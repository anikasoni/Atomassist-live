import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import { ErrorMessage, StatusBadge } from "../components/ui";
import { api, ApiError, ChatMessage, Recording, Session } from "../lib/api";
import { clearAgentAuth, getAgentToken, getCustomerToken } from "../lib/auth";
import { formatDateTime, formatDurationFromDates } from "../lib/time";

type ResolutionStatus = "OPEN" | "RESOLVED" | "ESCALATED";

function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes) return "";

  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function reviewBadgeClass(status: string) {
  if (status === "RESOLVED") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "ESCALATED") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }

  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

export function SessionHistoryPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [resolutionStatus, setResolutionStatus] =
    useState<ResolutionStatus>("OPEN");
  const [savingReview, setSavingReview] = useState(false);

  const agentToken = getAgentToken();
  const canEditReview = Boolean(agentToken);

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
      setReviewNotes(result.session.reviewNotes ?? "");
      setResolutionStatus(
        ((result.session.resolutionStatus as ResolutionStatus) ?? "OPEN")
      );
      setError("");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load history");
    }
  }

  async function saveReview() {
    if (!sessionId || !agentToken) return;

    setSavingReview(true);
    setError("");

    try {
      const result = await api.updateSessionReview(agentToken, sessionId, {
        resolutionStatus,
        reviewNotes,
      });

      setSession(result.session);
      setReviewNotes(result.session.reviewNotes ?? "");
      setResolutionStatus(
        ((result.session.resolutionStatus as ResolutionStatus) ?? "OPEN")
      );
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to save review");
    } finally {
      setSavingReview(false);
    }
  }

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

  function logout() {
    clearAgentAuth();
    navigate("/agent/login");
  }

  useEffect(() => {
    void loadHistory();
  }, [sessionId]);

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              Support Case Review
            </div>

            <h1 className="text-3xl font-bold">Session History</h1>
            <p className="mt-2 font-mono text-sm text-slate-400">{sessionId}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {session && <StatusBadge status={session.status} />}
            {session && (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${reviewBadgeClass(
                  session.resolutionStatus ?? "OPEN"
                )}`}
              >
                Review: {session.resolutionStatus ?? "OPEN"}
              </span>
            )}

            <Link
              to="/agent/dashboard"
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/10"
            >
              Agent Dashboard
            </Link>

            <button
              onClick={logout}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/10"
            >
              Logout
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {!error && !session && <p className="text-slate-400">Loading history...</p>}

        {session && (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <SummaryCard label="Session status" value={session.status} />
              <SummaryCard
                label="Call duration"
                value={formatDurationFromDates(session.startedAt, session.endedAt)}
              />
              <SummaryCard
                label="Participants"
                value={session.participants?.length ?? 0}
              />
              <SummaryCard
                label="Artifacts"
                value={
                  (session.chatMessages?.length ?? 0) +
                  (session.files?.length ?? 0) +
                  (session.recordings?.length ?? 0)
                }
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-lg font-semibold">Case Review</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Agent/admin review notes for support handoff, QA, and audit.
                  </p>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <InfoBlock label="Created" value={formatDateTime(session.createdAt)} />
                    <InfoBlock label="Started" value={formatDateTime(session.startedAt)} />
                    <InfoBlock label="Ended" value={formatDateTime(session.endedAt)} />
                  </div>

                  <div className="mt-5 space-y-4">
                    <label className="block">
                      <span className="text-sm text-slate-300">
                        Resolution status
                      </span>
                      <select
                        disabled={!canEditReview}
                        value={resolutionStatus}
                        onChange={(event) =>
                          setResolutionStatus(event.target.value as ResolutionStatus)
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-400 disabled:opacity-60"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="ESCALATED">ESCALATED</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm text-slate-300">
                        Review notes
                      </span>
                      <textarea
                        disabled={!canEditReview}
                        value={reviewNotes}
                        onChange={(event) => setReviewNotes(event.target.value)}
                        placeholder="Example: Customer issue was resolved after screen share. Shared troubleshooting PDF and confirmed reconnection behavior."
                        rows={6}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-60"
                      />
                    </label>

                    {canEditReview ? (
                      <button
                        onClick={() => void saveReview()}
                        disabled={savingReview}
                        className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                      >
                        {savingReview ? "Saving review..." : "Save Review"}
                      </button>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Customers can view the case record but cannot edit review notes.
                      </p>
                    )}

                    {session.reviewedAt && (
                      <p className="text-xs text-slate-500">
                        Last reviewed {formatDateTime(session.reviewedAt)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-lg font-semibold">Event Timeline</h2>
                  <div className="mt-5 space-y-3">
                    {session.events?.map((event) => (
                      <div key={event.id} className="rounded-xl bg-slate-900 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-mono text-sm text-cyan-200">
                            {event.type}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(event.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
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
                            {formatDateTime(recording.startedAt)}
                          </p>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        No tab recordings yet.
                      </p>
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
                            <p className="mt-1 text-sm text-slate-200">
                              {message.body}
                            </p>
                          )}

                          <p className="mt-2 text-[10px] text-slate-600">
                            {formatDateTime(message.createdAt)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        No chat messages yet.
                      </p>
                    )}
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}