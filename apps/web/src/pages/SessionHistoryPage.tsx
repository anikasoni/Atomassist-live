import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import { ErrorMessage, StatusBadge } from "../components/ui";
import { api, ApiError, Session } from "../lib/api";
import { getAgentToken, getCustomerToken } from "../lib/auth";

export function SessionHistoryPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      if (!sessionId) return;

      const token = getAgentToken() ?? getCustomerToken();

      if (!token) {
        navigate("/agent/login");
        return;
      }

      try {
        const result = await api.getSessionHistory(token, sessionId);
        setSession(result.session);
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load history");
      }
    }

    void loadHistory();
  }, [sessionId]);

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Session History</h1>
            <p className="mt-2 font-mono text-sm text-slate-400">{sessionId}</p>
          </div>
          {session && <StatusBadge status={session.status} />}
        </div>

        {error && <ErrorMessage message={error} />}

        {!error && !session && <p className="text-slate-400">Loading history...</p>}

        {session && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="font-semibold">Event Timeline</h2>
              <div className="mt-5 space-y-3">
                {session.events?.map((event) => (
                  <div key={event.id} className="rounded-xl bg-slate-900 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-sm text-cyan-200">{event.type}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="font-semibold">Participants</h2>
              <div className="mt-4 space-y-3">
                {session.participants?.map((participant) => (
                  <div key={participant.id} className="rounded-xl bg-slate-900 p-4">
                    <p className="font-medium">{participant.displayName}</p>
                    <p className="text-sm text-slate-400">
                      {participant.role} Â· {participant.status}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
      </div>
    </Shell>
  );
}