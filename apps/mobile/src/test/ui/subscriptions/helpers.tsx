/**
 * Helpers for the subscription / Pro gate screen tests (docs/features/subscriptions.md#gate-map).
 */
import type { WorkoutTemplate } from '@muscleos/types';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { resetAppState, routeStub } from '../render';

export const CUSTOM_TEMPLATE: WorkoutTemplate = {
  id: 'tpl_custom_1',
  name: 'My Push',
  isBuiltIn: false,
  exerciseIds: ['bench-press', 'lateral-raise'],
};

/** Basic, templates loaded (none custom), no workout in progress, linked account. */
export async function resetGateState(): Promise<void> {
  await resetAppState();
  useActiveWorkoutStore.setState({ session: null, hydrated: true });
  useTemplatesStore.setState({
    userTemplates: [],
    folders: [],
    hiddenBuiltInIds: [],
    hiddenBuiltInFolderIds: [],
    isLoading: false,
  });
  useAuthStore.setState({ isAnonymous: false });
}

export function seedCustomTemplates(templates: WorkoutTemplate[] = [CUSTOM_TEMPLATE]): void {
  useTemplatesStore.setState({ userTemplates: templates, isLoading: false });
}

/** The tier hasn't been read yet (cold start, nothing cached). */
export function setSubscriptionLoading(): void {
  useSubscriptionStore.setState({ state: null, isLoading: true });
}

/** Routes most gate tests navigate to without rendering. */
export const stubs = {
  subscription: routeStub('subscription'),
  'create-template': routeStub('create-template'),
  'create-exercise': routeStub('create-exercise'),
  'personal-records': routeStub('personal-records'),
  'history-monthly': routeStub('history-monthly'),
  'workout-preview': routeStub('workout-preview'),
  'active-workout': routeStub('active-workout'),
  auth: routeStub('auth'),
};
