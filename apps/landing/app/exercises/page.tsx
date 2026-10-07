import type { Metadata } from 'next';
import Link from 'next/link';

import { DemoLicense } from '../components/DemoLicense';
import { ExerciseDemo } from '../components/ExerciseDemo';
import { ExerciseSearch, type ExerciseListRow } from '../components/ExerciseSearch';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { DEMO_EXERCISES, demoSources, FEATURED_DEMOS, EXERCISES, exercisePath, hasDemo, muscleLine } from '../data/exercises';

export const metadata: Metadata = {
  title: 'Exercise library — How to do every lift | MuscleOS',
  description: `${EXERCISES.length} exercises with the muscles they work and how to do them, plus free-to-reuse animated demos.`,
};

export default function ExercisesPage() {
  const rows: ExerciseListRow[] = EXERCISES.map(({ id, name, muscles, equipment }) => ({
    id,
    name,
    muscles,
    equipment,
    demo: hasDemo(id),
  }));

  return (
    <>
      <SiteHeader />
      <div className="bg-atmosphere relative min-h-screen">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <main className="relative mx-auto max-w-site px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
          <header className="max-w-2xl">
            <p className="font-mono-label text-xs uppercase tracking-[0.18em] text-primary">Exercise library</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink text-balance sm:text-5xl">
              See the movement, and the muscles it works
            </h1>
            <p className="mt-4 text-lg text-ink-secondary">
              Every exercise in MuscleOS, with the muscles it trains and how to do it. Animated demos
              highlight the working muscles in green, the same colours as the app.
            </p>
          </header>

          <section aria-labelledby="demos" className="mt-12">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="demos" className="font-display text-2xl font-semibold text-ink">
                Staple lifts
              </h2>
              <p className="font-mono-label text-xs uppercase tracking-wider text-ink-muted">
                {DEMO_EXERCISES.length} of {EXERCISES.length} animated
              </p>
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {FEATURED_DEMOS.map((e) => {
                const sources = demoSources(e.id);
                return (
                  <li key={e.id} className="h-full">
                    <Link
                      href={exercisePath(e.id)}
                      className="group block h-full overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {sources ? <ExerciseDemo sources={sources} label={`${e.name} demo`} lazy static /> : null}
                      <span className="block px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
                        <span className="block font-medium text-ink group-hover:text-primary">{e.name}</span>
                        <span className="mt-0.5 block truncate text-sm text-ink-muted">{muscleLine(e)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <DemoLicense className="mt-5 max-w-2xl" />
          </section>

          <section aria-labelledby="all" className="mt-16 max-w-3xl">
            <h2 id="all" className="font-display text-2xl font-semibold text-ink">
              All exercises
            </h2>
            <div className="mt-5">
              <ExerciseSearch rows={rows} />
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
