import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/storage/keys';
import type { SyncMeta } from './types';

const DEFAULT_META: SyncMeta = { lastPulledAt: null, lastPushedAt: null };

export async function getSyncMeta(): Promise<SyncMeta> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.syncMeta);
  if (!raw) return { ...DEFAULT_META };
  try {
    return { ...DEFAULT_META, ...(JSON.parse(raw) as SyncMeta) };
  } catch {
    return { ...DEFAULT_META };
  }
}

export async function setSyncMeta(patch: Partial<SyncMeta>): Promise<void> {
  const current = await getSyncMeta();
  await AsyncStorage.setItem(STORAGE_KEYS.syncMeta, JSON.stringify({ ...current, ...patch }));
}
