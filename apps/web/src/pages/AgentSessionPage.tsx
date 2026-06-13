import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import { ErrorMessage, StatusBadge } from "../components/ui";
import { api, ApiError, Session } from "../lib/api";
import { getAgentToken } from "../lib/auth";

export function AgentSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const token = getAgentToken();

  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);

  async function loadSession() {
    if (!token) {
      navigate("/agent/login");
      return;
    }

    if (!sessionId) return;

    try {
      const result = await api.getSession(token, sessionId);
      setSession(result.session);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load session");
    }
  }

  useEffect(() => {
    void loadSession();
  }, [sessionId]);

  async function endSession() {
    if (!token || !sessionId) return;

    setEnding(true);

    try {
      const result = await api.endSession(token, sessionId, "Ended from Phase 3 UI");
      setSession(result.session);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to end session");
    } finally {
      setEnding(false);
    }
  }

  if (!session) {
    return (
      <Shell>
        {error ? <ErrorMessage message={error} /> : <p className="text-slate-400">Loading session...</p>}
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Session</h1>
            <p className="mt-2 font-mono text-sm text-slate-400">{session.id}</p>
          </div>
          <StatusBadge status={session.status} />
        </div>

        {error && <ErrorMessage message={error} />}

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to={`/call/${session.id}?role=agent`}
            className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5 hover:bg-cyan-400/20"
          >
            <h2 className="font-semibold text-cyan-200">Open Call Room</h2>
            <p className="mt-2 text-sm text-slate-400">
              Placeholder now. WebRTC comes in the media phase.
            </p>
          </Link>

          <Link
            to={`/session/${session.id}/history`}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10"
          >
            <h2 className="font-semibold">View History</h2>
            <p className="mt-2 text-sm text-slate-400">
              See persisted join/end events.
            </p>
          </Link>

          <button
            disabled={session.status === "ENDED" || ending}
            onClick={endSession}
            className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5 text-left hover:bg-rose-400/20 disabled:opacity-50"
          >
            <h2 className="font-semibold text-rose-200">
              {ending ? "Ending..." : "End Session"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Cleanly ends the support session.
            </p>
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">Participants</h2>
          <div className="mt-4 space-y-3">
            {session.participants?.length ? (
              session.participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between rounded-xl bg-slate-900 p-4">
                  <div>
                    <p className="font-medium">{participant.displayName}</p>
                    <p className="text-sm text-slate-400">{participant.role}</p>
                  </div>
                  <span className="text-sm text-slate-300">{participant.status}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No participants yet.</p>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}