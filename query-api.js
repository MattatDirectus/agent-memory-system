#!/usr/bin/env node

/**
 * Memory System - Query API
 *
 * Fast API for searching memories and conversations
 * Uses SQLite FTS5 for <500ms queries across thousands of entries
 *
 * Usage:
 *   node query-api.js --port 3333
 *
 * Endpoints:
 *   POST /search/memories - Search all memories
 *   POST /search/conversations - Search conversations
 *   POST /search/combined - Search everything
 *   POST /search/by-tag - Search by tag
 *   GET /memories/recent - Get recent entries
 *   GET /memories/:id - Get single memory with context
 *   POST /search/snippet-context - Get context around snippets
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const DB_PATH = path.join(__dirname, 'memory.db');
const DEFAULT_PORT = 3333;

// ============================================================================
// Database
// ============================================================================

let db;

function openDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Database error:', err);
        reject(err);
      } else {
        console.log('✓ Connected to memory database');
        resolve();
      }
    });
    db.configure('busyTimeout', 5000);
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

// ============================================================================
// Search Functions
// ============================================================================

async function searchMemories(query, limit = 10) {
  /**
   * Full-text search on memories
   * Returns: memory entries with content snippets
   */
  try {
    const results = await dbAll(
      `SELECT
         m.id,
         m.type,
         m.content,
         m.source_file,
         m.timestamp,
         GROUP_CONCAT(t.name, ', ') as tags,
         datetime(m.timestamp, 'unixepoch') as date,
         snippet(memories_fts, 0, '<b>', '</b>', '...', 64) as snippet
       FROM memories m
       LEFT JOIN memory_tags mt ON m.id = mt.memory_id
       LEFT JOIN tags t ON mt.tag_id = t.id
       JOIN memories_fts fts ON m.id = fts.rowid
       WHERE memories_fts MATCH ?
       GROUP BY m.id
       ORDER BY rank
       LIMIT ?`,
      [query, limit]
    );
    return results;
  } catch (err) {
    console.error('Search error:', err);
    return [];
  }
}

