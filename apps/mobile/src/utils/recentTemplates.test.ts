import type { WorkoutSession, WorkoutTemplate } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { pickRecentTemplates } from './recentTemplates';

const tpl = (id: string, extra: Partial<WorkoutTemplate> = {}): WorkoutTemplate => ({
  id,
  name: id,
  exerciseIds: [],
  ...extra,
});
const done = (templateId: string, day: number): WorkoutSession => ({
  id: `s_${templateId}_${day}`,
  templateId,
  startedAt: `2026-01-${String(day).padStart(2, '0')}T10:00:00.000Z`,
  completedAt: `2026-01-${String(day).padStart(2, '0')}T11:00:00.000Z`,
  exercises: [],
});

const templates = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => tpl(id));
const none = new Set<string>();
const notHidden = () => false;

describe('pickRecentTemplates', () => {
  it('lists one entry per template, most recent first', () => {
    const recent = pickRecentTemplates({
      completedSessions: [done('b', 5), done('a', 4), done('b', 3)],
      templates,
      suggestedIds: none,
      isHidden: notHidden,
    });
    expect(recent.map((r) => [r.template.id, r.session.id])).toEqual([
      ['b', 's_b_5'],
      ['a', 's_a_4'],
    ]);
  });

  it('excludes Suggested, hidden, deleted templates and empty workouts', () => {
    const recent = pickRecentTemplates({
      completedSessions: [done('a', 9), done('b', 8), done('gone', 7), done('_empty', 7), done('c', 6)],
      templates, // 'gone' was deleted; '_empty' is an empty workout
      suggestedIds: new Set(['a']),
      isHidden: (t) => t.id === 'b',
    });
    expect(recent.map((r) => r.template.id)).toEqual(['c']);
  });

  it('caps at 6', () => {
    const sessions = templates.map((t, i) => done(t.id, 20 - i));
    const recent = pickRecentTemplates({
      completedSessions: sessions,
      templates,
      suggestedIds: none,
      isHidden: notHidden,
    });
    expect(recent).toHaveLength(6);
  });
});
