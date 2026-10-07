import type { SetRecord, SessionExercise, TemplateExercise, WorkoutSession } from '@muscleos/types';
import type { PersistedActiveWorkout } from '@/storage/localStorage';
import {
  DEFAULT_SETS_PER_EXERCISE,
  clampWarmUpSets,
  clampWorkingSets,
  type ResolvedTemplateExercise,
} from '@/utils/templateExercises';

export { DEFAULT_SETS_PER_EXERCISE } from '@/utils/templateExercises';

/**
 * Pure session-transformation logic for the active workout.
 *
 * These functions hold the set-logging and rest-bookkeeping rules described in
 * docs/features/workout-logging.md. They are deliberately free of Zustand, storage, and
 * React Native so they can be unit-tested; `activeWorkoutStore` is a thin wrapper that calls
 * them and persists the result.
 */

export const DEFAULT_REST_SECONDS = 120;
/** The running timer's ±30 step. */
export const REST_STEP_SECONDS = 30;
/** Floor for the running timer's total when stepping down. A typed preset may be 0:00. */
export const REST_MIN_SECONDS = 30;
/** Longest rest a user can set, including time added to a running timer. */
export const REST_MAX_SECONDS = 15 * 60;
/** −30 never leaves less than this much of a running countdown. */
export const REST_MIN_REMAINING_MS = 1000;
/** A rest that ended this recently counts as "just ended" and plays the in-app sound. */
export const REST_END_SOUND_GRACE_MS = 1500;

export interface RunningRest {
  /** Absolute end of the countdown (epoch ms). */
  endTime: number;
  /** The countdown's full length in seconds: time already rested plus time remaining. */
  total: number;
}

/**
 * The header dialogue's ±30 on a running countdown. Not snapped to a 30-second grid.
 *
 * - **+30** adds up to 30 s, capping the total at 15:00.
 * - **−30** removes up to 30 s, but never takes the total below 30 s or leaves less than 1 s on
 *   the clock. At a 30 s total it does nothing.
 *
 * The end time and the total always move by the same amount, so the progress bar
 * (`(total − left) / total`) and the duration recorded when the rest ends stay true.
 */
export function adjustRunningRest(
  rest: RunningRest,
  direction: 1 | -1,
  now: number
): RunningRest {
  if (direction === 1) {
    const added = Math.max(0, Math.min(REST_STEP_SECONDS, REST_MAX_SECONDS - rest.total));
    return { endTime: rest.endTime + added * 1000, total: rest.total + added };
  }
  const remainingMs = rest.endTime - now;
  const cut = Math.max(
    0,
    Math.min(
      REST_STEP_SECONDS,
      rest.total - REST_MIN_SECONDS,
      Math.floor((remainingMs - REST_MIN_REMAINING_MS) / 1000)
    )
  );
  return { endTime: rest.endTime - cut * 1000, total: rest.total - cut };
}

/** Seconds actually rested when a countdown is skipped: total minus the whole seconds left. */
export function restTakenSeconds(total: number, endTime: number, now: number): number {
  return Math.max(0, total - Math.ceil((endTime - now) / 1000));
}

/** Seconds left on a countdown, rounded up (what the UI shows), or null when no timer runs. */
export function restSecondsLeft(endTime: number | null, now: number): number | null {
  return endTime === null ? null : Math.max(0, Math.ceil((endTime - now) / 1000));
}

export interface RestEndResolution {
  /** The full duration to record against the set the rest followed (none for a manual rest). */
  record?: { exIdx: number; setIdx: number; seconds: number };
  /** True when the countdown ended within the grace window, i.e. the app saw it end live. */
  playEndSound: boolean;
}

/**
 * What to do once a countdown reaches zero, or null while it is still running (or none runs).
 * A rest noticed long after it ended — the app was backgrounded and the OS notification already
 * alerted — still records its duration but skips the in-app sound.
 */
export function resolveRestEnd(
  rest: { restEndTime: number | null; restAfter: RestAfter | null; total: number },
  now: number
): RestEndResolution | null {
  if (rest.restEndTime === null || now < rest.restEndTime) return null;
  return {
    ...(rest.restAfter !== null && {
      record: { exIdx: rest.restAfter.exIdx, setIdx: rest.restAfter.setIdx, seconds: rest.total },
    }),
    playEndSound: now - rest.restEndTime < REST_END_SOUND_GRACE_MS,
  };
}

/** Countdown tick at 3, 2, 1 seconds left — once per second, only while counting down. */
export function shouldPlayRestTick(prev: number | null, left: number): boolean {
  if (left < 1 || left > 3) return false;
  return prev === null || left < prev;
}

