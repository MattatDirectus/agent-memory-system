-- ============================================================================
-- Memory System - SQLite Schema
-- Combines conversations, daily memory logs, and long-term MEMORY.md into
-- a searchable, indexed system optimized for <500ms queries
-- ============================================================================

-- Main conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL, -- Unix timestamp
  channel TEXT, -- telegram, discord, etc.
  user_role TEXT, -- 'user' or 'assistant'
  message_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Sessions table (groups conversations)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  channel TEXT,
  context TEXT, -- "main session", "group chat", etc.
  summary TEXT, -- AI-generated or manual summary
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Memory entries from MEMORY.md and daily files
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'long_term', 'daily', 'tagged'
  source_file TEXT, -- MEMORY.md, 2026-02-16.md, etc.
  content TEXT NOT NULL,
  tags TEXT, -- JSON array of tags
  timestamp INTEGER, -- Last modified timestamp
  session_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Full-text search index for conversations
CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(
  message_text,
  content=conversations,
  content_rowid=rowid
);

-- Full-text search index for memories
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  content,
  tags,
  content=memories,
  content_rowid=rowid
);

-- Tag/label system for organizing memories
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT, -- 'project', 'person', 'context', 'emotion', etc.
  color TEXT, -- Hex color for UI
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Association table between memories and tags
CREATE TABLE IF NOT EXISTS memory_tags (
  memory_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (memory_id, tag_id),
  FOREIGN KEY (memory_id) REFERENCES memories(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

-- Conversation snippets (context-rich extracts from conversations)
CREATE TABLE IF NOT EXISTS snippets (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  snippet_text TEXT NOT NULL,
  context_before TEXT, -- Previous 1-2 messages for context
  context_after TEXT, -- Next 1-2 messages for context
  timestamp INTEGER NOT NULL,
  relevance_score REAL DEFAULT 0.0, -- For ranking
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- FTS index for snippets
CREATE VIRTUAL TABLE IF NOT EXISTS snippets_fts USING fts5(
  snippet_text,
  context_before,
  context_after,
  content=snippets,
  content_rowid=rowid
);

-- Search history (for analytics and improving relevance)
CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  results_count INTEGER,
  top_result_id TEXT,
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES for fast querying
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_user_role ON conversations(user_role);

CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_channel ON sessions(channel);

CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(source_file);

CREATE INDEX IF NOT EXISTS idx_snippets_session ON snippets(session_id);
CREATE INDEX IF NOT EXISTS idx_snippets_conversation ON snippets(conversation_id);
CREATE INDEX IF NOT EXISTS idx_snippets_timestamp ON snippets(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_snippets_relevance ON snippets(relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_memory_tags_memory ON memory_tags(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_tags_tag ON memory_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp DESC);

-- ============================================================================
-- TRIGGERS for auto-updating timestamps
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp
AFTER UPDATE ON conversations
BEGIN
  UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp
AFTER UPDATE ON sessions
BEGIN
  UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_memories_timestamp
AFTER UPDATE ON memories
BEGIN
  UPDATE memories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_snippets_timestamp
AFTER UPDATE ON snippets
BEGIN
  UPDATE snippets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_tags_timestamp
AFTER UPDATE ON tags
BEGIN
  UPDATE tags SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- VIEWS for common queries
-- ============================================================================

-- Recent conversations with session context
CREATE VIEW IF NOT EXISTS v_recent_conversations AS
SELECT
  c.id,
  c.session_id,
  c.timestamp,
  c.message_text,
  c.user_role,
  c.channel,
  s.context as session_context,
  s.summary,
  datetime(c.timestamp, 'unixepoch') as formatted_time
FROM conversations c
LEFT JOIN sessions s ON c.session_id = s.id
ORDER BY c.timestamp DESC;

-- Memories with tag information
CREATE VIEW IF NOT EXISTS v_memories_with_tags AS
SELECT
  m.id,
  m.type,
  m.content,
  m.source_file,
  m.timestamp,
  GROUP_CONCAT(t.name, ',') as tag_names,
  GROUP_CONCAT(t.id, ',') as tag_ids,
  m.created_at,
  m.updated_at
FROM memories m
LEFT JOIN memory_tags mt ON m.id = mt.memory_id
LEFT JOIN tags t ON mt.tag_id = t.id
GROUP BY m.id
ORDER BY m.timestamp DESC;

-- Snippets with full context
CREATE VIEW IF NOT EXISTS v_snippets_with_context AS
SELECT
  s.id,
  s.session_id,
  s.snippet_text,
  s.context_before,
  s.context_after,
  s.timestamp,
  s.relevance_score,
  se.context as session_context,
  datetime(s.timestamp, 'unixepoch') as formatted_time
FROM snippets s
LEFT JOIN sessions se ON s.session_id = se.id
ORDER BY s.relevance_score DESC, s.timestamp DESC;
