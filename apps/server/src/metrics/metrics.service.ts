import * as client from "prom-client";
import { prisma } from "../db/prisma.js";

export const metricsRegistry = new client.Registry();

client.collectDefaultMetrics({
  register: metricsRegistry,
  prefix: "atomassist_",
});

export const httpRequestsTotal = new client.Counter({
  name: "atomassist_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status_code"],
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: "atomassist_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const activeSocketConnections = new client.Gauge({
  name: "atomassist_socket_connections_active",
  help: "Current active Socket.IO connections",
  registers: [metricsRegistry],
});

export const sessionsByStatusGauge = new client.Gauge({
  name: "atomassist_sessions_by_status",
  help: "Number of sessions grouped by status",
  labelNames: ["status"],
  registers: [metricsRegistry],
});

export const participantsByStatusGauge = new client.Gauge({
  name: "atomassist_participants_by_status",
  help: "Number of participants grouped by status",
  labelNames: ["status"],
  registers: [metricsRegistry],
});

export const chatMessagesTotalGauge = new client.Gauge({
  name: "atomassist_chat_messages_total",
  help: "Total persisted chat messages",
  registers: [metricsRegistry],
});

export const filesTotalGauge = new client.Gauge({
  name: "atomassist_files_total",
  help: "Total uploaded file assets",
  registers: [metricsRegistry],
});

export const recordingsTotalGauge = new client.Gauge({
  name: "atomassist_recordings_total",
  help: "Total uploaded tab recordings",
  registers: [metricsRegistry],
});

export function setActiveSocketConnections(count: number) {
  activeSocketConnections.set(count);
}

export async function refreshDatabaseMetrics() {
  const [sessions, participants, chatMessagesTotal, filesTotal, recordingsTotal] =
    await Promise.all([
      prisma.session.groupBy({
        by: ["status"],
        _count: {
          status: true,
        },
      }),
      prisma.participant.groupBy({
        by: ["status"],
        _count: {
          status: true,
        },
      }),
      prisma.chatMessage.count(),
      prisma.fileAsset.count(),
      prisma.recording.count(),
    ]);

  sessionsByStatusGauge.reset();
  participantsByStatusGauge.reset();

  for (const item of sessions) {
    sessionsByStatusGauge.set(
      { status: item.status.toLowerCase() },
      item._count.status
    );
  }

  for (const item of participants) {
    participantsByStatusGauge.set(
      { status: item.status.toLowerCase() },
      item._count.status
    );
  }

  chatMessagesTotalGauge.set(chatMessagesTotal);
  filesTotalGauge.set(filesTotal);
  recordingsTotalGauge.set(recordingsTotal);
}