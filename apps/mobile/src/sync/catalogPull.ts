import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { catalogRowToExercise } from '@/utils/exerciseNormalize';
import type { Exercise } from '@muscleos/types';
import { advanceWatermark } from './catalogMerge';

export async function fetchCatalogDelta(
  watermark: string
): Promise<{ exercises: Exercise[]; watermark: string }> {
  if (!isSupabaseConfigured()) return { exercises: [], watermark };

  const { data, error } = await supabase
    .from('catalog_exercises')
    .select(
      'id, name, instructions, category, muscles, equipment, aliases, tracking_type, is_published, updated_at'
    )
    .gt('updated_at', watermark)
    .order('updated_at', { ascending: true });

  if (error) {
    if (__DEV__) console.warn('[catalog] pull failed:', error.message);
    return { exercises: [], watermark };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    exercises: rows.map((row) => catalogRowToExercise(row)),
    watermark: advanceWatermark(rows, watermark),
  };
}

