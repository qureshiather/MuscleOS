import { memo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { Exercise } from '@muscleos/types';
import { ExerciseMuscleFigures } from '@/components/ExerciseMuscleFigures';
import { useTheme } from '@/theme/ThemeContext';
import { exerciseDemoPosterUrl } from '@/utils/exerciseDemo';

/**
 * A square still of the exercise: its demo poster, or the front/back body figures for customs and
 * when the poster can't load. Grids and lists use this rather than a playing clip per row.
 * Spec: docs/features/exercise-demos.md#app-player
 */
export const ExerciseThumb = memo(function ExerciseThumb({
  exercise,
  size,
}: {
  exercise: Pick<Exercise, 'id' | 'isPublished' | 'muscles'>;
  size: number;
}) {
  const { isDark } = useTheme();
  const posterUrl = exerciseDemoPosterUrl(exercise, isDark ? 'dark' : 'light');
  const [posterFailed, setPosterFailed] = useState(false);
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {posterUrl && !posterFailed ? (
        <Image
          source={{ uri: posterUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setPosterFailed(true)}
          testID={`exercise-poster-${exercise.id}`}
        />
      ) : (
        <ExerciseMuscleFigures muscles={exercise.muscles} width={Math.floor(size * 0.36)} gap={Math.max(1, Math.round(size / 40))} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
