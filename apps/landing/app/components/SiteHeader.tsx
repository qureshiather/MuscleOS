import Image from 'next/image';
import Link from 'next/link';

const NAV = [
  { href: '/#features', label: 'Features', hideOnMobile: true },
  { href: '/faq', label: 'FAQ', hideOnMobile: false },
  { href: '/#pricing', label: 'Pricing', hideOnMobile: false },
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
        </nav>
      </div>
    </header>
  );
}
