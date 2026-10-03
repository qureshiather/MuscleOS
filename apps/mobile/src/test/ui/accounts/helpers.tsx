/**
 * Accounts-area screen-test helpers: put the auth store into a guest or linked state without a
 * Supabase session.
 */
import type { User } from '@supabase/supabase-js';
import { useAuthStore } from '@/store/authStore';

type Provider = 'apple' | 'google' | 'email';

export function linkedUser(provider: Provider, email = 'lifter@example.com', extra: Provider[] = []): User {
  const providers = [provider, ...extra];
  return {
    id: `user-${provider}`,
    email,
    is_anonymous: false,
    identities: providers.map((p) => ({ provider: p })),
    app_metadata: { provider, providers },
    user_metadata: { full_name: 'Sam Lifter' },
  } as unknown as User;
}

export function signInAs(user: User): void {
  useAuthStore.setState({
    user,
    isAnonymous: false,
    isLoading: false,
    profile: {
      id: user.id,
      accountId: user.id,
      email: user.email ?? undefined,
      displayName: 'Sam Lifter',
      provider: (user.app_metadata?.provider as Provider) ?? 'email',
    },
  });
}

export function signInAsGuest(): void {
  useAuthStore.setState({
    user: { id: 'guest-1', is_anonymous: true } as unknown as User,
    isAnonymous: true,
    profile: null,
    isLoading: false,
  });
}
