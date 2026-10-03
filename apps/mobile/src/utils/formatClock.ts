/**
 * `m:ss` clock label used across the workout UI — elapsed time, rest countdowns, rest presets,
 * recorded rest durations, and the resume pill. Minutes are not wrapped into hours (75:00).
 * Negative or non-finite input reads as 0:00; fractional seconds are floored.
 */
export function formatClock(totalSeconds: number): string {
  const whole = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** {@link formatClock} for a millisecond duration (e.g. workout elapsed time). */
export function formatClockMs(ms: number): string {
  return formatClock(ms / 1000);
}
