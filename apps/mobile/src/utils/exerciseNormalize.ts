import type {
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseTrackingType,
  MuscleId,
} from '@muscleos/types';
import { EXERCISE_CATEGORIES } from '@muscleos/types';

const EQUIPMENT: Equipment[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
  'band',
  'ez_bar',
  'other',
];

const TRACKING: ExerciseTrackingType[] = ['weight_reps', 'bodyweight_reps', 'duration'];

function isCategory(value: unknown): value is ExerciseCategory {
  return typeof value === 'string' && (EXERCISE_CATEGORIES as string[]).includes(value);
}

function inferCategory(equipment: Equipment[]): ExerciseCategory {
  if (equipment.includes('cable')) return 'cable';
  if (equipment.includes('machine')) return 'machine';
  if (equipment.includes('bodyweight')) return 'bodyweight';
  return 'free_weight';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

export function normalizeExercise(raw: unknown, fallbackId = 'unknown'): Exercise {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const id = typeof row.id === 'string' && row.id ? row.id : fallbackId;
  const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : id;
  const equipment = asStringArray(row.equipment).filter((e): e is Equipment =>
    EQUIPMENT.includes(e as Equipment)
  );
  const muscles = asStringArray(row.muscles) as MuscleId[];
  const category = isCategory(row.category) ? row.category : inferCategory(equipment);
  const aliases = asStringArray(row.aliases);
  const trackingRaw = row.trackingType ?? row.tracking_type;
  const trackingType = TRACKING.includes(trackingRaw as ExerciseTrackingType)
    ? (trackingRaw as ExerciseTrackingType)
    : 'weight_reps';
  const instructions =
    typeof row.instructions === 'string' && row.instructions.trim()
      ? row.instructions.trim()
      : undefined;
  const isPublished = row.isPublished === false || row.is_published === false ? false : true;

  return {
    id,
    name,
    muscles: muscles.length > 0 ? muscles : (['chest'] as MuscleId[]),
    equipment,
    category,
    ...(aliases.length ? { aliases } : {}),
    trackingType,
    isPublished,
    ...(instructions ? { instructions } : {}),
  };
}

export function catalogRowToExercise(row: Record<string, unknown>): Exercise {
  return normalizeExercise({
    id: row.id,
    name: row.name,
    muscles: row.muscles,
    equipment: row.equipment,
    category: row.category,
    aliases: row.aliases,
    instructions: row.instructions,
    trackingType: row.tracking_type ?? row.trackingType,
    isPublished: row.is_published ?? row.isPublished,
  });
}

export function exerciseToUserRow(
  exercise: Exercise,
  updatedAt: string,
  deletedAt?: string | null
): Record<string, unknown> {
  return {
    id: exercise.id,
    name: exercise.name,
    instructions: exercise.instructions ?? null,
    category: exercise.category,
    muscles: exercise.muscles,
    equipment: exercise.equipment,
    tracking_type: exercise.trackingType ?? 'weight_reps',
    updated_at: updatedAt,
    deleted_at: deletedAt ?? null,
  };
}
