/**
 * Strong-style sync merge policy (local-first).
 *
 * 1. Missing local entity → take remote (server fills gaps)
 * 2. Net-new local → keep; pushed via outbox
 * 3. Conflict (both sides have the entity):
 *    - Dirty local (pending outbox) → local wins
 *    - Clean session → last-write-wins: remote updated_at vs local completedAt/startedAt; tie keeps local
 *    - Clean template / folder / custom exercise → no local timestamp, so remote is taken
 * 4. Map / settings snapshots (notes, previous, app_settings):
 *    - Clean, or an empty local map → the remote snapshot replaces local
 *    - Pending local → keep local; union keys, empty local slots fill from remote
 *      (settings: each pending local unit/sound/theme field wins; biodata merges per field)
 * 5. Remote deletes follow the same decision; a remote snapshot delete resets local to empty/defaults.
 */

import type { SyncedAppSettings, UserAppProfile, ExercisePrevious } from '@/storage/localStorage';

export function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/** Decide whether a whole-document entity should take remote or keep local. */
export function decideEntityApply(args: {
  hasLocal: boolean;
  isDirty: boolean;
  localUpdatedAt: string | null;
  remoteUpdatedAt: string;
}): 'take_remote' | 'keep_local' {
  if (!args.hasLocal) return 'take_remote';
  if (args.isDirty) return 'keep_local';
  if (!args.localUpdatedAt) return 'take_remote';
  return args.remoteUpdatedAt > args.localUpdatedAt ? 'take_remote' : 'keep_local';
}

/**
 * When local wins over a newer remote, bump the outbox clock so the subsequent
 * push is not rejected by server-side LWW.
 */
export function bumpUpdatedAtIfNeeded(
  localUpdatedAt: string,
  remoteUpdatedAt: string,
  nowIso = new Date().toISOString()
): string {
  return remoteUpdatedAt > localUpdatedAt ? nowIso : localUpdatedAt;
}

export function mergeStringMap(
  local: Record<string, string>,
  remote: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const l = local[key];
    const r = remote[key];
    if (!isEmptyValue(l)) out[key] = l;
    else if (!isEmptyValue(r)) out[key] = r;
  }
  return out;
}

export function mergeExercisePreviousMap(
  local: Record<string, ExercisePrevious>,
  remote: Record<string, ExercisePrevious>
): Record<string, ExercisePrevious> {
  const out: Record<string, ExercisePrevious> = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const l = local[key];
    const r = remote[key];
    if (l != null && !isEmptyValue(l)) out[key] = l;
    else if (r != null) out[key] = r;
  }
  return out;
}

function mergeProfile(local: UserAppProfile, remote: UserAppProfile): UserAppProfile {
  const out: UserAppProfile = { ...remote };
  for (const [key, value] of Object.entries(local) as [keyof UserAppProfile, unknown][]) {
    if (!isEmptyValue(value)) {
      (out as Record<string, unknown>)[key as string] = value;
    }
  }
  return out;
}

/**
 * Field-aware settings merge: non-empty local wins; empty local slots take remote.
 * Profile keys are merged the same way.
 */
export function mergeAppSettingsPreferLocal(
  local: SyncedAppSettings,
  remote: SyncedAppSettings
): SyncedAppSettings {
  return {
    weightUnit: local.weightUnit ?? remote.weightUnit,
    bodyWeightUnit: local.bodyWeightUnit ?? remote.bodyWeightUnit,
    workoutSoundsEnabled: local.workoutSoundsEnabled ?? remote.workoutSoundsEnabled,
    themePreference: local.themePreference ?? remote.themePreference,
    profile: mergeProfile(local.profile ?? {}, remote.profile ?? {}),
  };
}
