import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitGiftRevenue, obsToOc, ocToObsSeals, ocToObsString, isValidGiftPrice, OC_PER_OBS, MIN_GIFT_PRICE_OC, MAX_GIFT_PRICE_OC } from './economics.js';

test('1 OBS === 1_000_000 OC', () => {
  assert.equal(obsToOc(10n ** 18n), OC_PER_OBS);
});

test('OC to seals conversion', () => {
  assert.equal(ocToObsSeals(1_000_000n), 10n ** 18n);
  assert.equal(ocToObsSeals(10_000_000n), 10n * 10n ** 18n);
  assert.equal(ocToObsSeals(1n), 10n ** 12n);
});

test('ocToObsString formatting', () => {
  assert.equal(ocToObsString(1_000_000n), '1');
  assert.equal(ocToObsString(10_000_000n), '10');
  assert.equal(ocToObsString(1_000n), '0.001');
});

test('70/30 split sums exactly and is deterministic', () => {
  for (const price of [1_000n, 10_000n, 100_000n, 3n, 7n, 1n, 10_000_000n]) {
    const { creator, platform, total } = splitGiftRevenue(price);
    assert.equal(creator + platform, price, `price ${price}: shares do not sum`);
    assert.equal(total, price);
    // Creator gets floor(0.7*price)
    assert.ok(creator <= (price * 7n) / 10n + 1n);
    assert.ok(platform >= (price * 3n) / 10n - 1n);
  }
  // Example from the spec
  const s = splitGiftRevenue(100_000n);
  assert.equal(s.creator, 70_000n);
  assert.equal(s.platform, 30_000n);
});

test('gift price range validation', () => {
  assert.equal(isValidGiftPrice(1_000n), true);
  assert.equal(isValidGiftPrice(10_000_000n), true);
  assert.equal(isValidGiftPrice(999n), false);
  assert.equal(isValidGiftPrice(10_000_001n), false);
});
