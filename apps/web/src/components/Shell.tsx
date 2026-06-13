import { Link } from "react-router-dom";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-bold tracking-tight">
            AtomAssist Live
          </Link>
          <nav className="flex gap-4 text-sm text-slate-300">
            <Link className="hover:text-white" to="/agent/login">
              Agent
            </Link>
            <Link className="hover:text-white" to="/agent/dashboard">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">{children}</section>
    </main>
  );
}