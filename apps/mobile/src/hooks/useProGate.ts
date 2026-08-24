import { useCallback, useEffect } from 'react';
import { type Href, useRouter } from 'expo-router';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { subscriptionPaywallPath, type ProFeature } from '@/subscription/features';

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

/** Redirects to the paywall when the screen requires Pro. Returns whether access is allowed. */
export function useRequirePro(feature: ProFeature): boolean {
  const router = useRouter();
  const isPro = useSubscriptionStore((s) => s.isPro());

  useEffect(() => {
    if (!isPro) {
      router.replace(subscriptionPaywallPath(feature) as Href);
    }
  }, [feature, isPro, router]);

  return isPro;
}
