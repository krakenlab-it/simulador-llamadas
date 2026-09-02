/** Elapsed seconds between call start and hang-up. Null if still in progress. */
export function durationSecondsBetween(
  startedAt: Date | string,
  endedAt: Date | string | null | undefined,
): number | null {
  if (!endedAt) return null;
  const startMs =
    startedAt instanceof Date ? startedAt.getTime() : Date.parse(startedAt);
  const endMs = endedAt instanceof Date ? endedAt.getTime() : Date.parse(endedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

export function formatDurationLabel(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes} min` : `${minutes} min ${remainder} s`;
}
