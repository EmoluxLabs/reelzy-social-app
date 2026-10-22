/**
 * Run all pending migrations. Invoked at server boot and via `npm run db:migrate`.
 */
import { initDb, tx } from './index.js';
import { SCHEMA } from './schema.js';

const MIGRATIONS = [
  ['001_init', SCHEMA],
];

export async function runMigrations() {
  await initDb();
  await tx((d) => {
    d.exec(SCHEMA);
    for (const [name] of MIGRATIONS) {
      const existing = d.prepare('SELECT name FROM migrations WHERE name = ?').get(name);
      if (existing) continue;
      // Additional migration SQL for that version (future use):
      d.prepare('INSERT INTO migrations (name) VALUES (?)').run(name);
      console.log(`[db] applied migration ${name}`);
    }
  });
}

const isCli = process.argv[1] && (process.argv[1].endsWith('migrate.js') || process.argv[1].includes('db:migrate'));
if (isCli) {
  runMigrations()
    .then(() => { console.log('[db] migrations complete'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
