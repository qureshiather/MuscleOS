'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

export type ScrollerFeature = {
  id: string;
  label: string;
  title: string;
  body: string;
  points: readonly string[];
};

/**
 * Feature tour. On large screens the phone stays pinned and swaps to the screen for whichever
 * feature is in the middle of the viewport; the tab rail beside it jumps to a feature. On small
 * screens each feature shows its own phone inline.
 */
export function FeatureScroller({ features, phones }: { features: readonly ScrollerFeature[]; phones: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const blocks = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    for (const el of blocks.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
      <div>
        {features.map((f, i) => (
          <article
            key={f.id}
            id={f.id}
            data-index={i}
            ref={(el) => {
              blocks.current[i] = el;
            }}
            className="scroll-mt-24 py-10 lg:flex lg:min-h-[78vh] lg:flex-col lg:justify-center lg:py-0"
          >
            <h3 className="font-display text-3xl font-bold tracking-tight text-ink text-balance sm:text-4xl">
              {f.title}
            </h3>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-secondary">{f.body}</p>
            <ul className="mt-6 grid max-w-md gap-2.5 text-[15px] text-ink">
              {f.points.map((point) => (
                <li key={point} className="flex gap-3">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-ready" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-10 lg:hidden">{phones[i]}</div>
          </article>
        ))}
      </div>

      {/* Pinned phone + tab rail (large screens) */}
      <div className="hidden lg:block">
        <div className="sticky top-[11vh] flex h-[78vh] items-center justify-center gap-10">
          <div className="relative">
            <div className="glow-primary absolute -inset-16 opacity-50" aria-hidden />
            <div className="relative grid">
              {phones.map((phone, i) => (
                <div
                  key={features[i].id}
                  className="col-start-1 row-start-1 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    opacity: i === active ? 1 : 0,
                    transform: i === active ? 'none' : `translateY(${i < active ? -24 : 24}px) scale(0.96)`,
                  }}
                  aria-hidden={i !== active}
                >
                  {phone}
                </div>
              ))}
            </div>
          </div>

          <nav aria-label="Features" className="flex flex-col gap-1">
            {features.map((f, i) => (
              <a
                key={f.id}
                href={`#${f.id}`}
                aria-current={i === active ? 'true' : undefined}
                className={`group flex items-center gap-3 rounded-lg py-1.5 pr-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  i === active ? 'text-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <span
                  className={`h-0.5 rounded-full transition-all duration-300 ${
                    i === active ? 'w-8 bg-primary' : 'w-4 bg-border group-hover:w-6'
                  }`}
                  aria-hidden
                />
                {f.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
