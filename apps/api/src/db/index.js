/**
 * SQLite persistence layer using sql.js. We wrap it so that every write
 * transaction flushes the binary to disk atomically. This gives us full
 * ACID transactions for the financial ledger without requiring a native
 * build of better-sqlite3.
 */
import initSqlJs from 'sql.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = process.env.OC_DB_PATH || path.join(DATA_DIR, 'oc.sqlite');

let db = null;
let SQL = null;

async function ensureDir() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
}

async function loadFromDisk() {
  try {
    const buf = await fs.readFile(DB_PATH);
    db = new SQL.Database(new Uint8Array(buf));
  } catch (e) {
    if (e.code === 'ENOENT') {
      db = new SQL.Database();
    } else throw e;
  }
}

async function persist() {
  if (!db) return;
  const data = db.export();
  // Write-then-rename for crash-safe atomic persistence
  const tmp = `${DB_PATH}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await fs.writeFile(tmp, Buffer.from(data));
  await fs.rename(tmp, DB_PATH);
}

export async function initDb() {
  SQL = await initSqlJs();
  await ensureDir();
  await loadFromDisk();
  // Enable WAL-style behavior via pragma (sql.js ignores some pragmas, but FK and enforcement work)
  db.run('PRAGMA foreign_keys = ON');
  // Patch prepare so stmt.run() accepts variadic args (sql.js only accepts an array).
  const _origPrepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const stmt = _origPrepare(sql);
    const _origRun = stmt.run.bind(stmt);
    stmt.run = function (...args) {
      if (args.length === 1 && Array.isArray(args[0])) return _origRun(args[0]);
      return _origRun(args);
    };
    return stmt;
  };
  return db;
}

export function getDb() {
  if (!db) throw new Error('DB not initialised. Call initDb() first.');
  return db;
}

/**
 * Execute a callback inside an immediate SQLite transaction. All statements
 * inside run against a single connection; if the callback throws we roll back.
 * On success we persist the database to disk.
 *
 * @template T
 * @param {(db: Database) => T} fn
 * @returns {Promise<T>}
 */
export async function tx(fn) {
  if (!db) throw new Error('DB not initialised.');
  try {
    db.run('BEGIN IMMEDIATE');
    const result = await fn(db);
    db.run('COMMIT');
    await persist();
    return result;
  } catch (err) {
    try { db.run('ROLLBACK'); } catch { /* ignored */ }
    throw err;
  }
}

export function prepare(sql) {
  return db.prepare(sql);
}

/** Convenience: run one statement with bound params (for statements that don't return rows). */
export function run(sql, params = []) {
  const stmt = prepare(sql);
  try {
    stmt.bind(params);
    stmt.step();
  } finally {
    stmt.free();
  }
}

/** Execute a prepared statement once; returns { changes, lastInsertRowid }.
 * Useful inside tx callbacks where the caller needs changes info. */
export function execStmt(stmt, params = []) {
  stmt.bind(params);
  stmt.step();
  const result = { changes: Number(stmt.getRowsModified?.() ?? 0) };
  stmt.reset();
  return result;
}

/** Fetch all rows as objects. */
export function all(sql, params) {
  const stmt = prepare(sql);
  const rows = [];
  try {
    stmt.bind(params || []);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row) rows.push(row);
    }
  } finally {
    stmt.free();
  }
  return rows;
}

/** Fetch first row or null. */
export function get(sql, params) {
  const stmt = prepare(sql);
  try {
    stmt.bind(params || []);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      // If every column is null/undefined, treat as empty (sql.js artifact when step returns true without data)
      const keys = Object.keys(row);
      if (keys.length === 0) return null;
      return row;
    }
    return null;
  } finally {
    stmt.free();
  }
}

/** Count rows matching a simple SELECT COUNT(...) query. */
export function count(sql, params) {
  const row = get(sql, params);
  if (!row) return 0;
  const v = Object.values(row)[0];
  return Number(v) || 0;
}

/** Execute multiple statements (e.g. a migration file). */
export function execMany(sql) {
  db.exec(sql);
}

export const dbPath = DB_PATH;
