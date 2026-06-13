import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { logSessionEvent } from "../services/event.service.js";
import { generateInviteToken, hashInviteToken } from "../utils/tokens.js";

export const sessionRouter = Router();

const endSessionSchema = z.object({
  reason: z.string().max(200).optional(),
});

function assertAgentOwnsSessionOrAdmin(sessionAgentId: string, user: NonNullable<Express.Request["user"]>) {
  if (user.role === "ADMIN") return;

  if (user.role !== "AGENT" || user.id !== sessionAgentId) {
    throw new AppError(403, "You cannot access this session", "SESSION_ACCESS_DENIED");
  }
}

sessionRouter.post(
  "/",
  requireAuth,
  requireRole("AGENT", "ADMIN"),
  asyncHandler(async (req, res) => {
    const inviteToken = generateInviteToken();
    const inviteTokenHash = hashInviteToken(inviteToken);

    const session = await prisma.session.create({
      data: {
        agentId: req.user!.id,
        inviteTokenHash,
      },
    });

    await logSessionEvent({
      sessionId: session.id,
      type: "SESSION_CREATED",
      payload: {
        createdBy: req.user!.id,
        createdByRole: req.user!.role,
      },
    });

    const inviteUrl = `${req.protocol}://${req.get("host")}/api/invites/${inviteToken}`;

    res.status(201).json({
      session,
      inviteToken,
      inviteUrl,
    });
  })
);

sessionRouter.get(
  "/",
  requireAuth,
  requireRole("AGENT", "ADMIN"),
  asyncHandler(async (req, res) => {
    const where = req.user!.role === "ADMIN" ? {} : { agentId: req.user!.id };

    const sessions = await prisma.session.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        participants: true,
        _count: {
          select: {
            events: true,
            chatMessages: true,
            files: true,
            recordings: true,
          },
        },
      },
    });

    res.json({ sessions });
  })
);

sessionRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await prisma.session.findUnique({
      where: {
        id: String(req.params.id),
      },
      include: {
        participants: true,
      },
    });

    if (!session) {
      throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");
    }

    if (req.user!.role === "CUSTOMER") {
      if (req.user!.sessionId !== session.id) {
        throw new AppError(403, "You cannot access this session", "SESSION_ACCESS_DENIED");
      }
    } else {
      assertAgentOwnsSessionOrAdmin(session.agentId, req.user!);
    }

    res.json({ session });
  })
);

sessionRouter.get(
  "/:id/history",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await prisma.session.findUnique({
      where: {
        id: String(req.params.id),
      },
      include: {
        participants: {
          orderBy: {
            joinedAt: "asc",
          },
        },
        events: {
          orderBy: {
            createdAt: "asc",
          },
        },
        chatMessages: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            file: true,
          },
        },
        files: {
          orderBy: {
            createdAt: "asc",
          },
        },
        recordings: {
          orderBy: {
            startedAt: "asc",
          },
        },
      },
    });

    if (!session) {
      throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");
    }

    if (req.user!.role === "CUSTOMER") {
      if (req.user!.sessionId !== session.id) {
        throw new AppError(403, "You cannot access this session history", "SESSION_ACCESS_DENIED");
      }
    } else {
      assertAgentOwnsSessionOrAdmin(session.agentId, req.user!);
    }

    res.json({ session });
  })
);

sessionRouter.post(
  "/:id/end",
  requireAuth,
  requireRole("AGENT", "ADMIN"),
  asyncHandler(async (req, res) => {
    const body = endSessionSchema.parse(req.body ?? {});

    const session = await prisma.session.findUnique({
      where: {
        id: String(req.params.id),
      },
    });

    if (!session) {
      throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");
    }

    assertAgentOwnsSessionOrAdmin(session.agentId, req.user!);

    if (session.status === "ENDED") {
      return res.json({
        session,
        message: "Session already ended",
      });
    }

    const updatedSession = await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        endReason: body.reason ?? "Ended by agent",
        participants: {
          updateMany: {
            where: {
              status: {
                not: "LEFT",
              },
            },
            data: {
              status: "LEFT",
              leftAt: new Date(),
            },
          },
        },
      },
      include: {
        participants: true,
      },
    });

    await logSessionEvent({
      sessionId: session.id,
      type: "SESSION_ENDED",
      payload: {
        endedBy: req.user!.id,
        endedByRole: req.user!.role,
        reason: body.reason ?? "Ended by agent",
      },
    });

    res.json({ session: updatedSession });
  })
);