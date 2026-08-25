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

function StoreButtons({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center ${className}`}>
      <a
        href="https://apps.apple.com/app/muscleos/id000000000"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-ink px-5 py-3.5 text-[15px] font-medium text-white transition hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <AppStoreIcon className="h-5 w-5 shrink-0" />
        <span>App Store</span>
      </a>
      <a
        href="https://play.google.com/store/apps/details?id=com.muscleos.app"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-primary px-5 py-3.5 text-[15px] font-medium text-white transition hover:bg-primary-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <GooglePlayIcon className="h-5 w-5 shrink-0" />
        <span>Google Play</span>
      </a>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-site items-center justify-between px-6 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
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
          <a href="#recovery" className="transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Recovery
          </a>
          <a href="#training" className="hidden transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline">
            Training
          </a>
          <Link href="/privacy" className="transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
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
      <div className="mx-auto flex max-w-site flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-ink-muted sm:flex-row sm:px-8">
        <div className="flex items-center gap-2.5">
          <Image src="/icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
          <span className="font-display font-medium text-ink">MuscleOS</span>
          <span className="text-ink-muted">· © {new Date().getFullYear()}</span>
        </div>
        <p className="flex gap-4">
          <Link href="/privacy" className="transition hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-ink">
            Terms
          </Link>
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="bg-atmosphere relative min-h-screen overflow-x-hidden">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <SiteHeader />

      {/* Hero — brand + one line + CTAs + product visual */}
      <section className="relative mx-auto grid min-h-[100svh] max-w-site grid-cols-1 items-center gap-10 px-6 pb-16 pt-28 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-20 lg:pt-24">
        <div className="relative z-10 max-w-xl animate-rise">
          <p className="font-mono-label mb-5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            Workout companion
          </p>
          <h1 className="font-display text-[clamp(3.25rem,9vw,5.5rem)] font-extrabold leading-[0.92] tracking-tight text-ink">
            MuscleOS
          </h1>
          <p className="mt-6 max-w-md text-xl leading-snug text-ink-secondary text-balance sm:text-2xl">
            Train hard. Recover on schedule.
          </p>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
            Log sets from built-in programs, then see which muscle groups are ready for the next session.
          </p>
          <StoreButtons className="mt-9 animate-rise-delay-1" />
        </div>

        <div className="relative flex justify-center lg:justify-end animate-rise-delay-2">
          {/* Soft stage behind the phone */}
          <div
            className="absolute -inset-8 top-10 rounded-[3rem] bg-gradient-to-br from-primary/10 via-ready/5 to-transparent blur-2xl lg:-inset-12"
            aria-hidden
          />
          <div className="animate-float relative">
            <PhoneFrame
              src="/screens/recovery.png"
              alt="MuscleOS Recovery screen showing front and back muscle maps highlighted when ready"
              priority
            />
          </div>
        </div>
      </section>

      {/* Recovery — one job */}
      <section
        id="recovery"
        className="relative border-t border-border/70 bg-surface/40"
      >
        <div className="mx-auto grid max-w-site grid-cols-1 items-center gap-12 px-6 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-28">
          <div className="order-2 lg:order-1">
            <div className="animate-float-slow relative mx-auto w-fit lg:mx-0">
              <PhoneFrame
                src="/screens/recovery.png"
                alt="Muscle recovery map with ready muscles in green"
                tilt="left"
              />
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-ready">
              Recovery map
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl text-balance">
              See what&apos;s ready before you train.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-secondary">
              After you log a session, MuscleOS tracks muscle recovery on a front-and-back body map.
              Green means ready. Warm and hot tones show groups still recovering — so you plan the next workout with your body, not a guess.
            </p>
          </div>
        </div>
      </section>

      {/* Training — templates + library */}
      <section id="training" className="relative border-t border-border/70">
        <div className="mx-auto max-w-site px-6 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              Training
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl text-balance">
              Templates and a library that stay out of the way.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-secondary">
              Start from built-in programs like PPL, Upper/Lower, and 5×5. Browse hundreds of movements by muscle and equipment. Log reps and weight as you go — Basic includes the full gym-log loop.
            </p>
          </div>

          <div className="mt-14 flex flex-col items-center justify-center gap-8 sm:mt-16 sm:flex-row sm:items-end sm:gap-6 lg:gap-10">
            <div className="animate-float relative z-10">
              <PhoneFrame
                src="/screens/workouts.png"
                alt="Workouts screen with empty workout and template folders"
                tilt="left"
              />
            </div>
            <div className="animate-float-slow relative sm:mb-8">
              <PhoneFrame
                src="/screens/exercises.png"
                alt="Exercise library with search, filters, and 394 movements"
                tilt="right"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative border-t border-border/70 bg-ink text-white">
        <div className="mx-auto flex max-w-site flex-col items-start gap-8 px-6 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-20">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Get MuscleOS
            </h2>
            <p className="mt-3 max-w-md text-lg text-white/65">
              Free to start with built-in programs, recovery, and history. Pro unlocks custom templates and progress tools when you outgrow the defaults.
            </p>
          </div>
          <StoreButtons />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
