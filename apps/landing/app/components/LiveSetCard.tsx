'use client';

import { useEffect, useRef, useState } from 'react';

import {
  beatsPrevious,
  completedVolume,
  formatClock,
  LIVE_EXERCISE_ID,
  LIVE_PREVIOUS,
  LIVE_REST_SECONDS,
  LIVE_START,
  type LiveSet,
  nextSetIndex,
  parseEntry,
  recoveryAfter,
} from '../data/liveSet';

/** The demo runs rest twelve times faster than real life, so 2:00 passes in ten seconds. */
const REST_SPEED = 12;
const TICK_MS = 100;
const AUTOPLAY_MS = 1400;

const RECOVERY = recoveryAfter(LIVE_EXERCISE_ID);

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

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A playable copy of the app's set table. Tick a set and the rest timer runs; finish all three
 * and it shows what you moved and which muscles are now recovering, using the app's own rules.
 */
export function LiveSetCard() {
  const reducedMotion = usePrefersReducedMotion();
  const [sets, setSets] = useState<LiveSet[]>(() => LIVE_START.map((s) => ({ ...s })));
  const [rest, setRest] = useState<{ after: number; left: number } | null>(null);
  const [popped, setPopped] = useState<number | null>(null);
  const touched = useRef(false);

  const active = nextSetIndex(sets);
  const finished = active === -1;

  const resting = rest !== null;
  useEffect(() => {
    if (!resting) return;
    const id = window.setInterval(() => {
      setRest((r) => {
        if (!r) return r;
        const left = r.left - (TICK_MS / 1000) * REST_SPEED;
        return left <= 0 ? null : { ...r, left };
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [resting]);

  function toggle(i: number) {
    touched.current = true;
    const completing = !sets[i].done;
    const next = sets.map((s, j) => (j === i ? { ...s, done: completing } : s));
    setSets(next);
    setPopped(completing ? i : null);
    if (completing && nextSetIndex(next) !== -1) setRest({ after: i, left: LIVE_REST_SECONDS });
    else if (!completing || nextSetIndex(next) === -1) setRest(null);
  }

  // One orchestrated moment on load: the first set ticks itself off and the rest timer starts.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, after the motion check
  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setTimeout(() => {
      if (!touched.current) toggle(0);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [reducedMotion]);

  function edit(i: number, field: 'kg' | 'reps', raw: string) {
    touched.current = true;
    setSets((prev) => prev.map((s, j) => (j === i ? { ...s, [field]: parseEntry(raw, s[field]) } : s)));
  }

  function reset() {
    touched.current = true;
    setSets(LIVE_START.map((s) => ({ ...s })));
    setRest(null);
    setPopped(null);
  }

  const restProgress = rest ? 1 - rest.left / LIVE_REST_SECONDS : 0;
  const beat = sets.some((s) => s.done && beatsPrevious(s, LIVE_PREVIOUS));

  return (
    <div className="relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_30px_80px_-30px_rgba(12,12,20,0.55)]">
      {/* Header: the exercise and the live rest clock */}
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div>
          <p className="font-display text-xl font-bold tracking-tight text-primary">Bench Press</p>
          <p className="text-sm text-ink-muted">Barbell</p>
        </div>
        <div className="text-right" aria-live="polite">
          <p
            className={`font-mono tabular text-3xl font-medium leading-none transition-colors ${
              rest ? 'text-primary' : finished ? 'text-ready' : 'text-ink-muted'
            }`}
          >
            {rest ? formatClock(rest.left) : finished ? 'Done' : formatClock(LIVE_REST_SECONDS)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">{rest ? 'Resting' : finished ? 'Saved' : 'Rest'}</p>
        </div>
      </div>

      {/* Set table */}
      <div className="grid grid-cols-[2.25rem_1fr_4.5rem_3.75rem_3rem] items-center gap-x-2 px-4 pb-1 text-[11px] font-medium tracking-wider text-ink-muted">
        <span className="text-center">SET</span>
        <span className="text-center">PREVIOUS</span>
        <span className="text-center">KG</span>
        <span className="text-center">REPS</span>
        <span className="sr-only">Done</span>
      </div>

      <ol>
        {sets.map((s, i) => {
          const isActive = i === active;
          return (
            <li key={`set-${i + 1}`}>
              <div
                className={`relative grid grid-cols-[2.25rem_1fr_4.5rem_3.75rem_3rem] items-center gap-x-2 px-4 py-2 transition-colors duration-300 ${
                  s.done
                    ? 'tint-ready'
                    : isActive
                      ? 'tint-primary'
                      : ''
                }`}
              >
                <span
                  className={`absolute inset-y-0 left-0 w-1 transition-colors ${
                    s.done ? 'bg-ready' : isActive ? 'bg-primary' : 'bg-transparent'
                  }`}
                  aria-hidden
                />
                <span
                  className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    s.done
                      ? 'bg-ready text-surface'
                      : isActive
                        ? 'bg-primary text-surface'
                        : 'border border-border text-ink-muted'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="font-mono tabular text-center text-sm text-ink-muted">
                  {LIVE_PREVIOUS.kg} × {LIVE_PREVIOUS.reps}
                </span>
                <input
                  aria-label={`Set ${i + 1} weight in kilograms`}
                  inputMode="decimal"
                  defaultValue={s.kg}
                  key={`kg-${i}-${s.kg}`}
                  onBlur={(e) => edit(i, 'kg', e.currentTarget.value)}
                  className="font-mono tabular h-10 w-full rounded-lg bg-background text-center text-lg text-ink outline-none ring-primary focus:ring-2"
                />
                <input
                  aria-label={`Set ${i + 1} reps`}
                  inputMode="numeric"
                  defaultValue={s.reps}
                  key={`reps-${i}-${s.reps}`}
                  onBlur={(e) => edit(i, 'reps', e.currentTarget.value)}
                  className="font-mono tabular h-10 w-full rounded-lg bg-background text-center text-lg text-ink outline-none ring-primary focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={s.done}
                  aria-label={s.done ? `Undo set ${i + 1}` : `Complete set ${i + 1}`}
                  className={`flex h-10 w-full items-center justify-center rounded-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    s.done
                      ? 'bg-ready text-surface'
                      : isActive
                        ? 'border-2 border-primary tint-primary-strong text-primary hover:bg-primary hover:text-surface'
                        : 'border border-border bg-background text-ink-muted hover:border-primary hover:text-primary'
                  } ${popped === i ? 'animate-set-pop' : ''}`}
                >
                  <CheckIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Rest divider: becomes the progress track while the timer runs */}
              {i < sets.length - 1 ? (
                <div className="flex items-center gap-3 px-5 py-1.5">
                  <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary"
                      style={{
                        width: `${rest?.after === i ? restProgress * 100 : 0}%`,
                        transition: `width ${TICK_MS}ms linear`,
                      }}
                    />
                  </div>
                  <span
                    className={`font-mono tabular text-xs ${rest?.after === i ? 'font-semibold text-primary' : 'text-ink-muted'}`}
                  >
                    {rest?.after === i ? formatClock(rest.left) : '2:00'} rest
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Result: what the session produced */}
      <div className="border-t border-border px-5 pb-5 pt-4">
        {finished ? (
          <div className="animate-rise-in">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-lg font-bold text-ink">
                {completedVolume(sets).toLocaleString('en-US')} kg moved
              </p>
              {beat ? (
                <span className="rounded-full tint-ready px-2.5 py-0.5 text-xs font-semibold text-ready">
                  Beat last time
                </span>
              ) : null}
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {RECOVERY.map((m) => (
                <li
                  key={m.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-ink-secondary"
                >
                  <span className="h-2 w-2 rounded-full bg-danger" aria-hidden />
                  {m.label} ready in {m.hours} h
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={reset}
              className="mt-4 text-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Log it again
            </button>
          </div>
        ) : (
          <p className="text-sm text-ink-secondary">
            Last time:{' '}
            <span className="font-mono tabular text-ink">
              {LIVE_PREVIOUS.kg} kg × {LIVE_PREVIOUS.reps}
            </span>
            . Tick each set to start
            your rest.
          </p>
        )}
      </div>
    </div>
  );
}