export interface RestAfter {
  exIdx: number;
  setIdx: number;
}

export function restKey(exIdx: number, setIdx: number): string {
  return `${exIdx}-${setIdx}`;
}

function plannedSetsForExercise(sets?: number, warmUpSets?: number): SetRecord[] {
  const working = clampWorkingSets(sets);
  const warmUps = clampWarmUpSets(warmUpSets);
  const rows: SetRecord[] = [];
  for (let i = 0; i < warmUps; i++) rows.push({ completed: false, isWarmUp: true });
  for (let i = 0; i < working; i++) rows.push({ completed: false });
  return rows;
}

/** A new session with the template's per-exercise working and warm-up rows. */
export function createEmptySession(
  templateId: string,
  plan: readonly TemplateExercise[],
  now: number = Date.now()
): WorkoutSession {
  return {
    id: 'session_' + now,
    templateId,
    startedAt: new Date(now).toISOString(),
    exercises: plan.map((item) => ({
      exerciseId: item.exerciseId,
      sets: plannedSetsForExercise(item.sets, item.warmUpSets),
    })),
  };
}

/** Remap "exIdx-setIdx" rest duration keys after exercises move; `oldToNew[i] == null` drops key. */
export function remapRestDurations(
  durations: Record<string, number>,
  oldToNew: (number | null | undefined)[]
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, seconds] of Object.entries(durations)) {
    const [exStr, setStr] = key.split('-');
    const oldEx = parseInt(exStr, 10);
    const setIdx = parseInt(setStr, 10);
    if (Number.isNaN(oldEx) || Number.isNaN(setIdx)) continue;
    const newEx = oldToNew[oldEx];
    if (newEx == null || newEx < 0) continue;
    next[restKey(newEx, setIdx)] = seconds;
  }
  return next;
}

export function remapRestAfter(
  restAfter: RestAfter | null,
  oldToNew: (number | null | undefined)[]
): RestAfter | null {
  if (!restAfter) return null;
  const newEx = oldToNew[restAfter.exIdx];
  if (newEx == null || newEx < 0) return null;
  return { exIdx: newEx, setIdx: restAfter.setIdx };
}

/** Adding a warm-up at position 0 shifts every existing set of that exercise up by one. */
export function bumpRestKeysForInsertedSet(
  durations: Record<string, number>,
  exIdx: number
): Record<string, number> {
  const next = { ...durations };
  const keys = Object.keys(durations)
    .map((k) => {
      const [exStr, setStr] = k.split('-');
      return { k, ex: parseInt(exStr, 10), set: parseInt(setStr, 10) };
    })
    .filter((x) => x.ex === exIdx && !Number.isNaN(x.set))
    .sort((a, b) => b.set - a.set);

  for (const { k, set } of keys) {
    next[restKey(exIdx, set + 1)] = durations[k];
    delete next[k];
  }
  return next;
}

/** Drop every rest-duration key belonging to one exercise index (used when that slot is replaced). */
export function dropRestKeysForExercise(
  durations: Record<string, number>,
  exIdx: number
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, seconds] of Object.entries(durations)) {
    const [exStr] = key.split('-');
    const ex = parseInt(exStr, 10);
    if (Number.isNaN(ex) || ex === exIdx) continue;
    next[key] = seconds;
  }
  return next;
}

export function dropRestKeysForRemovedSet(
  durations: Record<string, number>,
  exIdx: number,
  removedSetIdx: number
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, seconds] of Object.entries(durations)) {
    const [exStr, setStr] = key.split('-');
    const ex = parseInt(exStr, 10);
    const set = parseInt(setStr, 10);
    if (Number.isNaN(ex) || Number.isNaN(set)) continue;
    if (ex !== exIdx) {
      next[key] = seconds;
      continue;
    }
    if (set === removedSetIdx) continue;
    next[restKey(exIdx, set > removedSetIdx ? set - 1 : set)] = seconds;
  }
  return next;
}

/**
 * Index map after removing the exercise at `removedIdx`: the removed slot maps to -1, everything
 * after it shifts down by one.
 */
export function oldToNewForRemove(length: number, removedIdx: number): number[] {
  return Array.from({ length }, (_, i) => (i < removedIdx ? i : i === removedIdx ? -1 : i - 1));
}

/** Index map after moving the exercise at `fromIndex` to `toIndex`. */
export function oldToNewForReorder(length: number, fromIndex: number, toIndex: number): number[] {
  return Array.from({ length }, (_, oldIdx) => {
    if (oldIdx === fromIndex) return toIndex;
    if (fromIndex < toIndex) {
      if (oldIdx > fromIndex && oldIdx <= toIndex) return oldIdx - 1;
    } else if (oldIdx >= toIndex && oldIdx < fromIndex) {
      return oldIdx + 1;
    }
    return oldIdx;
  });
}

