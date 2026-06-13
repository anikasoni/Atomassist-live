import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../components/Shell";
import { ErrorMessage } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { getAgentToken, saveAgentAuth } from "../lib/auth";

export function AgentLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("agent@demo.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function verifyExistingLogin() {
      const token = getAgentToken();

      if (!token) return;

      try {
        const result = await api.me(token);

        if (result.user.role === "AGENT" || result.user.role === "ADMIN") {
          saveAgentAuth(token, result.user);
          navigate("/agent/dashboard");
        }
      } catch {
        // stale token stays handled by ProtectedAgentRoute if user navigates manually
      }
    }

    void verifyExistingLogin();
  }, [navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await api.loginAgent(email, password);
      saveAgentAuth(result.token, result.user);
      navigate("/agent/dashboard");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold">Agent Login</h1>
        <p className="mt-2 text-slate-400">
          Use demo credentials to create and manage support sessions.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          {error && <ErrorMessage message={error} />}

          <label className="block">
            <span className="text-sm text-slate-300">Email</span>
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-400"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Password</span>
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-400"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button
            disabled={loading}
            className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="text-xs text-slate-500">
            Demo: agent@demo.com / demo123
          </p>
        </form>
      </div>
    </Shell>
  );
}