import test from 'node:test';
import assert from 'node:assert/strict';
import { showSeasonReview } from '../lib/ui/race-presentation';

test('an ended weekend with later rounds never gets a season-finished label', () => {
  assert.equal(showSeasonReview(18, [18, 19, 20], true), false);
  assert.equal(showSeasonReview(20, [18, 19, 20], true), true);
  assert.equal(showSeasonReview(20, [18, 19, 20], false), false);
  assert.equal(showSeasonReview(0, [], true), false);
});
