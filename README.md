# Obsidian Circle (OC)

> The social layer for the Obsidian Network — posts, reels, live rooms, 1:1 calls,
> DMs, and a native double-entry OC wallet with 320 built-in virtual gifts.

Obsidian Circle is a production-ready web app backed by a single-process Node.js
API (Express + sql.js SQLite-on-disk) and a Next.js 14 frontend (App Router).
Monetization is native to the protocol layer: every gift settles as a 70/30
split between creator and platform, instantly, with no third-party processor.

---

## Stack

| Layer     | Tech                                                                        |
|-----------|-----------------------------------------------------------------------------|
| Frontend  | Next.js 14 (App Router), Tailwind, lucide-react, Zustand, socket.io-client  |
| Backend   | Express 4, socket.io, zod, bcrypt, jsonwebtoken, better-sqlite3-style sql.js|
| Ledger    | Double-entry integer math (O(1) per transfer, ACID inside a single tx())    |
| Storage   | SQLite (`data/oc.sqlite`), uploaded media in `data/uploads/`                |
| Chain     | Obsidian Network L1 (bech32m `obs1…` addresses; native RPC on :8630)        |
| Streaming | Built-in WebRTC mesh for calls; optional LiveKit adapter for live rooms     |

## Features

- **Auth**: JWT (httpOnly cookie + bearer), bcrypt hashing, registration/login/logout,
  cookie-based Socket.IO authentication, wallet signature challenge for on-chain
  account linking.
- **Social feed**: posts, reels (vertical video), hashtags, likes, comments,
  saves, follows, follower/following tabs, public profiles, search.
- **Real-time**: DMs over Socket.IO with conversation membership checks; typing
  indicators; presence; live-room chat, viewer tracking, WebRTC signaling, and
  gift fan-out; live notifications for follow/like/comment/gift/deposit.
- **Wallet**: double-entry OC ledger with explicit accounts (`USER_OC`,
  `CREATOR_EARNINGS`, `PLATFORM_GIFT_REVENUE`, `RESERVED_PAYOUT`,
  `ESCROW_DEPOSIT`, `BONUS_LIABILITY`); deposit intents and withdrawals with
  idempotency keys; 60-second expiry sweeper; admin reconciliation endpoint.
- **Gifts**: 320 virtual gifts (1 OC – 10,000 OC), client-side animation,
  70/30 creator/platform split with on-platform notification and outbox event.
  Gift OC lands in `CREATOR_EARNINGS` and converts 1:1 to spendable `USER_OC`.
- **Admin**: reconciliation, user search, withdrawal approval, credit (airdrop).
- **Responsive** mobile-first UI with dark/light theme toggle and persisted
  preference.

## Quick start

```bash
npm install
cp .env.example .env
# edit .env — set JWT_SECRET (production); OBS_RPC_URL/TREASURY for chain hooks

npm run db:migrate   # creates apps/api/data/oc.sqlite and applies migrations
npm run db:seed      # seeds demo admin, 320 gifts, and a few sample posts/users
npm run dev          # starts api :4000 and web :3000 (concurrently)
```

Open <http://localhost:3000>.

### Demo account (after seed)

- Username: `obsidian`
- Password: `Admin2026!`
- Role: `super` (admin console at `/admin`)

Seed starts the admin wallet at 0 OC — credit yourself via the admin console
or `POST /api/admin/credit` (dev only). In production, replace with a real
deposit flow or OBS airdrop.

### Production build

```bash
npm run build   # builds web (Next.js production bundle)
npm start       # runs node src/index.js (API) + next start -p 3000
```

Put the web server behind a reverse proxy (nginx/Caddy/Cloudflare) terminating
TLS; set `CORS_ORIGIN=https://yourdomain`; set a strong `JWT_SECRET`.

## Environment variables

See `.env.example`. The critical ones:

| Variable                  | Purpose                                                  |
|---------------------------|----------------------------------------------------------|
| `PORT`                    | API port (default `4000`)                                |
| `CORS_ORIGIN`             | Allowed frontend origin (e.g. `https://oc.example`)      |
| `JWT_SECRET`              | HMAC secret for tokens — **rotate per environment**      |
| `JWT_EXPIRES_IN`          | Token lifetime (default `7d`)                            |
| `BCRYPT_ROUNDS`           | bcrypt cost (default `12`)                               |
| `OBS_RPC_URL`             | Obsidian L1 RPC endpoint for deposit confirmations       |
| `OBS_TREASURY_ADDRESS`    | Destination address for user deposits (qr code)          |
| `OBS_TREASURY_PRIVATE_KEY`| Treasury key used to sign approved withdrawals           |
| `OBS_CHAIN_ID`            | Obsidian chain-id: 7777 mainnet / 7778 devnet            |
| `OBS_REQUIRED_CONFIRMATIONS` | Blocks before a deposit is credited (default 6)       |
| `LIVEKIT_*`               | Optional SFU for large live rooms (mesh works for <6)    |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | Media upload location / cap                         |
| `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` / `GIFT_RATE_LIMIT_MAX` | Global/auth/gift per-minute caps |

If `OBS_RPC_URL` is unset the API logs a notice and runs in dev mode: deposit
confirmation is stubbed (intents expire after 60 seconds) so flows still work
end-to-end against a mock flow.

## Ledger invariants

Every ledger movement uses integer `BIGINT` math on OC subunits.

