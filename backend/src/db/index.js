import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isPostgres = false;
let pgPool = null;
let sqliteDb = null;

const dbUrl = process.env.DATABASE_URL;

if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
  isPostgres = true;
  pgPool = new pg.Pool({
    connectionString: dbUrl,
    ssl: process.env.PGSSLMODE === 'require' || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('[DB] Connecting to PostgreSQL database...');
} else {
  isPostgres = false;
  const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../../frontdesk.db');
  sqliteDb = new DatabaseSync(dbPath);
  console.log(`[DB] Using embedded SQLite database at: ${dbPath}`);
}

export async function initDatabase() {
  if (isPostgres) {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await pgPool.query(schemaSql);
    console.log('[DB] PostgreSQL schema initialized successfully.');
  } else {
    // SQLite schema creation
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'agent',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE NOT NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        priority TEXT NOT NULL CHECK (priority IN ('critical', 'medium', 'low')),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed')),
        assigned_to INTEGER REFERENCES agents(id),
        created_at TEXT DEFAULT (datetime('now')),
        first_response_at TEXT,
        resolved_at TEXT,
        closed_at TEXT,
        sla_reply_deadline TEXT NOT NULL,
        sla_resolve_deadline TEXT NOT NULL,
        sla_paused_at TEXT,
        sla_total_paused_minutes INTEGER DEFAULT 0,
        sla_reply_breached INTEGER DEFAULT 0,
        sla_resolve_breached INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        agent_id INTEGER REFERENCES agents(id),
        author_name TEXT NOT NULL,
        author_type TEXT NOT NULL CHECK (author_type IN ('agent', 'customer', 'system')),
        body TEXT NOT NULL,
        is_internal INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        agent_id INTEGER REFERENCES agents(id),
        actor_name TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_comments_ticket_id ON comments(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_comments_is_internal ON comments(is_internal);
      CREATE INDEX IF NOT EXISTS idx_audit_ticket_id ON audit_log(ticket_id);
    `);
    console.log('[DB] SQLite schema initialized successfully.');
  }
}

/**
 * Execute a query with parameterized values
 * Accepts $1, $2, ... placeholders and converts to ? if using SQLite
 */
export async function query(sql, params = []) {
  if (isPostgres) {
    const res = await pgPool.query(sql, params);
    return res.rows;
  } else {
    // Convert $1, $2, ... to ? for SQLite
    const sqliteSql = sql.replace(/\$\d+/g, '?');
    const stmt = sqliteDb.prepare(sqliteSql);
    
    // Check if SELECT query or RETURNING
    const isSelect = /^\s*SELECT/i.test(sqliteSql);
    const hasReturning = /RETURNING/i.test(sqliteSql);

    if (isSelect || hasReturning) {
      if (hasReturning) {
        // SQLite doesn't natively support RETURNING prior to 3.35 or with DatabaseSync returning all rows directly,
        // but modern sqlite does support RETURNING with .all()
        try {
          return stmt.all(...params);
        } catch {
          stmt.run(...params);
          return [];
        }
      }
      return stmt.all(...params);
    } else {
      const info = stmt.run(...params);
      return { rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  }
}

/**
 * Convenience method for single row
 */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export function isPostgresEngine() {
  return isPostgres;
}

export default {
  query,
  queryOne,
  initDatabase,
  isPostgresEngine
};
