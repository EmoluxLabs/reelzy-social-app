/**
 * Seed default data:
 *  - Initial rate/revenue-share version
 *  - Default admin account (email: admin@obsidian.circle / password: Admin2026!)
 *  - 320 gift catalog entries (100 Basic, 100 Premium, 60 Epic, 50 Legendary, 10 Limited)
 *
 * Safe to re-run: insertions are conditional on existing primary keys.
 */
import bcrypt from 'bcryptjs';
import { tx, run, get } from './index.js';
import { runMigrations } from './migrate.js';
import { generateId } from '@oc/shared';
import { OC_ECON, GIFT_CATALOG_COUNTS, ROLE } from '@oc/shared';

const DEFAULT_ADMIN = {
  email: 'admin@obsidian.circle',
  username: 'obsidian',
  password: 'Admin2026!',
};

// Gift definitions: palette-driven shapes + particles to produce original artwork
// without requiring copyrighted assets. Every entry has a unique animation config
// that the front-end renders with CSS/SVG + a small particle library.
const BASIC_GIFTS = [
  ['Heart', 1000, ['❤️']], ['Rose', 1200, ['🌹']], ['Star', 1500, ['⭐']],
  ['Smile', 1000, ['😊']], ['Thumbs Up', 1000, ['👍']], ['Clap', 1200, ['👏']],
  ['Balloon', 1500, ['🎈']], ['Flower', 1500, ['🌸']], ['Firefly', 2000, ['✨']],
  ['Mini Trophy', 3000, ['🏆']], ['High Five', 1000, ['🙌']], ['Laugh', 1000, ['😂']],
  ['Hug', 1200, ['🤗']], ['Wink', 1000, ['😉']], ['Wave', 1000, ['👋']],
  ['Sparkle', 2000, ['💫']], ['Confetti', 2500, ['🎊']], ['Cheers', 3000, ['🥂']],
  ['Coffee', 1500, ['☕']], ['Cookie', 1500, ['🍪']], ['Cake Slice', 2000, ['🍰']],
  ['Ice Cream', 2000, ['🍦']], ['Doughnut', 1800, ['🍩']], ['Pizza', 2500, ['🍕']],
  ['Burger', 2500, ['🍔']], ['Sushi', 3000, ['🍣']], ['Taco', 2000, ['🌮']],
  ['Lollipop', 1200, ['🍭']], ['Candy', 1200, ['🍬']], ['Grape', 1500, ['🍇']],
  ['Cherry', 1200, ['🍒']], ['Peach', 1500, ['🍑']], ['Lemon', 1000, ['🍋']],
  ['Music Note', 1500, ['🎵']], ['Headphones', 2500, ['🎧']], ['Microphone', 2500, ['🎤']],
  ['Pencil', 1200, ['✏️']], ['Bookmark', 1200, ['🔖']], ['Paper Plane', 1500, ['🛩']],
  ['Rocket (mini)', 3000, ['🚀']], ['Moon', 2500, ['🌙']], ['Sun', 2000, ['☀️']],
  ['Cloud', 1500, ['☁️']], ['Rainbow', 3000, ['🌈']], ['Umbrella', 1500, ['☂️']],
  ['Snowflake', 2000, ['❄️']], ['Leaf', 1200, ['🍃']], ['Clover', 2000, ['🍀']],
  ['Mushroom', 1500, ['🍄']], ['Seedling', 2000, ['🌱']], ['Tulip', 1800, ['🌷']],
  ['Sunflower', 2000, ['🌻']], ['Bouquet', 5000, ['💐']], ['Crown (paper)', 3000, ['👑']],
  ['Gem', 2000, ['💎']], ['Ring (toy)', 3000, ['💍']], ['Lipstick', 2500, ['💄']],
  ['Dress', 5000, ['👗']], ['Shoe', 3000, ['👟']], ['Sunglasses', 2000, ['🕶']],
  ['Camera', 4000, ['📷']], ['Film', 2500, ['🎞']], ['Ticket', 1500, ['🎟']],
  ['Book', 2000, ['📚']], ['Paintbrush', 2000, ['🖌']], ['Palette', 2500, ['🎨']],
  ['Game Controller', 4000, ['🎮']], ['Dice', 2000, ['🎲']], ['Puzzle Piece', 1500, ['🧩']],
  ['Ball', 2000, ['⚽']], ['Tennis', 2000, ['🎾']], ['Medal', 3500, ['🎖']],
  ['Ribbon', 1500, ['🎀']], ['Party Popper', 2500, ['🎉']], ['Bell', 1500, ['🔔']],
  ['Key', 3000, ['🔑']], ['Lock', 2500, ['🔒']], ['Torch', 1800, ['🔦']],
  ['Candle', 1500, ['🕯']], ['Battery', 2000, ['🔋']], ['Hourglass', 2500, ['⏳']],
  ['Watch', 3000, ['⌚']], ['Globe', 3000, ['🌍']], ['Mountain', 2500, ['⛰']],
  ['Wave', 1500, ['🌊']], ['Fire', 2000, ['🔥']], ['Lightning', 2500, ['⚡']],
  ['Comet', 3000, ['☄️']], ['Planet', 2500, ['🪐']], ['Starburst', 2000, ['💥']],
  ['Bubble', 1000, ['🫧']], ['Ghost', 1800, ['👻']], ['Alien', 2500, ['👽']],
  ['Unicorn (chibi)', 5000, ['🦄']], ['Butterfly', 2500, ['🦋']], ['Bee', 2000, ['🐝']],
  ['Ladybug', 1800, ['🐞']], ['Dolphin', 3000, ['🐬']], ['Whale', 3500, ['🐳']],
  ['Fox', 3000, ['🦊']], ['Panda', 3000, ['🐼']], ['Koala', 3000, ['🐨']],
];

