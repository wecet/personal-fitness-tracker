import assert from 'node:assert/strict';
import { it } from 'node:test';
import { weekBeats } from './week.ts';

it('lays out Monday to Sunday with load, plans and match day', () => {
  // Wednesday 18 Nov 2026; matches on Saturday, training Tuesday and Friday.
  const now = new Date(2026, 10, 18, 12);
  const daily = new Map([
    ['2026-11-16', { gym: 400, football: 0 }],
    ['2026-11-17', { gym: 0, football: 600 }],
  ]);
  const beats = weekBeats(now, daily, [6], [2, 5]);
  assert.deepEqual(beats.map((b) => b.letter), ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  assert.deepEqual(beats.map((b) => b.kind), ['gym', 'football', 'rest', 'rest', 'training', 'match', 'rest']);
  assert.equal(beats[1].level, 1);
  assert.equal(beats[0].level, 400 / 600);
  assert.equal(beats.findIndex((b) => b.today), 2);
  assert.deepEqual(beats.map((b) => b.future), [false, false, false, true, true, true, true]);
});

it('keeps a missed match day marked as a match', () => {
  const now = new Date(2026, 10, 22, 12); // Sunday
  const beats = weekBeats(now, new Map(), [6], []);
  assert.equal(beats[5].kind, 'match');
  assert.equal(beats[6].today, true);
});
