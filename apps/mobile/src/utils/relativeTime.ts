/**
 * Format a past ISO date as relative time: "1 day ago", "2 hours ago", etc.
 */
export function formatRelative(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
  if (diffDay < 7) return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
  if (diffWeek < 4) return diffWeek === 1 ? '1 week ago' : `${diffWeek} weeks ago`;
  return date.toLocaleDateString();
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Day-grain label for when a muscle should be ready again.
 * Recovery is an estimate — avoid clock times that imply false precision.
 */
export function formatRecoveryReady(untilIso: string, now = new Date()): string {
  const until = new Date(untilIso);
  const dayDiff = Math.round(
    (startOfLocalDay(until) - startOfLocalDay(now)) / (24 * 60 * 60 * 1000)
  );

  if (dayDiff <= 0) return 'Ready later today';
  if (dayDiff === 1) return 'Ready tomorrow';
  if (dayDiff < 7) {
    return `Ready ${until.toLocaleDateString(undefined, { weekday: 'short' })}`;
  }
  return `Ready ${until.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
