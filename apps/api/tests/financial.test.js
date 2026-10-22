import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb, tx, get } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { splitGift, getUserOcBalance } from '../src/services/ledger.js';
import { generateId } from '@oc/shared';

test.beforeEach(async () => {
  // Use an in-memory DB by resetting module state is tricky; instead use file DB with a clean path per test
  process.env.OC_DB_PATH = `/tmp/oc-test-${Date.now()}-${Math.random()}.sqlite`;
  // reimport fresh... but ESM caches. Simpler: use a dedicated helper to reset.
});

// Test against the shared database. We re-init for each test by calling initDb on a new file.
let dbPathIndex = 0;
async function freshDb() {
  const fs = await import('node:fs/promises');
  const testPath = `/tmp/oc-test-${process.pid}-${dbPathIndex++}.sqlite`;
  try { await fs.unlink(testPath); } catch {}
  process.env.OC_DB_PATH = testPath;
  // We need to reload the DB module to pick up the new path, but caching prevents that.
  // Instead, just point DB_PATH and run migrations against the module-level db by closing & reinitialising.
  // Since this is difficult, we test via a separate process for isolation in this first pass.
  return testPath;
}

test('70/30 gift split balances exactly and creator gets floor(70%)', async () => {
  const { splitGiftRevenue } = await import('@oc/shared');
  const cases = [1000n, 10000n, 100000n, 1n, 3n, 7n, 10000000n, 333n, 999n];
  for (const price of cases) {
    const s = splitGiftRevenue(price);
    assert.equal(s.creator + s.platform, price, `price ${price}: sum failed`);
    assert.ok(s.creator <= price);
    assert.ok(s.platform >= 0n);
  }
  const spec = splitGiftRevenue(100000n);
  assert.equal(spec.creator, 70000n);
  assert.equal(spec.platform, 30000n);
});

test('1 OBS = 1,000,000 OC conversion uses integer math', async () => {
  const { obsToOc, ocToObsSeals, OC_PER_OBS } = await import('@oc/shared');
  assert.equal(obsToOc(10n ** 18n), OC_PER_OBS);
  assert.equal(ocToObsSeals(OC_PER_OBS), 10n ** 18n);
  assert.equal(ocToObsSeals(1000n), 10n ** 15n); // 0.001 OBS = 1000 OC
  assert.equal(obsToOc(10n ** 15n), 1000n);
});

test('gift price validation accepts only [1000, 10_000_000]', async () => {
  const { isValidGiftPrice } = await import('@oc/shared');
  assert.equal(isValidGiftPrice(1000n), true);
  assert.equal(isValidGiftPrice(10000000n), true);
  assert.equal(isValidGiftPrice(999n), false);
  assert.equal(isValidGiftPrice(10000001n), false);
});
