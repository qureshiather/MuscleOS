import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { buildExportData } from './localStorage';
import { useAuthStore } from '@/store/authStore';

export async function exportAndShareData(): Promise<boolean> {
  const profile = useAuthStore.getState().profile;
  const data = await buildExportData(profile ?? undefined);
  const json = JSON.stringify(data, null, 2);
  const filename = `muscleos-export-${new Date().toISOString().slice(0, 10)}.json`;
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
