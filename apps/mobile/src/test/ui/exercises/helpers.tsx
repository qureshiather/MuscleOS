import type { Exercise } from '@muscleos/types';
import { useExercisesStore } from '@/store/exercisesStore';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import ExercisesScreen from '../../../../app/(tabs)/exercises';
import CreateExerciseScreen from '../../../../app/create-exercise';
import { renderApp, routeStub } from '../render';

export function exercise(id: string, name: string, extra: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name,
    muscles: ['chest'],
    equipment: ['barbell'],
    category: 'free_weight',
    isPublished: true,
    ...extra,
  };
}

/** A small catalog so lists render fully (FlatList only mounts the first window). */
export const CATALOG: Exercise[] = [
  exercise('bench-press', 'Bench Press', {
    muscles: ['chest', 'triceps'],
    instructions: 'Lower the bar to your chest and press.',
  }),
  exercise('back-squat', 'Back Squat', { muscles: ['quads', 'glutes'] }),
  exercise('lat-pulldown', 'Lat Pulldown', {
    muscles: ['lats', 'biceps'],
    equipment: ['cable'],
    category: 'cable',
  }),
  exercise('pec-deck', 'Pec Deck', { equipment: ['machine'], category: 'machine' }),
  exercise('push-up', 'Push-Up', {
    muscles: ['chest', 'triceps'],
    equipment: ['bodyweight'],
    category: 'bodyweight',
  }),
  exercise('stationary-bike', 'Stationary Bike', {
    muscles: ['quads'],
    equipment: ['machine'],
    category: 'machine',
    isPublished: false,
  }),
];

export function seedExercises(custom: Exercise[] = [], catalog: Exercise[] = CATALOG): void {
  useExercisesStore.setState({ catalogExercises: catalog, customExercises: custom, isLoading: false });
  useExerciseNotesStore.setState({ notes: {}, isLoading: false });
}

export function renderExercises(initialUrl = '/exercises') {
  return renderApp(
    {
      '(tabs)/exercises': ExercisesScreen,
      'create-exercise': CreateExerciseScreen,
      'active-workout': routeStub('active-workout'),
      'exercise-progression': routeStub('exercise-progression'),
    },
    initialUrl
  );
}
