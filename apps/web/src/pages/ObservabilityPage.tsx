import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";
import { ErrorMessage } from "../components/ui";
import { API_BASE_URL } from "../lib/api";

interface ParsedMetric {
  name: string;
  labels: Record<string, string>;
  value: number;
}

function parseMetricLine(line: string): ParsedMetric | null {
  if (!line || line.startsWith("#")) return null;

  const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+(-?\d+(\.\d+)?)/);

  if (!match) return null;

  const labels: Record<string, string> = {};
  const rawLabels = match[3];

  if (rawLabels) {
    for (const part of rawLabels.split(",")) {
      const [key, rawValue] = part.split("=");

      if (key && rawValue) {
        labels[key] = rawValue.replace(/^"|"$/g, "");
      }
    }
  }

  return {
    name: match[1],
    labels,
    value: Number(match[4]),
  };
}

function getMetric(metrics: ParsedMetric[], name: string) {
  return metrics.find((metric) => metric.name === name)?.value ?? 0;
}

function getMetricByLabel(
  metrics: ParsedMetric[],
  name: string,
  labelName: string,
  labelValue: string
) {
  return (
    metrics.find(
      (metric) =>
        metric.name === name && metric.labels[labelName] === labelValue
    )?.value ?? 0
  );
}

function formatBytes(value: number) {
  if (!value) return "0 MB";

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMs(seconds: number) {
  return `${(seconds * 1000).toFixed(1)} ms`;
}

export function ObservabilityPage() {
  const [rawMetrics, setRawMetrics] = useState("");
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  async function loadMetrics() {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics`);

      if (!response.ok) {
        throw new Error(`Metrics request failed with ${response.status}`);
      }

      const text = await response.text();
      setRawMetrics(text);
      setLastUpdatedAt(new Date());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    }
  }

  useEffect(() => {
    void loadMetrics();

    const intervalId = window.setInterval(() => {
      void loadMetrics();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const metrics = useMemo(() => {
    return rawMetrics
      .split("\n")
      .map(parseMetricLine)
      .filter((item): item is ParsedMetric => Boolean(item));
  }, [rawMetrics]);

  const totalHttpRequests = useMemo(() => {
    return metrics
      .filter((metric) => metric.name === "atomassist_http_requests_total")
      .reduce((sum, metric) => sum + metric.value, 0);
  }, [metrics]);

  const waitingSessions = getMetricByLabel(
    metrics,
    "atomassist_sessions_by_status",
    "status",
    "waiting"
  );

  const activeSessions = getMetricByLabel(
    metrics,
    "atomassist_sessions_by_status",
    "status",
    "active"
  );

  const endedSessions = getMetricByLabel(
    metrics,
    "atomassist_sessions_by_status",
    "status",
    "ended"
  );

  const connectedParticipants = getMetricByLabel(
    metrics,
    "atomassist_participants_by_status",
    "status",
    "connected"
  );

  const reconnectingParticipants = getMetricByLabel(
    metrics,
    "atomassist_participants_by_status",
    "status",
    "reconnecting"
  );

  const leftParticipants = getMetricByLabel(
    metrics,
    "atomassist_participants_by_status",
    "status",
    "left"
  );

  const activeSockets = getMetric(
    metrics,
    "atomassist_socket_connections_active"
  );

  const chatMessages = getMetric(metrics, "atomassist_chat_messages_total");
  const files = getMetric(metrics, "atomassist_files_total");
  const recordings = getMetric(metrics, "atomassist_recordings_total");

  const memory = getMetric(metrics, "atomassist_process_resident_memory_bytes");
  const eventLoopLag = getMetric(metrics, "atomassist_nodejs_eventloop_lag_seconds");
  const heapUsed = getMetric(metrics, "atomassist_nodejs_heap_size_used_bytes");

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
              Observability Dashboard
            </div>

            <h1 className="text-3xl font-bold">System Metrics</h1>

            <p className="mt-2 max-w-3xl text-slate-400">
              Human-friendly view of live Prometheus metrics from the AtomAssist
              backend. Raw metrics are still available for Prometheus/Grafana.
            </p>

            {lastUpdatedAt && (
              <p className="mt-2 text-xs text-slate-600">
                Auto-refreshing every 5 seconds. Last updated{" "}
                {lastUpdatedAt.toLocaleTimeString()}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void loadMetrics()}
              className="rounded-xl border border-white/10 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Refresh
            </button>

            <a
              href={`${API_BASE_URL}/metrics`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 font-semibold text-emerald-100 hover:bg-emerald-400/20"
            >
              Raw /metrics
            </a>

            <Link
              to="/admin"
              className="rounded-xl border border-white/10 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Back to Admin
            </Link>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Active sockets" value={activeSockets} />
          <MetricCard label="HTTP requests" value={totalHttpRequests} />
          <MetricCard label="Chat messages" value={chatMessages} />
          <MetricCard label="Files uploaded" value={files} />
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Tab recordings" value={recordings} />
          <MetricCard label="Memory RSS" value={formatBytes(memory)} />
          <MetricCard label="Heap used" value={formatBytes(heapUsed)} />
          <MetricCard label="Event loop lag" value={formatMs(eventLoopLag)} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Sessions by Status</h2>
            <div className="mt-5 space-y-4">
              <MetricBar label="Waiting" value={waitingSessions} total={waitingSessions + activeSessions + endedSessions} />
              <MetricBar label="Active" value={activeSessions} total={waitingSessions + activeSessions + endedSessions} />
              <MetricBar label="Ended" value={endedSessions} total={waitingSessions + activeSessions + endedSessions} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Participants by Status</h2>
            <div className="mt-5 space-y-4">
              <MetricBar label="Connected" value={connectedParticipants} total={connectedParticipants + reconnectingParticipants + leftParticipants} />
              <MetricBar label="Reconnecting" value={reconnectingParticipants} total={connectedParticipants + reconnectingParticipants + leftParticipants} />
              <MetricBar label="Left" value={leftParticipants} total={connectedParticipants + reconnectingParticipants + leftParticipants} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Raw Prometheus Preview</h2>
              <p className="mt-1 text-sm text-slate-500">
                This text endpoint is what Prometheus would scrape.
              </p>
            </div>
          </div>

          <pre className="mt-5 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-400">
            {rawMetrics.slice(0, 6000)}
          </pre>
        </section>
      </div>
    </Shell>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}

function MetricBar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">{value}</span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-slate-900">
        <div
          className="h-full rounded-full bg-cyan-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}