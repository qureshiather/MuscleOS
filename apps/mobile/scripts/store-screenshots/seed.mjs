#!/usr/bin/env node
/**
 * Builds the demo log the store screenshots are shot from: eight weeks of Push Pull Legs with
 * gradual progression, plus a Push workout in progress with the rest timer running.
 *
 * Usage: seed.mjs <out.json> [--rest-seconds=N] [--no-active] [--dark]
 * Writes a flat { asyncStorageKey: stringValue } map. Dates are relative to now, so recovery and
 * the "This week" header look right whenever it runs.
 */
import { writeFileSync } from 'node:fs';

const DAY = 86_400_000;
const now = Date.now();
const out = process.argv[2];
if (!out) throw new Error('usage: seed.mjs <out.json>');

/** Weight at week 0, gain per week, rounding step, reps, sets. */
const PLAN = {
  'ppl-push': [
    ['bench-press', 80, 1.25, 2.5, 6, 4],
    ['overhead-press', 47.5, 0.75, 2.5, 6, 3],
    ['incline-bench', 62.5, 1, 2.5, 8, 3],
    ['lateral-raise', 10, 0.25, 1, 12, 3],
    ['tricep-pushdown', 32.5, 0.75, 2.5, 10, 3],
  ],
  'ppl-pull': [
    ['barbell-row', 70, 1.25, 2.5, 8, 4],
    ['lat-pulldown', 62.5, 1, 2.5, 10, 3],
    ['face-pull', 22.5, 0.5, 2.5, 12, 3],
    ['barbell-curl', 32.5, 0.5, 2.5, 10, 3],
    ['hammer-curl', 14, 0.25, 1, 10, 3],
  ],
  'ppl-legs': [
    ['squat', 110, 2, 2.5, 6, 4],
    ['romanian-deadlift', 90, 1.5, 2.5, 8, 3],
    ['leg-press', 170, 3, 5, 10, 3],
    ['leg-curl', 42.5, 0.75, 2.5, 12, 3],
    ['calf-raise', 60, 1, 2.5, 12, 3],
  ],
};

const round = (value, step) => Math.round(value / step) * step;

function sessionAt(templateId, daysAgo, weekIndex, n) {
  const start = new Date(now - daysAgo * DAY);
  start.setHours(17, 40 + (n % 4) * 5, 0, 0);
  const minutes = 58 + ((n * 7) % 16);
  return {
    id: `demo_${n}`,
    templateId,
    startedAt: start.toISOString(),
    completedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
    exercises: PLAN[templateId].map(([exerciseId, base, gain, step, reps, sets]) => ({
      exerciseId,
      restBetweenSetsSeconds: 120,
      sets: Array.from({ length: sets }, (_, i) => ({
        weightKg: round(base + gain * weekIndex, step),
        // The last set of a heavy day sometimes falls a rep short, as real logs do.
        reps: i === sets - 1 && (n + weekIndex) % 3 === 0 ? reps - 1 : reps,
        completed: true,
      })),
    })),
  };
}

// Oldest first. Most recent: Legs yesterday, Pull 2 days ago, Push 4 days ago.
const WEEKS = 8;
const CYCLE = [
  ['ppl-legs', 1],
  ['ppl-pull', 2],
  ['ppl-push', 4],
  ['ppl-legs', 6],
  ['ppl-pull', 7],
  ['ppl-push', 9],
];
const sessions = [];
let n = 0;
for (let block = 0; ; block++) {
  const offset = block * 10;
  if (offset > WEEKS * 7) break;
  for (const [templateId, daysAgo] of CYCLE) {
    const ago = daysAgo + offset;
    sessions.push(sessionAt(templateId, ago, WEEKS - ago / 7, n++));
  }
}
sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

// "Previous" is the most recent session's numbers for each exercise.
const previous = {};
for (const session of [...sessions].reverse()) {
  for (const ex of session.exercises) {
    const last = ex.sets[0];
    previous[ex.exerciseId] = { weightKg: last.weightKg, reps: last.reps };
  }
}

// In progress: Push, first set of bench done, resting before the second.
const restSeconds = 120;
const restArg = process.argv.find((a) => a.startsWith('--rest-seconds='));
const restLeft = restArg ? Number(restArg.split('=')[1]) : 95;
const started = now - 6 * 60_000;
const active = {
  session: {
    id: 'demo_active',
    templateId: 'ppl-push',
    startedAt: new Date(started).toISOString(),
    exercises: PLAN['ppl-push'].map(([exerciseId, , , , , sets]) => {
      const { weightKg, reps } = previous[exerciseId];
      return {
        exerciseId,
        restBetweenSetsSeconds: restSeconds,
        sets: Array.from({ length: sets }, (_, i) =>
          exerciseId === 'bench-press' && i === 0
            ? { weightKg: weightKg + 2.5, reps, completed: true }
            : exerciseId === 'bench-press'
              ? { weightKg: weightKg + 2.5, reps, completed: false }
              : { weightKg, reps, completed: false, weightPrefilled: true, repsPrefilled: true }
        ),
      };
    }),
  },
  restEndTime: now + restLeft * 1000,
  restTotalSeconds: restSeconds,
  restAfter: { exIdx: 0, setIdx: 0 },
  restDurationsBetweenSets: {},
  lastActivityAt: now,
};

const includeActive = !process.argv.includes('--no-active');
const store = {
  muscleos_sessions: JSON.stringify(sessions),
  muscleos_exercise_previous: JSON.stringify(previous),
  muscleos_exercise_notes: JSON.stringify({ squat: 'Safety pins on 7, belt', 'bench-press': 'Bench notch 4, feet planted' }),
  muscleos_active_program: 'builtin_ppl',
  muscleos_theme: process.argv.includes('--dark') ? 'dark' : 'light',
  muscleos_exercise_weight_unit: 'kg',
  muscleos_body_weight_unit: 'kg',
  muscleos_unit_system: 'metric',
  muscleos_workout_sounds: '0',
  muscleos_default_rest: '120',
  muscleos_exact_alarm_prompt_shown: '1',
  muscleos_profile: JSON.stringify({ weightKg: 82, age: 31, sex: 'male' }),
  ...(includeActive ? { muscleos_active_workout: JSON.stringify(active) } : {}),
};
writeFileSync(out, JSON.stringify(store));
console.log(`${sessions.length} sessions → ${out}`);
