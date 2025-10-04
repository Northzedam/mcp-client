const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createDB(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Tabla de migraciones
  db.prepare(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      appliedAt TEXT
    )
  `).run();

  function migrate() {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

    const applied = new Set(
      db.prepare('SELECT name FROM migrations').all().map(r => r.name)
    );

    const nowISO = new Date().toISOString();
    const tx = db.transaction(() => {
      for (const file of files) {
        if (applied.has(file)) continue;
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        db.exec(sql);
        db.prepare('INSERT INTO migrations (name, appliedAt) VALUES (?, ?)').run(file, nowISO);
      }
    });

    tx();
  }

  // ---------- Helpers genéricos ----------
  const safeParseJSON = (s) => { try { return JSON.parse(s); } catch { return undefined; } };

  // ---------- Sessions / Messages ----------
  const getSessions = () =>
    db.prepare('SELECT * FROM sessions ORDER BY createdAt DESC').all();

  const createSession = (title) => {
    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO sessions (id, title, createdAt) VALUES (?, ?, ?)'
    ).run(id, title, new Date().toISOString());
    return id;
  };

  const listMessages = (sessionId) =>
    db.prepare('SELECT * FROM messages WHERE sessionId = ? ORDER BY createdAt')
      .all(sessionId);

  const appendMessage = (msg) => {
    db.prepare(
      'INSERT INTO messages (id, sessionId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)'
    ).run(
      msg.id || crypto.randomUUID(),
      msg.sessionId,
      msg.role,
      msg.content,
      new Date().toISOString()
    );
  };

  // ---------- Settings (key-value JSON) ----------
  const setSetting = (key, value) => {
    const json = JSON.stringify(value ?? null);
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, json);
  };

  const getSetting = (key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? safeParseJSON(row.value) : undefined;
  };

  const listSettings = () => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    return rows.map(r => ({ key: r.key, value: safeParseJSON(r.value) }));
  };

  // ---------- Tool Logs (MCP) ----------
  const logToolDecision = ({ sessionId, tool, args, decision }) => {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const argsStr = JSON.stringify(args ?? {});
    db.prepare(`
      INSERT INTO tools_logs (id, sessionId, tool, args, decision, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, tool, argsStr, decision, createdAt);
    return id;
  };

  const listToolLogs = ({ sessionId, limit = 100, offset = 0 } = {}) => {
    const mapRow = (row) => ({ ...row, args: safeParseJSON(row.args) });
    if (sessionId) {
      return db.prepare(`
        SELECT * FROM tools_logs
        WHERE sessionId = ?
        ORDER BY createdAt DESC
        LIMIT ? OFFSET ?
      `).all(sessionId, limit, offset).map(mapRow);
    }
    return db.prepare(`
      SELECT * FROM tools_logs
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset).map(mapRow);
  };

  return {
    db, migrate,
    // sesiones / mensajes
    getSessions, createSession, listMessages, appendMessage,
    // settings
    setSetting, getSetting, listSettings,
    // tool logs
    logToolDecision, listToolLogs,
  };
}

module.exports = { createDB };
