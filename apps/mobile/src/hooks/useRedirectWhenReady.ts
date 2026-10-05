import { useCallback } from 'react';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

/**
 * Replace the current route with `href` (when non-null) once the navigator has mounted.
 *
 * A cold-start deep link renders the target screen before the root navigator is ready, and a plain
 * `router.replace` in `useEffect` then throws "Attempted to navigate before mounting the Root
 * Layout component". expo-router's `useFocusEffect` waits for the loaded navigation state.
 */
export function useRedirectWhenReady(href: Href | null): void {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      if (href != null) router.replace(href);
    }, [href, router])
  );
}
