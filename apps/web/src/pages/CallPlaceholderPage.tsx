import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Socket } from "socket.io-client";
import { Shell } from "../components/Shell";
import { ErrorMessage, StatusBadge } from "../components/ui";
import { MediaRoom } from "../components/media/MediaRoom";
import type { ChatMessage, Participant, Session } from "../lib/api";
import {
  getAgentToken,
  getCustomerSessionId,
  getCustomerToken,
} from "../lib/auth";
import { createRealtimeSocket } from "../lib/socket";

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

export function CallPlaceholderPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);

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
              Live SFU Call · Self-hosted mediasoup
            </div>

            <h1 className="text-3xl font-bold">Live Video Support Room</h1>
            <p className="mt-2 font-mono text-sm text-slate-400">{sessionId}</p>
            <p className="mt-2 text-sm text-slate-500">
              Realtime connection: {connectionStatus}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {session && <StatusBadge status={session.status} />}

            <button
              onClick={leaveCall}
              className="rounded-xl border border-white/10 px-4 py-3 font-semibold hover:bg-white/10"
            >
              Leave
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
                  <p className="text-sm text-slate-400">Local video loading...</p>
                </div>
                <div className="aspect-video rounded-2xl border border-white/10 bg-slate-900 p-5">
                  <p className="text-sm text-slate-400">Remote video loading...</p>
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
                Customer disconnects are held for a 60-second reconnect window. If the customer does not return, the session auto-ends and the invite expires.
              </p>
            </div>
          </section>

          <aside className="flex h-[640px] flex-col rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 p-4">
              <h2 className="font-semibold">In-call Chat</h2>
              <p className="text-xs text-slate-500">
                Messages are persisted to the session record.
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
                    <p className="text-sm text-slate-200">{message.body}</p>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="border-t border-white/10 p-4">
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
          View persisted session history →
        </Link>
      </div>
    </Shell>
  );
}