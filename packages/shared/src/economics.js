/**
 * Integer-only economics for OC Coin.
 * No floating point anywhere. All amounts pass through BigInt.
 *
 * Internal unit: "mote" = 1/1000 OC. We expose OC as bigint, so callers use
 * integer OC. Motes exist only to keep intermediate math lossless.
 */
import { OC_ECON } from './constants.js';

const { OC_PER_OBS, CREATOR_SHARE_BPS, PLATFORM_SHARE_BPS, BPS_DENOMINATOR, MIN_GIFT_PRICE_OC, MAX_GIFT_PRICE_OC } = OC_ECON;

export const MOTES_PER_OC = OC_ECON.MOTES_PER_OC;
export const MOTES_PER_OBS = OC_PER_OBS * MOTES_PER_OC;

export function ocToMotes(oc) { return BigInt(oc) * MOTES_PER_OC; }
export function motesToOc(motes) { return BigInt(motes) / MOTES_PER_OC; }

export function obsToOc(obsAmount /* in seals */) {
  // 1 OBS (1e18 seals) = 1_000_000 OC
  // OC = seals * 1_000_000 / 1e18 = seals / 1e12
  return BigInt(obsAmount) / (10n ** 12n);
}

export function ocToObsSeals(oc) {
  // seals = OC * 1e18 / 1_000_000 = OC * 1e12
  return BigInt(oc) * (10n ** 12n);
}

export function ocToObsString(oc) {
  const seals = ocToObsSeals(BigInt(oc));
  // Format OBS as a decimal string with 18 decimals, trimmed.
  const whole = seals / (10n ** 18n);
  const frac = seals % (10n ** 18n);
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

/**
 * Split a gift amount OC into creator (70%) and platform (30%) shares using
 * deterministic integer arithmetic. Creator is floor(70%); platform receives
 * the remainder so the sum is always exactly price.
 */
export function splitGiftRevenue(priceOc) {
  const price = BigInt(priceOc);
  const creator = (price * CREATOR_SHARE_BPS) / BPS_DENOMINATOR;
  const platform = price - creator;
  return { creator, platform, total: price };
}

export function isValidGiftPrice(priceOc) {
  try {
    const p = BigInt(priceOc);
    return p >= MIN_GIFT_PRICE_OC && p <= MAX_GIFT_PRICE_OC;
  } catch { return false; }
}

export function assertValidGiftPrice(priceOc) {
  if (!isValidGiftPrice(priceOc)) {
    throw new Error(`Gift price ${priceOc} is outside allowed range [${MIN_GIFT_PRICE_OC}, ${MAX_GIFT_PRICE_OC}] OC`);
  }
}

export { MIN_GIFT_PRICE_OC, MAX_GIFT_PRICE_OC, OC_PER_OBS };
