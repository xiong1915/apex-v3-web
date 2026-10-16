import test from 'node:test';
import assert from 'node:assert/strict';
import { entranceMode, standingRatio } from '../lib/ui/motion-policy';

test('entrance stays nonblocking, respects reduced motion and uses a light repeat visit', () => {
  assert.equal(entranceMode(false, false), 'full');
  assert.equal(entranceMode(true, false), 'light');
  assert.equal(entranceMode(false, true), 'none');
  assert.equal(entranceMode(true, true), 'none');
});

test('championship bars never invent a score or overflow their track', () => {
  assert.equal(standingRatio(50, 100), 0.5);
  assert.equal(standingRatio(0, 0), 0);
  assert.equal(standingRatio(150, 100), 1);
  assert.equal(standingRatio(-1, 100), 0);
  assert.equal(standingRatio(Number.NaN, 100), 0);
});
