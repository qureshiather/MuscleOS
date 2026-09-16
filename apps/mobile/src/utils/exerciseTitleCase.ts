/** Small words stay lowercase unless they are the first or last word. */
const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'but',
  'or',
  'nor',
  'for',
  'on',
  'at',
  'to',
  'from',
  'by',
  'in',
  'of',
  'with',
  'vs',
]);

function titleCasePart(part: string, forceCapitalize: boolean): string {
  const match = part.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/);
  if (!match) return part;
  const [, prefix, core, suffix] = match;
  if (!core) return part;

  const upper = core.toUpperCase();
  if (upper === 'EZ') return `${prefix}EZ${suffix}`;

  const lower = core.toLowerCase();
  if (!forceCapitalize && SMALL_WORDS.has(lower)) {
    return `${prefix}${lower}${suffix}`;
  }

  if (core.length <= 3 && core === upper && /[A-Z]/.test(core)) {
    return `${prefix}${core}${suffix}`;
  }

  const titled = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
  return `${prefix}${titled}${suffix}`;
}

/** Title-case an exercise name the way the catalog is stored. */
export function toExerciseTitleCase(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .map((word, index) => {
      const wordIsEdge = index === 0 || index === words.length - 1;
      const parts = word.split('-');
      return parts
        .map((part, partIndex) => {
          const partIsHyphenTail = partIndex > 0;
          return titleCasePart(part, wordIsEdge || partIsHyphenTail);
        })
        .join('-');
    })
    .join(' ');
}
