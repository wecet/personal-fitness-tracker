import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MUSCLE_IDS } from '../../shared/muscles.ts';
import { DEFAULT_SETTINGS } from '../../shared/types.ts';
import { EXERCISES } from '../test/fixtures.ts';
import { dateKey, parseDateKey } from './dates.ts';
import { activityLoad, footballContext } from './football.ts';
import { loadBar } from './plates.ts';
import { formatNum, parseNumText } from './numText.ts';
import { groupByRegion, REGIONS } from './regions.ts';

describe('dates', () => {
  it('round-trips local date keys', () => {
    const d = new Date(2026, 0, 5, 23, 30);
    assert.equal(dateKey(d), '2026-01-05');
    assert.equal(parseDateKey('2026-01-05').getDate(), 5);
  });
});

describe('plate calculator', () => {
  it('loads each side heaviest first', () => {
    assert.deepEqual(loadBar(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25])!.perSide, [25, 15]);
  });

  it('says when plates can’t make the weight exactly', () => {
    const load = loadBar(101, 20, [25, 20, 10, 5, 2.5])!;
    assert.equal(load.exact, false);
    assert.equal(load.total, 100);
    assert.equal(loadBar(15, 20, [25]), null);
  });
});

describe('football schedule', () => {
  // Matches on Saturday (6), training Tuesday (2) and Friday (5).
  const settings = DEFAULT_SETTINGS;
  const on = (y: number, m: number, d: number) => footballContext(new Date(y, m, d, 9), settings, []);

  it('labels days around the match', () => {
    assert.equal(on(2026, 9, 31).label, 'Match day'); // Saturday
    assert.equal(on(2026, 10, 1).label, 'MD+1'); // Sunday
    assert.equal(on(2026, 10, 3).label, 'Football training'); // Tuesday
    assert.equal(on(2026, 10, 4).label, 'MD-3'); // Wednesday
    assert.equal(on(2026, 10, 4).legsWindow, true);
  });

  it('measures session load as minutes × effort', () => {
    assert.equal(activityLoad({ minutes: 90, rpe: 8 }), 720);
  });
});

describe('muscle regions', () => {
  it('covers every muscle', () => {
    assert.deepEqual(Object.keys(REGIONS).sort(), [...MUSCLE_IDS].sort());
  });

  it('only lists library exercises, under the muscle they train', () => {
    for (const [muscle, regions] of Object.entries(REGIONS)) {
      for (const region of regions) {
        for (const name of region.exercises) {
          const ex = EXERCISES.find((e) => e.name === name);
          assert.ok(ex, `${muscle}/${region.id}: "${name}" isn't in the library`);
          assert.equal(ex.muscle, muscle, `${name} is filed under ${muscle} but trains ${ex.muscle}`);
        }
      }
    }
  });

  it('places every library strength exercise in a region', () => {
    for (const ex of EXERCISES.filter((e) => e.kind === 'strength')) {
      const { other } = groupByRegion(ex.muscle, [ex]);
      assert.equal(other.length, 0, `${ex.name} (${ex.muscle}) has no region`);
    }
  });

  it('numbers regions in order', () => {
    const { groups } = groupByRegion('chest', EXERCISES);
    assert.deepEqual(groups.map((g) => [g.number, g.region.id]), [[1, 'upper'], [2, 'mid'], [3, 'lower']]);
  });
});

describe('count-up number text', () => {
  it('splits a value into prefix, number and unit', () => {
    assert.deepEqual(parseNumText('+82.5 kg'), { prefix: '+', value: 82.5, decimals: 1, grouped: false, magnitude: '', unit: ' kg' });
    assert.deepEqual(parseNumText('1,204'), { prefix: '', value: 1204, decimals: 0, grouped: true, magnitude: '', unit: '' });
    assert.equal(parseNumText('−2 kg')!.prefix, '−');
    assert.equal(parseNumText('12 wk')!.unit, ' wk');
    assert.deepEqual([parseNumText('1.8K AU')!.magnitude, parseNumText('1.8K AU')!.unit], ['K', ' AU']);
    assert.equal(parseNumText('80 Kg')!.magnitude, '');
  });

  it('leaves text that isn’t a single number alone', () => {
    for (const text of ['—', '1:05', '3 × 8', '', 'Hamstrings']) assert.equal(parseNumText(text), null, text);
  });

  it('formats mid-count values like the original', () => {
    assert.equal(formatNum(1203.6, { decimals: 0, grouped: true }), '1,204');
    assert.equal(formatNum(41.25, { decimals: 1, grouped: false }), '41.3');
  });
});
