// Runnable check for the KDS course-scoped bump logic.
// No test runner is configured in this repo — run it directly:
//
//   npx tsx src/lib/kdsCourseBump.test.ts
//
import assert from 'node:assert/strict';
import type { Course, KDSTicketItem } from '../types/pos';
import { applyCourseBump, courseRank } from './kdsCourseBump';

let n = 0;
const it = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ok  ${name}`);
};

const item = (
  course: Course | undefined,
  status: KDSTicketItem['status'],
  name = course ?? 'item'
): KDSTicketItem => ({
  uuid: `${name}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  quantity: 1,
  modifiers: [],
  course,
  status,
});

const courses = (items: KDSTicketItem[], status: KDSTicketItem['status']) =>
  items.filter(i => i.status === status).map(i => i.course).sort();

console.log('kdsCourseBump');

it('courseRank orders culinary progression, undefined -> mains, unknown -> last', () => {
  assert.ok(courseRank('starters') < courseRank('sides'));
  assert.ok(courseRank('sides') < courseRank('mains'));
  assert.ok(courseRank('mains') < courseRank('desserts'));
  assert.equal(courseRank(undefined), courseRank('mains'));
  assert.equal(courseRank('nonsense' as Course), 6);
});

// Scenario (a): starters + sides fire immediately onto the same ticket.
// Bumping starters must NOT also bump sides.
it('(a) bump closes only starters, leaves sides pending', () => {
  const items = [
    item('starters', 'pending', 'nachos'),
    item('starters', 'preparing', 'wings'),
    item('sides', 'pending', 'fries'),
  ];
  const r = applyCourseBump(items);
  assert.deepEqual(courses(r.items, 'bumped'), ['starters', 'starters']);
  assert.deepEqual(courses(r.items, 'pending'), ['sides']);
  assert.equal(r.allItemsBumped, false);
});

it('(a) second bump then closes sides and fully closes the ticket', () => {
  const items = [
    item('starters', 'bumped', 'nachos'),
    item('sides', 'pending', 'fries'),
  ];
  const r = applyCourseBump(items);
  assert.deepEqual(courses(r.items, 'bumped'), ['sides', 'starters']);
  assert.equal(r.allItemsBumped, true);
});

// Scenario (b): mains fired early while starters still cooking.
it('(b) mains fired early survives a starters bump', () => {
  const items = [
    item('starters', 'preparing', 'soup'),
    item('mains', 'pending', 'steak'), // fired early by Expo
  ];
  const r = applyCourseBump(items);
  assert.deepEqual(courses(r.items, 'bumped'), ['starters']);
  assert.deepEqual(courses(r.items, 'pending'), ['mains']);
  assert.equal(r.allItemsBumped, false);
});

it('(b) bumping mains afterwards fully closes the ticket', () => {
  const items = [
    item('starters', 'bumped', 'soup'),
    item('mains', 'preparing', 'steak'),
  ];
  const r = applyCourseBump(items);
  assert.equal(r.items.every(i => i.status === 'bumped'), true);
  assert.equal(r.allItemsBumped, true);
});

// Regression: the common case must still work.
it('regression: single-course order bumps and closes in one press', () => {
  const items = [
    item('mains', 'preparing', 'burger'),
    item('mains', 'preparing', 'tacos'),
  ];
  const r = applyCourseBump(items);
  assert.equal(r.items.every(i => i.status === 'bumped'), true);
  assert.equal(r.allItemsBumped, true);
});

it('regression: drinks-only bar ticket closes in one press', () => {
  const items = [item('drinks', 'preparing', 'margarita'), item('drinks', 'preparing', 'cola')];
  const r = applyCourseBump(items);
  assert.equal(r.allItemsBumped, true);
});

it('regression: held later course is untouched and keeps the ticket open', () => {
  const items = [
    item('starters', 'preparing', 'soup'),
    item('mains', 'held', 'steak'),
  ];
  const r = applyCourseBump(items);
  assert.deepEqual(courses(r.items, 'bumped'), ['starters']);
  assert.deepEqual(courses(r.items, 'held'), ['mains']);
  assert.equal(r.allItemsBumped, false);
});

it('edge: no active items -> no-op, ticket does not close', () => {
  const items = [item('mains', 'held', 'steak'), item('desserts', 'held', 'cake')];
  const r = applyCourseBump(items);
  assert.deepEqual(r.items, items);
  assert.equal(r.allItemsBumped, false);
});

it('edge: undefined-course item is bumped with mains, not before it', () => {
  const items = [
    item('starters', 'preparing', 'soup'),
    item(undefined, 'pending', 'mystery'),
  ];
  const first = applyCourseBump(items);
  assert.equal(first.items.find(i => i.name === 'mystery')!.status, 'pending'); // not yet
  assert.equal(first.items.find(i => i.name === 'soup')!.status, 'bumped');

  const second = applyCourseBump(first.items);
  assert.equal(second.items.find(i => i.name === 'mystery')!.status, 'bumped');
  assert.equal(second.allItemsBumped, true);
});

console.log(`\n${n} checks passed`);
