import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DAY, entry, exercise, NOW } from '../test/fixtures.ts';
import { averageTrend, formatChange, formatPct, progressSeries, repMaxes, trend } from './trends.ts';

const bench = exercise('Barbell Bench Press');

describe('progressSeries', () => {
  it('tracks estimated 1RM for weighted lifts', () => {
    const s = progressSeries(bench, [entry('Barbell Bench Press', 3, [[1, 100]])]);
    assert.equal(s.unit, 'kg');
    assert.equal(s.points[0].y, 100);
  });

  it('keeps only the latest unit when bodyweight work starts using added weight', () => {
    const dips = exercise('Chest Dip');
    const s = progressSeries(dips, [entry('Chest Dip', 9, [[12, 0]]), entry('Chest Dip', 3, [[8, 10]])]);
    assert.equal(s.unit, 'kg');
    assert.equal(s.points.length, 1);
  });
});

describe('trend', () => {
  const at = (daysAgo: number, y: number) => ({ at: NOW - daysAgo * DAY, y, entry: entry('Barbell Bench Press', daysAgo, [[1, y]]) });

  it('measures from the last session before the window to the latest', () => {
    const t = trend([at(70, 100), at(40, 105), at(3, 110)], NOW)!;
    assert.equal(t.from, 100);
    assert.equal(t.to, 110);
    assert.equal(t.change, 10);
    assert.ok(Math.abs(t.pct - 0.1) < 1e-9);
  });

  it('needs two sessions and something recent', () => {
    assert.equal(trend([at(3, 100)], NOW), null);
    assert.equal(trend([at(90, 100), at(80, 110)], NOW), null);
  });

  it('averages exercises equally and ignores unknowns', () => {
    const t = (pct: number) => ({ from: 1, to: 1 + pct, change: pct, pct });
    assert.equal(averageTrend([t(0.1), t(-0.02), null]), 0.04);
    assert.equal(averageTrend([null]), null);
  });
});

describe('repMaxes', () => {
  it('lists the heaviest weight for each rep target and drops ones that say nothing new', () => {
    const r = repMaxes([entry('Barbell Bench Press', 9, [[1, 110], [5, 100]]), entry('Barbell Bench Press', 3, [[3, 100], [8, 90], [12, 70]])]);
    assert.deepEqual(r.map((x) => [x.reps, x.weight]), [[1, 110], [5, 100], [8, 90], [12, 70]]);
  });
});

describe('formatting', () => {
  it('formats changes and percentages with real minus signs', () => {
    assert.equal(formatChange(7.4, 'kg'), '+7.5 kg');
    assert.equal(formatChange(-2, 'reps'), '−2 reps');
    assert.equal(formatChange(0.1, 'reps'), 'No change');
    assert.equal(formatChange(10, 'seconds'), '+10s');
    assert.equal(formatChange(75, 'seconds'), '+1:15');
    assert.equal(formatPct(0.081), '+8%');
    assert.equal(formatPct(-0.004), '±0%');
  });
});
