import dgram from "node:dgram";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { prisma } from "../db/prisma.js";
import { mediaService } from "../media/media.service.js";

interface ActiveServerRecording {
  recordingId: string;
  sessionId: string;
  outputPath: string;
  sdpPath: string;
  ffmpegLogPath: string;
  process: ChildProcessWithoutNullStreams;
  consumers: Array<{
    producerId: string;
    kind: "audio" | "video";
    close: () => void;
  }>;
}

const activeRecordings = new Map<string, ActiveServerRecording>();

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreeUdpPort() {
  return new Promise<number>((resolve, reject) => {
    const socket = dgram.createSocket("udp4");

    socket.once("error", reject);

    socket.bind(0, "127.0.0.1", () => {
      const address = socket.address();

      if (typeof address === "string") {
        socket.close();
        reject(new Error("Could not allocate UDP port"));
        return;
      }

      const port = address.port;

      socket.close(() => resolve(port));
    });
  });
}

function codecName(mimeType: string) {
  return mimeType.split("/")[1] ?? mimeType;
}

function fmtpFromParameters(parameters?: Record<string, unknown>) {
  if (!parameters) return "";

  const parts = Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`);

  return parts.join(";");
}

function buildSdp(
  tracks: Array<{
    kind: "audio" | "video";
    port: number;
    rtpParameters: any;
  }>
) {
  const lines: string[] = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=AtomAssist Server SFU Recording",
    "c=IN IP4 127.0.0.1",
    "t=0 0",
  ];

  for (const track of tracks) {
    const codec = track.rtpParameters.codecs[0];
    const encoding = track.rtpParameters.encodings?.[0];
    const payloadType = codec.payloadType;
    const name = codecName(codec.mimeType);
    const clockRate = codec.clockRate;
    const channels = codec.channels;
    const ssrc = encoding?.ssrc;

    lines.push(
      `m=${track.kind} ${track.port} RTP/AVP ${payloadType}`,
      "a=recvonly",
      "a=rtcp-mux"
    );

    if (track.kind === "audio" && channels) {
      lines.push(`a=rtpmap:${payloadType} ${name}/${clockRate}/${channels}`);
    } else {
      lines.push(`a=rtpmap:${payloadType} ${name}/${clockRate}`);
    }

    const fmtp = fmtpFromParameters(codec.parameters);

    if (fmtp) {
      lines.push(`a=fmtp:${payloadType} ${fmtp}`);
    }

    if (ssrc) {
      lines.push(`a=ssrc:${ssrc} cname:atomassist-recording`);
    }
  }

  return `${lines.join("\r\n")}\r\n`;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export const serverSfuRecorder = {
  isRecording(recordingId: string) {
    return activeRecordings.has(recordingId);
  },

  async start(input: {
    sessionId: string;
    recordingId: string;
    outputPath: string;
  }) {
    if (activeRecordings.has(input.recordingId)) {
      throw new Error("Server-side recording already active");
    }

    const producers = mediaService.listSessionProducers(input.sessionId);

    const participants = await prisma.participant.findMany({
      where: {
        sessionId: input.sessionId,
      },
      select: {
        id: true,
        role: true,
        displayName: true,
      },
    });

    const customerParticipantIds = new Set(
      participants
        .filter((participant) => participant.role === "CUSTOMER")
        .map((participant) => participant.id)
    );

    const agentParticipantIds = new Set(
      participants
        .filter((participant) => participant.role === "AGENT")
        .map((participant) => participant.id)
    );

    // For an agent-triggered recording, prefer recording the customer stream.
    // Fallback to any video/audio producer if customer media is not available.
    const videoProducer =
      producers.find(
        (producer) =>
          producer.kind === "video" &&
          customerParticipantIds.has(producer.participantId)
      ) ??
      producers.find(
        (producer) =>
          producer.kind === "video" &&
          !agentParticipantIds.has(producer.participantId)
      ) ??
      producers.find((producer) => producer.kind === "video");

    const audioProducer =
      producers.find(
        (producer) =>
          producer.kind === "audio" &&
          videoProducer &&
          producer.participantId === videoProducer.participantId
      ) ??
      producers.find(
        (producer) =>
          producer.kind === "audio" &&
          customerParticipantIds.has(producer.participantId)
      ) ??
      producers.find((producer) => producer.kind === "audio");

    if (!videoProducer && !audioProducer) {
      throw new Error("No active SFU producers available to record");
    }

    const selectedProducers = [videoProducer, audioProducer].filter(
      Boolean
    ) as Array<{
      producerId: string;
      participantId: string;
      kind: "audio" | "video";
    }>;

    ensureDir(path.dirname(input.outputPath));

    const sdpPath = input.outputPath.replace(/\.webm$/i, ".sdp");
    const ffmpegLogPath = input.outputPath.replace(/\.webm$/i, ".ffmpeg.log");

    const trackSpecs: Array<{
      kind: "audio" | "video";
      producerId: string;
      port: number;
      rtpParameters: any;
      close: () => void;
      resume: () => Promise<void>;
    }> = [];

    for (const producer of selectedProducers) {
      const ffmpegRtpPort = await getFreeUdpPort();
      let plainTransportPort = await getFreeUdpPort();

      while (plainTransportPort === ffmpegRtpPort) {
        plainTransportPort = await getFreeUdpPort();
      }

      const consumer = await mediaService.createServerSideRtpConsumer({
        sessionId: input.sessionId,
        producerId: producer.producerId,
        rtpPort: ffmpegRtpPort,
        plainTransportPort,
      });

      trackSpecs.push({
        kind: consumer.kind,
        producerId: consumer.producerId,
        port: ffmpegRtpPort,
        rtpParameters: consumer.rtpParameters,
        close: consumer.close,
        resume: consumer.resume,
      });
    }

    const sdp = buildSdp(trackSpecs);
    fs.writeFileSync(sdpPath, sdp, "utf8");

    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y",
        "-protocol_whitelist",
        "file,udp,rtp",
        "-analyzeduration",
        "15000000",
        "-probesize",
        "15000000",
        "-i",
        sdpPath,
        "-c",
        "copy",
        "-f",
        "webm",
        input.outputPath,
      ],
      {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    const logStream = fs.createWriteStream(ffmpegLogPath, { flags: "a" });

    ffmpeg.stdout.pipe(logStream);
    ffmpeg.stderr.pipe(logStream);

    ffmpeg.once("exit", (code, signal) => {
      logStream.write(`\n[ffmpeg exited] code=${code} signal=${signal}\n`);
      logStream.end();

      const active = activeRecordings.get(input.recordingId);

      if (active) {
        for (const consumer of active.consumers) {
          consumer.close();
        }

        activeRecordings.delete(input.recordingId);
      }
    });

    ffmpeg.once("error", (error) => {
      logStream.write(`\n[ffmpeg error] ${error.message}\n`);
    });

    await wait(700);

    for (const track of trackSpecs) {
      await track.resume();
    }

    activeRecordings.set(input.recordingId, {
      recordingId: input.recordingId,
      sessionId: input.sessionId,
      outputPath: input.outputPath,
      sdpPath,
      ffmpegLogPath,
      process: ffmpeg,
      consumers: trackSpecs.map((track) => ({
        producerId: track.producerId,
        kind: track.kind,
        close: track.close,
      })),
    });

    return {
      outputPath: input.outputPath,
      sdpPath,
      ffmpegLogPath,
      tracks: trackSpecs.map((track) => ({
        producerId: track.producerId,
        kind: track.kind,
        port: track.port,
      })),
    };
  },

  async stop(recordingId: string) {
    const active = activeRecordings.get(recordingId);

    if (!active) {
      throw new Error("Server-side recording is not active");
    }

    const processClosed = new Promise<void>((resolve) => {
      active.process.once("exit", () => resolve());
    });

    if (!active.process.killed) {
      active.process.stdin.write("q");
      active.process.stdin.end();
    }

    await Promise.race([processClosed, wait(5000)]);

    if (!active.process.killed && activeRecordings.has(recordingId)) {
      active.process.kill("SIGINT");
      await wait(1000);
    }

    for (const consumer of active.consumers) {
      consumer.close();
    }

    activeRecordings.delete(recordingId);

    const exists = fs.existsSync(active.outputPath);
    const sizeBytes = exists ? fs.statSync(active.outputPath).size : 0;

    return {
      outputPath: active.outputPath,
      sdpPath: active.sdpPath,
      ffmpegLogPath: active.ffmpegLogPath,
      sizeBytes,
    };
  },
};