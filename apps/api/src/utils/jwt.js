import jwt from 'jsonwebtoken';
import { ENV } from './env.js';

export function signToken(payload, opts = {}) {
  return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: opts.expiresIn || ENV.JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, ENV.JWT_SECRET);
  } catch {
    return null;
  }
}
