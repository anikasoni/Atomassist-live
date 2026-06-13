import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { logSessionEvent } from "../services/event.service.js";

export const sessionReviewRouter = Router();

const reviewSchema = z.object({
  resolutionStatus: z.enum(["OPEN", "RESOLVED", "ESCALATED"]),
  reviewNotes: z.string().trim().max(2000).optional().default(""),
});

async function assertCanReviewSession(input: {
  sessionId: string;
  user: NonNullable<Express.Request["user"]>;
}) {
  const session = await prisma.session.findUnique({
    where: {
      id: input.sessionId,
    },
  });

  if (!session) {
    throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");
  }

  if (input.user.role === "CUSTOMER") {
    throw new AppError(403, "Customers cannot update session review", "REVIEW_ACCESS_DENIED");
  }

  if (input.user.role !== "ADMIN" && session.agentId !== input.user.id) {
    throw new AppError(403, "Agent cannot review this session", "REVIEW_ACCESS_DENIED");
  }

  return session;
}

sessionReviewRouter.patch(
  "/:id/review",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessionId = String(req.params.id);
    const body = reviewSchema.parse(req.body);

    await assertCanReviewSession({
      sessionId,
      user: req.user!,
    });

    const updatedSession = await prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        resolutionStatus: body.resolutionStatus,
        reviewNotes: body.reviewNotes,
        reviewedAt: new Date(),
        reviewedByAgentId: req.user!.id,
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
        files: true,
        recordings: {
          orderBy: {
            startedAt: "desc",
          },
        },
      },
    });

    await logSessionEvent({
      sessionId,
      type: "SESSION_REVIEW_UPDATED",
      payload: {
        resolutionStatus: body.resolutionStatus,
        reviewedBy: req.user!.id,
        reviewNotesLength: body.reviewNotes.length,
      },
    });

    res.json({
      session: updatedSession,
    });
  })
);