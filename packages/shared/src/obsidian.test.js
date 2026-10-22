import test from 'node:test';
import assert from 'node:assert/strict';
import { validateObsidianAddress } from './obsidian.js';

test('valid dev treasury address validates', () => {
  const r = validateObsidianAddress('obs1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq0q0dy3');
  assert.equal(r.ok, true);
});

test('rejects bad checksums', () => {
  assert.equal(validateObsidianAddress('obs1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq0q0dy4').ok, false);
});

test('rejects wrong prefix', () => {
  assert.equal(validateObsidianAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4').ok, false);
});
