import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnPath } from '../lib/auth/redirect';

test('return paths preserve local query and hash without permitting external origins', () => {
  assert.equal(safeReturnPath('/ai?q=test#answer'), '/ai?q=test#answer');
  for (const path of ['//attacker.example', '/\\attacker.example/x', 'https://attacker.example', '/\t/attacker.example', '/..//attacker.example', '/%2e%2e//attacker.example', 'javascript:alert(1)', '']) {
    assert.equal(safeReturnPath(path), '/');
  }
  const path = new URLSearchParams('returnUrl=%2F%5Cattacker.example').get('returnUrl');
  assert.equal(safeReturnPath(path), '/');
  assert.equal(new URL(safeReturnPath(path), 'https://site.example').origin, 'https://site.example');
});
