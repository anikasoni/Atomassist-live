import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { setActiveSocketConnections } from "../metrics/metrics.service.js";
import { mediaService } from "../media/media.service.js";
import { logSessionEvent } from "../services/event.service.js";
import type { AuthUser } from "../types/auth.js";
import { verifyAuthToken } from "../utils/tokens.js";

const RECONNECT_GRACE_MS = 60_000;

const reconnectTimers = new Map<string, NodeJS.Timeout>();

const joinSchema = z.object({
  sessionId: z.string().min(1),
});

const chatSchema = z.object({
  sessionId: z.string().min(1),
  body: z.string().trim().min(1).max(1000),
});

const fileUploadedSchema = z.object({
  sessionId: z.string().min(1),
  messageId: z.string().min(1),
});

const endSessionSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().max(200).optional(),
});

const mediaSessionSchema = z.object({
  sessionId: z.string().min(1),
});

const createTransportSchema = z.object({
  sessionId: z.string().min(1),
  direction: z.enum(["send", "recv"]),
});

const connectTransportSchema = z.object({
  sessionId: z.string().min(1),
  transportId: z.string().min(1),
  dtlsParameters: z.any(),
});

const produceSchema = z.object({
  sessionId: z.string().min(1),
  transportId: z.string().min(1),
  kind: z.enum(["audio", "video"]),
  rtpParameters: z.any(),
  appData: z.record(z.string(), z.unknown()).optional(),
});

const consumeSchema = z.object({
  sessionId: z.string().min(1),
  producerId: z.string().min(1),
  rtpCapabilities: z.any(),
});

const resumeConsumerSchema = z.object({
  sessionId: z.string().min(1),
  consumerId: z.string().min(1),
});

const closeProducerSchema = z.object({
  sessionId: z.string().min(1),
  producerId: z.string().min(1),
});

type Ack =
  | { ok: true; data?: unknown }
  | { ok: false; error: { code: string; message: string } };

function roomName(sessionId: string) {
  return `session:${sessionId}`;
}

function updateSocketMetrics(io: Server) {
  setActiveSocketConnections(io.engine.clientsCount);
}

function socketError(code: string, message: string): Ack {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function getJoinedSocketData(socket: Socket) {
  const sessionId = socket.data.sessionId as string | undefined;
  const participantId = socket.data.participantId as string | undefined;

  if (!sessionId || !participantId) {
    throw new Error("Socket has not joined a session");
  }

  return { sessionId, participantId };
}

async function getRoomState(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      participants: {
        orderBy: {
          joinedAt: "asc",
        },
      },
      chatMessages: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          senderParticipant: {
            select: {
              id: true,
              displayName: true,
              role: true,
            },
          },
          file: true,
        },
      },
    },
  });

  return { session };
}

async function emitRoomState(io: Server, sessionId: string) {
  const state = await getRoomState(sessionId);
  io.to(roomName(sessionId)).emit("session:state", state);
}

