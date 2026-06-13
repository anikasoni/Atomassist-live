import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shell } from "../components/Shell";
import { ErrorMessage, StatusBadge } from "../components/ui";
import { api, ApiError, Session } from "../lib/api";
import { clearAgentAuth, getAgentToken, getAgentUser } from "../lib/auth";

interface AdminSession extends Session {
  _count?: {
    events?: number;
    chatMessages?: number;
    files?: number;
    recordings?: number;
  };
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const token = getAgentToken();
  const user = getAgentUser();

  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [endingSessionId, setEndingSessionId] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const stats = useMemo(() => {
    return {
      total: sessions.length,
      waiting: sessions.filter((session) => session.status === "WAITING").length,
      active: sessions.filter((session) => session.status === "ACTIVE").length,
      ended: sessions.filter((session) => session.status === "ENDED").length,
      participants: sessions.reduce(
        (sum, session) => sum + (session.participants?.length ?? 0),
        0
      ),
    };
  }, [sessions]);

  async function loadSessions() {
    if (!token) {
      navigate("/agent/login");
      return;
    }

    try {
      const result = await api.listSessions(token);
      setSessions(result.sessions as AdminSession[]);
      setLastRefreshedAt(new Date());
      setError("");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();

    const intervalId = window.setInterval(() => {
      void loadSessions();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  async function endSession(sessionId: string) {
    if (!token) return;

    setEndingSessionId(sessionId);
    setError("");

    try {
      await api.endSession(token, sessionId, "Ended by admin");
      await loadSessions();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to end session");
    } finally {
      setEndingSessionId(null);
    }
  }

  function logout() {
    clearAgentAuth();
    navigate("/agent/login");
  }

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm text-violet-200">
              Admin Control Center
            </div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="mt-2 text-slate-400">
              Signed in as {user?.displayName ?? "Admin"} · monitors all support sessions.
            </p>
            {lastRefreshedAt && (
              <p className="mt-1 text-xs text-slate-600">
                Auto-refreshing every 5 seconds · Last refresh{" "}
                {lastRefreshedAt.toLocaleTimeString()}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void loadSessions()}
              className="rounded-xl border border-white/10 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Refresh
            </button>
            <button
              onClick={logout}
              className="rounded-xl border border-white/10 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Logout
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Total sessions" value={stats.total} />
          <StatCard label="Waiting" value={stats.waiting} />
          <StatCard label="Active" value={stats.active} />
          <StatCard label="Ended" value={stats.ended} />
          <StatCard label="Participants" value={stats.participants} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-lg font-semibold">All Sessions</h2>
            <p className="mt-1 text-sm text-slate-500">
              Admin can monitor live sessions, inspect history, and force-end sessions.
            </p>
          </div>

          {loading ? (
            <p className="p-5 text-slate-400">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="p-5 text-slate-400">No sessions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Participants</th>
                    <th className="px-4 py-3">Events</th>
                    <th className="px-4 py-3">Chat</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Ended</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-t border-white/10">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-slate-300">
                          {session.id}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Agent: {session.agentId}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge status={session.status} />
                      </td>

                      <td className="px-4 py-3 text-slate-300">
                        {session.participants?.length ?? 0}
                      </td>

                      <td className="px-4 py-3 text-slate-300">
                        {session._count?.events ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-300">
                        {session._count?.chatMessages ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-400">
                        {new Date(session.createdAt).toLocaleString()}
                      </td>

                      <td className="px-4 py-3 text-slate-400">
                        {session.endedAt
                          ? new Date(session.endedAt).toLocaleString()
                          : "-"}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-3">
                          <Link
                            className="text-cyan-300 hover:text-cyan-200"
                            to={`/session/${session.id}/history`}
                          >
                            History
                          </Link>

                          <Link
                            className="text-cyan-300 hover:text-cyan-200"
                            to={`/call/${session.id}?role=agent`}
                          >
                            Room
                          </Link>

                          {session.status !== "ENDED" && (
                            <button
                              onClick={() => void endSession(session.id)}
                              disabled={endingSessionId === session.id}
                              className="text-rose-300 hover:text-rose-200 disabled:opacity-60"
                            >
                              {endingSessionId === session.id
                                ? "Ending..."
                                : "End"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}