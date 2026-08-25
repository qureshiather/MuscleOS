import Link from 'next/link';
import Image from 'next/image';

export function LegalPageLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-atmosphere relative min-h-screen overflow-x-hidden">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" aria-hidden />

      <header className="relative z-10 border-b border-border/80 bg-surface/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-5">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Image
              src="/icon.png"
              alt=""
              width={36}
              height={36}
              className="brand-mark h-9 w-9 rounded-[10px]"
              style={{ viewTransitionName: 'brand-mark' }}
            />
            <span className="font-display font-semibold tracking-tight text-ink">MuscleOS</span>
          </Link>
          <nav className="ml-auto">
            <Link
              href="/"
              className="text-sm text-ink-muted transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              ← Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          <div className="mt-8 space-y-6 text-ink-secondary [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
            {children}
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/80 py-6 text-center text-sm text-ink-muted">
        <p>© {new Date().getFullYear()} MuscleOS</p>
        <p className="mt-1 flex justify-center gap-3">
          <Link href="/privacy" className="transition hover:text-ink">
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="transition hover:text-ink">
            Terms
          </Link>
          <span aria-hidden>·</span>
          <Link href="/" className="transition hover:text-ink">
            Home
          </Link>
        </p>
      </footer>
    </div>
  );
}
