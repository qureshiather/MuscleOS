import Link from 'next/link';

import { BrandMark } from './BrandMark';

import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { href: '/#features', label: 'Features', hideOnMobile: true },
  { href: '/exercises', label: 'Exercises', hideOnMobile: false },
  { href: '/faq', label: 'FAQ', hideOnMobile: false },
  { href: '/#pricing', label: 'Pricing', hideOnMobile: true },
  { href: '/privacy', label: 'Privacy', hideOnMobile: true },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-site items-center justify-between px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <BrandMark className="h-9 w-9" style={{ viewTransitionName: 'brand-mark' }} />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            MuscleOS
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-4 sm:gap-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center py-1 text-sm font-medium text-ink transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                item.hideOnMobile ? 'max-sm:hidden' : ''
              }`}
            >
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
