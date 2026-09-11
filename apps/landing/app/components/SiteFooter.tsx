import Image from 'next/image';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-background">
      <div className="mx-auto flex max-w-site flex-col gap-8 px-5 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <Image src="/icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
            <span className="font-display font-medium text-ink">MuscleOS</span>
          </div>
          <p className="mt-2 max-w-xs text-sm text-ink-secondary">
            Track workouts, history, and muscle recovery.
          </p>
          <p className="mt-4 text-sm text-ink-muted">© {new Date().getFullYear()} MuscleOS</p>
        </div>
        <div className="flex gap-12 text-sm">
          <div>
            <p className="font-medium text-ink">Product</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/#features" className="text-ink-secondary transition hover:text-ink">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-ink-secondary transition hover:text-ink">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-ink-secondary transition hover:text-ink">
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
  );
}
