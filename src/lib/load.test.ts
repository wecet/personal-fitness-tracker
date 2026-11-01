import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dateKey } from './dates.ts';
import { monotony, weeklyLoad, weeksBefore, workloadSeries, type DayLoad } from './load.ts';

const DAY = 86_400_000;
const end = new Date(2026, 10, 1);
const day = (n: number) => new Date(end.getFullYear(), end.getMonth(), end.getDate() - n);

/** `load` AU of gym work every day for the last `days` days. */
function steady(days: number, load: number): Map<string, DayLoad> {
  return new Map(Array.from({ length: days }, (_, i) => [dateKey(day(i)), { gym: load, football: 0 }]));
}

describe('workloadSeries', () => {
  it('says "building baseline" for the first four weeks', () => {
    const s = workloadSeries(steady(10, 300), dateKey(day(9)), end);
    assert.equal(s.at(-1)!.zone, 'baseline');
  });

  it('settles near a ratio of 1 for steady training', () => {
    const s = workloadSeries(steady(120, 300), dateKey(day(119)), end);
    const last = s.at(-1)!;
    assert.equal(last.zone, 'sweet');
    assert.ok(Math.abs(last.ratio! - 1) < 0.05);
    assert.ok(Math.abs(last.acute - 2100) < 50, 'acute load is expressed per week');
  });

  it('flags a spike when a hard week follows a quiet month', () => {
    const daily = steady(120, 150);
    for (let i = 0; i < 7; i++) daily.set(dateKey(day(i)), { gym: 700, football: 0 });
    assert.equal(workloadSeries(daily, dateKey(day(119)), end).at(-1)!.zone, 'spike');
  });

  it('returns a single empty day without any history', () => {
    assert.deepEqual(workloadSeries(new Map(), null, end).map((w) => w.zone), ['baseline']);
  });
});

describe('monotony', () => {
  it('is undefined for identical days and high for little variation', () => {
    assert.equal(monotony(steady(7, 300), end).monotony, null);
    const varied = new Map([...steady(7, 300)].map(([k, v], i) => [k, { ...v, gym: i % 2 ? 280 : 320 }]));
    assert.ok(monotony(varied, end).monotony! > 2);
  });
});

describe('weekly sums', () => {
  it('sums calendar weeks Monday to Sunday', () => {
    const weeks = weeklyLoad(steady(14, 100), end, 2);
    assert.equal(weeks[1].start.getDay(), 1);
    assert.equal(weeks[1].gym, 700);
  });

  it('sums rolling weeks before a day, excluding the day itself', () => {
    const daily = steady(30, 100);
    daily.set(dateKey(end), { gym: 9999, football: 0 });
    const weeks = weeksBefore(daily, end, 2);
    assert.deepEqual(weeks.map((w) => w.gym), [700, 700]);
    assert.equal(weeks[1].end.getTime(), end.getTime() - DAY);
  });
});
