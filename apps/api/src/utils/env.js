import dotenv from 'dotenv';
dotenv.config();

function required(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    // Don't crash startup for optional services; caller will check
    return null;
  }
  return v;
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  SESSION_COOKIE: 'oc_session',
  DB_PATH: process.env.OC_DB_PATH,
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),

  // Obsidian node RPC
  OBS_RPC_URL: process.env.OBS_RPC_URL || null,
  OBS_TREASURY_ADDRESS: process.env.OBS_TREASURY_ADDRESS || null,
  OBS_TREASURY_PRIVATE_KEY: process.env.OBS_TREASURY_PRIVATE_KEY || null,
  OBS_CHAIN_ID: parseInt(process.env.OBS_CHAIN_ID || '7777', 10),
  OBS_REQUIRED_CONFIRMATIONS: parseInt(process.env.OBS_REQUIRED_CONFIRMATIONS || '6', 10),

  // Media upload
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'data/uploads',
  MAX_UPLOAD_MB: parseInt(process.env.MAX_UPLOAD_MB || '100', 10),

  // Live streaming (LiveKit or fallback)
  LIVEKIT_URL: process.env.LIVEKIT_URL || null,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || null,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || null,

  // Rate limits
  RATE_LIMIT_WINDOW_MS: 60 * 1000,
  RATE_LIMIT_MAX: 120,
  AUTH_RATE_LIMIT_MAX: 10,
  GIFT_RATE_LIMIT_MAX: 30,
};
