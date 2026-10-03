import { beforeEach, describe, expect, it } from 'vitest';
import AsyncStorage, { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import { STORAGE_KEYS } from '@/storage/keys';
import {
  clearOutbox,
  commitOutboxEdits,
  enqueueOutbox,
  enqueueOutboxMany,
  getOutbox,
  getOutboxMap,
  outboxEntryKey,
  reconcileOutbox,
  removeOutboxEntries,
  setOutbox,
  upsertOutboxEntries,
} from './outbox';
import type { OutboxEntry } from './types';

/** docs/features/accounts-and-data.md#cloud-sync — the sync outbox (one entry per entity). */

const T1 = '2026-01-01T10:00:00.000Z';
const T2 = '2026-01-02T10:00:00.000Z';

const entry = (entityId: string, updatedAt = T1, payload: unknown = { id: entityId }): OutboxEntry => ({
  entityType: 'session',
  entityId,
  op: 'upsert',
  payload,
  updatedAt,
});

beforeEach(() => __resetAsyncStorage());

describe('outbox keys and replacement', () => {
  it('keys entries by entity type and id', () => {
    expect(outboxEntryKey('template', 't1')).toBe('template:t1');
  });

  it('replaces an entry for the same entity instead of adding a second one', async () => {
    await enqueueOutbox(entry('s1', T1));
    await enqueueOutbox(entry('s2', T1));
    await enqueueOutbox({ ...entry('s1', T2), op: 'delete', payload: undefined });
    const outbox = await getOutbox();
    expect(outbox.map((e) => `${e.entityId}:${e.op}`)).toEqual(['s2:upsert', 's1:delete']);
  });

  it('the same id under another entity type is a different entry', () => {
    const next = upsertOutboxEntries([{ ...entry('x'), entityType: 'template' }], [entry('x')]);
    expect(next).toHaveLength(2);
  });

  it('enqueueOutboxMany keeps the last entry per entity', async () => {
    await enqueueOutboxMany([entry('s1', T1), entry('s1', T2)]);
    expect(await getOutbox()).toEqual([entry('s1', T2)]);
  });

  it('reads a corrupt or non-array blob as empty', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.syncOutbox, '{not json');
    expect(await getOutbox()).toEqual([]);
    await AsyncStorage.setItem(STORAGE_KEYS.syncOutbox, '{"a":1}');
    expect(await getOutbox()).toEqual([]);
  });

  it('clearOutbox and an empty setOutbox remove the key', async () => {
    await setOutbox([entry('s1')]);
    expect((await getOutboxMap()).has('session:s1')).toBe(true);
    await clearOutbox();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.syncOutbox)).toBeNull();
  });
});

describe('serialized mutations (H2)', () => {
  it('concurrent enqueues all land', async () => {
    await Promise.all(Array.from({ length: 25 }, (_, i) => enqueueOutbox(entry(`s${i}`))));
    expect(await getOutbox()).toHaveLength(25);
  });

  it('an enqueue issued while an edit is being committed is not lost', async () => {
    const before = [entry('s1')];
    await setOutbox(before);
    await Promise.all([commitOutboxEdits(before, []), enqueueOutbox(entry('s2'))]);
    expect((await getOutbox()).map((e) => e.entityId)).toEqual(['s2']);
  });

  it('a failed mutation does not block the queue', async () => {
    const { mutateOutbox } = await import('./outbox');
    await expect(
      mutateOutbox(() => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    await enqueueOutbox(entry('s1'));
    expect(await getOutbox()).toHaveLength(1);
  });
});

describe('reconcileOutbox / removeOutboxEntries', () => {
  it('removes only the entries that were read, and keeps entries queued since', async () => {
    const pushed = [entry('s1'), entry('s2')];
    await setOutbox(pushed);
    await enqueueOutbox(entry('s3'));
    await removeOutboxEntries(pushed);
    expect((await getOutbox()).map((e) => e.entityId)).toEqual(['s3']);
  });

  it('keeps an entry that was re-queued (changed) after it was read', async () => {
    const pushed = [entry('s1', T1)];
    await setOutbox(pushed);
    await enqueueOutbox(entry('s1', T2, { id: 's1', edited: true }));
    await removeOutboxEntries(pushed);
    expect(await getOutbox()).toEqual([entry('s1', T2, { id: 's1', edited: true })]);
  });

  it('applies replacements and additions computed from the snapshot', () => {
    const before = [entry('a', T1), entry('b', T1)];
    const after = [entry('a', T2), entry('c', T1)];
    expect(reconcileOutbox(before, after, before)).toEqual([entry('a', T2), entry('c', T1)]);
  });

  it('does not resurrect an entry removed from the live outbox since the read', () => {
    const before = [entry('a', T1)];
    expect(reconcileOutbox(before, [entry('a', T2)], [])).toEqual([]);
  });

  it('live entries the edit never saw are untouched', () => {
    expect(reconcileOutbox([], [], [entry('z')])).toEqual([entry('z')]);
  });
});
