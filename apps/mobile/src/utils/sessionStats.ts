import type { SetRecord, WorkoutSession } from '@muscleos/types';
import { kgToDisplay, type WeightUnit } from '@/utils/weightUnits';

/**
 * History card volume: Σ weightKg × reps over **completed** sets. Warm-ups are not excluded;
 * sets missing weight or reps contribute zero. Stored in kg; see {@link formatVolume} for display.
 */
export function sessionVolumeKg(session: WorkoutSession): number {
  let total = 0;
  for (const se of session.exercises) {
    for (const set of se.sets) {
      if (!set.completed) continue;
      total += (set.weightKg ?? 0) * (set.reps ?? 0);
    }
  }
  return total;
}

/**
 * `completedAt − startedAt` to the nearest minute: `45m`, `1h 15m`, `2h`. Null while in progress
 * and for sessions under a minute, so a card never reads `0m`.
 */
export function formatSessionDuration(session: WorkoutSession): string | null {
  if (!session.startedAt || !session.completedAt) return null;
  const ms = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
  if (!(ms >= 60_000)) return null;
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * One exercise's completed sets as a single history line, in the user's weight unit.
 *
 * Consecutive sets at the same weight merge into a group, so the line still reads in the order
 * the sets were done. A group whose reps all match collapses to `3 × 8`; otherwise reps are
 * listed `10 / 10 / 9`. Groups are joined with ` · ` and the unit appears once at the end:
 * `3 × 8 @ 70 kg`, `8 @ 70 · 8 @ 80 · 6 @ 85 kg`, `10 / 8 / 7`. Unweighted sets are bodyweight;
 * they read `BW` only when the same line also has weighted sets: `12 BW · 2 × 8 @ 10 kg`.
 */
export function formatSetGroups(sets: readonly SetRecord[], unit: WeightUnit): string {
  const groups: { weight: number | null; reps: string[] }[] = [];
  for (const set of sets) {
    const weight = set.weightKg != null && set.weightKg > 0 ? kgToDisplay(set.weightKg, unit) : null;
    const reps = set.reps != null ? `${set.reps}` : '?';
    const last = groups[groups.length - 1];
    if (last && last.weight === weight) last.reps.push(reps);
    else groups.push({ weight, reps: [reps] });
  }
  const anyWeighted = groups.some((g) => g.weight != null);
  const parts = groups.map(({ weight, reps }) => {
    const repLabel =
      reps.length > 1 && reps.every((r) => r === reps[0]) ? `${reps.length} × ${reps[0]}` : reps.join(' / ');
    if (weight != null) return `${repLabel} @ ${weight}`;
    return anyWeighted ? `${repLabel} BW` : repLabel;
  });
  return parts.join(' · ') + (anyWeighted ? ` ${unit}` : '');
}

/** Session volume in the user's weight unit, rounded to a whole number: `16,456 kg`, `36,280 lb`. */
export function formatVolume(volumeKg: number, unit: WeightUnit): string {
  const value = unit === 'lb' ? kgToDisplay(volumeKg, 'lb') : volumeKg;
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${unit}`;
}

/**
 * Week-header volume: whole numbers below 10,000 (`8,240 kg`), then one decimal in thousands
 * (`12.1k kg`) so the header stays one line.
 */
export function formatCompactVolume(volumeKg: number, unit: WeightUnit): string {
  const value = unit === 'lb' ? kgToDisplay(volumeKg, 'lb') : volumeKg;
  if (value < 10_000) return formatVolume(volumeKg, unit);
  return `${(Math.round(value / 100) / 10).toLocaleString('en-US')}k ${unit}`;
}
