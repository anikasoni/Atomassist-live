import { useEffect, useRef, useState } from "react";
import { Device } from "mediasoup-client";
import type { types as mediasoupTypes } from "mediasoup-client";
import type { Socket } from "socket.io-client";
import { ErrorMessage } from "../ui";

interface Ack<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface ProducerInfo {
  producerId: string;
  participantId: string;
  kind: "audio" | "video";
}

interface MediaRoomProps {
  socket: Socket;
  sessionId: string;
  enabled: boolean;
}

function emitAck<T>(
  socket: Socket,
  event: string,
  payload: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (ack: Ack<T>) => {
      if (!ack?.ok) {
        reject(new Error(ack?.error?.message ?? `${event} failed`));
        return;
      }

      resolve(ack.data as T);
    });
  });
}

export function MediaRoom({ socket, sessionId, enabled }: MediaRoomProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<mediasoupTypes.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupTypes.Transport | null>(null);
  const audioProducerRef = useRef<mediasoupTypes.Producer | null>(null);
  const videoProducerRef = useRef<mediasoupTypes.Producer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());

  const consumedProducerIdsRef = useRef<Set<string>>(new Set());
  const consumingProducerIdsRef = useRef<Set<string>>(new Set());
  const pendingProducerIdsRef = useRef<Set<string>>(new Set());

  const remoteConsumersRef = useRef<
    Map<
      string,
      {
        consumer: mediasoupTypes.Consumer;
        track: MediaStreamTrack;
      }
    >
  >(new Map());

  const [error, setError] = useState("");
  const [mediaStatus, setMediaStatus] = useState("idle");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    let syncIntervalId: number | undefined;

    async function consumeProducer(producerId: string) {
      if (!mounted) return;

      if (consumedProducerIdsRef.current.has(producerId)) return;
      if (consumingProducerIdsRef.current.has(producerId)) return;

      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;

      if (!device || !recvTransport) {
        pendingProducerIdsRef.current.add(producerId);
        return;
      }

      consumingProducerIdsRef.current.add(producerId);

      try {
        const consumerOptions = await emitAck<{
          id: string;
          producerId: string;
          kind: "audio" | "video";
          rtpParameters: mediasoupTypes.RtpParameters;
        }>(socket, "media:consume", {
          sessionId,
          producerId,
          rtpCapabilities: device.rtpCapabilities,
        });

        if (!mounted) return;

        const consumer = await recvTransport.consume({
          id: consumerOptions.id,
          producerId: consumerOptions.producerId,
          kind: consumerOptions.kind,
          rtpParameters: consumerOptions.rtpParameters,
        });

        if (!mounted) {
          consumer.close();
          return;
        }

        remoteConsumersRef.current.set(producerId, {
          consumer,
          track: consumer.track,
        });

        remoteStreamRef.current.addTrack(consumer.track);

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
          await remoteVideoRef.current.play().catch(() => {});
        }

        consumedProducerIdsRef.current.add(producerId);

        console.log("[media] consumed remote track", {
          producerId,
          consumerId: consumer.id,
          kind: consumer.kind,
          trackId: consumer.track.id,
        });
      } catch (err) {
        console.warn("[media] consume failed", producerId, err);
        consumedProducerIdsRef.current.delete(producerId);
        pendingProducerIdsRef.current.add(producerId);
      } finally {
        consumingProducerIdsRef.current.delete(producerId);
      }
    }

    async function syncRemoteProducers() {
      if (!mounted) return;
      if (!deviceRef.current || !recvTransportRef.current) return;

      try {
        const producers = await emitAck<ProducerInfo[]>(
          socket,
          "media:listProducers",
          { sessionId }
        );

        for (const producer of producers) {
          await consumeProducer(producer.producerId);
        }

        for (const producerId of pendingProducerIdsRef.current) {
          await consumeProducer(producerId);
        }

        pendingProducerIdsRef.current.clear();
      } catch (err) {
        console.warn("[media] producer sync failed", err);
      }
    }

    async function startMedia() {
      try {
        setError("");
        setMediaStatus("requesting camera/mic");

        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24 },
          },
        });

        if (!mounted) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = localStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          await localVideoRef.current.play().catch(() => {});
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }

        setMediaStatus("loading SFU device");

        const routerRtpCapabilities =
          await emitAck<mediasoupTypes.RtpCapabilities>(
            socket,
            "media:getRouterRtpCapabilities",
            { sessionId }
          );

        if (!mounted) return;

        const device = new Device();
        await device.load({ routerRtpCapabilities });
        deviceRef.current = device;

        setMediaStatus("creating send transport");

        const sendTransportOptions =
          await emitAck<mediasoupTypes.TransportOptions>(
            socket,
            "media:createWebRtcTransport",
            {
              sessionId,
              direction: "send",
            }
          );

        if (!mounted) return;

        const sendTransport = device.createSendTransport(sendTransportOptions);
        sendTransportRef.current = sendTransport;

        sendTransport.on(
          "connect",
          ({ dtlsParameters }, callback, errback) => {
            emitAck(socket, "media:connectTransport", {
              sessionId,
              transportId: sendTransport.id,
              dtlsParameters,
            })
              .then(() => callback())
              .catch((err) => errback(err as Error));
          }
        );

        sendTransport.on(
          "produce",
          ({ kind, rtpParameters, appData }, callback, errback) => {
            emitAck<{ id: string }>(socket, "media:produce", {
              sessionId,
              transportId: sendTransport.id,
              kind,
              rtpParameters,
              appData,
            })
              .then(({ id }) => callback({ id }))
              .catch((err) => errback(err as Error));
          }
        );

        const audioTrack = localStream.getAudioTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];

        if (audioTrack) {
          audioProducerRef.current = await sendTransport.produce({
            track: audioTrack,
            appData: { mediaTag: "mic" },
          });
        }

        if (videoTrack) {
          videoProducerRef.current = await sendTransport.produce({
            track: videoTrack,
            appData: { mediaTag: "camera" },
          });
        }

        setMediaStatus("creating receive transport");

        const recvTransportOptions =
          await emitAck<mediasoupTypes.TransportOptions>(
            socket,
            "media:createWebRtcTransport",
            {
              sessionId,
              direction: "recv",
            }
          );

        if (!mounted) return;

        const recvTransport = device.createRecvTransport(recvTransportOptions);
        recvTransportRef.current = recvTransport;

        recvTransport.on(
          "connect",
          ({ dtlsParameters }, callback, errback) => {
            emitAck(socket, "media:connectTransport", {
              sessionId,
              transportId: recvTransport.id,
              dtlsParameters,
            })
              .then(() => callback())
              .catch((err) => errback(err as Error));
          }
        );

        await syncRemoteProducers();

        syncIntervalId = window.setInterval(() => {
          void syncRemoteProducers();
        }, 2500);

        setMediaStatus("connected through SFU");
      } catch (err) {
        console.error("[media] start failed", err);
        setError(err instanceof Error ? err.message : "Media failed to start");
        setMediaStatus("error");
      }
    }

    function onNewProducer(payload: ProducerInfo) {
      console.log("[media] new remote producer", payload);
      void consumeProducer(payload.producerId);
    }

    function onProducerClosed(payload: { producerId: string }) {
      console.log("[media] remote producer closed", payload);

      consumedProducerIdsRef.current.delete(payload.producerId);
      consumingProducerIdsRef.current.delete(payload.producerId);
      pendingProducerIdsRef.current.delete(payload.producerId);

      const entry = remoteConsumersRef.current.get(payload.producerId);

      if (entry) {
        entry.consumer.close();
        remoteStreamRef.current.removeTrack(entry.track);
        entry.track.stop();
        remoteConsumersRef.current.delete(payload.producerId);
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    }

    function onParticipantMediaMayHaveChanged() {
      window.setTimeout(() => {
        void syncRemoteProducers();
      }, 500);
    }

    socket.on("media:newProducer", onNewProducer);
    socket.on("media:producerClosed", onProducerClosed);
    socket.on("participant:joined", onParticipantMediaMayHaveChanged);
    socket.on("participant:reconnected", onParticipantMediaMayHaveChanged);

    void startMedia();

    return () => {
      mounted = false;

      if (syncIntervalId) {
        window.clearInterval(syncIntervalId);
      }

      socket.off("media:newProducer", onNewProducer);
      socket.off("media:producerClosed", onProducerClosed);
      socket.off("participant:joined", onParticipantMediaMayHaveChanged);
      socket.off("participant:reconnected", onParticipantMediaMayHaveChanged);

      audioProducerRef.current?.close();
      videoProducerRef.current?.close();
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();

      audioProducerRef.current = null;
      videoProducerRef.current = null;
      sendTransportRef.current = null;
      recvTransportRef.current = null;
      deviceRef.current = null;

      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;

      for (const entry of remoteConsumersRef.current.values()) {
        entry.consumer.close();
        entry.track.stop();
      }

      remoteConsumersRef.current.clear();
      consumedProducerIdsRef.current.clear();
      consumingProducerIdsRef.current.clear();
      pendingProducerIdsRef.current.clear();

      remoteStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        remoteStreamRef.current.removeTrack(track);
      });

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    };
  }, [enabled, sessionId, socket]);

  function toggleMic() {
    const next = !micEnabled;
    setMicEnabled(next);

    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });

    if (next) {
      audioProducerRef.current?.resume();
    } else {
      audioProducerRef.current?.pause();
    }
  }

  function toggleCamera() {
    const next = !cameraEnabled;
    setCameraEnabled(next);

    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });

    if (next) {
      videoProducerRef.current?.resume();
    } else {
      videoProducerRef.current?.pause();
    }
  }

  return (
    <div className="space-y-4">
      {error && <ErrorMessage message={error} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-sm text-slate-300">Local video</p>
          </div>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full bg-black object-cover"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-sm text-slate-300">Remote video</p>
          </div>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="aspect-video w-full bg-black object-cover"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-slate-400">Media: {mediaStatus}</p>

        <div className="flex gap-3">
          <button
            onClick={toggleMic}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            {micEnabled ? "Mute Mic" : "Unmute Mic"}
          </button>

          <button
            onClick={toggleCamera}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            {cameraEnabled ? "Camera Off" : "Camera On"}
          </button>
        </div>
      </div>
    </div>
  );
}