async function searchConversations(query, limit = 10) {
  /**
   * Search across conversations with session context
   */
  try {
    const results = await dbAll(
      `SELECT
         c.id,
         c.message_text,
         c.user_role,
         c.timestamp,
         c.channel,
         s.context as session_context,
         datetime(c.timestamp, 'unixepoch') as date,
         snippet(conversations_fts, 0, '<b>', '</b>', '...', 80) as snippet
       FROM conversations c
       JOIN conversations_fts fts ON c.rowid = fts.rowid
       LEFT JOIN sessions s ON c.session_id = s.id
       WHERE conversations_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      [query, limit]
    );
    return results;
  } catch (err) {
    console.error('Search error:', err);
    return [];
  }
}

async function searchCombined(query, limit = 20) {
  /**
   * Search memories and conversations together
   * Returns combined results ranked by relevance
   */
  const memories = await searchMemories(query, Math.floor(limit * 0.6));
  const conversations = await searchConversations(query, Math.floor(limit * 0.4));

  return {
    memories: memories.map(m => ({ ...m, source: 'memory' })),
    conversations: conversations.map(c => ({ ...c, source: 'conversation' })),
    total: memories.length + conversations.length
  };
}

async function searchByTag(tagName, limit = 50) {
  /**
   * Find all memories with a specific tag
   */
  try {
    const results = await dbAll(
      `SELECT
         m.id,
         m.type,
         m.content,
         m.source_file,
         m.timestamp,
         GROUP_CONCAT(t.name, ', ') as tags,
         datetime(m.timestamp, 'unixepoch') as date
       FROM memories m
       JOIN memory_tags mt ON m.id = mt.memory_id
       JOIN tags t ON mt.tag_id = t.id
       WHERE t.name = ?
       GROUP BY m.id
       ORDER BY m.timestamp DESC
       LIMIT ?`,
      [tagName, limit]
    );
    return results;
  } catch (err) {
    console.error('Tag search error:', err);
    return [];
  }
}

async function getMemoryWithContext(memoryId) {
  /**
   * Get a single memory with all associated data
   */
  try {
    const memory = await dbGet(
      `SELECT m.*, GROUP_CONCAT(t.name, ', ') as tags
       FROM memories m
       LEFT JOIN memory_tags mt ON m.id = mt.memory_id
       LEFT JOIN tags t ON mt.tag_id = t.id
       WHERE m.id = ?
       GROUP BY m.id`,
      [memoryId]
    );

    if (!memory) return null;

    // Get nearby memories from same source file
    const context = await dbAll(
      `SELECT id, content, timestamp, type
       FROM memories
       WHERE source_file = ?
       ORDER BY timestamp DESC
       LIMIT 5`,
      [memory.source_file]
    );

    return { ...memory, context };
  } catch (err) {
    console.error('Context fetch error:', err);
    return null;
  }
}

async function getRecentMemories(limit = 20, type = null) {
  /**
   * Get most recent memory entries
   * type: 'long_term', 'daily', or null for all
   */
  try {
    let sql = `SELECT 
         m.id,
         m.type,
         m.content,
         m.source_file,
         m.timestamp,
         GROUP_CONCAT(t.name, ', ') as tags,
         datetime(m.timestamp, 'unixepoch') as date
       FROM memories m
       LEFT JOIN memory_tags mt ON m.id = mt.memory_id
       LEFT JOIN tags t ON mt.tag_id = t.id
    `;

    const params = [];

    if (type) {
      sql += 'WHERE m.type = ? ';
      params.push(type);
    }

    sql += `GROUP BY m.id
            ORDER BY m.timestamp DESC
            LIMIT ?`;
    params.push(limit);

    const results = await dbAll(sql, params);
    return results;
  } catch (err) {
    console.error('Recent fetch error:', err);
    return [];
  }
}

async function getAllTags() {
  /**
   * Get all tags with counts
   */
  try {
    const tags = await dbAll(
      `SELECT
         t.id,
         t.name,
         t.category,
         t.color,
         COUNT(mt.memory_id) as count
       FROM tags t
       LEFT JOIN memory_tags mt ON t.id = mt.tag_id
       GROUP BY t.id
       ORDER BY count DESC`,
      []
    );
    return tags;
  } catch (err) {
    console.error('Tags fetch error:', err);
    return [];
  }
}

// ============================================================================
// Express Setup
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /search/memories
 * Query: { q: "search term", limit: 10 }
 */
app.post('/search/memories', async (req, res) => {
  const { q, limit = 10 } = req.body;

  if (!q) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    const results = await searchMemories(q, limit);
    res.json({
      query: q,
      count: results.length,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /search/conversations
 * Query: { q: "search term", limit: 10 }
 */
app.post('/search/conversations', async (req, res) => {
  const { q, limit = 10 } = req.body;

  if (!q) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    const results = await searchConversations(q, limit);
    res.json({
      query: q,
      count: results.length,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /search/combined
 * Query: { q: "search term", limit: 20 }
 */
app.post('/search/combined', async (req, res) => {
  const { q, limit = 20 } = req.body;

  if (!q) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    const results = await searchCombined(q, limit);
    res.json({
      query: q,
      ...results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /search/tag
 * Query: { tag: "project", limit: 50 }
 */
app.post('/search/tag', async (req, res) => {
  const { tag, limit = 50 } = req.body;

  if (!tag) {
    return res.status(400).json({ error: 'Tag required' });
  }

  try {
    const results = await searchByTag(tag, limit);
    res.json({
      tag,
      count: results.length,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /memories/recent?limit=20&type=daily
 */
app.get('/memories/recent', async (req, res) => {
  const { limit = 20, type = null } = req.query;

  try {
    const results = await getRecentMemories(parseInt(limit), type);
    res.json({
      count: results.length,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /memories/:id
 */
app.get('/memories/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const memory = await getMemoryWithContext(id);
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    res.json(memory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /tags
 */
app.get('/tags', async (req, res) => {
  try {
    const tags = await getAllTags();
    res.json({
      count: tags.length,
      tags,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: DB_PATH,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// Startup
// ============================================================================

async function start() {
  try {
    await openDatabase();

    const port = process.env.PORT || DEFAULT_PORT;
    app.listen(port, () => {
      console.log(`\n🧠 Memory API running on port ${port}`);
      console.log(`📖 Database: ${DB_PATH}`);
      console.log(`\n📚 Available endpoints:`);
      console.log(`   POST /search/memories - Search memories`);
      console.log(`   POST /search/conversations - Search conversations`);
      console.log(`   POST /search/combined - Search everything`);
      console.log(`   POST /search/tag - Search by tag`);
      console.log(`   GET  /memories/recent - Get recent entries`);
      console.log(`   GET  /memories/:id - Get single memory`);
      console.log(`   GET  /tags - List all tags`);
      console.log(`   GET  /health - Health check\n`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\nClosing database...');
  db.close();
  process.exit(0);
});

start();
