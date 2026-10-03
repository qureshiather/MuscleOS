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
    select: [] as Array<{ table: string; since: string | null }>,
    upsert: [] as Array<{ table: string; rows: Row[] }>,
  };
  const failures: {
    rpc: Partial<Record<string, PgError>>;
    select: Partial<Record<string, PgError>>;
    upsert: Partial<Record<string, PgError>>;
  } = { rpc: {}, select: {}, upsert: {} };
  /** Optional hook run inside an RPC call, e.g. to enqueue while a push is in flight. */
  const hooks: { duringRpc?: () => Promise<void> } = {};

  function upsertInto(table: string, rows: Row[], key: (r: Row) => string) {
    const list = tables[table] ?? [];
    for (const row of rows) {
      const i = list.findIndex((r) => key(r) === key(row));
      if (i >= 0) list[i] = { ...list[i], ...row };
      else list.push({ ...row });
    }
    tables[table] = list;
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
      const builder = {
        select(_cols: string) {
          return builder;
        },
        gt(_col: string, value: string) {
          since = value;
          return builder;
        },
        async order(_col: string, _opts?: unknown) {
          calls.select.push({ table, since });
          const error = failures.select[table];
          if (error) return { data: null, error };
          const rows = (tables[table] ?? []).filter((r) => since == null || String(r.updated_at) > since);
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
  }

  return { client, tables, calls, failures, hooks, reset };
}
