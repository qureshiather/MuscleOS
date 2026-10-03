import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/storage/keys';
import type { OutboxEntry, SyncEntityType } from './types';

/**
 * The outbox is one AsyncStorage blob that several callers read-modify-write (notify*, merge,
 * import, push). Every mutation goes through `mutateOutbox`, which runs them one at a time so a
 * write never drops an entry queued while it was in flight.
 */

export function outboxEntryKey(entityType: SyncEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

function keyOf(entry: OutboxEntry): string {
  return outboxEntryKey(entry.entityType, entry.entityId);
}

let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function readOutbox(): Promise<OutboxEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.syncOutbox);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeOutbox(entries: OutboxEntry[]): Promise<void> {
  if (entries.length === 0) {
    await AsyncStorage.removeItem(STORAGE_KEYS.syncOutbox);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEYS.syncOutbox, JSON.stringify(entries));
}

/** Read-modify-write the outbox, serialized with every other outbox mutation. */
export function mutateOutbox(update: (entries: OutboxEntry[]) => OutboxEntry[]): Promise<OutboxEntry[]> {
  return serialize(async () => {
    const next = update(await readOutbox());
    await writeOutbox(next);
    return next;
  });
}

/** Waits for queued mutations, so a read sees every enqueue that was called before it. */
export function getOutbox(): Promise<OutboxEntry[]> {
  return serialize(readOutbox);
}

export async function getOutboxMap(): Promise<Map<string, OutboxEntry>> {
  const outbox = await getOutbox();
  return new Map(outbox.map((entry) => [keyOf(entry), entry]));
}

/** Add or replace entries; one entry per entity, the last one queued wins. */
export function upsertOutboxEntries(entries: OutboxEntry[], into: OutboxEntry[]): OutboxEntry[] {
  const incoming = new Map(entries.map((entry) => [keyOf(entry), entry]));
  return [...into.filter((e) => !incoming.has(keyOf(e))), ...incoming.values()];
}

export async function enqueueOutbox(entry: OutboxEntry): Promise<void> {
  await mutateOutbox((current) => upsertOutboxEntries([entry], current));
}

export async function enqueueOutboxMany(entries: OutboxEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await mutateOutbox((current) => upsertOutboxEntries(entries, current));
}

function sameEntry(a: OutboxEntry | undefined, b: OutboxEntry | undefined): boolean {
  if (!a || !b) return a === b;
  return a.op === b.op && a.updatedAt === b.updatedAt && JSON.stringify(a.payload) === JSON.stringify(b.payload);
}

/**
 * Apply edits computed from an earlier read (`before` → `after`) onto the current outbox. An entry
 * that changed since that read was re-queued by the user meanwhile, so the newer one is kept.
 * Entries missing from `after` are removed; entries only in `current` are untouched; entries only in
 * `after` are added. An entry removed from the live outbox since the read (already pushed) stays gone.
 */
export function reconcileOutbox(
  before: OutboxEntry[],
  after: OutboxEntry[],
  current: OutboxEntry[]
): OutboxEntry[] {
  const beforeMap = new Map(before.map((e) => [keyOf(e), e]));
  const afterMap = new Map(after.map((e) => [keyOf(e), e]));
  const out: OutboxEntry[] = [];
  const seen = new Set<string>();
  for (const entry of current) {
    const key = keyOf(entry);
    seen.add(key);
    const prior = beforeMap.get(key);
    if (prior && sameEntry(prior, entry)) {
      const replacement = afterMap.get(key);
      if (replacement) out.push(replacement);
    } else {
      // Untouched by the edit, or re-queued since the read: the live entry wins.
      out.push(entry);
    }
  }
  for (const [key, entry] of afterMap) {
    if (!seen.has(key) && !beforeMap.has(key)) out.push(entry);
  }
  return out;
}

/** Commit edits made against a snapshot read earlier, without losing entries queued since. */
export async function commitOutboxEdits(before: OutboxEntry[], after: OutboxEntry[]): Promise<void> {
  await mutateOutbox((current) => reconcileOutbox(before, after, current));
}

/** Remove exactly these entries, unless they were re-queued (changed) after being read. */
export async function removeOutboxEntries(entries: OutboxEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await commitOutboxEdits(entries, []);
}

export async function setOutbox(entries: OutboxEntry[]): Promise<void> {
  await mutateOutbox(() => entries);
}

export async function clearOutbox(): Promise<void> {
  await mutateOutbox(() => []);
}
