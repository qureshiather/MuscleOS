'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const APP_CALLBACK = 'muscleos://auth-callback';
const FORWARD_KEYS = ['token_hash', 'type', 'code', 'access_token', 'refresh_token'] as const;

type LinkState =
  | { kind: 'ready'; appUrl: string }
  | { kind: 'expired' }
  | { kind: 'invalid' };

function readLinkState(): LinkState {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  for (const [key, value] of hash) {
    if (!params.has(key)) params.set(key, value);
  }

  const errorCode = params.get('error_code');
  const description = (params.get('error_description') ?? '').toLowerCase();
  if (
    errorCode === 'otp_expired' ||
    description.includes('expired') ||
    description.includes('invalid')
  ) {
    return { kind: 'expired' };
  }
  if (params.get('error')) return { kind: 'invalid' };

  const forward = new URLSearchParams();
  for (const key of FORWARD_KEYS) {
    const value = params.get(key);
    if (value) forward.set(key, value);
  }
  const query = forward.toString();
  return { kind: 'ready', appUrl: query ? `${APP_CALLBACK}?${query}` : APP_CALLBACK };
}

export function AuthConfirmClient() {
  const [state, setState] = useState<LinkState | null>(null);

  useEffect(() => {
    const next = readLinkState();
    setState(next);
    if (next.kind === 'ready' && next.appUrl.includes('?')) {
      window.location.href = next.appUrl;
    }
  }, []);

  if (state?.kind === 'expired' || state?.kind === 'invalid') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <p className="font-display text-3xl font-semibold tracking-tight text-ink">This link has expired</p>
        <p className="mt-3 text-ink-muted">
          Open MuscleOS, choose Continue with Email, then Forgot password? to send a new link. The
          previous one can no longer be used.
        </p>
        <Link href="/" className="mt-6 text-sm text-ink-muted underline">
          Back to muscleos.app
        </Link>
      </main>
    );
  }

  const appUrl = state?.kind === 'ready' ? state.appUrl : APP_CALLBACK;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p className="font-display text-3xl font-semibold tracking-tight text-ink">Open MuscleOS</p>
      <p className="mt-3 text-ink-muted">
        This link confirms your email or resets your password. It should open the app on this phone.
      </p>
      <a
        href={appUrl}
        className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-white"
      >
        Open MuscleOS
      </a>
      <Link href="/" className="mt-6 text-sm text-ink-muted underline">
        Back to muscleos.app
      </Link>
    </main>
  );
}
