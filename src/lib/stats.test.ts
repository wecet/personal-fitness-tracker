import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activity, DAY, entry, exById, NOW } from '../test/fixtures.ts';
import { beats, daysSinceTrained, formatDuration, formatKg, formatSets, hoursToRecover, muscleFatigue, personalBests, weeklySets } from './stats.ts';
import { setEfforts } from './strain.ts';
import { maxRepsAt, wathen1RM } from './strength.ts';

describe('formatting', () => {
  it('formats kg, durations and grouped sets', () => {
    assert.equal(formatKg(80), '80 kg');
    assert.equal(formatKg(82.5), '82.5 kg');
    assert.equal(formatDuration(65), '1:05');
    assert.equal(formatSets([{ reps: 8, weight: 80 }, { reps: 8, weight: 80 }, { reps: 7, weight: 80 }], 'weight'), '3 × 7–8 @ 80 kg');
  });
});

describe('personal bests', () => {
  it('prefers heavier, then more reps', () => {
    assert.ok(beats({ reps: 1, weight: 101 }, { reps: 10, weight: 100 }, 'weight'));
    assert.ok(beats({ reps: 9, weight: 100 }, { reps: 8, weight: 100 }, 'weight'));
    assert.ok(!beats({ reps: 8, weight: 100 }, { reps: 8, weight: 100 }, 'weight'));
  });

  it('marks every entry that set a new best when it was logged', () => {
    const a = entry('Barbell Bench Press', 9, [[5, 80]]);
    const b = entry('Barbell Bench Press', 6, [[5, 75]]);
    const c = entry('Barbell Bench Press', 3, [[6, 80]]);
    const { best, prEntryIds } = personalBests([c, a, b], exById);
    assert.deepEqual([...prEntryIds].sort(), [a.id, c.id].sort());
    assert.equal(best.get(a.exerciseId)!.reps, 6);
  });
});

describe('strength estimates', () => {
  it('Wathen 1RM and its inverse agree', () => {
    const oneRm = wathen1RM(100, 5);
    assert.ok(oneRm > 110 && oneRm < 118);
    assert.ok(Math.abs(maxRepsAt(100, oneRm) - 5) < 0.01);
    assert.equal(wathen1RM(100, 1), 100);
  });
});

describe('effort, volume and recovery', () => {
  const session = [entry('Barbell Bench Press', 1, [[8, 80], [8, 80], [8, 80]])];
  const efforts = setEfforts(session, exById);

  it('infers reps in reserve and counts hard sets for the main muscle, half for helpers', () => {
    const sets = efforts.get(session[0].id)!;
    assert.ok(sets.every((s) => s.rir != null && s.rir >= 0 && s.rir <= 4));
    const volume = weeklySets(session, exById, NOW, efforts);
    assert.equal(volume.get('chest'), 3);
    assert.equal(volume.get('triceps'), 1.5);
  });

  it('logs mobility work with no fatigue', () => {
    const stretch = entry('Couch Stretch', 1, [[1, 0]]);
    assert.ok(setEfforts([stretch], exById).get(stretch.id)!.every((s) => s.fatigue === 0 && s.hard === 0));
  });

  it('leaves a trained muscle recovering, and fully recovered after ten days', () => {
    const fresh = muscleFatigue(session, exById, NOW, efforts);
    assert.ok(fresh.get('chest')!.hoursLeft > 0);
    const later = muscleFatigue(session, exById, NOW + 10 * DAY, efforts);
    assert.equal(later.get('chest'), undefined);
  });

  it('loads the legs after a match', () => {
    const f = muscleFatigue([], exById, NOW, new Map(), [activity(0.5, 90, 8)]);
    assert.ok(f.get('hamstrings')!.hoursLeft > 24);
    assert.equal(f.get('chest'), undefined);
  });

  it('scales recovery time with load', () => {
    assert.equal(hoursToRecover('chest', 0.5), 0);
    assert.ok(hoursToRecover('chest', 6) > hoursToRecover('chest', 3));
  });

  it('counts whole days since a muscle was last trained', () => {
    assert.equal(daysSinceTrained(session, exById, NOW).get('chest'), 1);
  });
});
