import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Soreness } from '../../shared/types.ts';
import { readiness } from './readiness.ts';

const checkIn = (sleep: 1 | 2 | 3, energy: 1 | 2 | 3, muscles: Soreness['muscles'] = {}): Soreness => ({
  id: 'sore-2026-01-01', recordedAt: '2026-01-01T07:00:00Z', muscles, sleep, energy,
});

describe('readiness', () => {
  it('waits for both answers', () => {
    assert.equal(readiness({ checkIn: undefined }), null);
    assert.equal(readiness({ checkIn: { ...checkIn(2, 2), energy: undefined } }), null);
  });

  it('pushes on an ordinary or good day', () => {
    assert.equal(readiness({ checkIn: checkIn(2, 2) }), 'push');
    assert.equal(readiness({ checkIn: checkIn(3, 1) }), 'push');
  });

  it('holds after a poor night, eases off when several things stack up', () => {
    assert.equal(readiness({ checkIn: checkIn(1, 2) }), 'hold');
    assert.equal(readiness({ checkIn: checkIn(1, 1) }), 'ease');
    assert.equal(readiness({ checkIn: checkIn(2, 2, { quads: 2 }), matchYesterday: true }), 'ease');
    assert.equal(readiness({ checkIn: checkIn(2, 2), loadZone: 'spike' }), 'hold');
  });
});
