import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import type { HealthResponse } from "@atomassist/shared";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { initRealtime } from "./realtime/socket.js";
import { apiRouter } from "./routes/index.js";

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;

  const response: HealthResponse = {
    status: "ok",
    service: "atomassist-server",
  };

  res.json(response);
});

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = createServer(app);

initRealtime(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`AtomAssist server running on http://localhost:${env.PORT}`);
  console.log(`Allowed frontend origin: ${env.FRONTEND_ORIGIN}`);
});

function shutdown(signal: string) {
  console.log(`[shutdown] received ${signal}`);

  httpServer.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));