import type { Exercise } from '@muscleos/types';
import { EXERCISE_CATEGORY_LABELS, MUSCLE_GROUPS } from '@muscleos/types';

/** Lowercase, strip diacritics, turn punctuation/hyphens into spaces. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function dropTrailingPlural(value: string): string {
  if (value.length >= 3 && value.endsWith('s') && !value.endsWith('ss')) {
    return value.slice(0, -1);
  }
  return value;
}

function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = new Array<number>(cols);
  let curr = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;

  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}

function maxEditDistance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  return 2;
}

function tokenMatchesHaystack(token: string, normalized: string, words: string[]): boolean {
  if (!token) return true;
  if (normalized.includes(token)) return true;
  const stemmed = dropTrailingPlural(token);
  if (stemmed !== token && normalized.includes(stemmed)) return true;

  const max = maxEditDistance(token.length);
  if (max === 0) return false;
  for (const word of words) {
    if (levenshtein(token, word, max) <= max) return true;
    if (stemmed !== token && levenshtein(stemmed, word, max) <= max) return true;
  }
  return false;
}

/** Score a single searchable string against a normalized query. 0 = no match. */
export function scoreSearchText(haystack: string, normalizedQuery: string): number {
  if (!normalizedQuery) return 1;
  const normalized = normalizeSearchText(haystack);
  if (!normalized) return 0;

  const compactQuery = normalizedQuery.replace(/ /g, '');
  const compactHaystack = normalized.replace(/ /g, '');
  const compactQueryStem = dropTrailingPlural(compactQuery);
  const compactHaystackStem = dropTrailingPlural(compactHaystack);

  if (normalized === normalizedQuery || compactHaystack === compactQuery) return 1000;
  if (compactHaystackStem === compactQueryStem && compactQueryStem.length > 0) return 960;
  if (normalized.startsWith(normalizedQuery) || compactHaystack.startsWith(compactQuery)) return 800;
  if (normalized.includes(normalizedQuery) || compactHaystack.includes(compactQuery)) return 700;
  if (
    compactQueryStem.length >= 4 &&
    (compactHaystack.includes(compactQueryStem) || compactHaystackStem.includes(compactQueryStem))
  ) {
    return 640;
  }

  const tokens = normalizedQuery.split(' ');
  const words = normalized.split(' ');
  if (tokens.every((token) => tokenMatchesHaystack(token, normalized, words))) {
    const inOrder = normalized.includes(tokens.join(' ')) || compactHaystack.includes(compactQuery);
    return inOrder ? 520 : 400;
  }

  if (compactQuery.length >= 5) {
    const max = maxEditDistance(compactQuery.length);
    if (levenshtein(compactQuery, compactHaystack, max) <= max) return 280;
    if (
      compactQueryStem !== compactQuery &&
      levenshtein(compactQueryStem, compactHaystackStem, max) <= max
    ) {
      return 260;
    }
  }

  return 0;
}

function metadataHaystacks(exercise: Exercise): string[] {
  const fields = [
    exercise.category.replace('_', ' '),
    EXERCISE_CATEGORY_LABELS[exercise.category],
    ...exercise.equipment,
    ...exercise.muscles.flatMap((id) => {
      const group = MUSCLE_GROUPS[id];
      return group ? [group.name, id.replace('_', ' ')] : [id.replace('_', ' ')];
    }),
  ];
  return fields;
}

export function exerciseSearchScore(exercise: Exercise, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 1;

  const nameScore = scoreSearchText(exercise.name, normalizedQuery);
  if (nameScore > 0) return nameScore + 80;

  const idScore = scoreSearchText(exercise.id.replace(/-/g, ' '), normalizedQuery);
  if (idScore > 0) return idScore + 40;

  for (const alias of exercise.aliases ?? []) {
    const aliasScore = scoreSearchText(alias.replace(/-/g, ' '), normalizedQuery);
    if (aliasScore > 0) return aliasScore + 20;
  }

  for (const field of metadataHaystacks(exercise)) {
    const metaScore = scoreSearchText(field, normalizedQuery);
    if (metaScore > 0) return Math.min(metaScore, 350);
  }

  return 0;
}

export function exerciseMatchesQuery(exercise: Exercise, query: string): boolean {
  return exerciseSearchScore(exercise, query) > 0;
}

export function textMatchesQuery(haystack: string, query: string): boolean {
  return scoreSearchText(haystack, normalizeSearchText(query)) > 0;
}

/** Filter and rank exercises for a search box. Unfiltered lists keep their original order. */
export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return exercises;

  return exercises
    .map((exercise) => ({ exercise, score: exerciseSearchScore(exercise, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
    .map((entry) => entry.exercise);
}

export function buildExerciseAliasMap(exercises: Exercise[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const exercise of exercises) {
    for (const alias of exercise.aliases ?? []) {
      map.set(alias, exercise.id);
    }
  }
  return map;
}
