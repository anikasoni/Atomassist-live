import type { Role, SessionStatus } from "@atomassist/shared";

const plannedRoles: Role[] = ["AGENT", "CUSTOMER", "ADMIN"];
const plannedSessionStates: SessionStatus[] = ["WAITING", "ACTIVE", "ENDED"];

export function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
        <div className="mb-6 inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
          Hackathon Phase 1 · Foundation Ready
        </div>

        <h1 className="max-w-3xl text-5xl font-bold tracking-tight md:text-7xl">
          AtomAssist Live
        </h1>

        <p className="mt-6 max-w-2xl text-xl text-slate-300">
          Self-hosted real-time video support platform.
        </p>

        <p className="mt-4 max-w-3xl text-slate-400">
          This project will route customer support audio/video through our own
          mediasoup SFU server in a later phase. No peer-to-peer WebRTC and no
          hosted video SDKs.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold text-cyan-200">Frontend</h2>
            <p className="mt-2 text-sm text-slate-400">
              React, Vite, TypeScript, Tailwind.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold text-cyan-200">Backend</h2>
            <p className="mt-2 text-sm text-slate-400">
              Express TypeScript API with health check.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold text-cyan-200">Next</h2>
            <p className="mt-2 text-sm text-slate-400">
              Auth, sessions, invites, chat, and mediasoup SFU.
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-slate-300">
          <p>Planned roles: {plannedRoles.join(", ")}</p>
          <p className="mt-2">
            Planned session states: {plannedSessionStates.join(", ")}
          </p>
        </div>
      </section>
    </main>
  );
}