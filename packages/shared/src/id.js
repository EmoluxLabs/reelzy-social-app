import { randomBytes } from 'node:crypto';

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateId(prefix, bytes = 16) {
  const buf = randomBytes(bytes);
  let out = '';
  for (let i = 0; i < buf.length; i++) out += ID_ALPHABET[buf[i] % ID_ALPHABET.length];
  return `${prefix}_${out}`;
}

export const idempotencyKey = () => generateId('idem', 18);
export const txId = () => generateId('ltx', 20);
export const uuid = () => generateId('id', 16);