- 1 OBS = 1,000,000 OC (fixed).
- 70% of every gift → creator `CREATOR_EARNINGS`; 30% → platform
  `PLATFORM_GIFT_REVENUE`.
- Withdrawals move `USER_OC` → `RESERVED_PAYOUT` at request time and release to
  the chain on admin approval; an approval failure rolls `RESERVED_PAYOUT` back.
- Earnings convert 1:1 into `USER_OC` (no fee).
- `POST /api/admin/reconciliation` returns per-account totals plus any
  unresolved deposits/withdrawals. The sum of all account balances should equal
  `0` for a healthy ledger (liabilities are stored as negative balances).

## HTTP API overview

All authenticated endpoints accept the session cookie set on
`/api/auth/login`, or a bearer `Authorization: Bearer <token>` header.

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/users/me
GET    /api/users/:username
POST   /api/users/:username/follow
POST   /api/users/:username/unfollow
GET    /api/users/search/:query
GET    /api/users/:username/followers
GET    /api/users/:username/following

GET    /api/posts/feed
GET    /api/posts/discover
GET    /api/posts/reels
GET    /api/posts/search?query=
POST   /api/posts
GET    /api/posts/:id
DELETE /api/posts/:id
POST   /api/posts/:id/like
POST   /api/posts/:id/unlike
POST   /api/posts/:id/comments
POST   /api/posts/:id/save

GET    /api/gifts/catalog
POST   /api/gifts/send

GET    /api/users/me/wallet
POST   /api/wallet/deposits/intent
POST   /api/wallet/link/challenge
POST   /api/wallet/link/confirm
POST   /api/wallet/withdrawals
GET    /api/wallet/withdrawals
POST   /api/wallet/earnings/convert
GET    /api/wallet/deposit-address

GET    /api/notifications
POST   /api/notifications/read-all
POST   /api/notifications/:id/read

POST   /api/chat/conversations
GET    /api/chat/conversations
GET    /api/chat/conversations/:id/messages
POST   /api/chat/conversations/:id/messages

POST   /api/live/rooms
GET    /api/live/rooms
POST   /api/live/rooms/:id/join
POST   /api/live/rooms/:id/leave
POST   /api/calls/offer
POST   /api/calls/answer

GET    /api/admin/reconciliation
GET    /api/admin/users
GET    /api/admin/withdrawals
POST   /api/admin/withdrawals/:id/approve
POST   /api/admin/credit            # super / finance only
```

## Socket.IO events

Authenticated via the session cookie on handshake (re-validated server-side;
suspended users are rejected).

| Event                 | Direction | Payload                                                |
|-----------------------|-----------|--------------------------------------------------------|
| `join_conversation`   | c→s       | `{ conversationId }` (must be a member)                |
| `leave_conversation`  | c→s       | `{ conversationId }`                                   |
| `chat_message`        | c→s→room  | `{ conversationId, text }`                             |
| `typing`              | c→s→room  | `{ conversationId }`                                   |
| `join_live`           | c→s       | `{ roomId }`                                           |
| `leave_live`          | c→s       | `{ roomId }`                                           |
| `live_chat`           | c→s→room  | `{ roomId, text }`                                     |
| `signal`              | c→s→peer  | `{ roomId, to, payload }`                              |
| `notification`        | s→c       | real-time inbox push (follow/like/comment/gift/deposit)|
| `gift`                | s→room    | in-room gift animation broadcast                       |
| `outbox`              | s→user    | generic push for all notifications                     |

## Project layout

```
packages/shared/   # constants, economics (parseObsAmount), bech32m address lib, id generator
apps/api/          # Express + Socket.IO API
  src/index.js              # server entry, socket authz, outbox/sweeper loops
  src/routes/*.js           # REST endpoints
  src/services/
    ledger.js               # double-entry primitives (debit/credit/transfer)
    notifications.js        # unified DB+outbox notification helper
    obsidian.js             # bech32m address + RPC client stubs
  src/db/
    index.js                # sql.js driver, migrations, tx()
    migrations/             # SQL migration files
  src/seeds/                # seed data (admin, gifts, demo posts)
apps/web/          # Next.js App Router frontend
  src/app/                  # routes (each folder is a page)
  src/components/           # shared UI (Avatar, PostCard, Sidebar, TopBar, …)
  src/lib/api.js            # fetch wrapper with cookie auth
  src/lib/utils.js          # number/time formatters
  src/store/                # Zustand stores (auth, chat)
```

## Tests

```bash
npm test
```

Covers the shared economics module (OC/OBS conversion, 70/30 split
determinism, gift price bounds), Obsidian bech32m address validation,
and API-layer ledger flows.

## Security notes

- Passwords hashed with bcrypt (configurable rounds).
- JWT in httpOnly + SameSite=Lax cookie (and bearer fallback for mobile).
- CORS restricted to `CORS_ORIGIN`. Helmet is active; CSP is managed by
  Next.js on the web side.
- Rate limits on global, auth, and gift endpoints (see env vars).
- All ledger-mutating routes require idempotency keys where user error can
  duplicate moves (gifts, withdrawals).
- Socket.IO handlers enforce conversation membership, live-room viewer rows,
  and peer scope before relaying messages.
- Admin endpoints gated on role (`super` / `moderator` / `finance`).
- Inputs validated with `zod` schemas; BigInt responses coerced to strings
  via a response-json sanitizer.

## License

Proprietary — © EmoluxLabs / Obsidian Network contributors.
