import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { clearAgentAuth, getAgentToken, saveAgentAuth } from "../lib/auth";

export function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<
    "checking" | "allowed" | "not_logged_in" | "not_admin"
  >("checking");

  useEffect(() => {
    async function verify() {
      const token = getAgentToken();

      if (!token) {
        setStatus("not_logged_in");
        return;
      }

      try {
        const result = await api.me(token);

        if (result.user.role !== "ADMIN") {
          setStatus("not_admin");
          return;
        }

        saveAgentAuth(token, result.user);
        setStatus("allowed");
      } catch {
        clearAgentAuth();
        setStatus("not_logged_in");
      }
    }

    void verify();
  }, []);

  if (status === "checking") {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-slate-300">Checking secure admin session...</p>
        </div>
      </main>
    );
  }

  if (status === "not_logged_in") {
    return <Navigate to="/agent/login?next=/admin&role=admin" replace />;
  }

  if (status === "not_admin") {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6">
          <h1 className="text-2xl font-bold text-amber-100">
            Admin access required
          </h1>
          <p className="mt-3 text-slate-300">
            You are currently signed in as an agent. The admin dashboard requires
            an admin account.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => {
                clearAgentAuth();
                window.location.href = "/agent/login?next=/admin&role=admin";
              }}
              className="rounded-xl bg-amber-300 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-200"
            >
              Sign in as Admin
            </button>

            <Link
              to="/agent/dashboard"
              className="rounded-xl border border-white/10 px-5 py-3 font-semibold text-white hover:bg-white/10"
            >
              Back to Agent Dashboard
            </Link>
          </div>

          <p className="mt-5 text-xs text-slate-500">
            Demo admin: admin@demo.com / demo123
          </p>
        </div>
      </main>
    );
  }

  return children;
}