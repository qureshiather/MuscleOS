import Link from 'next/link';
import Image from 'next/image';
import { PhoneFrame } from './components/PhoneFrame';

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

/** Store listings are not live yet — keep CTAs honest. */
function ComingSoonStores({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const shell = dark
    ? 'border-white/15 bg-white/5 text-white'
    : 'border-border bg-surface text-ink';
  const muted = dark ? 'text-white/50' : 'text-ink-muted';

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-stretch ${className}`}>
      <div className={`inline-flex min-w-[11.5rem] items-center gap-2.5 rounded-xl border px-5 py-3.5 ${shell}`}>
        <AppStoreIcon className="h-5 w-5 shrink-0" />
        <span className="flex flex-col leading-tight">
          <span className={`text-[11px] ${muted}`}>iPhone</span>
          <span className="text-[15px] font-medium">Coming soon</span>
        </span>
      </div>
      <div className={`inline-flex min-w-[11.5rem] items-center gap-2.5 rounded-xl border px-5 py-3.5 ${shell}`}>
        <GooglePlayIcon className="h-5 w-5 shrink-0" />
        <span className="flex flex-col leading-tight">
          <span className={`text-[11px] ${muted}`}>Android</span>
          <span className="text-[15px] font-medium">Coming soon</span>
        </span>
      </div>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-site items-center justify-between px-6 py-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Image
            src="/icon.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-[10px]"
            priority
          />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            MuscleOS
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-ink-muted">
          <a
            href="#features"
            className="hidden transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Pricing
          </a>
          <Link
            href="/privacy"
            className="transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Privacy
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-surface/60">
      <div className="mx-auto flex max-w-site flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <Image src="/icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
            <span className="font-display font-medium text-ink">MuscleOS</span>
          </div>
          <p className="mt-2 max-w-xs text-sm text-ink-muted">
            Log workouts. See recovery. Keep it simple.
          </p>
          <p className="mt-4 text-sm text-ink-muted">© {new Date().getFullYear()} MuscleOS</p>
        </div>
        <div className="flex gap-12 text-sm">
          <div>
            <p className="font-medium text-ink">Product</p>
            <ul className="mt-3 space-y-2 text-ink-muted">
              <li>
                <a href="#features" className="transition hover:text-ink">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="transition hover:text-ink">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Legal</p>
            <ul className="mt-3 space-y-2 text-ink-muted">
              <li>
                <Link href="/privacy" className="transition hover:text-ink">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition hover:text-ink">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

const PROBLEMS = [
  {
    pain: 'Guessing which muscles need rest',
    fix: 'A body map shows what’s still recovering after you log a session.',
  },
  {
    pain: 'Apps that bury logging behind fluff',
    fix: 'Start a template, log sets and reps, rest timer included — that’s the core loop.',
  },
  {
    pain: 'Paying before you know if it fits',
    fix: 'Basic is a real gym log: built-in programs, recovery, history, and export stay free.',
  },
] as const;

const FEATURES = [
  {
    id: 'recovery',
    label: 'Recovery',
    title: 'See what’s ready before you train',
    body: 'After a workout, MuscleOS updates a front-and-back muscle map. Ready groups show green; recovering groups warm up toward hot — so the next session isn’t a guess.',
    points: [
      'Front and back body diagram',
      'Built from the sessions you actually logged',
      'Included on Basic — not gated',
    ],
    src: '/screens/recovery.png',
    alt: 'MuscleOS Recovery screen with green ready muscle highlights',
    tilt: 'left' as const,
  },
  {
    id: 'logging',
    label: 'Logging',
    title: 'Templates, sets, and rest — without the clutter',
    body: 'Pick a built-in program (PPL, Upper/Lower, 5×5, Arnold, and more), run the session, and log weight and reps as you go. Plate calculator and workout sounds are there when you need them.',
    points: [
      '11 built-in programs',
      'Set logging with rest timers',
      'Resume an in-progress workout',
    ],
    src: '/screens/workouts.png',
    alt: 'MuscleOS Workouts screen',
    tilt: 'right' as const,
  },
  {
    id: 'library',
    label: 'Library & history',
    title: 'Find the movement. Keep the record.',
    body: 'Browse a few hundred built-in exercises by muscle and equipment. After sessions finish, history is there to review — and you can export your data as JSON anytime.',
    points: [
      'Search and filter the exercise library',
      'Workout history list and detail',
      'Export your data',
    ],
    src: '/screens/exercises.png',
    alt: 'MuscleOS exercise library',
    tilt: 'left' as const,
  },
] as const;

const STEPS = [
  {
    n: '1',
    title: 'Open the app',
    body: 'Start logging right away — no account required for local use.',
  },
  {
    n: '2',
    title: 'Run a template',
    body: 'Choose a built-in program and log sets as you train.',
  },
  {
    n: '3',
    title: 'Check recovery',
    body: 'See which muscle groups are ready for the next session.',
  },
] as const;

export default function Home() {
  return (
    <div className="bg-atmosphere relative min-h-screen overflow-x-hidden">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <SiteHeader />

      {/* Hero */}
      <section className="relative mx-auto grid min-h-[100svh] max-w-site grid-cols-1 items-center gap-12 px-6 pb-16 pt-28 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-24 lg:pt-24">
        <div className="relative z-10 max-w-xl animate-rise">
          <p className="font-mono-label mb-5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            Workout companion
          </p>
          <h1 className="font-display text-[clamp(3.25rem,9vw,5.5rem)] font-extrabold leading-[0.92] tracking-tight text-ink">
            MuscleOS
          </h1>
          <p className="mt-5 max-w-md text-xl leading-snug text-ink-secondary text-balance sm:text-2xl">
            Train hard. Recover on schedule.
          </p>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
            A gym log with a recovery map — built-in programs, set tracking, and a clear view of which muscles are ready next.
          </p>
          <ComingSoonStores className="mt-9 animate-rise-delay-1" />
          <p className="mt-4 text-sm text-ink-muted animate-rise-delay-1">
            Free Basic tier. No credit card. Store pages go live when the apps ship.
          </p>
        </div>

        <div className="relative flex justify-center lg:justify-end animate-rise-delay-2">
          <div
            className="absolute -inset-8 top-10 rounded-[3rem] bg-gradient-to-br from-primary/10 via-ready/5 to-transparent blur-2xl lg:-inset-12"
            aria-hidden
          />
          <div className="animate-float relative">
            <PhoneFrame
              src="/screens/recovery.png"
              alt="MuscleOS Recovery screen showing front and back muscle maps"
              priority
            />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="relative border-t border-border/70 bg-surface/50">
        <div className="mx-auto max-w-site px-6 py-20 sm:px-8 lg:py-24">
          <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            The real problem
          </p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl text-balance">
            You don’t need another social feed. You need a log that respects recovery.
          </h2>

          <ul className="mt-12 grid gap-6 sm:grid-cols-3">
            {PROBLEMS.map((item) => (
              <li key={item.pain} className="border-t border-border pt-6">
                <p className="font-medium text-ink">{item.pain}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">→ {item.fix}</p>
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
              What you get
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl text-balance">
              Three things the app actually does.
            </h2>
            <p className="mt-4 text-lg text-ink-secondary">
              No XP, no leaderboards, no fake social layer — just logging, recovery, and history.
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
                    <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-ready">
                      {feature.label}
                    </p>
                    <h3 className="font-display mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl text-balance">
                      {feature.title}
                    </h3>
                    <p className="mt-4 max-w-md text-base leading-relaxed text-ink-secondary sm:text-lg">
                      {feature.body}
                    </p>
                    <ul className="mt-6 space-y-2.5 text-sm text-ink-secondary">
                      {feature.points.map((point) => (
                        <li key={point} className="flex gap-2.5">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`flex justify-center ${phoneFirst ? 'lg:order-1 lg:justify-start' : 'lg:justify-end'}`}>
                    <div className={i % 2 === 0 ? 'animate-float' : 'animate-float-slow'}>
                      <PhoneFrame
                        src={feature.src}
                        alt={feature.alt}
                        label={feature.label}
                        tilt={feature.tilt}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing — honest */}
      <section id="pricing" className="relative border-t border-border/70 bg-surface/50">
        <div className="mx-auto max-w-site px-6 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              Pricing
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl text-balance">
              Basic is a real gym log. Pro is optional.
            </h2>
            <p className="mt-4 text-lg text-ink-secondary">
              Upgrade when you outgrow built-in programs — not to unlock the basics.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-3xl gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-7 sm:p-8">
              <p className="font-display text-xl font-semibold text-ink">Basic</p>
              <p className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Free</p>
              <ul className="mt-6 space-y-2.5 text-sm text-ink-secondary">
                <li>11 built-in programs</li>
                <li>Full set logging &amp; rest timers</li>
                <li>Exercise library &amp; recovery map</li>
                <li>History &amp; JSON export</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-7 sm:p-8">
              <p className="font-display text-xl font-semibold text-ink">Pro</p>
              <p className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
                $2.99<span className="text-lg font-medium text-ink-muted">/mo</span>
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                or $19.99/yr · $39.99 lifetime (USD)
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-ink-secondary">
                <li>Custom templates &amp; exercises</li>
                <li>Empty / ad-hoc workouts</li>
                <li>Personal records &amp; progression charts</li>
                <li>Monthly training calendar</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative border-t border-border/70">
        <div className="mx-auto max-w-site px-6 py-20 sm:px-8 lg:py-24">
          <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            How it works
          </p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl text-balance">
            Three steps. No onboarding maze.
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
        </div>
      </section>

      {/* Closing */}
      <section className="relative border-t border-border/70 bg-ink text-white">
        <div className="mx-auto flex max-w-site flex-col items-start gap-8 px-6 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-20">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              MuscleOS is almost here.
            </h2>
            <p className="mt-3 max-w-md text-lg text-white/65">
              iOS and Android builds are in progress. This site will link to the stores when they’re live — no fake download buttons in the meantime.
            </p>
          </div>
          <ComingSoonStores dark />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
