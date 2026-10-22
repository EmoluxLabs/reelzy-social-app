/**
 * Shared immutable constants for Obsidian Circle.
 * All monetary values use integer arithmetic in seals (OBS) and
 * the smallest OC Coin unit. 1 OBS = 10^18 seals; 1 OBS = 1_000_000 OC.
 */

// Brand
export const BRAND = {
  NAME: 'Obsidian Circle',
  SHORT: 'OC',
  SLOGAN: 'Connect. Create. Go Live.',
  TAGLINE: 'Your Circle. Your Creativity. Your Rewards.',
  PLATFORM_COIN: 'OC Coin',
  CHAIN_COIN: 'OBS Coin',
};

// Obsidian Network
export const OBS_NETWORK = {
  NAME: 'mainnet',
  CHAIN_ID: 7777,
  ADDRESS_PREFIX: 'obs',
  SEALS_PER_OBS: 10n ** 18n,
  DEFAULT_RPC_PORT: 8630,
  OBS_PER_OC: 1n,
};

// OC Coin economics
// 1 OBS = 1_000_000 OC Coin (OC is an integer unit). Internally we track
// thousandths of an OC ("motes") to avoid floating-point drift; callers
// never see motes — they are a safety net only.
export const OC_ECON = {
  OC_PER_OBS: 1_000_000n,
  MOTES_PER_OC: 1000n,
  CREATOR_SHARE_BPS: 7000n, // 70%
  PLATFORM_SHARE_BPS: 3000n, // 30%
  BPS_DENOMINATOR: 10_000n,
  MIN_GIFT_PRICE_OC: 1_000n,
  MAX_GIFT_PRICE_OC: 10_000_000n,
  INITIAL_RATE_VERSION: 1,
  INITIAL_REVSHARE_VERSION: 1,
};

// Gift catalog
export const GIFT_CATALOG_COUNTS = {
  Basic: 100,
  Premium: 100,
  Epic: 60,
  Legendary: 50,
  Limited: 10,
  TOTAL: 320,
};

// Limited gift rule: per-user per-gift 24h cooldown
export const LIMITED_GIFT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Ledger account types
export const ACCOUNT = {
  USER_OC: 'USER_OC',
  CREATOR_EARNINGS: 'CREATOR_EARNINGS',
  BONUS_LIABILITY: 'BONUS_LIABILITY',
  PLATFORM_GIFT_REVENUE: 'PLATFORM_GIFT_REVENUE',
  OBS_TREASURY: 'OBS_TREASURY',
  RESERVED_PAYOUT: 'RESERVED_PAYOUT',
  PENDING_DEPOSIT: 'PENDING_DEPOSIT',
  PENDING_PAYOUT: 'PENDING_PAYOUT',
  FEES: 'FEES',
};

// Operation types
export const OP = {
  DEPOSIT_INTENT: 'DEPOSIT_INTENT',
  DEPOSIT_CREDIT: 'DEPOSIT_CREDIT',
  GIFT_SEND: 'GIFT_SEND',
  GIFT_CREATOR_CREDIT: 'GIFT_CREATOR_CREDIT',
  GIFT_PLATFORM_CREDIT: 'GIFT_PLATFORM_CREDIT',
  BONUS_GRANT: 'BONUS_GRANT',
  WITHDRAWAL_RESERVE: 'WITHDRAWAL_RESERVE',
  WITHDRAWAL_RELEASE: 'WITHDRAWAL_RELEASE',
  WITHDRAWAL_BROADCAST: 'WITHDRAWAL_BROADCAST',
  ADJUSTMENT: 'ADJUSTMENT',
};

// Roles
export const ROLE = {
  USER: 'user',
  MODERATOR: 'moderator',
  SUPPORT: 'support',
  FINANCE: 'finance',
  SUPER: 'super',
};

// Deposit states
export const DEPOSIT_STATE = {
  AWAITING: 'AWAITING_DEPOSIT',
  DETECTED: 'DETECTED',
  CONFIRMING: 'CONFIRMING',
  CONFIRMED: 'CONFIRMED',
  CREDITED: 'CREDITED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  UNDER_REVIEW: 'UNDER_REVIEW',
};

// Withdrawal states
export const WITHDRAWAL_STATE = {
  REQUESTED: 'REQUESTED',
  RESERVED: 'RESERVED',
  APPROVED: 'APPROVED',
  BROADCAST: 'BROADCAST',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

// Required block confirmations before crediting a deposit
export const REQUIRED_DEPOSIT_CONFIRMATIONS = 6;

// Deposit intent expiry
export const DEPOSIT_INTENT_TTL_MS = 2 * 60 * 60 * 1000; // 2h
