#!/usr/bin/env node

/**
 * Memory System - Sync Service
 *
 * Watches for new memory files and conversations, syncs them to SQLite.
 * Runs as a background service or can be triggered manually.
 *
 * Usage:
 *   node sync-service.js --watch (continuous mode)
 *   node sync-service.js --sync (one-time sync)
 *   node sync-service.js --init (initialize database)
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const chokidar = require('chokidar');

const DB_PATH = path.join(__dirname, 'memory.db');
const MEMORY_DIR = __dirname; // Current working directory where memory files are stored
const MEMORY_FILE = path.join(path.dirname(MEMORY_DIR), 'MEMORY.md');

// ============================================================================
// Database Setup
// ============================================================================

class MemoryDB {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
        process.exit(1);
      }
      console.log('✓ Connected to SQLite database:', dbPath);
    });
    this.db.configure('busyTimeout', 5000);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// ============================================================================
// Utilities
// ============================================================================

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

function extractDate(filename) {
  const match = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const date = new Date(`${match[0]}T00:00:00Z`);
    return Math.floor(date.getTime() / 1000);
  }
  return Math.floor(Date.now() / 1000);
}

function parseMemoryFile(content, sourceFile) {
  /**
   * Extracts major sections and creates memory entries.
   * Splits on ## headings and creates tagged chunks.
   */
  const entries = [];
  const sections = content.split(/^## /m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split('\n');
    const heading = lines[0];
    const text = lines.slice(1).join('\n').trim();

    if (!text) continue;

    const tags = extractTagsFromHeading(heading, sourceFile);
    entries.push({
      type: sourceFile.includes('MEMORY.md') ? 'long_term' : 'daily',
      sourceFile,
      heading,
      content: text,
      tags
    });
  }

  return entries;
}

function extractTagsFromHeading(heading, sourceFile) {
  /**
   * Tags extracted from heading patterns
   * Examples: "Key Projects" → "project", "How to Work with Matt" → "context"
   */
  const tagMap = {
    'projects': 'project',
    'context': 'context',
    'communication': 'communication',
    'writing': 'writing',
    'voice': 'voice',
    'work': 'work',
    'personal': 'personal',
    'health': 'health',
    'family': 'family',
    'money': 'finance',
    'insight': 'insight',
    'blocker': 'blocker',
    'win': 'win',
    'learning': 'learning'
  };

  const heading_lower = heading.toLowerCase();
  const detected = [];

  for (const [keyword, tag] of Object.entries(tagMap)) {
    if (heading_lower.includes(keyword)) {
      detected.push(tag);
    }
  }

  // Always tag daily files with "daily"
  if (!sourceFile.includes('MEMORY.md')) {
    detected.push('daily');
  }

  return detected;
}

async function initializeDatabase(db) {
  /**
   * Initialize database schema
   */
  try {
    const schemaPath = path.join(MEMORY_DIR, 'sqlite-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await db.exec(schema);
    console.log('✓ Database schema initialized');
  } catch (err) {
    console.error('Error initializing schema:', err);
    throw err;
  }
}

async function syncMemoryFile(db, filePath) {
  /**
   * Read a memory file and sync entries to database
   */
  try {
    const filename = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const timestamp = extractDate(filename);

    const entries = parseMemoryFile(content, filename);

    let syncedCount = 0;

    for (const entry of entries) {
      const memoryId = generateId();

      // Insert memory
      await db.run(
        `INSERT OR REPLACE INTO memories 
         (id, type, source_file, content, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [memoryId, entry.type, entry.sourceFile, entry.content, timestamp]
      );

      // Insert/link tags
      for (const tagName of entry.tags) {
        const tagId = await getOrCreateTag(db, tagName);
        await db.run(
          `INSERT OR IGNORE INTO memory_tags (memory_id, tag_id)
           VALUES (?, ?)`,
          [memoryId, tagId]
        );
      }

      syncedCount++;
    }

    console.log(`✓ Synced ${filename}: ${syncedCount} entries`);
    return syncedCount;

  } catch (err) {
    console.error(`Error syncing ${filePath}:`, err);
  }
}

async function getOrCreateTag(db, tagName) {
  /**
   * Get tag by name, or create if doesn't exist
   */
  let tag = await db.get(
    'SELECT id FROM tags WHERE name = ?',
    [tagName]
  );

  if (!tag) {
    const tagId = generateId();
    await db.run(
      `INSERT INTO tags (id, name, category)
       VALUES (?, ?, ?)`,
      [tagId, tagName, 'auto']
    );
    tag = { id: tagId };
  }

  return tag.id;
}

async function syncAllMemories(db) {
  /**
   * Find and sync all memory files in the directory
   */
  console.log('\n📚 Syncing all memory files...');

  const files = fs.readdirSync(MEMORY_DIR);
  const memoryFiles = [
    MEMORY_FILE, // MEMORY.md first
    ...files
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort()
      .reverse()
      .map(f => path.join(MEMORY_DIR, f))
  ].filter(f => fs.existsSync(f));

  let totalSynced = 0;
  for (const filePath of memoryFiles) {
    const count = await syncMemoryFile(db, filePath);
    if (count) totalSynced += count;
  }

  console.log(`\n✓ Sync complete: ${totalSynced} total entries\n`);
}

async function watchFiles(db) {
  /**
   * Watch for file changes and auto-sync
   */
  console.log('\n👁️  Watching for changes... (press Ctrl+C to stop)\n');

  const watcher = chokidar.watch([
    path.join(MEMORY_DIR, '*.md'),
    MEMORY_FILE
  ], {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100
    }
  });

  watcher.on('change', async (filePath) => {
    console.log(`📝 Change detected: ${path.basename(filePath)}`);
    await syncMemoryFile(db, filePath);
  });

  watcher.on('add', async (filePath) => {
    console.log(`➕ New file: ${path.basename(filePath)}`);
    await syncMemoryFile(db, filePath);
  });

  process.on('SIGINT', () => {
    console.log('\n\nClosing watcher...');
    watcher.close();
    process.exit(0);
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '--sync';

  const db = new MemoryDB(DB_PATH);

  try {
    if (command === '--init') {
      console.log('🔧 Initializing database...\n');
      await initializeDatabase(db);
      console.log('✓ Database initialized\n');
    }

    if (command === '--sync' || command === '--watch') {
      // Always ensure schema exists
      await initializeDatabase(db);
      await syncAllMemories(db);
    }

    if (command === '--watch') {
      await watchFiles(db);
    } else {
      await db.close();
      console.log('Done.');
    }

  } catch (err) {
    console.error('Fatal error:', err);
    await db.close();
    process.exit(1);
  }
}

main();
