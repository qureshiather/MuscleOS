/**
 * In-memory stand-in for the slice of the Supabase client that sync uses: `rpc`, and
 * `from(table).select().gt().order()` / `.upsert()`. Rows live in `tables`; failures are injected
 * through `failures`. Tests swap it in with `vi.mock('@/lib/supabase', ...)`.
 */
type Row = Record<string, unknown>;
type PgError = { message: string; code?: string };

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;

export function createFakeSupabase() {
  const tables: Record<string, Row[]> = { sync_records: [], user_exercises: [] };
  const calls = {
    rpc: [] as Array<{ name: string; args: { records: Row[] } }>,
    select: [] as Array<{ table: string; since: string | null; column: string }>,
    upsert: [] as Array<{ table: string; rows: Row[] }>,
  };
  const failures: {
    rpc: Partial<Record<string, PgError>>;
    select: Partial<Record<string, PgError>>;
    upsert: Partial<Record<string, PgError>>;
  } = { rpc: {}, select: {}, upsert: {} };
  /** Optional hook run inside an RPC call, e.g. to enqueue while a push is in flight. */
  const hooks: { duringRpc?: () => Promise<void> } = {};
  /**
   * The database clock that stamps `server_updated_at` on every write (MUS-91 trigger). Tests move
   * it independently of device time. `hasServerClock: false` simulates the column not existing.
   */
  const server = { now: '2026-06-01T00:00:00.000Z', hasServerClock: true };

  function upsertInto(table: string, rows: Row[], key: (r: Row) => string) {
    const list = tables[table] ?? [];
    for (const row of rows) {
      const stamped = server.hasServerClock ? { ...row, server_updated_at: server.now } : { ...row };
      const i = list.findIndex((r) => key(r) === key(row));
      if (i >= 0) list[i] = { ...list[i], ...stamped };
      else list.push(stamped);
    }
    tables[table] = list;
  }

  /** Seed rows as if another device had written them at the current server time. */
  function serverInsert(table: string, rows: Row[]) {
    upsertInto(table, rows, table === 'user_exercises' ? userKey : syncKey);
  }

  const syncKey = (r: Row) => `${r.entity_type}:${r.entity_id}`;
  const userKey = (r: Row) => String(r.id);

  const client = {
    async rpc(name: string, args: { records: Row[] }) {
      calls.rpc.push({ name, args });
      if (hooks.duringRpc) await hooks.duringRpc();
      const error = failures.rpc[name];
      if (error) return { data: null, error };
      if (name === 'upsert_sync_records') upsertInto('sync_records', args.records, syncKey);
      if (name === 'upsert_user_exercises') upsertInto('user_exercises', args.records, userKey);
      return { data: null, error: null };
    },
    from(table: string) {
      let since: string | null = null;
      let sinceColumn: string | null = null;
      const builder = {
        select(_cols: string) {
          return builder;
        },
        gt(col: string, value: string) {
          since = value;
          sinceColumn = col;
          return builder;
        },
        async order(col: string, _opts?: unknown) {
          calls.select.push({ table, since, column: sinceColumn ?? col });
          const error = failures.select[table];
          if (error) return { data: null, error };
          const usesServerClock = col === 'server_updated_at' || sinceColumn === 'server_updated_at';
          if (usesServerClock && !server.hasServerClock) {
            return {
              data: null,
              error: { code: '42703', message: `column ${table}.server_updated_at does not exist` },
            };
          }
          const rows = (tables[table] ?? []).filter(
            (r) => since == null || Date.parse(String(r[sinceColumn ?? 'updated_at'])) > Date.parse(since)
          );
          rows.sort((a, b) => Date.parse(String(a[col])) - Date.parse(String(b[col])));
          return { data: rows.map((r) => ({ ...r })), error: null };
        },
        async upsert(rows: Row[], _opts?: unknown) {
          calls.upsert.push({ table, rows });
          const error = failures.upsert[table];
          if (error) return { error };
          upsertInto(table, rows, table === 'user_exercises' ? userKey : syncKey);
          return { error: null };
        },
      };
      return builder;
    },
  };

  function reset() {
    tables.sync_records = [];
    tables.user_exercises = [];
    calls.rpc.length = 0;
    calls.select.length = 0;
    calls.upsert.length = 0;
    failures.rpc = {};
    failures.select = {};
    failures.upsert = {};
    hooks.duringRpc = undefined;
    server.now = '2026-06-01T00:00:00.000Z';
    server.hasServerClock = true;
  }

  return { client, tables, calls, failures, hooks, server, serverInsert, reset };
}
