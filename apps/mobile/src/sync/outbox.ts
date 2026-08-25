import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/storage/keys';
import type { OutboxEntry, SyncEntityType } from './types';

export function outboxEntryKey(entityType: SyncEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export async function getOutbox(): Promise<OutboxEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.syncOutbox);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OutboxEntry[];
  } catch {
    return [];
  }
}

export async function getOutboxMap(): Promise<Map<string, OutboxEntry>> {
  const outbox = await getOutbox();
  return new Map(outbox.map((entry) => [outboxEntryKey(entry.entityType, entry.entityId), entry]));
}

export async function enqueueOutbox(entry: OutboxEntry): Promise<void> {
  const outbox = await getOutbox();
  const key = outboxEntryKey(entry.entityType, entry.entityId);
  const next = [...outbox.filter((e) => outboxEntryKey(e.entityType, e.entityId) !== key), entry];
  await AsyncStorage.setItem(STORAGE_KEYS.syncOutbox, JSON.stringify(next));
}

export async function setOutbox(entries: OutboxEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.syncOutbox, JSON.stringify(entries));
}

export async function clearOutbox(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.syncOutbox);
}
