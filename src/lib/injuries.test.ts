import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { entry, exById, injury } from '../test/fixtures.ts';
import {
  daysOut, injuredSides, injuryLabel, preventionDue, preventionStatus, rehabInjury, returnStages, severity, stagesCleared, timeline,
} from './injuries.ts';

describe('labels and time lost', () => {
  it('names the side and area', () => {
    assert.equal(injuryLabel({ area: 'hamstrings', side: 'left' }), 'Left hamstrings');
    assert.equal(injuryLabel({ area: 'hips', side: 'both' }), 'Hips / groin');
    assert.equal(injuryLabel({ area: 'knee', side: null }), 'Knee');
  });

  it('counts days out to return, or to today while ongoing', () => {
    assert.equal(daysOut(injury({ area: 'calves', startedAt: '2026-10-01', resolvedAt: '2026-10-15' })), 14);
    assert.equal(daysOut(injury({ area: 'calves', startedAt: '2026-10-20' }), '2026-11-01'), 12);
  });

  it('grades severity on the football consensus scale', () => {
    assert.deepEqual([0, 2, 7, 28, 29].map(severity), ['Slight', 'Minimal', 'Mild', 'Moderate', 'Severe']);
  });

  it('marks both sides of every muscle a joint injury affects', () => {
    const sides = injuredSides([injury({ area: 'knee', side: 'right' }), injury({ area: 'chest', side: null })]);
    assert.deepEqual([...sides.get('quads')!], ['right']);
    assert.deepEqual([...sides.get('chest')!].sort(), ['left', 'right']);
  });
});

describe('return to play', () => {
  it('gives leg injuries running stages and upper-body ones lifting stages', () => {
    assert.equal(returnStages({ area: 'hamstrings' }).length, 6);
    assert.ok(returnStages({ area: 'ankle' }).some((s) => s.name === 'Running'));
    assert.equal(returnStages({ area: 'chest' }).length, 5);
    assert.equal(returnStages({ area: 'wrist' }).length, 5);
  });

  it('treats records from before the checklist as no stages cleared, and caps at the list length', () => {
    assert.equal(stagesCleared(injury({ area: 'chest' })), 0);
    assert.equal(stagesCleared(injury({ area: 'chest', stage: 9 })), 5);
  });

  it('pauses progression on the muscle until loaded strength is cleared', () => {
    const hurt = injury({ area: 'chest', stage: 2 });
    assert.equal(rehabInjury([hurt], 'chest'), hurt);
    assert.equal(rehabInjury([{ ...hurt, stage: 3 }], 'chest'), undefined);
    assert.equal(rehabInjury([{ ...hurt, resolvedAt: '2026-10-30' }], 'chest'), undefined);
    assert.equal(rehabInjury([hurt], 'quads'), undefined);
    // A knee injury pauses the quads.
    assert.ok(rehabInjury([injury({ area: 'knee' })], 'quads'));
  });
});

describe('timeline', () => {
  it('packs overlapping injuries into separate lanes and drops ones older than the window', () => {
    const bars = timeline(
      [
        injury({ area: 'calves', startedAt: '2025-06-01', resolvedAt: '2025-06-10' }),
        injury({ area: 'hamstrings', startedAt: '2026-03-01', resolvedAt: '2026-04-01' }),
        injury({ area: 'knee', startedAt: '2026-03-15', resolvedAt: '2026-03-20' }),
        injury({ area: 'chest', startedAt: '2026-05-01', resolvedAt: '2026-05-05' }),
      ],
      '2026-11-01',
    );
    assert.deepEqual(bars.map((b) => [b.injury.area, b.lane]), [['hamstrings', 0], ['knee', 1], ['chest', 0]]);
    assert.ok(bars.every((b) => b.from >= 0 && b.to <= 1 && b.from < b.to));
  });
});

describe('prevention', () => {
  const now = new Date(2026, 10, 1, 12);

  it('counts distinct days this week and flags regions hurt in the last year', () => {
    const status = preventionStatus(
      [entry('Nordic Curl', 0, [[5, 0]]), entry('Nordic Curl', 0, [[5, 0]]), entry('Nordic Curl', 10, [[5, 0]])],
      exById,
      [injury({ area: 'hamstrings', startedAt: '2026-03-01', resolvedAt: '2026-03-20' })],
      now,
    );
    const hamstring = status.find((s) => s.protocol.id === 'hamstring')!;
    assert.equal(hamstring.done, 1);
    assert.equal(hamstring.doneToday, true);
    assert.equal(hamstring.priority, true);
  });

  it('keeps eccentric work away from match days and puts priorities first', () => {
    const status = preventionStatus([], exById, [injury({ area: 'hips', startedAt: '2026-06-01', resolvedAt: '2026-06-10' })], now);
    const nearMatch = preventionDue(status, { avoidLegs: true, daysToMatch: 1, label: 'MD-1' }).map((s) => s.protocol.id);
    assert.deepEqual(nearMatch, ['ankle']);
    const free = preventionDue(status, { avoidLegs: false, daysToMatch: 4, label: 'MD-4' }).map((s) => s.protocol.id);
    assert.equal(free[0], 'groin');
  });
});