const PREMIUM_GIFTS = [
  ['Ruby Heart', 5000], ['Sapphire Rose', 6000], ['Golden Star', 7500],
  ['Diamond Crown', 10000], ['Emerald Bouquet', 12000], ['Platinum Trophy', 15000],
  ['Velvet Bow', 5500], ['Gold Medal', 8000], ['Silver Chalice', 9000],
  ['Pearl Necklace', 12000], ['Crystal Butterfly', 11000], ['Jeweled Guitar', 10000],
  ['Enchanted Harp', 12000], ['Premium Mic', 8000], ['Diamond Mic', 15000],
  ['Yacht (mini)', 20000], ['Sports Car', 25000], ['Limousine', 25000],
  ['Private Jet', 30000], ['Hot Air Balloon', 8000], ['Luxury Watch', 20000],
  ['Designer Bag', 15000], ['High Heels', 7500], ['Sneakers (LE)', 9000],
  ['Sunglasses (Gold)', 8000], ['Perfume Bottle', 9000], ['Lipstick (Ruby)', 6000],
  ['Diamond Ring', 20000], ['Tiara', 15000], ['Luxury Cake', 7500],
  ['Champagne Bottle', 10000], ['Wine Glass', 5000], ['Chocolate Box', 5500],
  ['Teddy Bear', 6000], ['Rose Petals', 4000], ['Heart Balloons', 5000],
  ['Love Letter', 4500], ['Heart Locket', 9000], ['Music Box', 8000],
  ['Vinyl Record', 6000], ['Boombox', 10000], ['Karaoke Mic', 7500],
  ['Film Camera', 12000], ['Paint Set', 8500], ['Sculpture', 15000],
  ['Theatre Mask', 6000], ['Spotlight', 9000], ['Red Carpet', 12000],
  ['VIP Ticket', 10000], ['Backstage Pass', 7500], ['Stage Curtain', 8000],
  ['Confetti Cannon', 6000], ['Neon Heart', 6500], ['LED Ring', 5500],
  ['Disco Ball', 8000], ['Retro TV', 9000], ['Arcade Cabinet', 10000],
  ['Pinball Machine', 12000], ['Skateboard', 7500], ['Snowboard', 9000],
  ['Surfboard', 10000], ['Football', 6000], ['Basketball', 6000],
  ['Motorcycle (sport)', 25000], ['Scooter', 8000], ['Helicopter', 30000],
  ['Speedboat', 22000], ['Luxury Perfume', 12000], ['Crystal Glass', 6000],
  ['Gold Chain', 12000], ['Silver Chain', 7500], ['Bronze Statue', 9000],
  ['Phoenix Feather', 15000], ['Dragon Scale', 15000], ['Magic Wand', 10000],
  ['Spell Book', 12000], ['Wizard Hat', 7500], ['Knight Helmet', 10000],
  ['Fairy Wings', 11000], ['Angel Halo', 8000], ['Demon Horns', 8000],
  ['Shield of Valor', 13000], ['Sword of Stars', 18000], ['Bow of Light', 14000],
  ['Potion of Love', 6000], ['Floating Lantern', 7000], ['Sky Lanterns', 8000],
  ['Cherry Blossoms', 5500], ['Aurora Borealis', 15000], ['Fireworks', 10000],
  ['Lotus Flower', 6000], ['White Swan', 9000], ['Peacock', 9000],
  ['Pegasus', 18000], ['White Tiger', 15000], ['Lion', 14000],
  ['Wolf', 12000], ['Eagle', 13000], ['Falcon', 11000],
  ['Owl', 9000], ['Dove', 6000], ['Horse', 12000],
  ['Castle Token', 25000], ['Magic Carpet', 18000], ['Compass', 8000],
  ['Golden Griffin', 22000],
];

