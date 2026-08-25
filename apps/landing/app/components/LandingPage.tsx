'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { useSpring } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

import BlurText from '@/components/BlurText';
import GradientText from '@/components/GradientText';
import SpotlightCard from '@/components/SpotlightCard';
import { PhoneFrame } from './PhoneFrame';

const Aurora = dynamic(() => import('@/components/Aurora'), { ssr: false });

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
        href="https://play.google.com/store/apps/details?id=com.muscleos.app"
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

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-site items-center justify-between px-6 py-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Image
            src="/icon.png"
            alt=""
            width={36}
            height={36}
            className="brand-mark h-9 w-9 rounded-[10px]"
            priority
            style={{ viewTransitionName: 'brand-mark' }}
          />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            MuscleOS
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium leading-none text-ink">
          <Link
            href="#features"
            className="hidden transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Pricing
          </Link>
          <Link
            href="/privacy"
            className="transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Privacy
          </Link>
        </nav>
      </div>
    </header>
  );
}

function StatBurst({
  value,
  label,
  prefix = '',
  suffix = '',
}: {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
}) {
  const spring = useSpring(0, { bounce: 0, duration: 1000 });
  const [display, setDisplay] = useState(0);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.4 });

  useEffect(() => {
    const unsub = spring.on('change', (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);

  useEffect(() => {
    if (inView) spring.set(value);
  }, [inView, spring, value]);

  return (
    <div ref={ref} className="text-center">
      <p className="font-mega text-[clamp(2.75rem,7vw,4.5rem)] leading-none tracking-tight text-ink">
        <NumberFlow value={display} prefix={prefix} suffix={suffix} />
      </p>
      <p className="mt-2 font-mono-label text-[11px] uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </p>
    </div>
  );
}

const PROBLEMS = [
  {
    pain: 'Logging that gets in the way',
    fix: 'Templates, sets, reps, rest timer — fast enough to use between sets.',
  },
  {
    pain: 'Programs that aren’t yours',
    fix: 'Start on built-ins, then build custom templates and exercises when you’re ready.',
  },
  {
    pain: 'No sense of whether you’re progressing',
    fix: 'History, PRs, and progression charts show what the numbers are doing over time.',
  },
] as const;

const FEATURES = [
  {
    id: 'workouts',
    label: 'Workouts',
    title: 'Templates, sets, and rest — without the clutter',
    body: 'Pick a built-in program — Push Pull Legs or Strong Lifts 5×5 — run the session, and log weight and reps as you go. Plate calculator and workout sounds are there when you need them.',
    points: [
      '5 built-in workouts (PPL + Strong Lifts)',
      'Set logging with rest timers',
      'Resume an in-progress workout',
    ],
    src: '/screens/workouts.png',
    alt: 'MuscleOS Workouts screen',
    tilt: 'left' as const,
  },
  {
    id: 'exercises',
    label: 'Exercises',
    title: 'A library you can search and filter',
    body: 'Browse hundreds of built-in movements by muscle and equipment. Add your own on Pro when the defaults aren’t enough.',
    points: [
      'Search by name, muscle, or equipment',
      'Muscle map on each exercise',
      'Custom exercises on Pro',
    ],
    src: '/screens/exercises.png',
    alt: 'MuscleOS exercise library',
    tilt: 'right' as const,
  },
  {
    id: 'recovery',
    label: 'Recovery',
    title: 'Muscle readiness on a body map',
    body: 'After you log a session, MuscleOS updates which muscle groups are still recovering. Same app, same data — just another tab when you want it.',
    points: [
      'Front and back diagram',
      'Updates from logged workouts',
      'Included on Basic',
    ],
    src: '/screens/recovery.png',
    alt: 'MuscleOS Recovery screen',
    tilt: 'left' as const,
  },
  {
    id: 'history',
    label: 'History',
    title: 'What you did, when you did it',
    body: 'Review past sessions, dig into details, and export everything as JSON. Pro adds personal records, progression charts, and a monthly calendar.',
    points: [
      'Session list and detail',
      'JSON export anytime',
      'PRs, charts, and calendar on Pro',
    ],
    src: undefined,
    alt: 'MuscleOS history (screenshot coming)',
    labelFallback: 'History',
    tilt: 'right' as const,
  },
] as const;

const STEPS = [
  {
    n: '1',
    title: 'Download',
    body: 'Get MuscleOS on iPhone or Android.',
  },
  {
    n: '2',
    title: 'Start a workout',
    body: 'Use a built-in template or build your own on Pro.',
  },
  {
    n: '3',
    title: 'Keep logging',
    body: 'Sets, history, recovery, and progress stay in one place.',
  },
] as const;

const PRO_POINTS = [
  'Custom workout templates & folders',
  'Custom exercises',
  'Empty / ad-hoc workouts',
  'Add exercises mid-session',
  'Save a finished workout as a template',
  'Personal records & estimated 1RM',
  'Exercise progression charts',
  'Monthly training calendar',
] as const;

export function LandingPage() {
  return (
    <>
      <SiteHeader />
      <div className="bg-atmosphere relative min-h-screen overflow-x-hidden">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" aria-hidden />

      {/* Hero — aurora full-bleed, content constrained */}
      <section className="relative min-h-[100svh]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(100svh,820px)] opacity-60"
          aria-hidden
        >
          <Aurora
            colorStops={['#2563eb', '#059669', '#3b82f6']}
            amplitude={0.85}
            blend={0.55}
            speed={0.55}
          />
        </div>

        <div className="relative z-10 mx-auto grid min-h-[100svh] max-w-site grid-cols-1 items-center gap-12 px-6 pb-16 pt-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-24 lg:pt-12">
          <div className="max-w-xl">
            <p className="font-mono-label mb-5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              Workout companion
            </p>

            <BlurText
              text="MuscleOS"
              delay={40}
              animateBy="letters"
              direction="top"
              className="font-display text-[clamp(3.25rem,9vw,5.5rem)] font-extrabold leading-[0.92] tracking-tight text-ink"
            />

            <div className="mt-5">
              <GradientText
                colors={['#1d4ed8', '#059669', '#2563eb', '#1d4ed8']}
                animationSpeed={10}
                className="!mx-0 !max-w-none !justify-start text-left text-xl font-semibold leading-snug sm:text-2xl"
              >
                Log workouts. Track progress. Train your way.
              </GradientText>
            </div>

            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
              Five built-in workouts across PPL and Strong Lifts to start fast. Custom templates, PRs,
              and progression when you want the full system.
            </p>

            <div className="mt-9">
              <StoreButtons />
            </div>
            <p className="mt-4 text-sm text-ink-muted">Free to start. Pro from $2.99/mo.</p>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div
              className="absolute -inset-8 top-10 rounded-[3rem] bg-gradient-to-br from-primary/10 via-ready/5 to-transparent blur-2xl lg:-inset-12"
              aria-hidden
            />
            <div className="animate-float relative">
              <PhoneFrame src="/screens/workouts.png" alt="MuscleOS Workouts screen" priority />
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="relative border-t border-border/70 bg-surface/50">
        <div className="mx-auto max-w-site px-6 py-20 sm:px-8 lg:py-24">
          <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            Why MuscleOS
          </p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-bold tracking-tight text-ink text-balance sm:text-4xl">
            A gym log that stays out of your way — and grows with how you train.
          </h2>

          <ul className="mt-12 grid gap-5 sm:grid-cols-3">
            {PROBLEMS.map((item) => (
              <li key={item.pain}>
                <SpotlightCard
                  className="!rounded-2xl !border-border !bg-surface !p-6 h-full"
                  spotlightColor="rgba(37, 99, 235, 0.14)"
                >
                  <p className="font-medium text-ink">{item.pain}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">→ {item.fix}</p>
                </SpotlightCard>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative border-t border-border/70">
        <div className="mx-auto max-w-site px-6 py-20 sm:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              Features
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink text-balance sm:text-4xl">
              Everything you need in the gym and after.
            </h2>
            <p className="mt-4 text-lg text-ink-secondary">
              Workouts, exercises, recovery, and history — one app, no social feed.
            </p>
          </div>

          <div className="mt-16 space-y-24 lg:mt-20 lg:space-y-28">
            {FEATURES.map((feature, i) => {
              const phoneFirst = i % 2 === 1;
              return (
                <article
                  key={feature.id}
                  id={feature.id}
                  className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
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
                    <div className={i % 2 === 0 ? 'animate-float' : 'animate-float-slow'}>
                      <PhoneFrame
                        src={'src' in feature ? feature.src : undefined}
                        alt={feature.alt}
                        label={'labelFallback' in feature ? feature.labelFallback : feature.label}
                        tilt={feature.tilt}
                        priority={i === 0}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/70 bg-surface/60 py-14 sm:py-16">
        <div className="mx-auto grid max-w-site gap-10 px-6 sm:grid-cols-3 sm:px-8">
          <StatBurst value={5} label="Built-in programs" />
          <StatBurst value={0} label="Cost to start" prefix="$" />
          <StatBurst value={100} label="Your data" suffix="%" />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative border-t border-border/70 bg-surface/50">
        <div className="mx-auto max-w-site px-6 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              Pricing
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink text-balance sm:text-4xl">
              Free to start. Pro to train on your terms.
            </h2>
            <p className="mt-4 text-lg text-ink-secondary">
              Basic covers solid built-in programs and full logging. Pro is the upgrade for your own
              programs, flexible sessions, and progress tools.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-4xl gap-6 lg:grid-cols-[1fr_1.15fr]">
            <div className="rounded-2xl border border-border bg-surface p-7 sm:p-8">
              <p className="font-display text-xl font-semibold text-ink">Basic</p>
              <p className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Free</p>
              <p className="mt-2 text-sm text-ink-muted">Forever — no trial wall</p>
              <ul className="mt-6 space-y-2.5 text-sm text-ink-secondary">
                <li>5 built-in programs (PPL &amp; Strong Lifts)</li>
                <li>Full set logging &amp; rest timers</li>
                <li>Exercise library</li>
                <li>Recovery map</li>
                <li>History &amp; JSON export</li>
              </ul>
            </div>

            <div className="relative rounded-2xl border-2 border-primary bg-primary/[0.06] p-7 shadow-[0_20px_50px_-28px_rgba(37,99,235,0.35)] sm:p-8">
              <p className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                Recommended
              </p>
              <p className="font-display text-xl font-semibold text-ink">Pro</p>
              <p className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
                $19.99<span className="text-lg font-medium text-ink-muted">/yr</span>
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                Best value · also $2.99/mo or $39.99 lifetime
              </p>
              <p className="mt-5 text-sm font-medium text-ink">
                Everything in Basic, plus the tools serious lifters actually use:
              </p>
              <ul className="mt-4 grid gap-2.5 text-sm text-ink-secondary sm:grid-cols-2">
                {PRO_POINTS.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How + close */}
      <section id="how" className="relative border-t border-border/70 bg-surface/50">
        <div className="mx-auto max-w-site px-6 py-20 sm:px-8 lg:py-24">
          <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            How it works
          </p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink text-balance sm:text-4xl">
            Download. Log. Repeat.
          </h2>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="relative">
                <span className="font-display text-4xl font-bold text-primary/20">{step.n}</span>
                <h3 className="font-display mt-2 text-xl font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-14 flex flex-col gap-5 border-t border-border/80 pt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-base text-ink-secondary sm:text-lg">
              Free on Basic. Pro from $2.99/mo when you want your own programs and progress tools.
            </p>
            <StoreButtons />
          </div>
        </div>
      </section>

      <footer className="border-t border-border/80 bg-background">
        <div className="mx-auto flex max-w-site flex-col gap-8 px-6 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <Image src="/icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
              <span className="font-display font-medium text-ink">MuscleOS</span>
            </div>
            <p className="mt-2 max-w-xs text-sm text-ink-secondary">
              Workout logging for people who actually train.
            </p>
            <p className="mt-4 text-sm text-ink-muted">© {new Date().getFullYear()} MuscleOS</p>
          </div>
          <div className="flex gap-12 text-sm">
            <div>
              <p className="font-medium text-ink">Product</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="#features" className="text-ink-secondary transition hover:text-ink">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="text-ink-secondary transition hover:text-ink">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">Legal</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/privacy" className="text-ink-secondary transition hover:text-ink">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-ink-secondary transition hover:text-ink">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}
