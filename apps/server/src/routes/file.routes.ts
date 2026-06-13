import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../db/prisma.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { logSessionEvent } from "../services/event.service.js";

export const fileRouter = Router();

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function safeFolderName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function safeOriginalName(value: string) {
  return value.replace(/[^\w.\-() ]/g, "_").slice(0, 180);
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const sessionId = safeFolderName(String(req.params.id));
    const dir = path.join(UPLOAD_ROOT, sessionId);

    fs.mkdirSync(dir, { recursive: true });

    cb(null, dir);
  },

  filename(_req, file, cb) {
    const originalName = safeOriginalName(file.originalname);
    const extension = path.extname(originalName);
    const filename = `${crypto.randomUUID()}${extension}`;

    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter(_req, file, cb) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new AppError(400, "This file type is not allowed", "FILE_TYPE_NOT_ALLOWED"));
      return;
    }

    cb(null, true);
  },
});

async function getUploadParticipant(input: {
  sessionId: string;
  user: NonNullable<Express.Request["user"]>;
}) {
  const session = await prisma.session.findUnique({
    where: {
      id: input.sessionId,
    },
    include: {
      participants: true,
    },
  });

  if (!session) {
    throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");
  }

  if (session.status === "ENDED") {
    throw new AppError(410, "Cannot upload files to an ended session", "SESSION_ALREADY_ENDED");
  }

  if (input.user.role === "CUSTOMER") {
    if (input.user.sessionId !== session.id || !input.user.participantId) {
      throw new AppError(403, "Customer cannot upload to this session", "SESSION_ACCESS_DENIED");
    }

    const participant = session.participants.find(
      (item) => item.id === input.user.participantId && item.role === "CUSTOMER"
    );

    if (!participant) {
      throw new AppError(403, "Customer participant not found", "PARTICIPANT_NOT_FOUND");
    }

    return { session, participant };
  }

  if (input.user.role !== "ADMIN" && session.agentId !== input.user.id) {
    throw new AppError(403, "Agent cannot upload to this session", "SESSION_ACCESS_DENIED");
  }

  const existingAgentParticipant = session.participants.find(
    (item) => item.role === "AGENT"
  );

  if (existingAgentParticipant) {
    return { session, participant: existingAgentParticipant };
  }

  const participant = await prisma.participant.create({
    data: {
      sessionId: session.id,
      role: "AGENT",
      displayName: input.user.displayName,
      status: "CONNECTED",
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  return { session, participant };
}

async function assertCanDownloadFile(input: {
  fileId: string;
  user: NonNullable<Express.Request["user"]>;
}) {
  const file = await prisma.fileAsset.findUnique({
    where: {
      id: input.fileId,
    },
    include: {
      session: true,
    },
  });

  if (!file) {
    throw new AppError(404, "File not found", "FILE_NOT_FOUND");
  }

  if (input.user.role === "CUSTOMER") {
    if (input.user.sessionId !== file.sessionId) {
      throw new AppError(403, "Customer cannot download this file", "FILE_ACCESS_DENIED");
    }

    return file;
  }

  if (input.user.role !== "ADMIN" && file.session.agentId !== input.user.id) {
    throw new AppError(403, "Agent cannot download this file", "FILE_ACCESS_DENIED");
  }

  return file;
}

fileRouter.post(
  "/sessions/:id/files",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const sessionId = String(req.params.id);

    if (!req.file) {
      throw new AppError(400, "No file uploaded", "NO_FILE_UPLOADED");
    }

    const { participant } = await getUploadParticipant({
      sessionId,
      user: req.user!,
    });

    const absoluteStoragePath = path.resolve(req.file.path);

    if (!absoluteStoragePath.startsWith(UPLOAD_ROOT)) {
      throw new AppError(400, "Invalid upload path", "INVALID_UPLOAD_PATH");
    }

    const file = await prisma.fileAsset.create({
      data: {
        sessionId,
        uploadedByParticipantId: participant.id,
        originalName: safeOriginalName(req.file.originalname),
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storagePath: absoluteStoragePath,
      },
    });

    const message = await prisma.chatMessage.create({
      data: {
        sessionId,
        senderParticipantId: participant.id,
        messageType: "FILE",
        body: file.originalName,
        fileId: file.id,
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
      participantId: participant.id,
      type: "FILE_SHARED",
      payload: {
        fileId: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      },
    });

    res.status(201).json({
      file,
      message,
    });
  })
);

fileRouter.get(
  "/files/:fileId/download",
  requireAuth,
  asyncHandler(async (req, res) => {
    const fileId = String(req.params.fileId);

    const file = await assertCanDownloadFile({
      fileId,
      user: req.user!,
    });

    const resolvedPath = path.resolve(file.storagePath);

    if (!resolvedPath.startsWith(UPLOAD_ROOT)) {
      throw new AppError(400, "Invalid file path", "INVALID_FILE_PATH");
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new AppError(404, "Stored file missing", "FILE_MISSING");
    }

    res.download(resolvedPath, file.originalName);
  })
);