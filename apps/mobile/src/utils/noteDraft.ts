/**
 * Save state of a free-text note being edited (the exercise detail sheet's **Your notes**). Notes
 * are stored trimmed, so whitespace-only edits aren't unsaved changes.
 *
 * - `unsaved` — the draft differs from the stored note; Save is enabled.
 * - `saved` — the draft matches a stored, non-empty note.
 * - `empty` — no note stored and nothing typed.
 */
export type NoteSaveState = 'unsaved' | 'saved' | 'empty';

export function noteSaveState(draft: string, saved: string | undefined): NoteSaveState {
  const stored = saved ?? '';
  if (draft.trim() !== stored) return 'unsaved';
  return stored ? 'saved' : 'empty';
}