const EPIC_GIFTS = [
  ['Lava Dragon', 50000], ['Ice Phoenix', 55000], ['Thunder Roc', 45000],
  ['Cosmic Serpent', 60000], ['Shadow Wolf', 40000], ['Crystal Golem', 50000],
  ['Fire Elemental', 45000], ['Water Elemental', 45000], ['Earth Elemental', 45000],
  ['Wind Elemental', 45000], ['Celestial Unicorn', 70000], ['Kitsune Spirit', 55000],
  ['Nine-Tailed Flame', 80000], ['Meteor Shower', 65000], ['Comet Strike', 75000],
  ['Nebula Cloud', 55000], ['Supernova', 90000], ['Black Hole', 100000],
  ['Astral Plane', 85000], ['Galaxy Spiral', 95000], ['Magic Portal', 60000],
  ['Ancient Rune', 40000], ['Floating Islands', 65000], ['Volcano Eruption', 80000],
  ['Tidal Wave', 70000], ['Hurricane Eye', 75000], ['Earthquake', 70000],
  ['Thunderstorm', 55000], ['Rainbow Waterfall', 65000], ['Aurora Dragon', 85000],
  ['Forest Spirit', 50000], ['Moon Rabbit', 45000], ['Sun Hawk', 55000],
  ['Star Guardian', 80000], ['Dream Weaver', 75000], ['Nightmare Hunter', 60000],
  ['Arcane Librarian', 55000], ['Spell Forge', 70000], ['Alchemy Set', 55000],
  ['Phoenix Rebirth', 95000], ['Dragon Breath', 50000], ['Faerie Ring', 40000],
  ['Mystic Mirror', 50000], ['Crystal Ball', 60000], ['Magic Hourglass', 65000],
  ['Flying Castle', 100000], ['Underwater Palace', 80000], ['Sky Temple', 90000],
  ['Inferno Tower', 75000], ['Frost Keep', 75000], ['Throne of Stars', 110000],
  ['Orb of Power', 85000], ['Chrono Crystal', 90000], ['Dragon\'s Eye', 100000],
  ['Phoenix Egg', 75000], ['Griffin Mount', 80000], ['Wyvern', 65000],
  ['Hydra', 70000], ['Chimera', 70000], ['Cerberus', 75000],
];

const LEGENDARY_GIFTS = [
  ['Royal Palace', 250000], ['Dragon Lord', 300000], ['Cosmic Guardian', 400000],
  ['Diamond Megayacht', 500000], ['Private Spacecraft', 750000], ['Golden Throne', 350000],
  ['Stadium Concert', 300000], ['World Tour', 600000], ['Mansion Estate', 450000],
  ['Private Island', 800000], ['Gold Supercar', 250000], ['Diamond Jet', 700000],
  ['Ancient Dragon King', 1000000], ['Phoenix Queen', 900000], ['Obsidian Kraken', 850000],
  ['Celestial Emperor', 1000000], ['Galaxy Crown', 750000], ['Stellar Empire', 1500000],
  ['Cosmic Throne', 1200000], ['Astral Dragon', 1100000], ['Frost Titan', 900000],
  ['Magma Colossus', 950000], ['Storm Leviathan', 900000], ['Eternal Flame', 800000],
  ['Void Sovereign', 1500000], ['Reality Shaper', 2000000], ['Infinity Engine', 2500000],
  ['Genesis Nova', 3000000], ['Divine Phoenix', 2000000], ['Time Lord Citadel', 2200000],
  ['World Tree', 1800000], ['Moon Base', 2000000], ['Mars Colony', 3000000],
  ['Dyson Sphere Shard', 5000000], ['Celestial Choir', 800000], ['Orbital Station', 2500000],
  ['Royal Coronation', 750000], ['Creator of Worlds', 10000000], ['Grand Festival', 700000],
  ['Million-Star Parade', 500000], ['Legendary Banner', 600000], ['Signature Crown', 900000],
  ['Platinum Record', 450000], ['Hall of Fame', 800000], ['Creator Statue', 650000],
  ['Walk of Fame Star', 500000], ['Golden Lifetime Award', 1200000], ['Million Fan Celebration', 700000],
  ['Cosmic Anniversary', 950000], ['Diamond Creator Badge', 600000],
];