/**
 * Complete a set and, when the next set is the same kind (warm-up vs working) and has no weight,
 * copy this set's weight into it. Reps are never carried over on complete. Returns a new array.
 */
export function completeSetInSets(sets: SetRecord[], setIndex: number): SetRecord[] {
  if (!sets[setIndex]) return sets;
  const next = [...sets];
  // Completing a set confirms its values, so they are no longer overwrite-on-first-digit
  // suggestions — a later re-open edits them normally.
  const completed = {
    ...next[setIndex],
    completed: true,
    weightPrefilled: false,
    repsPrefilled: false,
  };
  next[setIndex] = completed;
  const nextIdx = setIndex + 1;
  const following = next[nextIdx];
  if (
    following &&
    following.weightKg == null &&
    completed.weightKg != null &&
    (completed.isWarmUp === true) === (following.isWarmUp === true)
  ) {
    // Carried weight is a suggestion for the next set: overwrite it on first digit.
    next[nextIdx] = { ...following, weightKg: completed.weightKg, weightPrefilled: true };
  }
  return next;
}

/** A new working set that carries the previous last set's weight and reps if present. */
export function buildAddedSet(sets: SetRecord[]): SetRecord {
  const lastSet = sets[sets.length - 1];
  return {
    completed: false,
    // Carried values are suggestions: overwrite on first digit, render as ghost.
    ...(lastSet?.weightKg != null && { weightKg: lastSet.weightKg, weightPrefilled: true }),
    ...(lastSet?.reps != null && { reps: lastSet.reps, repsPrefilled: true }),
  };
}

/**
 * Prefill flags are transient editing state, so strip them before a session is stored/synced.
 * Returns a new session; the input is untouched.
 */
export function stripPrefillFlags(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map(({ weightPrefilled, repsPrefilled, ...rest }) => rest),
    })),
  };
}

/**
 * The session as stored on finish: prefill flags stripped and `completedAt` set. `templateId`
 * re-points it at a template saved from this workout ("Save as template"), so history shows that
 * template rather than the one it started from (e.g. `_empty`).
 */
export function completeSession(
  session: WorkoutSession,
  completedAt: string,
  templateId?: string
): WorkoutSession {
  return {
    ...stripPrefillFlags(session),
    completedAt,
    ...(templateId != null && { templateId }),
  };
}

/**
 * The best completed weighted set: highest weight, then highest reps as a tie-break. Only
 * completed sets with a positive weight qualify. Returns undefined when none do.
 */
export function bestCompletedSet(sets: SetRecord[]): SetRecord | undefined {
  return sets
    .filter((s) => s.completed && s.weightKg != null && s.weightKg > 0)
    .sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
}

export interface PreviousSnapshot {
  weightKg: number;
  reps?: number;
}

/** A set can be completed only once it has a positive rep count; weight is optional. */
export function canCompleteSet(set: Pick<SetRecord, 'reps'>): boolean {
  return set.reps != null && set.reps > 0;
}

/**
 * Seconds of rest to start after this set, or null when this set should not start a timer.
 * Warm-ups rest only when `warmUpRestSeconds` is set. Working sets use
 * `restBetweenSetsSeconds`, which defaults to 120. An explicit 0 is no rest.
 */
export function restDurationAfterComplete(
  set: Pick<SetRecord, 'isWarmUp'>,
  exercise: Pick<SessionExercise, 'restBetweenSetsSeconds' | 'warmUpRestSeconds'>
): number | null {
  const seconds =
    set.isWarmUp === true
      ? (exercise.warmUpRestSeconds ?? 0)
      : (exercise.restBetweenSetsSeconds ?? DEFAULT_REST_SECONDS);
  return seconds > 0 ? seconds : null;
}

/** A typed rest, including 0:00. Not snapped to the 30-second grid. */
export function storedRestSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(REST_MAX_SECONDS, Math.max(0, Math.trunc(seconds)));
}

/**
 * When a new exercise appears in the session (start, add, or replace), a set that is completely
 * empty (no weight *and* no reps) is prefilled from the exercise's previous snapshot. Partially
 * filled sets are left alone. Returns the patch to apply, or null when there is nothing to prefill.
 */
