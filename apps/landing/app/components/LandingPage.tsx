import Link from 'next/link';

import { DEMO_EXERCISES, demoSources, EXERCISES, exercisePath, FEATURED_DEMOS } from '../data/exercises';
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
    title: 'Log your workouts',
    body: 'Enter your weight and reps, see what you lifted last time, and rest between sets with a timer. Change exercises mid-session and save the result as a template.',
    points: [
      'Set logging with rest timers',
      'See what you lifted last time',
      'Setup notes on every exercise',
    ],
    src: '/screens/active-workout.png',
    alt: 'MuscleOS active workout — logging sets with a rest timer running',
  },
  {
    id: 'programs',
    label: 'Programs',
    title: 'Follow a program, or don’t',
    body: 'Pick one program and its workouts sit next to your own templates on the Workouts tab. See every workout and exercise before you commit, switch whenever you like, or skip programs and build your own.',
    points: [
      'Push Pull Legs, Upper/Lower, Strong Lifts 5×5 & PHUL',
      'One program at a time, or none',
      'Switch or remove it any time',
    ],
    src: '/screens/program.png',
    alt: 'MuscleOS program overview — Push Pull Legs with its workouts and exercises',
  },
  {
    id: 'exercises',
    label: 'Exercises',
    title: 'Find exercises',
    body: 'Search nearly 400 exercises by name, muscle, or equipment. Tap an exercise to see instructions, the muscles it works, and your own notes.',
    points: [
      'Search by name, muscle, or equipment',
      'Muscle map on each exercise',
      'Add your own exercises',
    ],
    src: '/screens/exercises.png',
    alt: 'MuscleOS exercise library',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    title: 'Check your recovery',
    body: 'Each muscle you train recovers for 36, 48, or 72 hours depending on its size. The body map shows which muscles are ready and which are still recovering.',
    points: [
      'Front and back diagram',
      'Updates when you finish a workout',
      'Suggests what’s ready to train',
    ],
    src: '/screens/recovery.png',
    alt: 'MuscleOS Recovery screen',
  },
  {
    id: 'history',
    label: 'History',
    title: 'Review past workouts',
    body: 'Each saved workout shows its duration, volume, exercises, and sets, with personal records, progression charts, and a monthly calendar. Fix a mistyped set or share a workout as an image.',
    points: [
      'Every session with its sets',
      'JSON export anytime',
      'PRs, progression charts, and a calendar',
    ],
    src: '/screens/history.png',
    alt: 'MuscleOS History screen',
  },
] as const;

const INCLUDED_POINTS = [
  'Programs: PPL, Upper/Lower, Strong Lifts & PHUL',
  'Your own templates, folders & rest timers',
  'Empty workouts & mid-session edits',
  'Set logging & rest timers',
  'Exercise library & custom exercises',
  'Recovery map',
  'History, PRs, charts & calendar',
  'Backup, sync & JSON export',
] as const;

const COACHING_POINTS = [
  'Personal trainers send you programs to run in MuscleOS',
  'The MuscleOS AI coach builds a program around your goals',
  'Your next weights and reps, set from what you logged',
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
              <h1 className="font-poster mt-6 text-[clamp(4rem,18vw,7.5rem)] text-ink">MuscleOS</h1>
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
              Log the session. Everything else builds itself from it.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-ink-secondary">
              Recovery, history, records and charts all come from the sets you tick off. Nothing extra to
              fill in.
            </p>
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
                <h2 className="font-poster text-[clamp(3rem,8vw,5.5rem)] text-ink">
                  {DEMO_EXERCISES.length} exercises.
                  <br />
                  Every one animated.
                </h2>
                <p className="mt-5 text-lg text-ink-secondary">
                  Each exercise in the library has a looping 3D demo, the muscles it works, and step-by-step
                  form cues. Search by name, muscle, or equipment.
                </p>
              </div>
              <Link
                href="/exercises"
                className="inline-flex shrink-0 items-center self-start rounded-full bg-primary px-6 py-3 text-base font-semibold text-surface transition hover:bg-primary-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:self-auto"
              >
                Browse all {EXERCISES.length} exercises
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
              <h2 className="font-poster text-[clamp(8rem,30vw,17rem)] leading-[0.8] text-primary">$0</h2>
              <p className="font-display mt-6 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Free. All of it, forever.
              </p>
              <p className="mt-4 max-w-md text-lg text-ink-secondary">
                No paywall, no trial, no ads, and no account needed. Every feature is for everyone.
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
                  For when you want someone else to plan your training. Optional, and paid. The app stays
                  free.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-ink-secondary">
                  {COACHING_POINTS.map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <span className="mt-2 h-1 w-3 shrink-0 rounded-full bg-ink-muted" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <FaqSection showShots={false} />

        {/* Closing call to install */}
        <section id="get" className="relative scroll-mt-16 overflow-hidden border-t border-border bg-primary">
          <div className="mx-auto flex max-w-site flex-col items-start gap-8 px-5 py-20 sm:px-8 sm:py-24 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="font-poster text-[clamp(3.5rem,11vw,7.5rem)] text-surface">
              Free on iPhone
              <br />
              and Android.
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
