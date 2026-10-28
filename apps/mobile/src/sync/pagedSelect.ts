/**
 * PostgREST caps every response at `max_rows` (1000, supabase/config.toml), silently. Pulls page
 * through `.range()` until a short page so no row past the cap is skipped — the shared pull cursor
 * would otherwise move past rows that were never fetched.
 */
export const PULL_PAGE_SIZE = 1000;

type Page<T> = { data: T[] | null; error: { code?: string; message?: string } | null };

/** Run `fetchPage(from, to)` (inclusive offsets) until a page comes back short. */
export async function selectAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = PULL_PAGE_SIZE
): Promise<Page<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