export function startPrefillPatch(
  set: Pick<SetRecord, 'weightKg' | 'reps' | 'isWarmUp'>,
  previous: PreviousSnapshot | undefined
): Partial<SetRecord> | null {
  if (!previous) return null;
  if (set.isWarmUp === true) return null;
  if (set.weightKg != null || set.reps != null) return null;
  // Mark both fields as suggestions so the keypad overwrites them on the first digit
  // rather than making the user backspace an auto-loaded value.
  return {
    weightKg: previous.weightKg,
    weightPrefilled: true,
    ...(previous.reps != null && { reps: previous.reps, repsPrefilled: true }),
  };
}

/** Default blank sets, prefilled from a previous snapshot when one exists (same rule as session start). */
export function createPrefillingSets(
  previous?: PreviousSnapshot,
  count: number = DEFAULT_SETS_PER_EXERCISE
): SetRecord[] {
  return Array.from({ length: count }, () => {
    const empty: SetRecord = { completed: false };
    const patch = startPrefillPatch(empty, previous);
    return patch ? { ...empty, ...patch } : empty;
  });
}

/**
 * Session-start prefill: every completely empty **working** set takes its exercise's previous
 * snapshot (see {@link startPrefillPatch}). Applied once, when the workout starts — never again,
 * so a value the user clears stays cleared. Returns the same session object when nothing changes.
 */
export function prefillSession(
  session: WorkoutSession,
  previous: Readonly<Record<string, PreviousSnapshot>>
): WorkoutSession {
  let changed = false;
  const exercises = session.exercises.map((se) => {
    const p = previous[se.exerciseId];
    if (!p) return se;
    let exChanged = false;
    const sets = se.sets.map((set) => {
      const patch = startPrefillPatch(set, p);
      if (!patch) return set;
      exChanged = true;
      return { ...set, ...patch };
    });
    if (!exChanged) return se;
    changed = true;
    return { ...se, sets };
  });
  return changed ? { ...session, exercises } : session;
}

/** True when the exercise is already in the session — the pickers never add a duplicate. */
export function sessionHasExercise(session: WorkoutSession, exerciseId: string): boolean {
  return session.exercises.some((se) => se.exerciseId === exerciseId);
}

/**
 * Swap a slot to a different movement. Logged sets, warm-ups, and per-set rest of the old
 * exercise are discarded — they belong to a different movement. The slot keeps its rest
 * preset and starts with default empty sets prefilled from the new exercise's previous
 * snapshot (PREVIOUS + weight/reps), not the movement it replaced.
 */
export function buildReplacedExercise(
  current: SessionExercise,
  newExerciseId: string,
  previous?: PreviousSnapshot
): SessionExercise {
  return {
    exerciseId: newExerciseId,
    sets: createPrefillingSets(previous),
    ...(current.restBetweenSetsSeconds != null
      ? { restBetweenSetsSeconds: current.restBetweenSetsSeconds }
      : {}),
    ...(current.warmUpRestSeconds != null ? { warmUpRestSeconds: current.warmUpRestSeconds } : {}),
  };
}

export type StartWorkoutParams = {
  exerciseIds?: string;
  /** Parallel working-set counts, e.g. "3,5,3". */
  sets?: string;
  /** Parallel warm-up counts, e.g. "1,0,0". */
  warmUpSets?: string;
  /** Legacy template-wide working-set default. */
  defaultSets?: string;
};

function parseCountList(raw: string | undefined, length: number): Array<number | undefined> {
  if (raw == null || raw === '') return Array.from({ length });
  const parts = raw.split(',');
  return Array.from({ length }, (_, i) => {
    const n = parseInt(parts[i] ?? '', 10);
    return Number.isNaN(n) ? undefined : n;
  });
}

function parsePositiveInt(raw?: string): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = parseInt(raw, 10);
  return !Number.isNaN(n) && n > 0 ? n : undefined;
}

/** Parsed route params for starting a workout from a deep link / template preview. */
export function parseStartParams(params: StartWorkoutParams = {}): ResolvedTemplateExercise[] {
  const ids = (params.exerciseIds ?? '').split(',').filter(Boolean);
  const fallbackSets = parsePositiveInt(params.defaultSets) ?? DEFAULT_SETS_PER_EXERCISE;
  const working = parseCountList(params.sets, ids.length);
  const warmUps = parseCountList(params.warmUpSets, ids.length);
  return ids.map((exerciseId, i) => ({
    exerciseId,
    sets: clampWorkingSets(working[i], fallbackSets),
    warmUpSets: clampWarmUpSets(warmUps[i]),
  }));
}

