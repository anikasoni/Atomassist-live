import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";

export function NotFoundPage() {
  return (
    <Shell>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="mt-2 text-slate-400">This route does not exist.</p>
        <Link className="mt-6 inline-block rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950" to="/">
          Go home
        </Link>
      </div>
    </Shell>
  );
}