const LIMITED_GIFTS = [
  ['The Obsidian Genesis', 1000000],
  ['Founder\'s Sigil', 1000000],
  ['Circle of Eternity', 2000000],
  ['Midnight Eclipse', 2500000],
  ['Cosmic Anniversary Ring', 3000000],
  ['Platinum Legacy', 4000000],
  ['Obsidian Throne Keepsake', 5000000],
  ['The One Crown', 7500000],
  ['Genesis Nova', 9000000],
  ['Void Sovereign\'s Oath', 10000000],
];

function buildCatalog() {
  const out = [];
  const pad = (v) => String(v).padStart(3, '0');
  const counters = { Basic: 0, Premium: 0, Epic: 0, Legendary: 0, Limited: 0 };

  const addGift = (cat, name, price, emoji, tier, daily_limit) => {
    counters[cat]++;
    const finalPrice = Math.max(1000, Math.round(price / 100) * 100);
    out.push({
      catalog_id: `${cat.toLowerCase()}_${pad(counters[cat])}`,
      name,
      category: cat,
      price: finalPrice,
      emoji,
      rarity_tier: tier,
      daily_limit,
    });
  };

  // Basic: 100. Use first N from curated list; if short, pad with numbered variants.
  const basicSeeds = BASIC_GIFTS.map((g) => ({ name: g[0], price: g[1], emoji: g[2][0] }));
  let bi = 0;
  while (counters.Basic < GIFT_CATALOG_COUNTS.Basic && bi < basicSeeds.length) {
    const b = basicSeeds[bi++];
    addGift('Basic', b.name, b.price, b.emoji, 1, 0);
  }
  const suffixes = [' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  const priceScale = [1.1, 1.25, 1.4, 1.5, 1.75, 2.0, 2.25, 2.5];
  let variant = 0;
  while (counters.Basic < GIFT_CATALOG_COUNTS.Basic) {
    const base = basicSeeds[variant % basicSeeds.length];
    const sfxIdx = Math.floor(variant / basicSeeds.length);
    if (sfxIdx >= suffixes.length) break;
    addGift('Basic', `${base.name}${suffixes[sfxIdx]}`, base.price * priceScale[sfxIdx], base.emoji, 1, 0);
    variant++;
  }

  // Other categories: take exactly N items; if array is short, pad with variants; if too long, truncate.
  const fillCategory = (arr, cat, tier, emoji, daily_limit) => {
    const target = GIFT_CATALOG_COUNTS[cat];
    for (let j = 0; j < Math.min(arr.length, target); j++) {
      addGift(cat, arr[j][0], arr[j][1], emoji, tier, daily_limit);
    }
    let k = 0;
    while (counters[cat] < target) {
      const base = arr[k % arr.length];
      const vr = Math.floor(k / arr.length) + 1;
      addGift(cat, `${base[0]} ${'★'.repeat(Math.min(vr,3))}`, base[1] * (1 + vr * 0.2), emoji, tier, daily_limit);
      k++;
      if (k > 200) throw new Error(`${cat} gift generation overflow`);
    }
  };
  fillCategory(PREMIUM_GIFTS, 'Premium', 2, '🎁', 0);
  fillCategory(EPIC_GIFTS, 'Epic', 3, '🎁', 0);
  fillCategory(LEGENDARY_GIFTS, 'Legendary', 4, '🎁', 0);
  fillCategory(LIMITED_GIFTS, 'Limited', 5, '🎁', 1);

  // Final defensive check
  for (const cat of Object.keys(GIFT_CATALOG_COUNTS)) {
    if (cat === 'TOTAL') continue;
    if (counters[cat] !== GIFT_CATALOG_COUNTS[cat]) {
      throw new Error(`${cat} count ${counters[cat]} !== ${GIFT_CATALOG_COUNTS[cat]}`);
    }
  }
  return out;
}

export async function seed({ force = false } = {}) {
  await runMigrations();
  await tx((db) => {
    // Helper within tx to run parameterised statements
    const runQ = (sql, params = []) => {
      const s = db.prepare(sql);
      try { s.bind(params); s.step(); } finally { s.free(); }
    };
    const getQ = (sql, params = []) => {
      const s = db.prepare(sql);
      try {
        s.bind(params);
        if (s.step()) {
          const row = s.getAsObject();
          return Object.keys(row).length ? row : null;
        }
        return null;
      } finally { s.free(); }
    };

    // Initial rate version
    const rv = getQ('SELECT id FROM rate_versions ORDER BY id ASC LIMIT 1');
    if (!rv) {
      runQ(`INSERT INTO rate_versions
        (id, oc_per_obs, creator_share_bps, platform_share_bps, effective_at, reason)
        VALUES (?, ?, ?, ?, ?, ?)`, [
        OC_ECON.INITIAL_RATE_VERSION,
        Number(OC_ECON.OC_PER_OBS),
        Number(OC_ECON.CREATOR_SHARE_BPS),
        Number(OC_ECON.PLATFORM_SHARE_BPS),
        Math.floor(Date.now() / 1000),
        'initial',
      ]);
    }

    // Admin user
    const existing = getQ('SELECT id FROM users WHERE email_lower = ?', [DEFAULT_ADMIN.email.toLowerCase()]);
    if (!existing) {
      const hash = bcrypt.hashSync(DEFAULT_ADMIN.password, 10);
      const now = Math.floor(Date.now() / 1000);
      const id = generateId('usr');
      runQ(`INSERT INTO users
        (id, username, username_lower, email, email_lower, display_name, password_hash, role, is_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, DEFAULT_ADMIN.username, DEFAULT_ADMIN.username.toLowerCase(), DEFAULT_ADMIN.email,
          DEFAULT_ADMIN.email.toLowerCase(), 'Obsidian', hash, ROLE.SUPER, 1, now, now]);
      runQ('INSERT INTO ledger_accounts (id, kind, user_id, created_at) VALUES (?, ?, ?, ?)',
        [generateId('acc'), 'USER_OC', id, now]);
    }

    // Gift catalog
    const existingCountRow = getQ('SELECT COUNT(*) AS c FROM gifts');
    const existingGifts = existingCountRow ? Number(existingCountRow.c) : 0;
    if (existingGifts === 0 || force) {
      if (force) runQ('DELETE FROM gifts');
      const catalog = buildCatalog();
      const counts = {};
      const now = Math.floor(Date.now() / 1000);
      for (const g of catalog) {
        runQ(`INSERT INTO gifts
          (id, catalog_id, name, category, price_oc, rarity_tier, description, animation_json, preview_url, is_active, daily_limit_per_user, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [generateId('gift'), g.catalog_id, g.name, g.category, g.price, g.rarity_tier,
            `${g.name} — a ${g.category} gift.`,
            JSON.stringify({ type: 'css', emoji: g.emoji, particles: g.rarity_tier * 12, glow: g.rarity_tier, rotation: g.rarity_tier >= 3 }),
            '', g.daily_limit, now]);
        counts[g.category] = (counts[g.category] || 0) + 1;
      }
      console.log('[seed] gift catalog seeded:', counts);
      if (counts.Basic !== 100 || counts.Premium !== 100 || counts.Epic !== 60 || counts.Legendary !== 50 || counts.Limited !== 10) {
        throw new Error(`Gift catalog count mismatch: ${JSON.stringify(counts)}`);
      }
    }
  });
}

const isCli = process.argv[1] && (process.argv[1].endsWith('seed.js') || process.argv[1].includes('db:seed'));
if (isCli) {
  seed().then(() => { console.log('[seed] done'); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}
