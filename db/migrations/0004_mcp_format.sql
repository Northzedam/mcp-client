-- Agregar campos para formato estandar MCP
ALTER TABLE mcp_servers ADD COLUMN mcp_config TEXT; -- JSON del formato estandar MCP
ALTER TABLE mcp_servers ADD COLUMN config_format TEXT DEFAULT 'individual' CHECK (config_format IN ('individual', 'mcp'));

-- Indice para el formato de configuracion
CREATE INDEX IF NOT EXISTS idx_mcp_servers_config_format ON mcp_servers(config_format);
