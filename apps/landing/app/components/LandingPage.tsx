import { FaqJsonLd } from './FaqJsonLd';
import { FaqSection } from './FaqSection';
import { PhoneFrame } from './PhoneFrame';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { StoreButtons } from './StoreButtons';

const PROBLEMS = [
  {
    pain: 'Start quickly',
    fix: 'Choose a built-in template and begin logging.',
  },
  {
    pain: 'Use your own workouts',
    fix: 'Create templates for your usual training days, or start empty and add as you go.',
  },
  {
    pain: 'Check muscle recovery',
    fix: 'See which muscles are ready and which are still recovering.',
  },
] as const;

const FEATURES = [
  {
    id: 'workouts',
    label: 'Workouts',
    title: 'Log your workouts',
    body: 'Start with a built-in Push Pull Legs, Upper/Lower, or Strong Lifts 5×5 workout. Enter your weight and reps, see what you lifted last time, and rest between sets with a timer.',
    points: [
      'Built-in PPL, Upper/Lower & Strong Lifts',
      'Set logging with rest timers',
      'See what you lifted last time',
    ],
    src: '/screens/active-workout.png',
    alt: 'MuscleOS active workout — logging sets with a rest timer running',
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
    body: 'Each saved workout shows its duration, volume, exercises, and sets, with personal records, progression charts, and a monthly calendar.',
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
  'Built-in PPL, Upper/Lower & Strong Lifts',
  'Custom workout templates & folders',
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
] as const;

export function LandingPage() {
  return (
    <>
      <FaqJsonLd />
      <SiteHeader />
      <div className="bg-atmosphere relative min-h-screen">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-30" aria-hidden />

        {/* Hero */}
        <section className="relative">
          <div className="relative z-10 mx-auto grid max-w-site grid-cols-1 items-center gap-8 px-5 pb-12 pt-8 sm:gap-10 sm:px-8 sm:pb-20 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-24 lg:pt-16">
            <div className="max-w-xl">
              <h1 className="font-display text-[clamp(2.5rem,9vw,5rem)] font-extrabold leading-[0.95] tracking-tight text-ink">
                MuscleOS
              </h1>

              <p className="mt-3 text-lg font-semibold leading-snug text-primary sm:mt-4 sm:text-2xl">
                Log your workouts and track muscle recovery.
              </p>

              <div className="mt-6 sm:mt-8">
                <StoreButtons />
              </div>
              <p className="mt-3 text-sm text-ink-muted sm:mt-4">Free. Every feature, no paywall, no ads.</p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <PhoneFrame src="/screens/workouts.png" alt="MuscleOS Workouts screen" priority />
            </div>
          </div>
        </section>

        {/* Why */}
        <section className="relative border-t border-border/70 bg-surface/50">
          <div className="mx-auto max-w-site px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
            <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              Overview
            </p>
            <h2 className="font-display mt-3 max-w-2xl text-3xl font-bold tracking-tight text-ink text-balance sm:text-4xl">
              A simple way to track your training.
            </h2>

            <ul className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-5">
              {PROBLEMS.map((item) => (
                <li
                  key={item.pain}
                  className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
                >
                  <p className="font-medium text-ink">{item.pain}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{item.fix}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="relative border-t border-border/70">
          <div className="mx-auto max-w-site px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
            <div className="max-w-2xl">
              <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                Features
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink text-balance sm:text-4xl">
                Workouts, recovery, exercises, and history.
              </h2>
              <p className="mt-4 text-lg text-ink-secondary">
                The main parts of MuscleOS.
              </p>
            </div>

            <div className="mt-14 space-y-16 sm:mt-16 lg:mt-20 lg:space-y-24">
              {FEATURES.map((feature, i) => {
                const phoneFirst = i % 2 === 1;
                return (
                  <article
                    key={feature.id}
                    id={feature.id}
                    className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
                  >
                    <div className={phoneFirst ? 'lg:order-2' : undefined}>
                      <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                        {feature.label}
                      </p>
                      <h3 className="font-display mt-3 text-2xl font-bold tracking-tight text-ink text-balance sm:text-3xl">
                        {feature.title}
                      </h3>
                      <p className="mt-4 max-w-md text-base leading-relaxed text-ink-secondary sm:text-lg">
                        {feature.body}
                      </p>
                      <ul className="mt-6 space-y-2.5 text-sm text-ink-secondary">
                        {feature.points.map((point) => (
                          <li key={point} className="flex gap-2.5">
                            <span
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                              aria-hidden
                            />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div
                      className={`flex justify-center ${phoneFirst ? 'lg:order-1 lg:justify-start' : 'lg:justify-end'}`}
                    >
                      <PhoneFrame
                        src={feature.src}
                        alt={feature.alt}
                        label={feature.label}
                        priority={i === 0}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="relative border-t border-border/70 bg-surface/50">
          <div className="mx-auto max-w-site px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                Pricing
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink text-balance sm:text-4xl">
                Free. All of it.
              </h2>
              <p className="mt-4 text-lg text-ink-secondary">
                Every feature in MuscleOS is free, forever. No paywall, no trial, no ads, and no account
                needed.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl items-stretch gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6">
              <div className="relative flex h-full flex-col rounded-2xl border-2 border-primary bg-primary/[0.06] p-6 sm:p-8">
                <p className="font-display text-xl font-semibold text-ink">MuscleOS</p>
                <p className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Free</p>
                <p className="mt-2 text-sm text-ink-muted">Forever</p>
                <p className="mt-5 text-sm font-medium text-ink">Everything included:</p>
                <ul className="mt-4 space-y-2.5 text-sm text-ink-secondary">
                  {INCLUDED_POINTS.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative flex h-full flex-col rounded-2xl border border-border bg-surface p-6 sm:p-8">
                <p className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-surface">
                  Coming later
                </p>
                <p className="font-display text-xl font-semibold text-ink">Coaching</p>
                <p className="mt-2 text-sm text-ink-secondary">
                  When you want a plan built for you. Optional, and nothing in the free app is held back
                  for it.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-ink-secondary">
                  {COACHING_POINTS.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted"
                        aria-hidden
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <FaqSection />

        <SiteFooter />
      </div>
    </>
  );
}
