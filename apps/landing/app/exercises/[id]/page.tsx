import { muscleLabel } from '@muscleos/types';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DemoLicense } from '../../components/DemoLicense';
import { ExerciseDemo } from '../../components/ExerciseDemo';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';
import { StoreButtons } from '../../components/StoreButtons';
import {
  demoSources,
  EXERCISES,
  exercisePath,
  getExercise,
  muscleLine,
  relatedExercises,
  typeLine,
} from '../../data/exercises';

type Params = { id: string };

// Every published catalog exercise gets a page; the app links to them by catalog id.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return EXERCISES.map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const exercise = getExercise((await params).id);
  if (!exercise) return {};
  return {
    title: `${exercise.name} — How to do it | MuscleOS`,
    description: exercise.instructions ?? `${exercise.name}: works ${muscleLine(exercise)}.`,
  };
}

export default async function ExercisePage({ params }: { params: Promise<Params> }) {
  const exercise = getExercise((await params).id);
  if (!exercise) notFound();
  const sources = demoSources(exercise.id);
  const related = relatedExercises(exercise.id);

  return (
    <>
      <SiteHeader />
      <div className="bg-atmosphere relative min-h-screen">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <main className="relative mx-auto max-w-site px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
          <nav aria-label="Breadcrumb" className="font-mono-label text-xs uppercase tracking-wider text-ink-muted">
            <Link href="/exercises" className="transition hover:text-primary">
              Exercises
            </Link>
            <span aria-hidden> / </span>
            <span className="text-ink-secondary">{exercise.name}</span>
          </nav>

          <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
            <div className="min-w-0">
              {sources ? (
                <figure className="m-0">
                  <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-phone-sm">
                    <ExerciseDemo sources={sources} label={`${exercise.name} demo`} />
                  </div>
                  <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                    <span>Green shows the muscles this exercise works.</span>
                    <a href={`${sources.light.video}?download=1`} className="text-primary hover:underline">
                      Download light MP4
                    </a>
                    <a href={`${sources.dark.video}?download=1`} className="text-primary hover:underline">
                      Download dark MP4
                    </a>
                  </figcaption>
                </figure>
              ) : (
                <div className="flex aspect-square w-full max-w-full flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface p-8 text-center">
                  <p className="font-mono-label text-xs uppercase tracking-wider text-ink-muted">Demo coming soon</p>
                  <p className="mt-3 max-w-xs text-ink-secondary">
                    We&apos;re animating the catalog a few exercises at a time. Until then, the steps on
                    this page cover the movement.
                  </p>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="font-mono-label text-xs uppercase tracking-[0.18em] text-primary">
                {typeLine(exercise)}
              </p>
              <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink text-balance">
                {exercise.name}
              </h1>

              <h2 className="mt-8 font-display text-lg font-semibold text-ink">Muscles worked</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {exercise.muscles.map((m, i) => (
                  <li
                    key={m}
                    className={`rounded-full px-3 py-1 text-sm ${
                      i === 0 ? 'bg-[color-mix(in_srgb,var(--color-ready)_14%,transparent)] font-medium text-ready' : 'border border-border text-ink-secondary'
                    }`}
                  >
                    {muscleLabel(m)}
                  </li>
                ))}
              </ul>

              {exercise.instructions ? (
                <>
                  <h2 className="mt-8 font-display text-lg font-semibold text-ink">How to do it</h2>
                  <p className="mt-3 max-w-prose text-[17px] leading-relaxed text-ink-secondary">
                    {exercise.instructions}
                  </p>
                </>
              ) : null}

              <div className="mt-10 rounded-2xl border border-border bg-surface p-5">
                <p className="font-display text-lg font-semibold text-ink">Log it in MuscleOS</p>
                <p className="mt-1 text-sm text-ink-secondary">
                  See what you lifted last time and which muscles are still recovering. Free, with no
                  paywall.
                </p>
                <div className="mt-4">
                  <StoreButtons />
                </div>
              </div>

              {sources ? <DemoLicense className="mt-6" /> : null}
            </div>
          </div>

          {related.length ? (
            <section aria-labelledby="related" className="mt-16">
              <h2 id="related" className="font-display text-xl font-semibold text-ink">
                Also works your {muscleLabel(exercise.muscles[0]).toLowerCase()}
              </h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={exercisePath(e.id)}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className="min-w-0 truncate font-medium text-ink">{e.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
