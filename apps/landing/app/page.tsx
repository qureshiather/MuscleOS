import Link from 'next/link';

function AppStoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function GooglePlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.302 2.302-8.636-8.635z"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 sm:py-24">
        {/* Hero */}
        <img src="/icon.png" alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl mb-6" />
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-center">
          MuscleOS
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-text-secondary text-center max-w-md">
          Your workout companion. Track exercises, run workouts, and see your progress.
        </p>

        {/* Features */}
        <ul className="mt-12 sm:mt-16 grid gap-6 sm:grid-cols-3 max-w-2xl text-center">
          <li className="rounded-xl bg-surface px-6 py-5 border border-[var(--color-text-muted)]/20">
            <span className="text-primary font-semibold">Exercise library</span>
            <p className="mt-2 text-sm text-text-secondary">
              Browse by muscle group and equipment. Find the right move for every goal.
            </p>
          </li>
          <li className="rounded-xl bg-surface px-6 py-5 border border-[var(--color-text-muted)]/20">
            <span className="text-primary font-semibold">Workout tracking</span>
            <p className="mt-2 text-sm text-text-secondary">
              Log sets and reps as you go. Simple, fast, no clutter.
            </p>
          </li>
          <li className="rounded-xl bg-surface px-6 py-5 border border-[var(--color-text-muted)]/20">
            <span className="text-primary font-semibold">Progress over time</span>
            <p className="mt-2 text-sm text-text-secondary">
              Review history and see how your numbers improve.
            </p>
          </li>
        </ul>

        {/* CTAs */}
        <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="https://apps.apple.com/app/muscleos/id000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-surface border border-[var(--color-text-muted)]/30 px-6 py-3 text-text hover:bg-surface/90 transition-colors"
          >
            <AppStoreIcon className="h-6 w-6 shrink-0" />
            <span>Download on the App Store</span>
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.muscleos.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-background px-6 py-3 font-medium hover:opacity-90 transition-opacity"
          >
            <GooglePlayIcon className="h-6 w-6 shrink-0" />
            <span>Get it on Google Play</span>
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-text-muted border-t border-[var(--color-text-muted)]/20">
        <p>© {new Date().getFullYear()} MuscleOS</p>
        <p className="mt-1">
          <Link href="/privacy" className="hover:text-text-secondary">Privacy</Link>
          {' · '}
          <Link href="/terms" className="hover:text-text-secondary">Terms</Link>
        </p>
      </footer>
    </div>
  );
}
