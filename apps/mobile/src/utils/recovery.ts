import type { MuscleRecovery } from '@muscleos/types';
import { getRecoveryUntil as getRecoveryUntilBase } from '@muscleos/types';
import { useSettingsStore } from '@/store/settingsStore';

/** Recovery options from the current biodata / protocol settings. */
export function getRecoveryOptions() {
  return { notNatty: !!useSettingsStore.getState().profile.notNatty };
}

export function getRecoveryUntil(r: MuscleRecovery): string {
  return getRecoveryUntilBase(r, getRecoveryOptions());
}
