import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { buildExportData } from './localStorage';
import { useAuthStore } from '@/store/authStore';
import { localDayKey } from '@/utils/calendar';

/** `muscleos-export-YYYY-MM-DD.json`, dated by the device's **local** calendar day (not UTC). */
export function exportFilename(now: Date = new Date()): string {
  return `muscleos-export-${localDayKey(now)}.json`;
}

export async function exportAndShareData(): Promise<boolean> {
  const profile = useAuthStore.getState().profile;
  const data = await buildExportData(profile ?? undefined);
  const json = JSON.stringify(data, null, 2);
  const filename = exportFilename();
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: 'Export MuscleOS data',
    });
    return true;
  }
  return false;
}
