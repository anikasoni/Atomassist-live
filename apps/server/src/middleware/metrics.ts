import type { NextFunction, Request, Response } from "express";
import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
} from "../metrics/metrics.service.js";

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const endedAt = process.hrtime.bigint();
    const durationSeconds = Number(endedAt - startedAt) / 1_000_000_000;

    const path =
      req.route?.path && typeof req.route.path === "string"
        ? req.route.path
        : req.path;

    const labels = {
      method: req.method,
      path,
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });

  next();
}