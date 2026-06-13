import { Router } from "express";
import {
  metricsRegistry,
  refreshDatabaseMetrics,
} from "../metrics/metrics.service.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const metricsRouter = Router();

metricsRouter.get(
  "/metrics",
  asyncHandler(async (_req, res) => {
    await refreshDatabaseMetrics();

    res.setHeader("Content-Type", metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  })
);