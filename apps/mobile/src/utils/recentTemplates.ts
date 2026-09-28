import type { WorkoutSession, WorkoutTemplate } from '@muscleos/types';

/** Home "Recent" row cap. */
export const RECENT_TEMPLATES_LIMIT = 6;

export type RecentTemplate = { session: WorkoutSession; template: WorkoutTemplate };

/**
 * The home screen's Recent row: templates you've completed, most recent first, one entry per
 * template. Skips anything already shown in Suggested, templates the user can't start on their
 * tier (callers pass only startable templates), and hidden templates.
 *
 * `completedSessions` must already be newest-first.
 */
export function pickRecentTemplates(args: {
  completedSessions: WorkoutSession[];
  startableTemplates: WorkoutTemplate[];
  suggestedIds: ReadonlySet<string>;
  isHidden: (template: WorkoutTemplate) => boolean;
  limit?: number;
}): RecentTemplate[] {
  const { completedSessions, suggestedIds, isHidden, limit = RECENT_TEMPLATES_LIMIT } = args;
  const templateMap = new Map(args.startableTemplates.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const items: RecentTemplate[] = [];
  for (const session of completedSessions) {
    if (suggestedIds.has(session.templateId) || seen.has(session.templateId)) continue;
    const template = templateMap.get(session.templateId);
    if (template == null || isHidden(template)) continue;
    seen.add(session.templateId);
    items.push({ session, template });
    if (items.length >= limit) break;
  }
  return items;
}