async function resolveParticipantForSocket(input: {
  user: AuthUser;
  sessionId: string;
  socketId: string;
}) {
  const { user, sessionId, socketId } = input;

  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      participants: true,
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.status === "ENDED") {
    throw new Error("This session has ended");
  }

  if (user.role === "CUSTOMER") {
    if (user.sessionId !== session.id || !user.participantId) {
      throw new Error("Customer token is not valid for this session");
    }

    const participant = await prisma.participant.findUnique({
      where: {
        id: user.participantId,
      },
    });

    if (!participant || participant.sessionId !== session.id) {
      throw new Error("Customer participant not found");
    }

    const previousStatus = participant.status;

    const updatedParticipant = await prisma.participant.update({
      where: {
        id: participant.id,
      },
      data: {
        status: "CONNECTED",
        socketId,
        lastSeenAt: new Date(),
      },
    });

    return {
      session,
      participant: updatedParticipant,
      previousStatus,
    };
  }

  if (user.role !== "ADMIN" && session.agentId !== user.id) {
    throw new Error("Agent cannot access this session");
  }

  const existingAgentParticipant = session.participants.find(
    (participant) => participant.role === "AGENT"
  );

  if (existingAgentParticipant) {
    const previousStatus = existingAgentParticipant.status;

    const updatedParticipant = await prisma.participant.update({
      where: {
        id: existingAgentParticipant.id,
      },
      data: {
        status: "CONNECTED",
        socketId,
        lastSeenAt: new Date(),
      },
    });

    return {
      session,
      participant: updatedParticipant,
      previousStatus,
    };
  }

  const createdParticipant = await prisma.participant.create({
    data: {
      sessionId: session.id,
      role: "AGENT",
      displayName: user.displayName,
      status: "CONNECTED",
      socketId,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  await logSessionEvent({
    sessionId: session.id,
    participantId: createdParticipant.id,
    type: "PARTICIPANT_JOINED",
    payload: {
      role: "AGENT",
      displayName: createdParticipant.displayName,
    },
  });

  return {
    session,
    participant: createdParticipant,
    previousStatus: "JOINED",
  };
}

async function startReconnectWindow(
  io: Server,
  input: {
    sessionId: string;
    participantId: string;
    reason: string;
  }
) {
  const { sessionId, participantId, reason } = input;

  const closedProducers = mediaService.closePeer(sessionId, participantId);

  for (const producer of closedProducers) {
    io.to(roomName(sessionId)).emit("media:producerClosed", producer);
  }

  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
  });

  if (!session || session.status === "ENDED") {
    return;
  }

  const participant = await prisma.participant.findUnique({
    where: {
      id: participantId,
    },
  });

  if (!participant || participant.status === "LEFT") {
    return;
  }

  await prisma.participant.update({
    where: {
      id: participantId,
    },
    data: {
      status: "RECONNECTING",
      lastSeenAt: new Date(),
    },
  });

  await logSessionEvent({
    sessionId,
    participantId,
    type: "PARTICIPANT_RECONNECTING",
    payload: {
      reason,
      graceMs: RECONNECT_GRACE_MS,
    },
  });

  io.to(roomName(sessionId)).emit("participant:reconnecting", {
    participantId,
    graceMs: RECONNECT_GRACE_MS,
  });

  await emitRoomState(io, sessionId);

  const existingTimer = reconnectTimers.get(participantId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    const latest = await prisma.participant.findUnique({
      where: {
        id: participantId,
      },
    });

    if (!latest || latest.status !== "RECONNECTING") {
      reconnectTimers.delete(participantId);
      return;
    }

    const now = new Date();

    await prisma.participant.update({
      where: {
        id: participantId,
      },
      data: {
        status: "LEFT",
        leftAt: now,
        socketId: null,
      },
    });

    await logSessionEvent({
      sessionId,
      participantId,
      type: "PARTICIPANT_LEFT",
      payload: {
        reason: "reconnect_window_expired",
      },
    });

    io.to(roomName(sessionId)).emit("participant:left", {
      participantId,
    });

    if (latest.role === "CUSTOMER") {
      const activeSession = await prisma.session.findUnique({
        where: {
          id: sessionId,
        },
        include: {
          participants: true,
        },
      });

      if (activeSession && activeSession.status !== "ENDED") {
        await prisma.session.update({
          where: {
            id: sessionId,
          },
          data: {
            status: "ENDED",
            endedAt: now,
            endReason: "Customer did not reconnect within 60 seconds",
            participants: {
              updateMany: {
                where: {
                  status: {
                    not: "LEFT",
                  },
                },
                data: {
                  status: "LEFT",
                  leftAt: now,
                  socketId: null,
                },
              },
            },
          },
        });

        for (const roomParticipant of activeSession.participants) {
          const timer = reconnectTimers.get(roomParticipant.id);
          if (timer) {
            clearTimeout(timer);
            reconnectTimers.delete(roomParticipant.id);
          }
        }

        mediaService.closeRoom(sessionId);

        await logSessionEvent({
          sessionId,
          participantId,
          type: "SESSION_ENDED",
          payload: {
            reason: "customer_reconnect_timeout",
            graceMs: RECONNECT_GRACE_MS,
          },
        });

        io.to(roomName(sessionId)).emit("session:ended", {
          sessionId,
          reason: "Customer did not reconnect within 60 seconds",
        });
      }
    }

    await emitRoomState(io, sessionId);

    reconnectTimers.delete(participantId);
  }, RECONNECT_GRACE_MS);

  reconnectTimers.set(participantId, timer);
}

