import type { SetRecord, WorkoutSession } from '@muscleos/types';
import { estimatedOneRepMax } from '@/utils/oneRepMax';
import { formatSessionDuration, formatVolume, sessionVolumeKg } from '@/utils/sessionStats';
import { kgToDisplay, type WeightUnit } from '@/utils/weightUnits';

/**
 * What the shareable workout image shows (`WorkoutShareCard`). Pure, so the card's content is
 * unit-tested; the component only lays it out.
 * Spec: docs/features/history-analytics.md#sharing-a-workout
 */

/** Lifts listed on the card; the rest collapse into "+N more". */
export const SHARE_CARD_MAX_LIFTS = 6;
/** Where the card sends people. */
export const SHARE_CARD_URL = 'muscleos.app';

export type ShareCardLift = {
  exerciseId: string;
  name: string;
  /** The lift's best set: `100 kg × 5`, or `12 reps` for bodyweight. */
  bestSet: string;
  isPR: boolean;
};

export type ShareCardModel = {
  title: string;
  /** `Tue, Sep 15` */
  date: string;
  stats: { label: string; value: string }[];
  lifts: ShareCardLift[];
  /** Lifts left off the card. */
  moreCount: number;
};

/** The set to show for a lift: highest estimated 1RM, or the most reps when none is weighted. */
export function bestSetLabel(sets: readonly SetRecord[], unit: WeightUnit): string | null {
  const done = sets.filter((s) => s.completed && (s.reps ?? 0) > 0);
  if (done.length === 0) return null;
  const weighted = done.filter((s) => (s.weightKg ?? 0) > 0);
  if (weighted.length > 0) {
    const best = weighted.reduce((a, b) =>
      estimatedOneRepMax(b.weightKg ?? 0, b.reps ?? 0) > estimatedOneRepMax(a.weightKg ?? 0, a.reps ?? 0) ? b : a
    );
    return `${kgToDisplay(best.weightKg ?? 0, unit)} ${unit} × ${best.reps}`;
  }
  const reps = Math.max(...done.map((s) => s.reps ?? 0));
  return `${reps} rep${reps === 1 ? '' : 's'}`;
}

export function shareCardModel(
  session: WorkoutSession,
  opts: {
    title: string;
    nameOf: (exerciseId: string) => string;
    unit: WeightUnit;
    /** Exercises that set a new best e1RM in this session. */
    prExerciseIds?: ReadonlySet<string>;
    /** Formats the session date; injectable so tests don't depend on the device locale. */
    formatDate?: (iso: string) => string;
  }
): ShareCardModel {
  const formatDate =
    opts.formatDate ??
    ((iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));

  const all: ShareCardLift[] = [];
  let sets = 0;
  for (const se of session.exercises) {
    const label = bestSetLabel(se.sets, opts.unit);
    sets += se.sets.filter((s) => s.completed).length;
    if (!label) continue;
    all.push({
      exerciseId: se.exerciseId,
      name: opts.nameOf(se.exerciseId),
      bestSet: label,
      isPR: opts.prExerciseIds?.has(se.exerciseId) ?? false,
    });
  }

  const duration = formatSessionDuration(session);
  const volumeKg = sessionVolumeKg(session);
  const stats = [
    ...(duration ? [{ label: 'Duration', value: duration }] : []),
    { label: 'Sets', value: String(sets) },
    ...(volumeKg > 0 ? [{ label: 'Volume', value: formatVolume(volumeKg, opts.unit) }] : []),
  ];

  return {
    title: opts.title,
    date: formatDate(session.completedAt ?? session.startedAt),
    stats,
    lifts: all.slice(0, SHARE_CARD_MAX_LIFTS),
    moreCount: Math.max(0, all.length - SHARE_CARD_MAX_LIFTS),
  };
}
