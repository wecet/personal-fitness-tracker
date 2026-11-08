import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Routine } from '../../shared/types.ts';
import { nextStep, refreshFromSession, routineSteps } from './routines.ts';

const sets = [{ reps: 8, weight: 50 }];
const routine: Routine = {
  id: 'r', name: 'Upper', createdAt: '2026-01-01T00:00:00Z',
  items: [
    { exerciseId: 1, sets },
    { exerciseId: 2, sets, supersetNext: true },
    { exerciseId: 3, sets },
    { exerciseId: 4, sets },
  ],
};

describe('supersets in routines', () => {
  it('groups paired exercises into one step', () => {
    assert.deepEqual(routineSteps(routine), [[1], [2, 3], [4]]);
  });

  it('points at what is left of the first unfinished step', () => {
    assert.deepEqual(nextStep(routine, new Set()), [1]);
    assert.deepEqual(nextStep(routine, new Set([1])), [2, 3]);
    assert.deepEqual(nextStep(routine, new Set([1, 3])), [2]);
    assert.deepEqual(nextStep(routine, new Set([1, 2, 3])), [4]);
    assert.equal(nextStep(routine, new Set([1, 2, 3, 4])), null);
  });

  it('keeps pairs when planned sets refresh after a workout', () => {
    const next = refreshFromSession(routine, []);
    assert.equal(next.items[1].supersetNext, true);
  });
});
