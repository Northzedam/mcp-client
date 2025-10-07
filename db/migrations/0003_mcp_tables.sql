-- Tabla para servidores MCP
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport IN ('stdio', 'websocket')),
  endpoint TEXT NOT NULL,
  args TEXT,                    -- JSON array para argumentos de comando
  auth TEXT,                    -- JSON object para autenticación
  scopes TEXT,                  -- JSON array para scopes
  enabled INTEGER DEFAULT 1,    -- 0 = false, 1 = true
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tabla para herramientas MCP
CREATE TABLE IF NOT EXISTS mcp_tools (
  id TEXT PRIMARY KEY,
  mcp_server_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  input_schema TEXT,            -- JSON schema
  created_at TEXT NOT NULL,
  FOREIGN KEY (mcp_server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
);

-- Tabla para logs de ejecución de herramientas MCP
CREATE TABLE IF NOT EXISTS mcp_tool_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  mcp_server_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  args TEXT,                    -- JSON
  result TEXT,                  -- JSON
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'denied')),
  decision TEXT,                -- 'ALLOW' | 'REQUIRE_CONFIRMATION' | 'DENY'
  error_message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (mcp_server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_status ON mcp_servers(status);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_server_id ON mcp_tools(mcp_server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_logs_session_id ON mcp_tool_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_logs_server_id ON mcp_tool_logs(mcp_server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_logs_created_at ON mcp_tool_logs(created_at);
