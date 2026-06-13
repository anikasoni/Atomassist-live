import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Socket } from "socket.io-client";
import { MediaRoom } from "../components/media/MediaRoom";
import { Shell } from "../components/Shell";
import { ErrorMessage, StatusBadge } from "../components/ui";
import { api, ApiError } from "../lib/api";
import type { ChatMessage, Participant, Session } from "../lib/api";
import {
  getAgentToken,
  getCustomerSessionId,
  getCustomerToken,
} from "../lib/auth";
import { createRealtimeSocket } from "../lib/socket";
import { formatDurationSeconds } from "../lib/time";

interface RoomState {
  session: Session | null;
}

interface Ack {
  ok: boolean;
  error?: {
    code: string;
    message: string;
  };
}

function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes) return "";

  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CallPlaceholderPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingIdRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
  const [serverRecordingId, setServerRecordingId] = useState<string | null>(null);
  const [serverRecordingStatus, setServerRecordingStatus] = useState("");

  const role = searchParams.get("role");

  const token = useMemo(() => {
    if (role === "customer") {
      return getCustomerToken();
    }

    if (role === "agent") {
      return getAgentToken();
    }

    if (sessionId && getCustomerSessionId() === sessionId) {
      return getCustomerToken();
    }

    return getAgentToken() ?? getCustomerToken();
  }, [role, sessionId]);

  const isAgent = role === "agent";

  useEffect(() => {
    if (!sessionId || !token) {
      setError("Missing session access. Please join again.");
      return;
    }

    const socket = createRealtimeSocket(token);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionStatus("connected");

      socket.emit("session:join", { sessionId }, (ack: Ack) => {
        if (!ack?.ok) {
          setError(ack?.error?.message ?? "Failed to join session");
        }
      });
    });

    socket.on("connect_error", (err) => {
      setConnectionStatus("error");
      setError(err.message);
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    socket.on("session:state", (state: RoomState) => {
      if (!state.session) return;

      setSession(state.session);
      setParticipants(state.session.participants ?? []);
      setMessages(state.session.chatMessages ?? []);
    });

    socket.on("chat:message", ({ message }: { message: ChatMessage }) => {
      setMessages((current) => {
        if (current.some((existing) => existing.id === message.id)) {
          return current;
        }

        return [...current, message];
      });
    });

    socket.on("session:ended", () => {
      setConnectionStatus("ended");
      setSession((current) =>
        current ? { ...current, status: "ENDED" } : current
      );
      socket.disconnect();
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!recording || !recordingStartedAtRef.current) return;

    const recordingTimerId = window.setInterval(() => {
      if (!recordingStartedAtRef.current) return;

      setRecordingElapsedSeconds(
        Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)
      );
    }, 1000);

    return () => {
      window.clearInterval(recordingTimerId);
    };
  }, [recording]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();

    if (!draft.trim() || !sessionId || !socketRef.current) return;

    setSending(true);

    socketRef.current.emit(
      "chat:send",
      {
        sessionId,
        body: draft.trim(),
      },
      (ack: Ack) => {
        setSending(false);

        if (!ack?.ok) {
          setError(ack?.error?.message ?? "Failed to send message");
          return;
        }

        setDraft("");
      }
    );
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !sessionId || !token || !socketRef.current) return;

    setUploading(true);
    setError("");

    try {
      const result = await api.uploadSessionFile(token, sessionId, file);

      socketRef.current.emit(
        "file:uploaded",
        {
          sessionId,
          messageId: result.message.id,
        },
        (ack: Ack) => {
          if (!ack?.ok) {
            setError(ack?.error?.message ?? "File uploaded but realtime broadcast failed");
            setMessages((current) => {
              if (current.some((item) => item.id === result.message.id)) {
                return current;
              }

              return [...current, result.message];
            });
          }
        }
      );
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("File upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function downloadFile(message: ChatMessage) {
    if (!token || !message.file) return;

    try {
      await api.downloadFile(token, message.file.id, message.file.originalName);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Download failed");
    }
  }

  async function uploadRecordingBlob(blob: Blob) {
    if (!token || !sessionId || !recordingIdRef.current) {
      setError("Recording upload failed because recording lifecycle was not initialized.");
      return;
    }

    setRecordingStatus("Processing and uploading tab recording...");

    try {
      await api.uploadRecordingBlob(
        token,
        sessionId,
        recordingIdRef.current,
        blob
      );

      setRecordingStatus("Tab recording is READY in session history.");
      recordingIdRef.current = null;
      recordingStartedAtRef.current = null;
      setRecordingElapsedSeconds(0);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Recording upload failed");
      setRecordingStatus("");
    }
  }

  async function startRecording() {
    if (!isAgent) return;

    setError("");
    setRecordingStatus("");

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      if (!token || !sessionId) {
        throw new Error("Missing agent session token for recording.");
      }

      const startedRecording = await api.startSessionRecording(token, sessionId);

      recordingIdRef.current = startedRecording.recording.id;
      recordingStartedAtRef.current = Date.now();
      setRecordingElapsedSeconds(0);

      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: "video/webm",
        });

        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        setRecording(false);

        if (blob.size > 0) {
          void uploadRecordingBlob(blob);
        }
      };

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      });

      recorder.start(1000);
      setRecording(true);
      setRecordingStatus("Recording IN_PROGRESS. Select the AtomAssist tab/window for best results.");
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Could not start recording");
      setRecording(false);
      setRecordingStatus("");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      setRecordingStatus("Recording PROCESSING. Finalizing local capture...");
      mediaRecorderRef.current.stop();
    }
  }

  async function startServerRecording() {
    if (!token || !sessionId || !isAgent) return;

    setError("");
    setServerRecordingStatus("Starting experimental server-side SFU recording...");

    try {
      const result = await api.startServerSideRecording(token, sessionId);

      setServerRecordingId(result.recording.id);
      setServerRecordingStatus(
        `Server recording IN_PROGRESS. Tracks: ${result.serverRecording.tracks
          .map((track) => track.kind)
          .join(", ")}`
      );
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("Server-side recording failed to start");

      setServerRecordingStatus("");
      setServerRecordingId(null);
    }
  }

  async function stopServerRecording() {
    if (!token || !sessionId || !serverRecordingId) return;

    setServerRecordingStatus("Server recording PROCESSING. Stopping FFmpeg...");

    try {
      const result = await api.stopServerSideRecording(
        token,
        sessionId,
        serverRecordingId
      );

      if (result.recording.status === "READY") {
        setServerRecordingStatus("Server recording READY in session history.");
      } else {
        setServerRecordingStatus(`Server recording status: ${result.recording.status}`);
      }

      setServerRecordingId(null);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("Server-side recording failed to stop");

      setServerRecordingStatus("");
      setServerRecordingId(null);
    }
  }

  function leaveCall() {
    socketRef.current?.emit("session:leave", {}, () => {
      socketRef.current?.disconnect();

      if (isAgent) {
        navigate("/agent/dashboard");
      } else {
        navigate("/");
      }
    });
  }

  function endSession() {
    if (!sessionId || !socketRef.current) return;

    setEnding(true);

    socketRef.current.emit(
      "session:end",
      {
        sessionId,
        reason: "Ended from call room",
      },
      (ack: Ack) => {
        setEnding(false);

        if (!ack?.ok) {
          setError(ack?.error?.message ?? "Failed to end session");
        }
      }
    );
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              Live SFU Call - Chat - File Sharing - Tab Recording
            </div>

            <h1 className="text-3xl font-bold">Live Video Support Room</h1>
            <p className="mt-2 font-mono text-sm text-slate-400">{sessionId}</p>
            <p className="mt-2 text-sm text-slate-500">
              Realtime connection: {connectionStatus}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {session && <StatusBadge status={session.status} />}

            {isAgent && session?.status !== "ENDED" && (
              recording ? (
                <button
                  onClick={stopRecording}
                  className="rounded-xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-200"
                >
                  Stop Tab Recording
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 font-semibold text-amber-100 hover:bg-amber-300/20"
                >
                  Start Tab Recording
                </button>
              )
            )}

            {isAgent && session?.status !== "ENDED" && (
              serverRecordingId ? (
                <button
                  onClick={stopServerRecording}
                  className="rounded-xl bg-violet-300 px-4 py-3 font-semibold text-slate-950 hover:bg-violet-200"
                >
                  Stop Server Recording
                </button>
              ) : (
                <button
                  onClick={startServerRecording}
                  className="rounded-xl border border-violet-300/40 bg-violet-300/10 px-4 py-3 font-semibold text-violet-100 hover:bg-violet-300/20"
                >
                  Start Server Recording
                </button>
              )
            )}

            <button
              onClick={leaveCall}
              className="rounded-xl border border-white/10 px-4 py-3 font-semibold hover:bg-white/10"
            >
              Leave Call
            </button>

            {isAgent && (
              <button
                onClick={endSession}
                disabled={ending || session?.status === "ENDED"}
                className="rounded-xl bg-rose-400 px-4 py-3 font-semibold text-slate-950 hover:bg-rose-300 disabled:opacity-60"
              >
                {ending ? "Ending..." : "End Session"}
              </button>
            )}
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {recordingStatus && (
          <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
            <div>{recordingStatus}</div>
            {recording && (
              <div className="mt-1 text-xs text-amber-200">
                Recording duration: {formatDurationSeconds(recordingElapsedSeconds)}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            {socketRef.current && sessionId && connectionStatus === "connected" ? (
              <MediaRoom
                socket={socketRef.current}
                sessionId={sessionId}
                enabled={connectionStatus === "connected" && session?.status !== "ENDED"}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="aspect-video rounded-2xl border border-white/10 bg-slate-900 p-5">
                  <p className="text-sm text-slate-400">Local camera loading...</p>
                </div>
                <div className="aspect-video rounded-2xl border border-white/10 bg-slate-900 p-5">
                  <p className="text-sm text-slate-400">Remote participant loading...</p>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="font-semibold">Participants</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="rounded-xl border border-white/10 bg-slate-900 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{participant.displayName}</p>
                        <p className="text-sm text-slate-400">
                          {participant.role}
                        </p>
                      </div>
                      <span
                        className={
                          participant.status === "CONNECTED"
                            ? "text-sm text-emerald-300"
                            : participant.status === "RECONNECTING"
                              ? "text-sm text-amber-300"
                              : "text-sm text-slate-400"
                        }
                      >
                        {participant.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Customer disconnects are held for a 60-second reconnect window.
                If the customer does not return, the session auto-ends and the invite expires.
              </p>
            </div>
          </section>

          <aside className="flex h-[640px] flex-col rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 p-4">
              <h2 className="font-semibold">In-call Chat</h2>
              <p className="text-xs text-slate-500">
                Text messages and shared files are persisted to the session record.
              </p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="text-sm text-slate-500">No messages yet.</p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="rounded-xl bg-slate-900 p-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-cyan-200">
                        {message.senderParticipant?.displayName ?? "Participant"}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </p>
                    </div>

                    {message.messageType === "FILE" && message.file ? (
                      <button
                        onClick={() => void downloadFile(message)}
                        className="mt-2 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-left hover:bg-cyan-400/20"
                      >
                        <p className="text-sm font-semibold text-cyan-100">
                          Download file
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-300">
                          {message.file.originalName}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {message.file.mimeType} ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â· {formatFileSize(message.file.sizeBytes)}
                        </p>
                      </button>
                    ) : (
                      <p className="text-sm text-slate-200">{message.body}</p>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="border-t border-white/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="cursor-pointer rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/10">
                  {uploading ? "Uploading..." : "Attach File"}
                  <input
                    type="file"
                    hidden
                    disabled={uploading || session?.status === "ENDED"}
                    onChange={uploadFile}
                  />
                </label>

                <p className="text-xs text-slate-500">Max 10 MB</p>
              </div>

              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type a message..."
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                />
                <button
                  disabled={sending || !draft.trim()}
                  className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            </form>
          </aside>
        </div>

        <Link
          to={`/session/${sessionId}/history`}
          className="inline-block text-sm text-cyan-300 hover:text-cyan-200"
        >
          {"View persisted session history ->"}
        </Link>
      </div>
    </Shell>
  );
}