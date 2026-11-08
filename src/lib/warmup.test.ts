import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exercise } from '../test/fixtures.ts';
import { warmupSets } from './warmup.ts';

const squat = exercise('Back Squat');
const pairs = (sets: { reps: number; weight: number }[]) => sets.map((s) => [s.weight, s.reps]);

describe('warmupSets', () => {
  it('ramps to the first working weight', () => {
    assert.deepEqual(pairs(warmupSets(squat, [{ reps: 5, weight: 100 }])), [[50, 8], [70, 5], [85, 2]]);
  });

  it('skips the top step for moderate weights', () => {
    assert.deepEqual(pairs(warmupSets(squat, [{ reps: 8, weight: 50 }])), [[25, 8], [35, 5]]);
  });

  it('has nothing for light work, bodyweight or timed exercises', () => {
    assert.deepEqual(warmupSets(squat, [{ reps: 10, weight: 30 }]), []);
    assert.deepEqual(warmupSets(exercise('Pull-Up'), [{ reps: 8, weight: 60 }]), []);
  });
});
