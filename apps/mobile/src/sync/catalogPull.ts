import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { catalogRowToExercise } from '@/utils/exerciseNormalize';
import type { Exercise } from '@muscleos/types';

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

  const rows = data ?? [];
  let nextWatermark = watermark;
  for (const row of rows) {
    const updatedAt = (row as { updated_at?: string }).updated_at;
    if (updatedAt && updatedAt > nextWatermark) nextWatermark = updatedAt;
  }

  return {
    exercises: rows.map((row) => catalogRowToExercise(row as Record<string, unknown>)),
    watermark: nextWatermark,
  };
}