async function handleSessionEnd(
  io: Server,
  input: {
    user: AuthUser;
    sessionId: string;
    reason?: string;
  }
) {
  const { user, sessionId, reason } = input;

  if (user.role !== "AGENT" && user.role !== "ADMIN") {
    throw new Error("Only an agent can end the session");
  }

  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      participants: true,
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (user.role !== "ADMIN" && session.agentId !== user.id) {
    throw new Error("Agent cannot end this session");
  }

  if (session.status === "ENDED") {
    return session;
  }

  const now = new Date();

  const updatedSession = await prisma.session.update({
    where: {
      id: session.id,
    },
    data: {
      status: "ENDED",
      endedAt: now,
      endReason: reason ?? "Ended by agent",
      participants: {
        updateMany: {
          where: {
            status: {
              not: "LEFT",
            },
          },
          data: {
            status: "LEFT",
            leftAt: now,
            socketId: null,
          },
        },
      },
    },
  });

  for (const participant of session.participants) {
    const timer = reconnectTimers.get(participant.id);
    if (timer) {
      clearTimeout(timer);
      reconnectTimers.delete(participant.id);
    }
  }

  mediaService.closeRoom(session.id);

  await logSessionEvent({
    sessionId: session.id,
    type: "SESSION_ENDED",
    payload: {
      endedBy: user.id,
      endedByRole: user.role,
      reason: reason ?? "Ended by agent",
    },
  });

  io.to(roomName(session.id)).emit("session:ended", {
    sessionId: session.id,
    reason: reason ?? "Ended by agent",
  });

  await emitRoomState(io, session.id);

  return updatedSession;
}

