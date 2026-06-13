import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { getRecordingCapabilities } from "../system/recording-capabilities.js";

export const systemRouter = Router();

systemRouter.get(
  "/recording-capabilities",
  asyncHandler(async (_req, res) => {
    const capabilities = await getRecordingCapabilities();

    res.json({
      capabilities,
    });
  })
);