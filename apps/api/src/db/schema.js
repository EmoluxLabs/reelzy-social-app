/**
 * SQL schema for Obsidian Circle.
 * All monetary OC amounts are stored as INTEGER OC (no decimal).
 * Seals (OBS native) are stored as TEXT because they can exceed JS number precision
 * but sqlite's INTEGER can hold up to 64-bit signed — seals at 1e18*10^9 = 1e27 exceed 2^63 (~9e18),
 * so we store them as TEXT strings.
 */
export const SCHEMA = `
-- Migrations table --------------------------------------------------------
CREATE TABLE IF NOT EXISTS migrations (
  name TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- Users -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- usr_xxx
  username TEXT NOT NULL UNIQUE,
  username_lower TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  email_lower TEXT UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  bio TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  profile_pic TEXT NOT NULL DEFAULT '',
  cover_pic TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  is_verified INTEGER NOT NULL DEFAULT 0,
  is_private INTEGER NOT NULL DEFAULT 0,
  is_suspended INTEGER NOT NULL DEFAULT 0,
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS users_lower_idx ON users(username_lower);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email_lower);

-- Sessions ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT,
  ip TEXT,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Follows -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS follows_followee ON follows(followee_id);

-- Blocks and mutes --------------------------------------------------------
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS mutes (
  muter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (muter_id, muted_id)
);

-- Password resets / verification codes ------------------------------------
CREATE TABLE IF NOT EXISTS auth_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'verify_email' | 'reset_password' | 'mfa_challenge' | 'wallet_link'
  code_hash TEXT NOT NULL,
  extra TEXT,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_codes_user_idx ON auth_codes(user_id, type);

-- OBS wallet links --------------------------------------------------------
CREATE TABLE IF NOT EXISTS obs_wallet_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  public_key TEXT NOT NULL,
  linked_at INTEGER NOT NULL,
  last_used_at INTEGER,
  UNIQUE(user_id, address)
);
CREATE INDEX IF NOT EXISTS wallet_addr_idx ON obs_wallet_links(address);

-- Posts / reels -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'post', -- 'post' | 'reel' | 'image'
  text TEXT NOT NULL DEFAULT '',
  media_json TEXT NOT NULL DEFAULT '[]', -- JSON array of { type, url, thumb, meta }
  visibility TEXT NOT NULL DEFAULT 'public', -- 'public' | 'followers' | 'private'
  is_pinned INTEGER NOT NULL DEFAULT 0,
  allow_comments INTEGER NOT NULL DEFAULT 1,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  shares_count INTEGER NOT NULL DEFAULT 0,
  saves_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_created_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_kind_idx ON posts(kind);

-- Likes -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS likes_post_idx ON likes(post_id);

-- Saves / bookmarks -------------------------------------------------------
CREATE TABLE IF NOT EXISTS saves (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

-- Comments ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS comment_likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, comment_id)
);

-- Hashtags ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hashtags (
  tag TEXT PRIMARY KEY,
  uses_count INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL REFERENCES hashtags(tag) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX IF NOT EXISTS post_hashtags_tag ON post_hashtags(tag);

-- Conversations / messages ------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'dm', -- 'dm' | 'group'
  name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  last_read_at INTEGER NOT NULL DEFAULT 0,
  muted_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS conv_part_user ON conversation_participants(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'text', -- 'text' | 'image' | 'video' | 'voice'
  body TEXT NOT NULL DEFAULT '',
  attachments_json TEXT NOT NULL DEFAULT '[]',
  duration_ms INTEGER,
  waveform_json TEXT,
  reply_to TEXT REFERENCES messages(id) ON DELETE SET NULL,
  edited_at INTEGER,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Calls -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL, -- 'voice' | 'video'
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  host_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'ringing', -- 'ringing' | 'ongoing' | 'ended' | 'missed' | 'declined'
  started_at INTEGER,
  ended_at INTEGER,
  end_reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS calls_host_idx ON calls(host_id, created_at DESC);

CREATE TABLE IF NOT EXISTS call_participants (
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER,
  left_at INTEGER,
  accepted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (call_id, user_id)
);

-- Live sessions -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'video', -- 'video' | 'audio'
  title TEXT NOT NULL,
  cover_url TEXT,
  category TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  room_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'live' | 'ended'
  viewer_count INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER,
  ended_at INTEGER,
  total_gifts_oc INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS live_status_idx ON live_sessions(status, started_at DESC);

CREATE TABLE IF NOT EXISTS live_participants (
  live_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer', -- 'host' | 'guest' | 'viewer'
  muted INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  PRIMARY KEY (live_id, user_id)
);

CREATE TABLE IF NOT EXISTS live_guest_requests (
  id TEXT PRIMARY KEY,
  live_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'cancelled'
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);

-- Notifications -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'follow' | 'like' | 'comment' | 'mention' | 'message' | 'call' | 'live_start' | 'gift' | 'deposit' | 'withdrawal' | 'security'
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications(user_id, created_at DESC);

-- Exchange rates and policies (versioned) ---------------------------------
CREATE TABLE IF NOT EXISTS rate_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oc_per_obs INTEGER NOT NULL,
  creator_share_bps INTEGER NOT NULL,
  platform_share_bps INTEGER NOT NULL,
  effective_at INTEGER NOT NULL,
  created_by TEXT,
  reason TEXT
);

-- OC Coin double-entry ledger ---------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL, -- 'USER_OC' | 'CREATOR_EARNINGS' | 'PLATFORM_GIFT_REVENUE' | 'OBS_TREASURY' | ...
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0, -- OC balance
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_user_idx ON ledger_accounts(user_id, kind);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  tx_id TEXT NOT NULL, -- groups all entries for one atomic operation
  op_type TEXT NOT NULL, -- 'GIFT_SEND' | 'GIFT_CREATOR_CREDIT' | 'DEPOSIT_CREDIT' | ...
  account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
  counterparty_account_id TEXT REFERENCES ledger_accounts(id),
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL,
  rate_version INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  idempotency_key TEXT
);
CREATE INDEX IF NOT EXISTS ledger_tx_idx ON ledger_entries(tx_id);
CREATE INDEX IF NOT EXISTS ledger_account_time ON ledger_accounts(id);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_idem_idx ON ledger_entries(idempotency_key);

-- Idempotency records (defence-in-depth) ----------------------------------
CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Gift catalog (320 entries) ----------------------------------------------
CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY,
  catalog_id TEXT NOT NULL UNIQUE, -- e.g. 'basic_001'
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Basic' | 'Premium' | 'Epic' | 'Legendary' | 'Limited'
  price_oc INTEGER NOT NULL,
  rarity_tier INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  animation_json TEXT NOT NULL DEFAULT '{}',
  preview_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  daily_limit_per_user INTEGER NOT NULL DEFAULT 0, -- 0 means no limit; for Limited = 1
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gifts_category_idx ON gifts(category);

-- Gift send transactions --------------------------------------------------
CREATE TABLE IF NOT EXISTS gift_transactions (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  recipient_id TEXT NOT NULL REFERENCES users(id),
  gift_id TEXT NOT NULL REFERENCES gifts(id),
  context_type TEXT NOT NULL, -- 'post' | 'live' | 'profile' | 'comment'
  context_id TEXT,
  price_oc INTEGER NOT NULL,
  creator_share_oc INTEGER NOT NULL,
  platform_share_oc INTEGER NOT NULL,
  ledger_tx_id TEXT NOT NULL,
  rate_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gift_tx_recipient ON gift_transactions(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gift_tx_context ON gift_transactions(context_type, context_id);

-- Limited-gift cooldowns --------------------------------------------------
CREATE TABLE IF NOT EXISTS gift_limited_cooldowns (
  user_id TEXT NOT NULL,
  gift_id TEXT NOT NULL REFERENCES gifts(id),
  last_purchase_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, gift_id)
) WITHOUT ROWID;

-- OBS deposit intents -----------------------------------------------------
CREATE TABLE IF NOT EXISTS obs_deposits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  wallet_address TEXT NOT NULL,
  treasury_address TEXT NOT NULL,
  expected_seals TEXT NOT NULL, -- string (BigInt-safe)
  expected_oc INTEGER NOT NULL,
  rate_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'AWAITING_DEPOSIT',
  chain_tx_id TEXT,
  detected_seals TEXT,
  confirmations INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  detected_at INTEGER,
  confirmed_at INTEGER,
  credited_at INTEGER,
  ledger_tx_id TEXT,
  error TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS deposit_user ON obs_deposits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deposit_chain_tx ON obs_deposits(chain_tx_id);
CREATE INDEX IF NOT EXISTS deposit_status ON obs_deposits(status);

-- OBS withdrawals ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS obs_withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  destination_address TEXT NOT NULL,
  amount_oc INTEGER NOT NULL,
  obs_seals TEXT NOT NULL,
  fee_oc INTEGER NOT NULL DEFAULT 0,
  payout_obs_seals TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  rate_version INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  reserved_ledger_tx_id TEXT,
  broadcast_tx_id TEXT,
  chain_tx_id TEXT,
  confirmed_at INTEGER,
  reviewer_id TEXT REFERENCES users(id),
  rejection_reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wd_user ON obs_withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wd_status ON obs_withdrawals(status);

-- Bonus campaigns and grants ----------------------------------------------
CREATE TABLE IF NOT EXISTS bonus_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  reason TEXT NOT NULL,
  per_user_oc INTEGER,
  starts_at INTEGER,
  ends_at INTEGER,
  total_budget_oc INTEGER NOT NULL,
  issued_oc INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bonus_grants (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES bonus_campaigns(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_oc INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ledger_tx_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(campaign_id, user_id)
);

-- Treasury snapshots (reserve monitoring) ---------------------------------
CREATE TABLE IF NOT EXISTS treasury_snapshots (
  id TEXT PRIMARY KEY,
  obs_balance_seals TEXT NOT NULL,
  oc_liability_total INTEGER NOT NULL DEFAULT 0,
  oc_creator_liability INTEGER NOT NULL DEFAULT 0,
  oc_bonus_liability INTEGER NOT NULL DEFAULT 0,
  pending_withdrawals_obs_seals TEXT NOT NULL DEFAULT '0',
  reserve_ratio_bps INTEGER,
  alerts_json TEXT NOT NULL DEFAULT '[]',
  taken_at INTEGER NOT NULL
);

-- Reports / moderation ----------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL, -- 'user' | 'post' | 'comment' | 'live' | 'message'
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'reviewed' | 'actioned' | 'dismissed'
  moderator_id TEXT REFERENCES users(id),
  action TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS reports_status ON reports(status, created_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_actor ON audit_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_action ON audit_events(action, created_at DESC);

-- Feature flags -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL DEFAULT 'true',
  updated_at INTEGER NOT NULL
);

-- Outbox for reliable event delivery (websocket notifications, etc.) ------
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  event TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS outbox_undelivered ON outbox(delivered_at) WHERE delivered_at IS NULL;
`;
