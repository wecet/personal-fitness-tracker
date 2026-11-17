import assert from 'node:assert/strict';
import { it } from 'node:test';
import { onGrid } from './beat.ts';

it('moves a start time forward to the next beat', () => {
  assert.equal(onGrid(0, 900), 0);
  assert.equal(onGrid(1, 900), 900);
  assert.equal(onGrid(900, 900), 900);
  assert.equal(onGrid(2050, 900), 2700);
});
