'use client';

import type { Exercise } from '@muscleos/types';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { filterExercises, muscleLine } from '../data/exerciseText';

export type ExerciseListRow = Pick<Exercise, 'id' | 'name' | 'muscles' | 'equipment'> & { demo: boolean };

/** The full catalog A–Z with a search box (name, muscle or equipment). */
export function ExerciseSearch({ rows }: { rows: ExerciseListRow[] }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterExercises(rows, query), [rows, query]);

  return (
    <div>
      <label htmlFor="exercise-search" className="sr-only">
        Search exercises
      </label>
      <input
        id="exercise-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, muscle or equipment"
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[15px] text-ink placeholder:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      <p className="font-mono-label mt-3 text-xs uppercase tracking-wider text-ink-muted" aria-live="polite">
        {shown.length === rows.length ? `${rows.length} exercises` : `${shown.length} of ${rows.length}`}
      </p>
      {shown.length ? (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {shown.map((e) => (
            <li key={e.id}>
              <Link
                href={`/exercises/${e.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{e.name}</span>
                  <span className="block truncate text-sm text-ink-muted">{muscleLine(e)}</span>
                </span>
                {e.demo ? (
                  <span className="font-mono-label shrink-0 rounded-full border border-ready px-2 py-0.5 text-[11px] uppercase tracking-wider text-ready">
                    Demo
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-ink-secondary">
          No exercise matches “{query}”. Try a muscle like “glutes” or equipment like “cable”.
        </p>
      )}
    </div>
  );
}
