CREATE TABLE IF NOT EXISTS tools_logs (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  tool TEXT NOT NULL,
  args TEXT NOT NULL,         -- JSON string
  decision TEXT NOT NULL,     -- 'ALLOW' | 'REQUIRE_CONFIRMATION' | 'DENY'
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tools_logs_sessionId ON tools_logs(sessionId);
CREATE INDEX IF NOT EXISTS idx_tools_logs_createdAt ON tools_logs(createdAt);
