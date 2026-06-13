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

export const recordingRouter = Router();

const RECORDING_ROOT = path.resolve(process.cwd(), "recordings");
const MAX_RECORDING_SIZE_BYTES = 300 * 1024 * 1024;

function safeFolderName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const sessionId = safeFolderName(String(req.params.id ?? "unknown"));
    const dir = path.join(RECORDING_ROOT, sessionId);

    fs.mkdirSync(dir, { recursive: true });

    cb(null, dir);
  },

  filename(_req, file, cb) {
    const extension = path.extname(file.originalname) || ".webm";
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_RECORDING_SIZE_BYTES,
  },
  fileFilter(_req, file, cb) {
    const allowed = new Set([
      "video/webm",
      "video/mp4",
      "application/octet-stream",
    ]);

    if (!allowed.has(file.mimetype)) {
      cb(new AppError(400, "Only video recordings are allowed", "RECORDING_TYPE_NOT_ALLOWED"));
      return;
    }

    cb(null, true);
  },
});

async function assertAgentCanRecord(input: {
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

  if (input.user.role !== "ADMIN" && session.agentId !== input.user.id) {
    throw new AppError(403, "Only the assigned agent or admin can manage recordings", "RECORDING_ACCESS_DENIED");
  }

  return session;
}

async function assertCanDownloadRecording(input: {
  recordingId: string;
  user: NonNullable<Express.Request["user"]>;
}) {
  const recording = await prisma.recording.findUnique({
    where: {
      id: input.recordingId,
    },
    include: {
      session: true,
    },
  });

  if (!recording) {
    throw new AppError(404, "Recording not found", "RECORDING_NOT_FOUND");
  }

  if (input.user.role === "CUSTOMER") {
    if (input.user.sessionId !== recording.sessionId) {
      throw new AppError(403, "Customer cannot download this recording", "RECORDING_ACCESS_DENIED");
    }

    return recording;
  }

  if (input.user.role !== "ADMIN" && recording.session.agentId !== input.user.id) {
    throw new AppError(403, "Agent cannot download this recording", "RECORDING_ACCESS_DENIED");
  }

  return recording;
}

recordingRouter.post(
  "/sessions/:id/recordings/start",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessionId = String(req.params.id);

    await assertAgentCanRecord({
      sessionId,
      user: req.user!,
    });

    const recording = await prisma.recording.create({
      data: {
        sessionId,
        startedByAgentId: req.user!.id,
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    await logSessionEvent({
      sessionId,
      type: "RECORDING_STARTED",
      payload: {
        recordingId: recording.id,
        startedBy: req.user!.id,
        mode: "browser_tab_mvp",
      },
    });

    res.status(201).json({
      recording,
    });
  })
);

recordingRouter.post(
  "/sessions/:id/recordings/upload",
  requireAuth,
  upload.single("recording"),
  asyncHandler(async (req, res) => {
    const sessionId = String(req.params.id);

    if (!req.file) {
      throw new AppError(400, "No recording uploaded", "NO_RECORDING_UPLOADED");
    }

    await assertAgentCanRecord({
      sessionId,
      user: req.user!,
    });

    const resolvedPath = path.resolve(req.file.path);

    if (!resolvedPath.startsWith(RECORDING_ROOT)) {
      throw new AppError(400, "Invalid recording path", "INVALID_RECORDING_PATH");
    }

    const now = new Date();

    const recording = await prisma.recording.create({
      data: {
        sessionId,
        startedByAgentId: req.user!.id,
        status: "READY",
        storagePath: resolvedPath,
        startedAt: now,
        stoppedAt: now,
        readyAt: now,
      },
    });

    await logSessionEvent({
      sessionId,
      type: "RECORDING_READY",
      payload: {
        recordingId: recording.id,
        sizeBytes: req.file.size,
        mimeType: req.file.mimetype,
        mode: "legacy_direct_upload",
      },
    });

    res.status(201).json({
      recording,
    });
  })
);

recordingRouter.post(
  "/sessions/:id/recordings/:recordingId/upload",
  requireAuth,
  upload.single("recording"),
  asyncHandler(async (req, res) => {
    const sessionId = String(req.params.id);
    const recordingId = String(req.params.recordingId);

    if (!req.file) {
      throw new AppError(400, "No recording uploaded", "NO_RECORDING_UPLOADED");
    }

    await assertAgentCanRecord({
      sessionId,
      user: req.user!,
    });

    const existingRecording = await prisma.recording.findUnique({
      where: {
        id: recordingId,
      },
    });

    if (!existingRecording || existingRecording.sessionId !== sessionId) {
      throw new AppError(404, "Recording not found for this session", "RECORDING_NOT_FOUND");
    }

    const resolvedPath = path.resolve(req.file.path);

    if (!resolvedPath.startsWith(RECORDING_ROOT)) {
      throw new AppError(400, "Invalid recording path", "INVALID_RECORDING_PATH");
    }

    const processingRecording = await prisma.recording.update({
      where: {
        id: recordingId,
      },
      data: {
        status: "PROCESSING",
        stoppedAt: new Date(),
      },
    });

    await logSessionEvent({
      sessionId,
      type: "RECORDING_PROCESSING",
      payload: {
        recordingId: processingRecording.id,
      },
    });

    const readyRecording = await prisma.recording.update({
      where: {
        id: recordingId,
      },
      data: {
        status: "READY",
        storagePath: resolvedPath,
        readyAt: new Date(),
      },
    });

    await logSessionEvent({
      sessionId,
      type: "RECORDING_READY",
      payload: {
        recordingId: readyRecording.id,
        sizeBytes: req.file.size,
        mimeType: req.file.mimetype,
        mode: "browser_tab_mvp",
      },
    });

    res.status(201).json({
      recording: readyRecording,
    });
  })
);

recordingRouter.get(
  "/recordings/:recordingId/download",
  requireAuth,
  asyncHandler(async (req, res) => {
    const recording = await assertCanDownloadRecording({
      recordingId: String(req.params.recordingId),
      user: req.user!,
    });

    if (recording.status !== "READY" || !recording.storagePath) {
      throw new AppError(404, "Recording file not ready", "RECORDING_NOT_READY");
    }

    const resolvedPath = path.resolve(recording.storagePath);

    if (!resolvedPath.startsWith(RECORDING_ROOT)) {
      throw new AppError(400, "Invalid recording path", "INVALID_RECORDING_PATH");
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new AppError(404, "Recording file missing", "RECORDING_FILE_MISSING");
    }

    res.download(resolvedPath, `atomassist-recording-${recording.sessionId}.webm`);
  })
);