export function initRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token || typeof token !== "string") {
      return next(new Error("Missing socket auth token"));
    }

    try {
      const user = verifyAuthToken(token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Invalid socket auth token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as AuthUser;

    updateSocketMetrics(io);

    console.log(`[socket] connected ${socket.id} as ${user.role}:${user.id}`);

    socket.on("session:join", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = joinSchema.parse(payload);

        const { participant, previousStatus } = await resolveParticipantForSocket({
          user,
          sessionId: body.sessionId,
          socketId: socket.id,
        });

        socket.data.sessionId = body.sessionId;
        socket.data.participantId = participant.id;

        socket.join(roomName(body.sessionId));

        const existingTimer = reconnectTimers.get(participant.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
          reconnectTimers.delete(participant.id);
        }

        if (previousStatus === "RECONNECTING") {
          await logSessionEvent({
            sessionId: body.sessionId,
            participantId: participant.id,
            type: "PARTICIPANT_RECONNECTED",
            payload: {
              role: participant.role,
              displayName: participant.displayName,
            },
          });

          io.to(roomName(body.sessionId)).emit("participant:reconnected", {
            participantId: participant.id,
          });
        } else {
          await logSessionEvent({
            sessionId: body.sessionId,
            participantId: participant.id,
            type: "PARTICIPANT_CONNECTED",
            payload: {
              role: participant.role,
              displayName: participant.displayName,
            },
          });

          io.to(roomName(body.sessionId)).emit("participant:joined", {
            participant,
          });
        }

        await emitRoomState(io, body.sessionId);

        ack?.({
          ok: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to join session";
        ack?.(socketError("SESSION_JOIN_FAILED", message));
      }
    });

    socket.on("chat:send", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = chatSchema.parse(payload);

        const sessionId = socket.data.sessionId as string | undefined;
        const participantId = socket.data.participantId as string | undefined;

        if (!sessionId || !participantId || sessionId !== body.sessionId) {
          throw new Error("Socket has not joined this session");
        }

        const session = await prisma.session.findUnique({
          where: {
            id: sessionId,
          },
        });

        if (!session || session.status === "ENDED") {
          throw new Error("Cannot send chat to an ended session");
        }

        const message = await prisma.chatMessage.create({
          data: {
            sessionId,
            senderParticipantId: participantId,
            messageType: "TEXT",
            body: body.body,
          },
          include: {
            senderParticipant: {
              select: {
                id: true,
                displayName: true,
                role: true,
              },
            },
            file: true,
          },
        });

        await logSessionEvent({
          sessionId,
          participantId,
          type: "CHAT_MESSAGE_SENT",
          payload: {
            messageId: message.id,
            messageType: "TEXT",
          },
        });

        io.to(roomName(sessionId)).emit("chat:message", {
          message,
        });

        await emitRoomState(io, sessionId);

        ack?.({
          ok: true,
          data: message,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send message";
        ack?.(socketError("CHAT_SEND_FAILED", message));
      }
    });

    socket.on("file:uploaded", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = fileUploadedSchema.parse(payload);
        const { sessionId, participantId } = getJoinedSocketData(socket);

        if (sessionId !== body.sessionId) {
          throw new Error("Socket session mismatch");
        }

        const message = await prisma.chatMessage.findUnique({
          where: {
            id: body.messageId,
          },
          include: {
            senderParticipant: {
              select: {
                id: true,
                displayName: true,
                role: true,
              },
            },
            file: true,
          },
        });

        if (!message || message.sessionId !== sessionId) {
          throw new Error("Uploaded file message not found");
        }

        if (message.senderParticipantId !== participantId) {
          throw new Error("Cannot broadcast another participant's file");
        }

        io.to(roomName(sessionId)).emit("chat:message", {
          message,
        });

        await emitRoomState(io, sessionId);

        ack?.({
          ok: true,
          data: message,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to broadcast uploaded file";
        ack?.(socketError("FILE_UPLOAD_BROADCAST_FAILED", message));
      }
    });

    socket.on("session:end", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = endSessionSchema.parse(payload);

        const session = await handleSessionEnd(io, {
          user,
          sessionId: body.sessionId,
          reason: body.reason,
        });

        ack?.({
          ok: true,
          data: session,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to end session";
        ack?.(socketError("SESSION_END_FAILED", message));
      }
    });

    socket.on("session:leave", async (_payload, ack?: (response: Ack) => void) => {
      ack?.({ ok: true });
      socket.disconnect();
    });

    socket.on("media:getRouterRtpCapabilities", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = mediaSessionSchema.parse(payload);
        const { sessionId } = getJoinedSocketData(socket);

        if (sessionId !== body.sessionId) {
          throw new Error("Socket session mismatch");
        }

        const rtpCapabilities = await mediaService.getRouterRtpCapabilities(body.sessionId);

        ack?.({
          ok: true,
          data: rtpCapabilities,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to get RTP capabilities";
        ack?.(socketError("MEDIA_RTP_CAPABILITIES_FAILED", message));
      }
    });

    socket.on("media:createWebRtcTransport", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = createTransportSchema.parse(payload);
        const { sessionId, participantId } = getJoinedSocketData(socket);

        if (sessionId !== body.sessionId) {
          throw new Error("Socket session mismatch");
        }

        const transportOptions = await mediaService.createWebRtcTransport({
          sessionId,
          participantId,
          direction: body.direction,
        });

        ack?.({
          ok: true,
          data: transportOptions,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create WebRTC transport";
        ack?.(socketError("MEDIA_CREATE_TRANSPORT_FAILED", message));
      }
    });

    socket.on("media:connectTransport", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = connectTransportSchema.parse(payload);
        const { sessionId, participantId } = getJoinedSocketData(socket);

        if (sessionId !== body.sessionId) {
          throw new Error("Socket session mismatch");
        }

        await mediaService.connectTransport({
          sessionId,
          participantId,
          transportId: body.transportId,
          dtlsParameters: body.dtlsParameters,
        });

        ack?.({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to connect transport";
        ack?.(socketError("MEDIA_CONNECT_TRANSPORT_FAILED", message));
      }
    });

    socket.on("media:produce", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = produceSchema.parse(payload);
        const { sessionId, participantId } = getJoinedSocketData(socket);

        if (sessionId !== body.sessionId) {
          throw new Error("Socket session mismatch");
        }

        const producer = await mediaService.produce({
          sessionId,
          participantId,
          transportId: body.transportId,
          kind: body.kind,
          rtpParameters: body.rtpParameters,
          appData: body.appData,
        });

        socket.to(roomName(sessionId)).emit("media:newProducer", {
          producerId: producer.id,
          participantId,
          kind: producer.kind,
        });

        ack?.({
          ok: true,
          data: {
            id: producer.id,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to produce media";
        ack?.(socketError("MEDIA_PRODUCE_FAILED", message));
      }
    });

    socket.on("media:listProducers", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = mediaSessionSchema.parse(payload);
        const { sessionId, participantId } = getJoinedSocketData(socket);

        if (sessionId !== body.sessionId) {
          throw new Error("Socket session mismatch");
        }

        const producers = mediaService.listRemoteProducers({
          sessionId,
          participantId,
        });

        ack?.({
          ok: true,
          data: producers,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to list producers";
        ack?.(socketError("MEDIA_LIST_PRODUCERS_FAILED", message));
      }
    });

    socket.on("media:consume", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = consumeSchema.parse(payload);
        const { sessionId, participantId } = getJoinedSocketData(socket);

        if (sessionId !== body.sessionId) {
          throw new Error("Socket session mismatch");
        }

        const consumer = await mediaService.consume({
          sessionId,
          participantId,
          producerId: body.producerId,
          rtpCapabilities: body.rtpCapabilities,
        });

        ack?.({
          ok: true,
          data: {
            id: consumer.id,
            producerId: body.producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to consume media";
        ack?.(socketError("MEDIA_CONSUME_FAILED", message));
      }
    });

    socket.on("media:resumeConsumer", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = resumeConsumerSchema.parse(payload);
        const { sessionId, participantId } = getJoinedSocketData(socket);

        if (sessionId !== body.sessionId) {
          throw new Error("Socket session mismatch");
        }

        await mediaService.resumeConsumer({
          sessionId,
          participantId,
          consumerId: body.consumerId,
        });

        ack?.({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to resume consumer";
        ack?.(socketError("MEDIA_RESUME_CONSUMER_FAILED", message));
      }
    });

    socket.on("media:closeProducer", async (payload, ack?: (response: Ack) => void) => {
      try {
        const body = closeProducerSchema.parse(payload);
        const { sessionId, participantId } = getJoinedSocketData(socket);

        if (sessionId !== body.sessionId) {
          throw new Error("Socket session mismatch");
        }

        mediaService.closeProducer({
          sessionId,
          participantId,
          producerId: body.producerId,
        });

        socket.to(roomName(sessionId)).emit("media:producerClosed", {
          producerId: body.producerId,
          participantId,
        });

        ack?.({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to close producer";
        ack?.(socketError("MEDIA_CLOSE_PRODUCER_FAILED", message));
      }
    });

    socket.on("disconnect", async (reason) => {
      updateSocketMetrics(io);

      console.log(`[socket] disconnected ${socket.id}: ${reason}`);

      const sessionId = socket.data.sessionId as string | undefined;
      const participantId = socket.data.participantId as string | undefined;

      if (!sessionId || !participantId) {
        return;
      }

      await startReconnectWindow(io, {
        sessionId,
        participantId,
        reason,
      });
    });
  });

  return io;
}