import { Link, useParams } from "react-router-dom";
import { Shell } from "../components/Shell";

export function CallPlaceholderPage() {
  const { sessionId } = useParams();

  return (
    <Shell>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="mb-6 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          Phase 3 Placeholder
        </div>

        <h1 className="text-3xl font-bold">Call Room</h1>
        <p className="mt-2 font-mono text-sm text-slate-400">{sessionId}</p>

        <p className="mt-6 max-w-2xl text-slate-300">
          The session join flow is working. In Phase 4 we add Socket.IO
          presence and chat. In Phase 5 we add mediasoup SFU audio/video.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="aspect-video rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Local video placeholder</p>
          </div>
          <div className="aspect-video rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Remote video placeholder</p>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            to="/agent/dashboard"
            className="rounded-xl border border-white/10 px-5 py-3 font-semibold hover:bg-white/10"
          >
            Agent Dashboard
          </Link>
          <Link
            to={`/session/${sessionId}/history`}
            className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
          >
            View History
          </Link>
        </div>
      </div>
    </Shell>
  );
}