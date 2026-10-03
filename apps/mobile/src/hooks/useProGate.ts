import { useCallback } from 'react';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import {
  shouldRedirectToPaywall,
  subscriptionPaywallPath,
  type ProFeature,
} from '@/subscription/features';

/** Returns Pro status and a gate helper that navigates to the paywall when locked. */
export function useProGate() {
  const router = useRouter();
  const isPro = useSubscriptionStore((s) => s.isPro());

  const gatePro = useCallback(
    (feature?: ProFeature): boolean => {
      if (isPro) return true;
      router.push(subscriptionPaywallPath(feature) as Href);
      return false;
    },
    [isPro, router]
  );

  return { isPro, gatePro };
}

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

/**
 * Redirects to the paywall when the screen requires Pro. Returns whether access is allowed.
 * Waits while the subscription is loading, so a Pro user is never bounced before the tier is known.
 */
export function useRequirePro(feature: ProFeature): boolean {
  const isPro = useSubscriptionStore((s) => s.isPro());
  const isLoading = useSubscriptionStore((s) => s.isLoading);
  const redirect = shouldRedirectToPaywall({ isPro, isLoading });
  useRedirectWhenReady(redirect ? (subscriptionPaywallPath(feature) as Href) : null);
  return isPro;
}
