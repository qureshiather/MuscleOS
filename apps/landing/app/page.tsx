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
            className="inline-flex items-center justify-center rounded-lg bg-surface border border-[var(--color-text-muted)]/30 px-6 py-3 text-text hover:bg-surface/90 transition-colors"
          >
            Download on the App Store
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.muscleos.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-background px-6 py-3 font-medium hover:opacity-90 transition-opacity"
          >
            Get it on Google Play
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-text-muted border-t border-[var(--color-text-muted)]/20">
        <p>© {new Date().getFullYear()} MuscleOS</p>
        <p className="mt-1">
          <a href="#" className="hover:text-text-secondary">Privacy</a>
          {' · '}
          <a href="#" className="hover:text-text-secondary">Terms</a>
        </p>
      </footer>
    </div>
  );
}
