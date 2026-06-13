import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { AppError } from "../middleware/error.js";
import { logSessionEvent } from "../services/event.service.js";
import { hashInviteToken, signAuthToken } from "../utils/tokens.js";

export const inviteRouter = Router();

const joinInviteSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

async function findSessionByInviteToken(token: string) {
  const inviteTokenHash = hashInviteToken(token);

  return prisma.session.findUnique({
    where: {
      inviteTokenHash,
    },
    include: {
      participants: true,
    },
  });
}

inviteRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const session = await findSessionByInviteToken(String(req.params.token));

    if (!session) {
      throw new AppError(404, "Invalid invite link", "INVALID_INVITE");
    }

    if (session.status === "ENDED") {
      throw new AppError(410, "This session has already ended", "SESSION_ALREADY_ENDED");
    }

    await logSessionEvent({
      sessionId: session.id,
      type: "INVITE_OPENED",
      payload: {
        tokenPreview: String(req.params.token).slice(0, 6),
      },
    });

    res.json({
      session: {
        id: session.id,
        status: session.status,
        createdAt: session.createdAt,
        participantCount: session.participants.length,
      },
    });
  })
);

inviteRouter.post(
  "/:token/join",
  asyncHandler(async (req, res) => {
    const body = joinInviteSchema.parse(req.body);

    const session = await findSessionByInviteToken(String(req.params.token));

    if (!session) {
      throw new AppError(404, "Invalid invite link", "INVALID_INVITE");
    }

    if (session.status === "ENDED") {
      throw new AppError(410, "This session has already ended", "SESSION_ALREADY_ENDED");
    }

    const existingActiveCustomer = session.participants.find(
      (participant) =>
        participant.role === "CUSTOMER" &&
        participant.status !== "LEFT"
    );

    if (existingActiveCustomer) {
      throw new AppError(
        409,
        "A customer has already joined this session",
        "CUSTOMER_ALREADY_JOINED"
      );
    }

    const participant = await prisma.participant.create({
      data: {
        sessionId: session.id,
        role: "CUSTOMER",
        displayName: body.displayName,
        status: "JOINED",
        joinedAt: new Date(),
      },
    });

    const updatedSession = await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        status: session.status === "WAITING" ? "ACTIVE" : session.status,
        startedAt: session.startedAt ?? new Date(),
      },
    });

    await logSessionEvent({
      sessionId: session.id,
      participantId: participant.id,
      type: "PARTICIPANT_JOINED",
      payload: {
        role: "CUSTOMER",
        displayName: participant.displayName,
      },
    });

    const token = signAuthToken({
      id: participant.id,
      role: "CUSTOMER",
      displayName: participant.displayName,
      sessionId: session.id,
      participantId: participant.id,
    });

    res.status(201).json({
      token,
      participant,
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        startedAt: updatedSession.startedAt,
      },
    });
  })
);