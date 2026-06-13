export function formatDurationSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatDurationFromDates(
  startedAt?: string | null,
  endedAt?: string | null
) {
  if (!startedAt) return "Not started";

  const startMs = new Date(startedAt).getTime();
  const endMs = endedAt ? new Date(endedAt).getTime() : Date.now();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "-";
  }

  return formatDurationSeconds((endMs - startMs) / 1000);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString();
}