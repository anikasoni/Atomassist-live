import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import { ErrorMessage } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { clearAgentAuth, getAgentToken, saveAgentAuth } from "../lib/auth";

export function AgentLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const next = searchParams.get("next");
  const requiredRole = searchParams.get("role");

  const isAdminLogin = requiredRole === "admin" || next === "/admin";

  const [email, setEmail] = useState(isAdminLogin ? "admin@demo.com" : "agent@demo.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function redirectForRole(role: "AGENT" | "CUSTOMER" | "ADMIN") {
    if (role === "ADMIN") {
      navigate(next ?? "/admin");
      return;
    }

    if (role === "AGENT") {
      navigate("/agent/dashboard");
      return;
    }

    navigate("/");
  }

  useEffect(() => {
    async function verifyExistingLogin() {
      const token = getAgentToken();

      if (!token) return;

      try {
        const result = await api.me(token);

        if (isAdminLogin && result.user.role !== "ADMIN") {
          return;
        }

        if (result.user.role === "AGENT" || result.user.role === "ADMIN") {
          saveAgentAuth(token, result.user);
          redirectForRole(result.user.role);
        }
      } catch {
        clearAgentAuth();
      }
    }

    void verifyExistingLogin();
  }, [isAdminLogin, next]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await api.loginAgent(email, password);

      if (isAdminLogin && result.user.role !== "ADMIN") {
        clearAgentAuth();
        setError("Admin access required. Please sign in with the admin demo account.");
        return;
      }

      saveAgentAuth(result.token, result.user);
      redirectForRole(result.user.role);
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
        <div className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
          {isAdminLogin ? "Admin sign-in required" : "Agent sign-in"}
        </div>

        <h1 className="text-3xl font-bold">
          {isAdminLogin ? "Admin Login" : "Agent Login"}
        </h1>

        <p className="mt-2 text-slate-400">
          {isAdminLogin
            ? "Sign in with an admin account to access the control dashboard."
            : "Sign in to create and manage support sessions."}
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
            {loading ? "Signing in..." : isAdminLogin ? "Sign in as Admin" : "Sign in"}
          </button>

          <div className="rounded-xl bg-slate-950 p-4 text-xs text-slate-400">
            <p>Agent demo: agent@demo.com / demo123</p>
            <p className="mt-1">Admin demo: admin@demo.com / demo123</p>
          </div>
        </form>
      </div>
    </Shell>
  );
}