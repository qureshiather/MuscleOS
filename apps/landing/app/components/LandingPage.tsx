import { FaqJsonLd } from './FaqJsonLd';
import { FaqSection } from './FaqSection';
import { PhoneFrame } from './PhoneFrame';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

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

function StoreButtons({ dark = false }: { dark?: boolean }) {
  const secondary = dark
    ? 'border border-white/20 bg-white/10 text-white hover:bg-white/15'
    : 'border border-border bg-surface text-ink hover:bg-surface/90';
  const primary = dark
    ? 'bg-white text-ink hover:bg-white/90'
    : 'bg-primary text-white hover:bg-primary-dim';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <a
        href="https://apps.apple.com/app/muscleos"
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-[15px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${secondary}`}
      >
        <AppStoreIcon className="h-5 w-5 shrink-0" />
        <span>App Store</span>
      </a>
      <a
        href="https://play.google.com/store/apps/details?id=com.muscle-os.app"
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-[15px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${primary}`}
      >
        <GooglePlayIcon className="h-5 w-5 shrink-0" />
        <span>Google Play</span>
      </a>
    </div>
  );
}

const PROBLEMS = [
  {
    pain: 'Start quickly',
    fix: 'Choose a built-in template and begin logging.',
  },
  {
    pain: 'Use your own workouts',
    fix: 'Create templates for your usual training days with Pro.',
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
    body: 'Start with a built-in Push Pull Legs or Strong Lifts 5×5 workout. Enter your weight and reps, complete each set, and use the rest timer between sets.',
    points: [
      '5 built-in workouts (PPL + Strong Lifts)',
      'Set logging with rest timers',
      'Resume an in-progress workout',
    ],
    src: '/screens/workouts.png',
    alt: 'MuscleOS Workouts screen',
  },
  {
    id: 'exercises',
    label: 'Exercises',
    title: 'Find exercises',
    body: 'Search the exercise library by name, muscle, or equipment. Tap an exercise to see instructions and the muscles it works.',
    points: [
      'Search by name, muscle, or equipment',
      'Muscle map on each exercise',
      'Custom exercises on Pro',
    ],
    src: '/screens/exercises.png',
    alt: 'MuscleOS exercise library',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    title: 'Check your recovery',
    body: 'Recovery updates after each saved workout. The body map shows which muscles are ready and which are still recovering.',
    points: [
      'Front and back diagram',
      'Updates from logged workouts',
      'Included on Basic',
    ],
    src: '/screens/recovery.png',
    alt: 'MuscleOS Recovery screen',
  },
  {
    id: 'history',
    label: 'History',
    title: 'Review past workouts',
    body: 'See your saved workouts, including duration, volume, exercises, and sets. Pro adds personal records, progression charts, and a monthly calendar.',
    points: [
      'Session list and detail',
      'JSON export anytime',
      'PRs, charts, and calendar on Pro',
    ],
    src: '/screens/history.png',
    alt: 'MuscleOS History screen',
  },
] as const;

const BASIC_POINTS = [
  '5 built-in programs (PPL & Strong Lifts)',
  'Full set logging & rest timers',
  'Exercise library',
  'Recovery map',
  'History & JSON export',
] as const;

const PRO_POINTS = [
  'Custom workout templates & folders',
  'Custom exercises',
  'Empty workouts & mid-session edits',
  'Save a finished workout as a template',
  'PRs, charts, and monthly calendar',
] as const;

const STATS = [
  { value: '≈32 MB', label: 'App size' },
  { value: '1–2 MB', label: 'Typical workout data' },
  { value: '$0', label: 'Basic plan' },
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
              <p className="font-mono-label mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-primary sm:mb-4">
                Workout tracker
              </p>

              <h1 className="font-display text-[clamp(2.5rem,9vw,5rem)] font-extrabold leading-[0.95] tracking-tight text-ink">
                MuscleOS
              </h1>

              <p className="mt-3 text-lg font-semibold leading-snug text-primary sm:mt-4 sm:text-2xl">
                Log your workouts and track muscle recovery.
              </p>

              <p className="mt-3 max-w-md text-base leading-relaxed text-ink-secondary sm:mt-4 sm:text-lg">
                Track sets, reps, weight, and rest. Review your workout history and see which
                muscles are ready to train.
              </p>

              <div className="mt-6 sm:mt-8">
                <StoreButtons />
              </div>
              <p className="mt-3 text-sm text-ink-muted sm:mt-4">Basic is free. Pro starts at $2.99/month.</p>
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

        {/* Stats */}
        <section className="border-y border-border/70 bg-surface/60 py-12 sm:py-16">
          <div className="mx-auto max-w-site px-5 sm:px-8">
            <p className="text-center font-display text-xl font-semibold text-ink">
              Small app. Low storage use.
            </p>
            <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
              {STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                    {stat.value}
                  </p>
                  <p className="mt-2 font-mono-label text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
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
                Choose Basic or Pro.
              </h2>
              <p className="mt-4 text-lg text-ink-secondary">
                Basic includes workout logging, built-in programs, Recovery, and History. Pro adds
                custom workouts and progress tools.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl items-stretch gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6">
              <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 sm:p-8">
                <p className="font-display text-xl font-semibold text-ink">Basic</p>
                <p className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Free</p>
                <p className="mt-2 text-sm text-ink-muted">No time limit</p>
                <p className="mt-5 text-sm font-medium text-ink">Includes:</p>
                <ul className="mt-4 space-y-2.5 text-sm text-ink-secondary">
                  {BASIC_POINTS.map((point) => (
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

              <div className="relative flex h-full flex-col rounded-2xl border-2 border-primary bg-primary/[0.06] p-6 sm:p-8">
                <p className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Recommended
                </p>
                <p className="font-display text-xl font-semibold text-ink">Pro</p>
                <p className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
                  $19.99<span className="text-lg font-medium text-ink-muted">/yr</span>
                </p>
                <p className="mt-2 text-sm text-ink-muted">or $2.99/month</p>
                <p className="mt-5 text-sm font-medium text-ink">Everything in Basic, plus:</p>
                <ul className="mt-4 space-y-2.5 text-sm text-ink-secondary">
                  {PRO_POINTS.map((point) => (
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
            </div>
          </div>
        </section>

        <FaqSection />

        <SiteFooter />
      </div>
    </>
  );
}
