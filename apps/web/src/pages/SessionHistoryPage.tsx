import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import { ErrorMessage, StatusBadge } from "../components/ui";
import { api, ApiError, ChatMessage, Recording, Session } from "../lib/api";
import { getAgentToken, getCustomerToken } from "../lib/auth";

function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes) return "";

  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SessionHistoryPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");

  async function downloadHistoryFile(message: ChatMessage) {
    const token = getAgentToken() ?? getCustomerToken();

    if (!token || !message.file) return;

    try {
      await api.downloadFile(token, message.file.id, message.file.originalName);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Download failed");
    }
  }

  async function downloadRecording(recording: Recording) {
    const token = getAgentToken() ?? getCustomerToken();

    if (!token || !sessionId) return;

    try {
      await api.downloadRecording(token, recording.id, sessionId);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Recording download failed");
    }
  }

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
  }, [sessionId, navigate]);

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
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
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

            <aside className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="font-semibold">Participants</h2>
                <div className="mt-4 space-y-3">
                  {session.participants?.map((participant) => (
                    <div key={participant.id} className="rounded-xl bg-slate-900 p-4">
                      <p className="font-medium">{participant.displayName}</p>
                      <p className="text-sm text-slate-400">
                        {participant.role} - {participant.status}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="font-semibold">Tab Recordings</h2>
                <div className="mt-4 space-y-3">
                  {session.recordings?.length ? (
                    session.recordings.map((recording) => (
                      <button
                        key={recording.id}
                        onClick={() => void downloadRecording(recording)}
                        className="w-full rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-left hover:bg-amber-300/20"
                      >
                        <p className="text-sm font-semibold text-amber-100">
                          Download tab recording
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Status: {recording.status}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-600">
                          {new Date(recording.startedAt).toLocaleString()}
                        </p>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No tab recordings yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="font-semibold">Chat and Files</h2>
                <div className="mt-4 space-y-3">
                  {session.chatMessages?.length ? (
                    session.chatMessages.map((message) => (
                      <div key={message.id} className="rounded-xl bg-slate-900 p-4">
                        <p className="text-xs text-cyan-200">
                          {message.senderParticipant?.displayName ?? "Participant"}
                        </p>

                        {message.messageType === "FILE" && message.file ? (
                          <button
                            onClick={() => void downloadHistoryFile(message)}
                            className="mt-2 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-left hover:bg-cyan-400/20"
                          >
                            <p className="text-sm font-semibold text-cyan-100">
                              Download file
                            </p>
                            <p className="mt-1 break-all text-xs text-slate-300">
                              {message.file.originalName}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-500">
                              {message.file.mimeType} - {formatFileSize(message.file.sizeBytes)}
                            </p>
                          </button>
                        ) : (
                          <p className="mt-1 text-sm text-slate-200">{message.body}</p>
                        )}

                        <p className="mt-2 text-[10px] text-slate-600">
                          {new Date(message.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No chat messages yet.</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </Shell>
  );
}