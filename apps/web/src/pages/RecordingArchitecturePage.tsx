import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";
import { ErrorMessage } from "../components/ui";
import { api, RecordingCapabilities } from "../lib/api";

export function RecordingArchitecturePage() {
  const [capabilities, setCapabilities] =
    useState<RecordingCapabilities | null>(null);
  const [error, setError] = useState("");

  async function loadCapabilities() {
    try {
      const result = await api.getRecordingCapabilities();
      setCapabilities(result.capabilities);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load recording capabilities"
      );
    }
  }

  useEffect(() => {
    void loadCapabilities();
  }, []);

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
              Recording Architecture
            </div>

            <h1 className="text-3xl font-bold">Recording Strategy</h1>

            <p className="mt-2 max-w-3xl text-slate-400">
              AtomAssist currently ships a stable browser tab recording MVP and
              documents the production path for true SFU-side recording.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void loadCapabilities()}
              className="rounded-xl border border-white/10 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Refresh
            </button>

            <Link
              to="/admin"
              className="rounded-xl border border-white/10 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Back to Admin
            </Link>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {!capabilities ? (
          <p className="text-slate-400">Loading recording capabilities...</p>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6">
                <h2 className="text-lg font-semibold text-emerald-100">
                  Current: Browser Tab Recording MVP
                </h2>

                <p className="mt-3 text-sm text-slate-300">
                  {capabilities.tabRecordingMvp.description}
                </p>

                <div className="mt-5 rounded-xl bg-slate-950 p-4 text-sm text-slate-400">
                  <p>Status: Available</p>
                  <p>Artifact: WebM uploaded to backend</p>
                  <p>Lifecycle: IN_PROGRESS - PROCESSING - READY</p>
                  <p>Use case: Reliable hackathon and product MVP recording</p>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-6">
                <h2 className="text-lg font-semibold text-amber-100">
                  Production Upgrade: SFU-Side Recording
                </h2>

                <p className="mt-3 text-sm text-slate-300">
                  {capabilities.serverSideSfuRecording.description}
                </p>

                <div className="mt-5 rounded-xl bg-slate-950 p-4 text-sm text-slate-400">
                  <p>
                    FFmpeg available:{" "}
                    {capabilities.serverSideSfuRecording.ffmpegAvailable
                      ? "Yes"
                      : "No"}
                  </p>
                  <p>Mode: {capabilities.serverSideSfuRecording.mode}</p>
                  <p>Status: documented and isolated from stable media flow</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold">
                True SFU Recording Production Path
              </h2>

              <div className="mt-5 grid gap-3">
                {capabilities.serverSideSfuRecording.productionPath.map(
                  (item, index) => (
                    <div
                      key={item}
                      className="rounded-xl border border-white/10 bg-slate-900 p-4"
                    >
                      <p className="text-sm text-slate-300">
                        <span className="mr-3 font-mono text-cyan-200">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {item}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-6">
              <h2 className="text-lg font-semibold text-cyan-100">
                Judge-Facing Explanation
              </h2>

              <p className="mt-3 text-sm text-slate-300">
                The live call uses a self-hosted mediasoup SFU. The recording
                feature is currently implemented as a browser tab recording MVP
                for reliability. The architecture clearly separates this MVP
                from the production SFU-side recording path, which would consume
                RTP server-side and mux audio/video through FFmpeg or GStreamer.
              </p>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}