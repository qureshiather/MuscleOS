'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const APP_CALLBACK = 'muscleos://auth-callback';

export function AuthConfirmClient() {
  const [appUrl, setAppUrl] = useState(APP_CALLBACK);

  useEffect(() => {
    const next = `${APP_CALLBACK}${window.location.search}${window.location.hash}`;
    setAppUrl(next);
    window.location.href = next;
  }, []);

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
