import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export async function logSessionEvent(input: {
  sessionId: string;
  participantId?: string;
  type: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.sessionEvent.create({
    data: {
      sessionId: input.sessionId,
      participantId: input.participantId,
      type: input.type,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
}