import type { Course, KDSTicketItem } from '../types/pos';

// Culinary progression order. Used to decide which course a KDS "Bump to
// Done" press closes when a ticket has more than one course active at once
// (e.g. mains fired early while starters are still cooking). Matches the
// serving order the Expo screen already lays its course strip out in.
const COURSE_SEQUENCE: Course[] = ['drinks', 'starters', 'tacos', 'sides', 'mains', 'desserts'];

// An item with no explicit course is treated as 'mains' — the same
// normalisation fireCourse() uses (`i.course || 'mains'`). Anything not in
// the sequence sorts last so it is never picked as "earliest" unless it is
// the only active course.
export const courseRank = (course?: Course): number => {
  const idx = COURSE_SEQUENCE.indexOf(course ?? 'mains');
  return idx === -1 ? COURSE_SEQUENCE.length : idx;
};

export interface CourseBumpResult {
  items: KDSTicketItem[];
  allItemsBumped: boolean;
}

// A KDS bump closes the single earliest course that currently has active
// (pending/preparing) items — not every active item on the ticket. Held
// items, and active items belonging to a later course, are left untouched.
// `allItemsBumped` still spans every course on the ticket, so the ticket
// only fully closes (and gets its kdsHistory entry) once each course has
// genuinely been bumped.
export const applyCourseBump = (items: KDSTicketItem[]): CourseBumpResult => {
  const activeRanks = items
    .filter(i => i.status === 'pending' || i.status === 'preparing')
    .map(i => courseRank(i.course));
  const earliestActiveRank = activeRanks.length > 0 ? Math.min(...activeRanks) : null;

  const newItems = items.map(i =>
    (i.status === 'pending' || i.status === 'preparing') &&
    earliestActiveRank !== null &&
    courseRank(i.course) === earliestActiveRank
      ? { ...i, status: 'bumped' as const }
      : i
  );

  return { items: newItems, allItemsBumped: newItems.every(i => i.status === 'bumped') };
};
