import type { Exercise, MuscleId, WorkoutTemplate } from '@muscleos/types';
import { builtInProgram, programTemplates, type BuiltInProgram } from '@/data/builtInTemplates';
import { resolveTemplateExercises } from '@/utils/templateExercises';

/**
 * Rules behind the Programs screens (docs/features/templates.md#programs). At most one program is
 * in Your workouts; choosing another replaces it.
 */

export type ProgramAction =
  | { kind: 'add'; label: string }
  | { kind: 'replace'; label: string; replacing: BuiltInProgram }
  | { kind: 'remove'; label: string };

/** The program detail's footer button, given the program shown and the one in Your workouts. */
export function programAction(programId: string, activeProgramId: string | null): ProgramAction {
  if (activeProgramId === programId) return { kind: 'remove', label: 'Remove from your workouts' };
  const active = builtInProgram(activeProgramId);
  if (active) {
    const program = builtInProgram(programId);
    return { kind: 'replace', label: `Switch to ${program?.name ?? 'this program'}`, replacing: active };
  }
  return { kind: 'add', label: 'Add to your workouts' };
}

/** The line under the footer button. */
export function programActionHint(action: ProgramAction): string {
  switch (action.kind) {
    case 'add':
      return 'Its workouts join your templates on the Workouts tab.';
    case 'replace':
      return `Replaces ${action.replacing.name} in Your workouts. Your templates and history stay.`;
    case 'remove':
      return 'Your templates and history stay.';
  }
}

/** The Programs list's "No program" entry, alongside the real programs. */
export const NO_PROGRAM = 'none' as const;
export type ProgramsListItem = BuiltInProgram | typeof NO_PROGRAM;

/**
 * Programs list order: whatever is chosen first — a program, or No program when none is — then
 * the rest of the programs as shipped. No program goes last while a program is chosen.
 */
export function orderPrograms(
  programs: readonly BuiltInProgram[],
  activeProgramId: string | null
): ProgramsListItem[] {
  const active = programs.find((p) => p.id === activeProgramId);
  if (!active) return [NO_PROGRAM, ...programs];
  return [active, ...programs.filter((p) => p !== active), NO_PROGRAM];
}

/** `3 days/wk · 2 workouts` */
export function programMeta(program: BuiltInProgram): string {
  const n = programTemplates(program.id).length;
  return `${program.daysPerWeek} days/wk · ${n} workout${n === 1 ? '' : 's'}`;
}

export type ProgramDay = {
  template: WorkoutTemplate;
  /** Each exercise with its working sets and the first muscle it lists (its pill on the card). */
  exercises: { exerciseId: string; name: string; sets: number; muscle?: MuscleId }[];
  /** Every muscle the workout trains, de-duplicated in first-seen order (its mini diagram). */
  muscleIds: MuscleId[];
  totalSets: number;
};

/**
 * What the program page shows: each workout with its exercises, working sets and muscles, and the
 * working sets across one pass through every workout (`totalSets`).
 */
export function programOverview(
  programId: string,
  getExercise: (id: string) => Pick<Exercise, 'name' | 'muscles'> | undefined
): { days: ProgramDay[]; totalSets: number } {
  const days = programTemplates(programId).map((template) => {
    const muscles = new Set<MuscleId>();
    const exercises = resolveTemplateExercises(template).map((e) => {
      const exercise = getExercise(e.exerciseId);
      for (const m of exercise?.muscles ?? []) muscles.add(m);
      return {
        exerciseId: e.exerciseId,
        name: exercise?.name ?? e.exerciseId,
        sets: e.sets,
        muscle: exercise?.muscles[0],
      };
    });
    return {
      template,
      exercises,
      muscleIds: [...muscles],
      totalSets: exercises.reduce((n, e) => n + e.sets, 0),
    };
  });
  return { days, totalSets: days.reduce((n, d) => n + d.totalSets, 0) };
}

/** `6 exercises · 18 sets` under a workout's name. */
export function programDayMeta(day: Pick<ProgramDay, 'exercises' | 'totalSets'>): string {
  const n = day.exercises.length;
  return `${n} exercise${n === 1 ? '' : 's'} · ${day.totalSets} set${day.totalSets === 1 ? '' : 's'}`;
}

/** The built-in program a template belongs to, for the preview's "Part of …" link. Customs have none. */
export function programForTemplate(
  template: Pick<WorkoutTemplate, 'isBuiltIn' | 'folderId'> | undefined
): BuiltInProgram | undefined {
  if (template?.isBuiltIn !== true) return undefined;
  return builtInProgram(template.folderId);
}
