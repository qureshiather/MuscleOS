'use client';

import { useEffect, useRef, useState } from 'react';

import type { DemoSources, DemoTheme } from '../data/exercises';

function siteTheme(): DemoTheme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === 'dark' || chosen === 'light') return chosen;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The site theme, following the toggle (`data-theme`) and the OS setting. Null until mounted. */
function useSiteTheme(): DemoTheme | null {
  const [theme, setTheme] = useState<DemoTheme | null>(null);
  useEffect(() => {
    const update = () => setTheme(siteTheme());
    update();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      media.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);
  return theme;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * A looping exercise demo in the clip rendered for the current site theme. Before hydration it
 * shows both posters behind the theme CSS classes, so the first paint is already right. With
 * `lazy`, the clip loads and plays only while on screen (the library grid has many of them).
 * With reduced motion nothing autoplays: the poster shows, with a Play button unless the demo is
 * `static` (grid cards, which are links themselves).
 */
export function ExerciseDemo({
  sources,
  label,
  lazy = false,
  static: isStatic = false,
  className = '',
}: {
  sources: DemoSources;
  label: string;
  lazy?: boolean;
  static?: boolean;
  className?: string;
}) {
  const theme = useSiteTheme();
  const reducedMotion = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!lazy);
  const [played, setPlayed] = useState(false);
  const animate = !reducedMotion || played;

  useEffect(() => {
    if (!lazy || !box.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '200px',
    });
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [lazy]);

  return (
    <div ref={box} className={`relative aspect-square w-full max-w-full overflow-hidden ${className}`}>
      {theme && visible && animate ? (
        <video
          key={theme}
          className="h-full w-full object-cover"
          src={sources[theme].video}
          poster={sources[theme].poster}
          aria-label={label}
          muted
          loop
          playsInline
          autoPlay
          disablePictureInPicture
          disableRemotePlayback
        />
      ) : theme ? (
        <>
          {/* biome-ignore lint/performance/noImgElement: static export, posters are already sized */}
          <img className="h-full w-full object-cover" src={sources[theme].poster} alt={label} loading="lazy" />
          {reducedMotion && !isStatic ? (
            <button
              type="button"
              onClick={() => setPlayed(true)}
              className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink shadow-phone-sm transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                <path d="M8 5.5v13l10.5-6.5z" />
              </svg>
              Play demo
            </button>
          ) : null}
        </>
      ) : (
        <>
          {/* biome-ignore lint/performance/noImgElement: static export, posters are already sized */}
          <img className="theme-light-only h-full w-full object-cover" src={sources.light.poster} alt={label} loading="lazy" />
          {/* biome-ignore lint/performance/noImgElement: static export, posters are already sized */}
          <img className="theme-dark-only h-full w-full object-cover" src={sources.dark.poster} alt={label} loading="lazy" />
        </>
      )}
    </div>
  );
}
