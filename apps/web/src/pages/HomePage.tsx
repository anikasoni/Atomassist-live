import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";

export function HomePage() {
  return (
    <Shell>
      <div className="flex min-h-[70vh] flex-col justify-center">
        <div className="mb-6 inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
          Hackathon Phase 3 · Session Flow
        </div>

        <h1 className="max-w-3xl text-5xl font-bold tracking-tight md:text-7xl">
          AtomAssist Live
        </h1>

        <p className="mt-6 max-w-2xl text-xl text-slate-300">
          Self-hosted real-time video support platform.
        </p>

        <p className="mt-4 max-w-3xl text-slate-400">
          Agents can create secure support sessions and invite customers through
          browser links. WebRTC SFU calling comes in the next media phase.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            to="/agent/login"
            className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
          >
            Agent Login
          </Link>
          <Link
            to="/agent/dashboard"
            className="rounded-xl border border-white/10 px-5 py-3 font-semibold text-white hover:bg-white/10"
          >
            Open Dashboard
          </Link>
        </div>
      </div>
    </Shell>
  );
}