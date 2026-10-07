import { describe, expect, it } from 'vitest';
import { noteSaveState } from './noteDraft';

describe('noteSaveState', () => {
  it('is unsaved when the trimmed draft differs from the stored note', () => {
    expect(noteSaveState('seat 5', 'seat 4')).toBe('unsaved');
    expect(noteSaveState('seat 4', undefined)).toBe('unsaved');
    // clearing a stored note is a change too (saving deletes it)
    expect(noteSaveState('', 'seat 4')).toBe('unsaved');
  });

  it('ignores surrounding whitespace, since notes are stored trimmed', () => {
    expect(noteSaveState('  seat 4 ', 'seat 4')).toBe('saved');
    expect(noteSaveState('   ', undefined)).toBe('empty');
  });

  it('is empty with no note stored and nothing typed', () => {
    expect(noteSaveState('', undefined)).toBe('empty');
  });
});
