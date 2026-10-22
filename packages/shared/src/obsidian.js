/**
 * Obsidian Network address validation and basic primitives.
 * Addresses use bech32 with the "obs" HRP (prefix "obs1").
 * We use a lightweight bech32 decoder adapted from the reference spec
 * (public domain, BIP-173) to avoid a heavy dep in the shared package.
 */
import { OBS_NETWORK } from './constants.js';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let chk = 1n;
  for (const v of values) {
    const top = chk >> 25n;
    chk = ((chk & 0x1ffffffn) << 5n) ^ BigInt(v);
    for (let i = 0; i < 5; i++) {
      if ((top >> BigInt(i)) & 1n) chk ^= BigInt(GEN[i]);
    }
  }
  return Number(chk);
}

function hrpExpand(hrp) {
  const ret = [];
  for (const c of hrp) ret.push(c.charCodeAt(0) >> 5);
  ret.push(0);
  for (const c of hrp) ret.push(c.charCodeAt(0) & 31);
  return ret;
}

// Obsidian addresses use bech32m (BIP-350), so a valid checksum polymods to
// 0x2bc830a3 rather than 1.
const BECH32M_CONSTANT = 0x2bc830a3;
function verifyChecksum(hrp, data) {
  return polymod([...hrpExpand(hrp), ...data]) === BECH32M_CONSTANT;
}

/**
 * Validate an Obsidian address. Returns { ok, hrp } on success, { ok:false } on failure.
 * Accepts only the configured HRP ("obs").
 */
export function validateObsidianAddress(address, expectedHrp = OBS_NETWORK.ADDRESS_PREFIX) {
  if (typeof address !== 'string') return { ok: false, reason: 'not-a-string' };
  const a = address.trim().toLowerCase();
  if (!a.startsWith(`${expectedHrp}1`)) return { ok: false, reason: 'bad-prefix' };
  if (a.length < 14 || a.length > 90) return { ok: false, reason: 'bad-length' };
  if (!/^[0-9a-z]+$/.test(a)) return { ok: false, reason: 'bad-characters' };
  const pos = a.lastIndexOf('1');
  const hrp = a.slice(0, pos);
  const dataPart = a.slice(pos + 1);
  if (hrp !== expectedHrp) return { ok: false, reason: 'bad-hrp' };
  const data = [];
  for (const ch of dataPart) {
    const idx = CHARSET.indexOf(ch);
    if (idx < 0) return { ok: false, reason: 'bad-char' };
    data.push(idx);
  }
  if (!verifyChecksum(hrp, data)) return { ok: false, reason: 'bad-checksum' };
  return { ok: true, hrp };
}

export function isValidObsidianAddress(address) {
  return validateObsidianAddress(address).ok;
}

/**
 * Parse a user-supplied OBS amount string (e.g. "1.5", "100", "0.001") into seals (bigint).
 * Throws on invalid input.
 */
export function parseObsAmount(str) {
  if (typeof str !== 'string') throw new Error('amount must be a string');
  const s = str.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('invalid OBS amount');
  const [whole, fracRaw = ''] = s.split('.');
  const frac = (fracRaw + '0'.repeat(18)).slice(0, 18);
  if (fracRaw.length > 18) throw new Error('OBS amount cannot exceed 18 decimal places');
  const combined = BigInt(whole) * (10n ** 18n) + BigInt(frac.padEnd(18, '0'));
  return combined;
}

export function formatSeals(seals) {
  const s = BigInt(seals);
  const whole = s / (10n ** 18n);
  const frac = s % (10n ** 18n);
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(18, '0').replace(/0+$/, '')}`;
}
