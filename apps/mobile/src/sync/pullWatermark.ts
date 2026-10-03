/**
 * Pull watermark on the server's clock (MUS-91). Rows carry `server_updated_at`, stamped by the
 * database on every write that lands; a device pulls rows newer than the latest one it has seen.
 * Device clocks never enter the comparison, so late uploads and clock skew can't hide a row.
 *
 * Each pull re-reads a short overlap before the watermark, so a row stamped just before it but
 * committed just after (concurrent writes) is still fetched. Rows already applied in that window
 * are remembered by key + stamp and skipped, so the overlap doesn't re-apply them.
 */

/** How far before the watermark each pull starts. */
export const PULL_OVERLAP_MS = 10_000;

export interface PullCursor {
  /** Latest `server_updated_at` applied, as the server returned it. Null → next pull is full. */
  watermark: string | null;
  /** `key@server_updated_at` of applied rows inside the overlap window. */
  seen: string[];
}

/**
 * True when the database doesn't have `server_updated_at` yet (migration not applied): Postgres
 * undefined-column, or PostgREST naming the column. Callers fall back to a full pull.
 */
export function isMissingServerClock(error: { code?: string; message?: string }): boolean {
  return error.code === '42703' || (error.message ?? '').includes('server_updated_at');
}

export const EMPTY_PULL_CURSOR: PullCursor = { watermark: null, seen: [] };

export interface PulledRow {
  /** Entity key (e.g. `session:abc`). */
  key: string;
  serverUpdatedAt: string;
}

function rowId(row: PulledRow): string {
  return `${row.key}@${row.serverUpdatedAt}`;
}

function time(iso: string): number {
  return Date.parse(iso);
}

/** Lower bound for the next pull, or null for a full pull. */
export function pullSince(cursor: PullCursor, options: { full?: boolean } = {}): string | null {
  if (options.full || !cursor.watermark) return null;
  const ms = time(cursor.watermark);
  if (Number.isNaN(ms)) return null;
  return new Date(ms - PULL_OVERLAP_MS).toISOString();
}

/** The rows of a pull that haven't been applied yet. */
export function unseenRows<T>(rows: T[], cursor: PullCursor, toPulled: (row: T) => PulledRow): T[] {
  if (cursor.seen.length === 0) return rows;
  const seen = new Set(cursor.seen);
  return rows.filter((row) => !seen.has(rowId(toPulled(row))));
}

/** The cursor after applying `rows`: the watermark moves to the newest stamp seen, never back. */
export function advancePullCursor(cursor: PullCursor, rows: PulledRow[]): PullCursor {
  let watermark = cursor.watermark;
  for (const row of rows) {
    const t = time(row.serverUpdatedAt);
    if (Number.isNaN(t)) continue;
    if (watermark == null || t > time(watermark)) watermark = row.serverUpdatedAt;
  }
  if (watermark == null) return { watermark: null, seen: [] };
  const floor = time(watermark) - PULL_OVERLAP_MS;
  const seen = new Set<string>();
  for (const id of cursor.seen) {
    const stamp = id.slice(id.lastIndexOf('@') + 1);
    if (time(stamp) >= floor) seen.add(id);
  }
  for (const row of rows) {
    if (time(row.serverUpdatedAt) >= floor) seen.add(rowId(row));
  }
  return { watermark, seen: [...seen] };
}
