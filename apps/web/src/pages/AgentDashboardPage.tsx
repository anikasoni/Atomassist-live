import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shell } from "../components/Shell";
import { EmptyState, ErrorMessage, StatusBadge } from "../components/ui";
import { api, ApiError, Session } from "../lib/api";
import { clearAgentAuth, getAgentToken, getAgentUser } from "../lib/auth";

export function AgentDashboardPage() {
  const navigate = useNavigate();
  const token = getAgentToken();
  const user = getAgentUser();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [lastInviteLink, setLastInviteLink] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function loadSessions() {
    if (!token) {
      navigate("/agent/login");
      return;
    }

    setError("");

    try {
      const result = await api.listSessions(token);
      setSessions(result.sessions);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function createSession() {
    if (!token) return;

    setCreating(true);
    setError("");

    try {
      const result = await api.createSession(token);
      const frontendInvite = `${window.location.origin}/join/${result.inviteToken}`;
      setLastInviteLink(frontendInvite);
      await navigator.clipboard.writeText(frontendInvite).catch(() => {});
      await loadSessions();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to create session");
    } finally {
      setCreating(false);
    }
  }

  function logout() {
    clearAgentAuth();
    navigate("/agent/login");
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Agent Dashboard</h1>
            <p className="mt-2 text-slate-400">
              Signed in as {user?.displayName ?? "Demo Agent"}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={createSession}
              disabled={creating}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create Support Session"}
            </button>
            <button
              onClick={logout}
              className="rounded-xl border border-white/10 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Logout
            </button>
          </div>
        </div>

        {lastInviteLink && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="font-semibold text-emerald-200">
              Session created. Customer invite copied to clipboard.
            </p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <input
                readOnly
                value={lastInviteLink}
                className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
              />
              <button
                onClick={() => navigator.clipboard.writeText(lastInviteLink)}
                className="rounded-xl bg-white px-4 py-3 font-semibold text-slate-950"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {error && <ErrorMessage message={error} />}

        {loading ? (
          <p className="text-slate-400">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            body="Create your first support session to generate a customer invite link."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-t border-white/10">
                    <td className="px-4 py-3 font-mono text-xs">{session.id}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(session.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link className="text-cyan-300 hover:text-cyan-200" to={`/agent/session/${session.id}`}>
                          Manage
                        </Link>
                        <Link className="text-cyan-300 hover:text-cyan-200" to={`/session/${session.id}/history`}>
                          History
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}