/** Encode a plan for `/workout-preview` and `/active-workout` route params. */
export function encodeStartParams(plan: readonly ResolvedTemplateExercise[]): {
  exerciseIds: string;
  sets?: string;
  warmUpSets?: string;
} {
  const exerciseIds = plan.map((p) => p.exerciseId).join(',');
  const allDefaultSets = plan.every((p) => p.sets === DEFAULT_SETS_PER_EXERCISE);
  const allNoWarmUp = plan.every((p) => p.warmUpSets === 0);
  return {
    exerciseIds,
    ...(!allDefaultSets && { sets: plan.map((p) => String(p.sets)).join(',') }),
    ...(!allNoWarmUp && { warmUpSets: plan.map((p) => String(p.warmUpSets)).join(',') }),
  };
}

export interface HydratedState {
  session: WorkoutSession;
  restEndTime: number | null;
  restTotalSeconds: number;
  restAfter: RestAfter | null;
  restDurationsBetweenSets: Record<string, number>;
  lastActivityAt: number;
}

/**
 * Normalize a persisted snapshot back into store state on app boot. A rest timer that already
 * expired while the app was dead is dropped (its `restEndTime` is in the past) — but its full
 * duration is first recorded against the set it followed, exactly as if the app had seen it end.
 * Missing fields fall back to their defaults. Snapshots written before `lastActivityAt` existed
 * count from the session start.
 */
export function normalizeHydratedState(
  saved: PersistedActiveWorkout,
  now: number = Date.now()
): HydratedState {
  const restTotalSeconds = saved.restTotalSeconds ?? DEFAULT_REST_SECONDS;
  const restDurationsBetweenSets = { ...(saved.restDurationsBetweenSets ?? {}) };
  const ended = resolveRestEnd(
    { restEndTime: saved.restEndTime ?? null, restAfter: saved.restAfter ?? null, total: restTotalSeconds },
    now
  );
  if (ended?.record) {
    restDurationsBetweenSets[restKey(ended.record.exIdx, ended.record.setIdx)] = ended.record.seconds;
  }
  const restEndTime = saved.restEndTime != null && !ended ? saved.restEndTime : null;
  return {
    session: saved.session,
    restEndTime,
    restTotalSeconds,
    restAfter: restEndTime != null ? saved.restAfter ?? null : null,
    restDurationsBetweenSets,
    lastActivityAt: saved.lastActivityAt ?? new Date(saved.session.startedAt).getTime(),
  };
}

/** A workout with no edits for this long is treated as forgotten and closed out automatically. */
export const STALE_WORKOUT_MS = 3 * 60 * 60 * 1000;

export type StaleWorkoutResolution =
  | { kind: 'finish'; completedAt: string }
  | { kind: 'discard' };

/**
 * What to do with an in-progress workout the user walked away from, or `null` if it isn't stale.
 * A stale workout with completed sets is finished as of its last edit, so history duration,
 * recovery and "trained today" reflect when the lifting happened rather than when the app was next
 * opened. One with nothing completed is discarded, since Finish needs at least one set.
 */
export function resolveStaleWorkout(
  session: WorkoutSession,
  lastActivityAt: number,
  now: number = Date.now()
): StaleWorkoutResolution | null {
  if (now - lastActivityAt < STALE_WORKOUT_MS) return null;
  const hasCompletedSet = session.exercises.some((ex) => ex.sets.some((s) => s.completed));
  if (!hasCompletedSet) return { kind: 'discard' };
  return { kind: 'finish', completedAt: new Date(lastActivityAt).toISOString() };
}

/**
 * The whole "previous" map rebuilt from scratch, e.g. after a session is deleted: per exercise,
 * the best completed weighted set from the **most recent** completed session that has one.
 * In-progress sessions are ignored.
 */
export function rebuildPreviousSnapshot(sessions: WorkoutSession[]): Record<string, PreviousSnapshot> {
  const newestFirst = sessions
    .filter((s) => s.completedAt != null)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  const prev: Record<string, PreviousSnapshot> = {};
  for (const s of newestFirst) {
    for (const se of s.exercises) {
      if (prev[se.exerciseId]) continue;
      const best = bestCompletedSet(se.sets);
      if (best) prev[se.exerciseId] = { weightKg: best.weightKg!, reps: best.reps };
    }
  }
  return prev;
}

/**
 * Overlay each exercise's best completed weighted set onto the existing "previous" snapshot map.
 * Exercises with no qualifying set leave their prior snapshot untouched.
 */
export function buildPreviousSnapshot(
  exercises: SessionExercise[],
  existing: Record<string, PreviousSnapshot>
): Record<string, PreviousSnapshot> {
  const prev = { ...existing };
  for (const se of exercises) {
    const best = bestCompletedSet(se.sets);
    if (best) {
      prev[se.exerciseId] = { weightKg: best.weightKg!, reps: best.reps };
    }
  }
  return prev;
}
