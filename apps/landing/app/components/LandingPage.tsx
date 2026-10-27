import Link from 'next/link';

import { DEMO_EXERCISES, demoSources, exercisePath, FEATURED_DEMOS } from '../data/exercises';
import { BrandMark } from './BrandMark';
import { ExerciseDemo } from './ExerciseDemo';
import { FaqJsonLd } from './FaqJsonLd';
import { FaqSection } from './FaqSection';
import { PhoneFrame } from './PhoneFrame';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { FeatureScroller } from './FeatureScroller';
import { StoreButtons } from './StoreButtons';

const FEATURES = [
  {
    id: 'workouts',
    label: 'Workouts',
    title: 'Log a workout',
    body: 'Type the weight, tick the set, and the rest timer starts. What you lifted last time is right there next to it.',
    points: ['Rest timer after every set', 'Last session’s weights and reps', 'Notes for seat height, pins or grip'],
    src: '/screens/active-workout.png',
    alt: 'MuscleOS active workout — logging sets with a rest timer running',
  },
  {
    id: 'programs',
    label: 'Programs',
    title: 'Run a program',
    body: 'Push Pull Legs, Upper/Lower, Strong Lifts 5×5 or PHUL. Or skip programs and build your own workouts.',
    points: ['See every workout before you start', 'Switch programs any time'],
    src: '/screens/program.png',
    alt: 'MuscleOS program overview — Push Pull Legs with its workouts and exercises',
  },
  {
    id: 'exercises',
    label: 'Exercises',
    title: 'Find any exercise',
    body: 'Nearly 400 of them, each with the muscles it works. Can’t find yours? Add it.',
    points: ['Search by name, muscle or equipment', 'Keep your own notes on each one'],
    src: '/screens/exercises.png',
    alt: 'MuscleOS exercise library',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    title: 'Know what’s ready',
    body: 'Finish a workout and the body map fills in. Red was just trained, green is good to go.',
    points: ['Front and back view', 'Suggests workouts for fresh muscles'],
    src: '/screens/recovery.png',
    alt: 'MuscleOS Recovery screen',
  },
  {
    id: 'history',
    label: 'History',
    title: 'Watch the numbers go up',
    body: 'Every workout you’ve logged, with your PRs, charts and a calendar. Share a session as an image.',
    points: ['Personal records', 'Progress charts per exercise', 'Export your data any time'],
    src: '/screens/history.png',
    alt: 'MuscleOS History screen',
  },
] as const;

const INCLUDED_POINTS = [
  'Programs and your own workouts',
  'Rest timers',
  'Exercise library',
  'Recovery map',
  'History, PRs and charts',
  'Backup and sync',
] as const;

const DEMO_STRIP = FEATURED_DEMOS.slice(0, 6);

export function LandingPage() {
  return (
    <>
      <FaqJsonLd />
      <SiteHeader />
      <main className="bg-atmosphere relative overflow-x-clip">
        {/* Hero: the name, the mark, and the app */}
        <section className="relative">
          <div className="relative z-10 mx-auto grid max-w-site grid-cols-1 items-center gap-14 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:pb-28 lg:pt-20">
            <div>
              <BrandMark className="h-16 w-16 sm:h-20 sm:w-20" />
              <h1 className="font-poster mt-6 text-[clamp(3.25rem,14vw,5.75rem)] text-ink">MuscleOS</h1>
              <p className="font-display mt-5 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                Your next set starts here.
              </p>
              <div className="mt-9">
                <StoreButtons />
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div className="glow-primary absolute left-1/2 top-1/2 h-[120%] w-[130%] -translate-x-1/2 -translate-y-1/2 opacity-60" aria-hidden />
              <div className="relative flex items-center">
                <div className="relative z-0 -mr-16 hidden -rotate-[6deg] opacity-90 sm:block">
                  <PhoneFrame src="/screens/recovery.png" alt="MuscleOS Recovery screen" size="compact" />
                </div>
                <div className="relative z-10">
                  <PhoneFrame src="/screens/workouts.png" alt="MuscleOS Workouts screen" priority />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="relative scroll-mt-16 border-t border-border">
          <div className="mx-auto max-w-site px-5 pt-20 sm:px-8 sm:pt-28">
            <h2 className="font-display max-w-3xl text-4xl font-bold tracking-tight text-ink text-balance sm:text-5xl">
              Everything you need between sets.
            </h2>
          </div>
          <div className="mx-auto max-w-site px-5 pb-16 sm:px-8 lg:pb-8">
            <FeatureScroller
              features={FEATURES}
              phones={FEATURES.map((f) => (
                <PhoneFrame key={f.id} src={f.src} alt={f.alt} label={f.label} />
              ))}
            />
          </div>
        </section>

        {/* Exercise demos */}
        <section className="relative border-t border-border bg-surface">
          <div className="mx-auto max-w-site px-5 py-20 sm:px-8 sm:py-28">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <h2 className="font-display text-4xl font-bold tracking-tight text-ink text-balance sm:text-5xl">
                  {DEMO_EXERCISES.length} exercises, every one animated.
                </h2>
                <p className="mt-5 text-lg text-ink-secondary">
                  See how each one is done before you load the bar.
                </p>
              </div>
              <Link
                href="/exercises"
                className="inline-flex shrink-0 items-center self-start rounded-full bg-primary px-6 py-3 text-base font-semibold text-surface transition hover:bg-primary-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:self-auto"
              >
                Browse exercises
              </Link>
            </div>

            <ul className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {DEMO_STRIP.map((exercise) => {
                const sources = demoSources(exercise.id);
                if (!sources) return null;
                return (
                  <li key={exercise.id}>
                    <Link
                      href={exercisePath(exercise.id)}
                      className="group block overflow-hidden rounded-2xl border border-border bg-background transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <ExerciseDemo sources={sources} label={`${exercise.name} demo`} lazy static />
                      <p className="px-4 py-3 font-display text-base font-semibold text-ink group-hover:text-primary sm:text-lg">
                        {exercise.name}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="relative scroll-mt-16 border-t border-border">
          <div className="mx-auto grid max-w-site gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <h2 className="font-poster text-7xl text-primary sm:text-8xl">$0</h2>
              <p className="font-display mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Free. All of it.
              </p>
              <p className="mt-4 max-w-md text-lg text-ink-secondary">
                No paywall, no trial, no ads. You don’t even need an account.
              </p>
            </div>

            <div className="flex flex-col gap-5 lg:pt-6">
              <ul className="grid gap-x-6 gap-y-3 text-[15px] text-ink sm:grid-cols-2">
                {INCLUDED_POINTS.map((point) => (
                  <li key={point} className="flex gap-3">
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-ready" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded-2xl border border-dashed border-border p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-xl font-semibold text-ink">Coaching</p>
                  <span className="rounded-full border border-border px-3 py-0.5 text-xs font-semibold text-ink-muted">
                    Coming later
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-secondary">
                  A paid extra for when you want someone else to plan your training: a personal trainer,
                  or the MuscleOS AI coach. The app stays free.
                </p>
              </div>
            </div>
          </div>
        </section>

        <FaqSection showShots={false} />

        {/* Closing call to install */}
        <section id="get" className="relative scroll-mt-16 overflow-hidden border-t border-border bg-primary">
          <div className="mx-auto flex max-w-site flex-col items-start gap-6 px-5 py-12 sm:px-8 sm:py-14 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="font-display text-3xl font-bold tracking-tight text-surface sm:text-4xl">
              Free on iPhone and Android.
            </h2>
            <div className="shrink-0">
              <StoreButtons />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
