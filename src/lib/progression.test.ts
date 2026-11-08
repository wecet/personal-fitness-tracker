import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { entry, exercise, NOW } from '../test/fixtures.ts';
import { forReadiness, suggestNext } from './progression.ts';

const bench = exercise('Barbell Bench Press');
const squat = exercise('Back Squat');
const suggest = (history: ReturnType<typeof entry>[], ex = bench, rpe?: number) =>
  suggestNext(history, ex, { now: NOW, rpe: rpe == null ? undefined : () => rpe });

describe('suggestNext', () => {
  it('has nothing to say before the first session, or for non-strength work', () => {
    assert.equal(suggest([]), null);
    assert.equal(suggestNext([entry('Box Jump', 2, [[5, 0]])], exercise('Box Jump'), { now: NOW }), null);
  });

  it('adds a rep while below the top of the range', () => {
    const s = suggest([entry('Barbell Bench Press', 3, [[8, 80], [7, 80]])])!;
    assert.equal(s.tone, 'up');
    assert.equal(s.short, '80 kg × 8');
    assert.deepEqual(s.sets.map((x) => x.reps), [8, 8]);
  });

  it('holds once at the top of the range, then goes up after two sessions there', () => {
    const once = suggest([entry('Barbell Bench Press', 3, [[10, 80], [10, 80]])])!;
    assert.equal(once.tone, 'hold');
    const twice = suggest([entry('Barbell Bench Press', 6, [[10, 80], [10, 80]]), entry('Barbell Bench Press', 3, [[10, 80], [11, 80]])])!;
    assert.equal(twice.tone, 'up');
    assert.equal(twice.short, '82.5 kg');
    assert.deepEqual(twice.sets.map((x) => [x.reps, x.weight]), [[8, 82.5], [9, 82.5]]);
  });

  it('jumps more for lower-body lifts (≈5% vs ≈2.5%)', () => {
    const h = [entry('Back Squat', 6, [[10, 100]]), entry('Back Squat', 3, [[10, 100]])];
    assert.equal(suggest(h, squat)!.short, '105 kg');
  });

  it('goes up straight away after a workout rated easy, but not a hard one', () => {
    const h = [entry('Barbell Bench Press', 3, [[10, 80], [10, 80]], { sessionId: 's' })];
    assert.equal(suggest(h, bench, 6)!.tone, 'up');
    assert.equal(suggest(h, bench, 9)!.tone, 'hold');
  });

  it('eases back in after a layoff: ~90% after 3 weeks, ~80% after 6', () => {
    assert.equal(suggest([entry('Barbell Bench Press', 28, [[8, 80]])])!.short, '72.5 kg');
    assert.equal(suggest([entry('Barbell Bench Press', 56, [[8, 80]])])!.short, '65 kg');
    assert.equal(suggest([entry('Barbell Bench Press', 20, [[8, 80]])])!.tone, 'up');
  });

  it('resets ~10% after three sessions at one weight with no progress', () => {
    const h = [7, 6, 3].map((d, i) => entry('Barbell Bench Press', d, [[7, 80], [i ? 6 : 7, 80]]));
    const s = suggest(h)!;
    assert.equal(s.tone, 'down');
    assert.equal(s.short, '72.5 kg');
  });

  it('does not reset again while building back up after a reset', () => {
    const h = [entry('Barbell Bench Press', 12, [[6, 100]]), entry('Barbell Bench Press', 9, [[8, 90]]), entry('Barbell Bench Press', 6, [[9, 90]]), entry('Barbell Bench Press', 3, [[9, 90]])];
    assert.equal(suggest(h)!.tone, 'up');
  });

  it('adds reps to bodyweight work, then weight once it gets easy', () => {
    const pushUp = exercise('Push-Up');
    assert.equal(suggestNext([entry('Push-Up', 3, [[12, 0]])], pushUp, { now: NOW })!.short, '13 reps');
    const easy = [entry('Push-Up', 6, [[15, 0], [16, 0]]), entry('Push-Up', 3, [[15, 0], [15, 0]])];
    assert.equal(suggestNext(easy, pushUp, { now: NOW })!.short, '+2.5 kg');
  });

  it('lengthens timed holds by ~10%', () => {
    const plank = exercise('Plank');
    const h = [{ ...entry('Plank', 3, []), sets: [{ reps: 0, weight: 0, seconds: 60 }] }];
    assert.equal(suggestNext(h, plank, { now: NOW })!.short, '1:05');
  });
});

describe('forReadiness', () => {
  const last = entry('Barbell Bench Press', 3, [[10, 80], [10, 80], [10, 80]]);
  const up = suggest([entry('Barbell Bench Press', 6, [[10, 80], [10, 80], [10, 80]]), last])!;

  it('leaves the suggestion alone when ready to push or not checked in', () => {
    assert.equal(forReadiness(up, last, bench, 'push'), up);
    assert.equal(forReadiness(up, last, bench, null), up);
  });

  it('holds at last time instead of going up', () => {
    const s = forReadiness(up, last, bench, 'hold');
    assert.equal(s.tone, 'hold');
    assert.deepEqual(s.sets, last.sets);
  });

  it('eases off: about 10% lighter and one set fewer', () => {
    const s = forReadiness(up, last, bench, 'ease');
    assert.equal(s.tone, 'down');
    assert.deepEqual(s.sets.map((x) => [x.reps, x.weight]), [[10, 72.5], [10, 72.5]]);
  });
});
