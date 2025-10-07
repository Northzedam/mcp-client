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

  const deleteSession = (sessionId) => {
    // Eliminar mensajes de la sesión
    db.prepare('DELETE FROM messages WHERE sessionId = ?').run(sessionId);
    
    // Eliminar logs de herramientas de la sesión
    db.prepare('DELETE FROM tools_logs WHERE sessionId = ?').run(sessionId);
    
    // Eliminar la sesión
    const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    
    return result.changes > 0; // Retorna true si se eliminó algo
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

  // ---------- MCP Servers ----------
  const getMCPServers = () => {
    const rows = db.prepare("SELECT * FROM mcp_servers ORDER BY created_at DESC").all();
    return rows.map(row => ({
      ...row,
      args: safeParseJSON(row.args),
      auth: safeParseJSON(row.auth),
      scopes: safeParseJSON(row.scopes),
      mcp_config: safeParseJSON(row.mcp_config),
      enabled: Boolean(row.enabled)
    }));
  };

  const getMCPServer = (id) => {
    const row = db.prepare("SELECT * FROM mcp_servers WHERE id = ?").get(id);
    if (!row) return null;
    return {
      ...row,
      args: safeParseJSON(row.args),
      auth: safeParseJSON(row.auth),
      scopes: safeParseJSON(row.scopes),
      mcp_config: safeParseJSON(row.mcp_config),
      enabled: Boolean(row.enabled)
    };
  };

  const createMCPServer = (serverData) => {
    const id = serverData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO mcp_servers (id, name, transport, endpoint, args, auth, scopes, enabled, notes, status, mcp_config, config_format, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      serverData.name,
      serverData.transport,
      serverData.endpoint,
      JSON.stringify(serverData.args || {}),
      JSON.stringify(serverData.auth || {}),
      JSON.stringify(serverData.scopes || {}),
      serverData.enabled ? 1 : 0,
      serverData.notes || "",
      "disconnected",
      JSON.stringify(serverData.mcp_config || {}),
      serverData.config_format || "individual",
      now,
      now
    );
    
    return id;
  };

  const updateMCPServer = (id, updates) => {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
      if (key === "args" || key === "auth" || key === "scopes" || key === "mcp_config") {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(updates[key] || {}));
      } else if (key === "enabled") {
        fields.push(`${key} = ?`);
        values.push(updates[key] ? 1 : 0);
      } else {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });
    
    fields.push("updated_at = ?");
    values.push(now);
    values.push(id);
    
    db.prepare(`UPDATE mcp_servers SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  };

  const deleteMCPServer = (id) => {
    const result = db.prepare("DELETE FROM mcp_servers WHERE id = ?").run(id);
    return result.changes > 0;
  };

  // ---------- MCP Tools ----------
  const getMCPTools = (serverId) => {
    const rows = db.prepare("SELECT * FROM mcp_tools WHERE mcp_server_id = ? ORDER BY created_at").all(serverId);
    return rows.map(row => ({
      ...row,
      input_schema: safeParseJSON(row.input_schema)
    }));
  };

  const createMCPTool = (toolData) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO mcp_tools (id, mcp_server_id, name, description, input_schema, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      toolData.mcp_server_id,
      toolData.name,
      toolData.description || "",
      JSON.stringify(toolData.input_schema || {}),
      now
    );
    
    return id;
  };

  const deleteMCPTools = (serverId) => {
    const result = db.prepare("DELETE FROM mcp_tools WHERE mcp_server_id = ?").run(serverId);
    return result.changes;
  };

  // ---------- MCP Tool Logs ----------
  const logMCPToolExecution = (logData) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO mcp_tool_logs (id, session_id, mcp_server_id, tool_name, args, result, status, decision, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      logData.session_id,
      logData.mcp_server_id,
      logData.tool_name,
      JSON.stringify(logData.args || {}),
      JSON.stringify(logData.result || {}),
      logData.status,
      logData.decision || null,
      logData.error_message || null,
      now
    );
    
    return id;
  };

  const listMCPToolLogs = ({ sessionId, limit = 100, offset = 0 } = {}) => {
    const mapRow = (row) => ({
      ...row,
      args: safeParseJSON(row.args),
      result: safeParseJSON(row.result)
    });
    
    if (sessionId) {
      return db.prepare(`
        SELECT * FROM mcp_tool_logs
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(sessionId, limit, offset).map(mapRow);
    }
    
    return db.prepare(`
      SELECT * FROM mcp_tool_logs
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset).map(mapRow);
  };

  // ---------- MCP Format Conversion ----------
  const convertMCPFormatToInternal = (mcpConfig) => {
    const servers = [];
    
    Object.entries(mcpConfig.mcpServers).forEach(([serverId, config]) => {
      // Detectar tipo de conexión
      let transport = "stdio";
      let endpoint = "";
      let args = [];
      let auth = {};
      
      if (config.type === "websocket" || config.url) {
        transport = "websocket";
        endpoint = config.url;
        auth = config.headers || {};
      } else if (config.command) {
        transport = "stdio";
        endpoint = config.command;
        args = config.args || [];
      }
      
      // Generar nombre amigable
      const nameMap = {
        "playwright": "Playwright Automation",
        "filesystem": "Sistema de Archivos",
        "github": "GitHub Integration",
        "web-search": "Búsqueda Web",
        "database": "Base de Datos"
      };
      
      const name = nameMap[serverId] || serverId.charAt(0).toUpperCase() + serverId.slice(1);
      
      // Generar notas
      let notes = "";
      if (transport === "stdio") {
        notes = `Proceso local: ${config.command} ${(config.args || []).join(" ")}`;
      } else if (transport === "websocket") {
        notes = `Servidor remoto: ${config.url}`;
      }
      
      servers.push({
        id: serverId,
        name,
        transport,
        endpoint,
        args,
        auth,
        scopes: {},
        enabled: true,
        notes,
        mcp_config: config,
        config_format: "mcp"
      });
    });
    
    return servers;
  };

  const createMCPServersFromMCPFormat = (mcpConfig) => {
    const servers = convertMCPFormatToInternal(mcpConfig);
    const createdIds = [];
    
    servers.forEach(serverData => {
      const id = createMCPServer(serverData);
      createdIds.push(id);
    });
    
    return createdIds;
  };

  return {
    db, migrate,
    // sesiones / mensajes
    getSessions, createSession, deleteSession, listMessages, appendMessage,
    // settings
    setSetting, getSetting, listSettings,
    // tool logs
    logToolDecision, listToolLogs,
    // MCP servers
    getMCPServers, getMCPServer, createMCPServer, updateMCPServer, deleteMCPServer,
    // MCP tools
    getMCPTools, createMCPTool, deleteMCPTools,
    // MCP tool logs
    logMCPToolExecution, listMCPToolLogs,
    // MCP format conversion
    convertMCPFormatToInternal, createMCPServersFromMCPFormat,
  };
}

module.exports = { createDB };
