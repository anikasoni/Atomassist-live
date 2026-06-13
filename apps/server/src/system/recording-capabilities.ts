import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RecordingCapabilities {
  tabRecordingMvp: {
    available: boolean;
    description: string;
  };
  serverSideSfuRecording: {
    available: boolean;
    ffmpegAvailable: boolean;
    mode: "disabled" | "ready_for_spike";
    description: string;
    productionPath: string[];
  };
}

export async function getRecordingCapabilities(): Promise<RecordingCapabilities> {
  let ffmpegAvailable = false;

  try {
    await execFileAsync("ffmpeg", ["-version"], {
      timeout: 3000,
    });

    ffmpegAvailable = true;
  } catch {
    ffmpegAvailable = false;
  }

  return {
    tabRecordingMvp: {
      available: true,
      description:
        "Browser tab recording is available. The agent selects the AtomAssist tab/window, records it in the browser, and uploads the WebM artifact to the backend.",
    },
    serverSideSfuRecording: {
      available: false,
      ffmpegAvailable,
      mode: ffmpegAvailable ? "ready_for_spike" : "disabled",
      description:
        ffmpegAvailable
          ? "FFmpeg is available. The project is ready for an isolated server-side SFU recording spike."
          : "FFmpeg is not available on this machine. True SFU-side recording needs FFmpeg or GStreamer.",
      productionPath: [
        "Consume mediasoup producers server-side",
        "Forward RTP from mediasoup PlainTransport to FFmpeg or GStreamer",
        "Mux audio and video into WebM/MP4",
        "Persist status as IN_PROGRESS, PROCESSING, READY, or FAILED",
        "Store artifact in object storage",
      ],
    },
  };
}