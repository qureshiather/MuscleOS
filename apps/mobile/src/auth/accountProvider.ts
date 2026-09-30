import type { AuthProvider } from '@muscleos/types';

export const AUTH_PROVIDER_LABEL: Record<AuthProvider, string> = {
  apple: 'Apple ID',
  google: 'Google',
  email: 'Email',
};

const LINKED_PROVIDERS: AuthProvider[] = ['apple', 'google', 'email'];

export function isAuthProvider(value: string): value is AuthProvider {
  return value === 'apple' || value === 'google' || value === 'email';
}

/** Prefer a linked Apple / Google / email identity over the anonymous bootstrap provider. */
export function linkedAuthProvider(user: {
  identities?: { provider: string }[] | null;
  app_metadata?: { provider?: string; providers?: string[] } | null;
}): AuthProvider {
  const fromIdentities = (user.identities ?? []).map((i) => i.provider).filter(isAuthProvider);
  for (const provider of LINKED_PROVIDERS) {
    if (fromIdentities.includes(provider)) return provider;
  }

  const metaProviders = user.app_metadata?.providers ?? [];
  for (const provider of LINKED_PROVIDERS) {
    if (metaProviders.includes(provider)) return provider;
  }

  const meta = user.app_metadata?.provider;
  if (meta && isAuthProvider(meta)) return meta;
  return 'email';
}

export function authProviderLabel(provider: AuthProvider): string {
  return AUTH_PROVIDER_LABEL[provider];
}

/**
 * True when the account can sign in with an email + password, i.e. it has an `email` identity.
 * Apple- and Google-only accounts have no MuscleOS password to change.
 */
export function hasPasswordSignIn(user: {
  identities?: { provider: string }[] | null;
  app_metadata?: { providers?: string[] } | null;
}): boolean {
  if ((user.identities ?? []).some((i) => i.provider === 'email')) return true;
  return (user.app_metadata?.providers ?? []).includes('email');
}
