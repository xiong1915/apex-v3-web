import test from 'node:test';
import assert from 'node:assert/strict';
import { standingRatio } from '../lib/ui/motion-policy';

test('championship bars never invent a score or overflow their track', () => {
  assert.equal(standingRatio(50, 100), 0.5);
  assert.equal(standingRatio(0, 0), 0);
  assert.equal(standingRatio(150, 100), 1);
  assert.equal(standingRatio(-1, 100), 0);
  assert.equal(standingRatio(Number.NaN, 100), 0);
});
