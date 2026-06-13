import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { clearAgentAuth, getAgentToken, saveAgentAuth } from "../lib/auth";

export function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "allowed" | "blocked">(
    "checking"
  );

  useEffect(() => {
    async function verify() {
      const token = getAgentToken();

      if (!token) {
        setStatus("blocked");
        return;
      }

      try {
        const result = await api.me(token);

        if (result.user.role !== "ADMIN") {
          setStatus("blocked");
          return;
        }

        saveAgentAuth(token, result.user);
        setStatus("allowed");
      } catch {
        clearAgentAuth();
        setStatus("blocked");
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

  if (status === "blocked") {
    return <Navigate to="/agent/login" replace />;
  }

  return children;
}