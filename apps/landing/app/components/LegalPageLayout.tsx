import Link from 'next/link';

export function LegalPageLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-text-muted)]/20">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img src="/icon.png" alt="" className="w-10 h-10 rounded-xl" />
            <span className="font-semibold text-text">MuscleOS</span>
          </Link>
          <nav className="ml-auto">
            <Link
              href="/"
              className="text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              ← Back
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-10 sm:py-14">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight text-text">{title}</h1>
          <div className="mt-8 space-y-6 text-text-secondary [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline [&_h2]:mt-8 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
            {children}
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-text-muted border-t border-[var(--color-text-muted)]/20">
        <p>© {new Date().getFullYear()} MuscleOS</p>
        <p className="mt-1">
          <Link href="/privacy" className="hover:text-text-secondary">Privacy</Link>
          {' · '}
          <Link href="/terms" className="hover:text-text-secondary">Terms</Link>
          {' · '}
          <Link href="/" className="hover:text-text-secondary">Home</Link>
        </p>
      </footer>
    </div>
  );
}
