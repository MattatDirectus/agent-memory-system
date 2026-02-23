# Directus Setup Guide - Memory System

This guide walks through setting up Directus to provide a beautiful dashboard for browsing, searching, and managing memories.

## Quick Start

### Option 1: Docker (Recommended for Development)

```bash
# Create directus project
npx create-directus-project memory-system

# Navigate to project
cd memory-system

# Start Directus
npm run dev
```

This starts Directus on `http://localhost:8055` with SQLite support built-in.

### Option 2: Using Existing Directus Instance

If you have a Directus instance running elsewhere, you can connect to the memory SQLite database by:

1. Creating a symlink to the memory.db
2. Or configuring a database connection in Directus settings

## Configuration

### 1. Database Connection

Directus needs to connect to the SQLite memory database at:
```
/path/to/workspace/memory/memory.db
```

**Option A: Docker Volume Mount**
```yaml
# docker-compose.override.yml
services:
  directus:
    volumes:
      - /path/to/workspace/memory:/app/memory
    environment:
      DB_CLIENT: sqlite3
      DB_FILENAME: /app/memory/memory.db
```

**Option B: Existing Directus Instance**

In Directus Admin Settings → Data Model → Database:
- Set connection to SQLite
- Point to the memory.db file

### 2. Import Collections

Directus automatically discovers SQLite tables. Ensure these tables exist:

- `conversations` - All conversation messages
- `sessions` - Conversation sessions
- `memories` - Long-term and daily memories
- `tags` - Tag definitions
- `memory_tags` - Memory-to-tag associations
- `snippets` - Context-rich conversation excerpts

If tables don't appear, click "Sync with Database" in Admin Settings.

### 3. Configure Collections in Directus UI

For each collection, configure the fields and display settings:

#### Memories Collection

```javascript
{
  "collection": "memories",
  "fields": [
    {
      "field": "id",
      "type": "string",
      "schema": { "is_primary_key": true },
      "readonly": true
    },
    {
      "field": "type",
      "type": "string",
      "interface": "select-dropdown",
      "options": { "choices": [
        { "text": "Long-term", "value": "long_term" },
        { "text": "Daily", "value": "daily" },
        { "text": "Tagged", "value": "tagged" }
      ]}
    },
    {
      "field": "content",
      "type": "text",
      "interface": "input-rich-text-html"
    },
    {
      "field": "source_file",
      "type": "string",
      "readonly": true
    },
    {
      "field": "tags",
      "type": "string",
      "interface": "tags"
    },
    {
      "field": "timestamp",
      "type": "integer",
      "readonly": true
    },
    {
      "field": "created_at",
      "type": "timestamp",
      "readonly": true
    },
    {
      "field": "updated_at",
      "type": "timestamp",
      "readonly": true
    }
  ]
}
```

#### Conversations Collection

```javascript
{
  "collection": "conversations",
  "fields": [
    {
      "field": "id",
      "type": "string",
      "schema": { "is_primary_key": true },
      "readonly": true
    },
    {
      "field": "session_id",
      "type": "string",
      "interface": "input",
      "readonly": true
    },
    {
      "field": "timestamp",
      "type": "integer",
      "readonly": true
    },
    {
      "field": "message_text",
      "type": "text",
      "interface": "input-multiline"
    },
    {
      "field": "user_role",
      "type": "string",
      "interface": "select-dropdown",
      "options": { "choices": [
        { "text": "User", "value": "user" },
        { "text": "Assistant", "value": "assistant" }
      ]}
    },
    {
      "field": "channel",
      "type": "string",
      "interface": "select-dropdown",
      "options": { "choices": [
        { "text": "Telegram", "value": "telegram" },
        { "text": "Discord", "value": "discord" },
        { "text": "Email", "value": "email" }
      ]}
    }
  ]
}
```

#### Tags Collection

```javascript
{
  "collection": "tags",
  "fields": [
    {
      "field": "id",
      "type": "string",
      "schema": { "is_primary_key": true },
      "readonly": true
    },
    {
      "field": "name",
      "type": "string",
      "interface": "input"
    },
    {
      "field": "category",
      "type": "string",
      "interface": "select-dropdown",
      "options": { "choices": [
        { "text": "Project", "value": "project" },
        { "text": "Person", "value": "person" },
        { "text": "Context", "value": "context" },
        { "text": "Emotion", "value": "emotion" },
        { "text": "Auto", "value": "auto" }
      ]}
    },
    {
      "field": "color",
      "type": "string",
      "interface": "input-color"
    }
  ]
}
```

### 4. Create Views (Dashboards)

Create custom views in Directus to display memories:

#### "All Memories" View
- Display: Grid with thumbnails
- Sort: By `updated_at` DESC
- Filter: Show all types

#### "Recent Daily Memories" View
- Display: Cards
- Filter: `type = 'daily'`
- Sort: By `timestamp` DESC
- Limit: 50

#### "Long-term Memory" View
- Display: Table
- Filter: `type = 'long_term'`
- Sort: By `updated_at` DESC
- Columns: ID, Type, Content (preview), Tags, Updated_at

#### "Timeline" View
- Display: Timeline (if available)
- Group by: `timestamp`
- Show: Both memories and conversations
- Sort: DESC

#### "Tags Cloud" View
- Use the `tags` collection
- Display: Tag browser showing memory count per tag

### 5. Create Search Interface

Create a custom search form using Directus Extensions:

**Search Form Extension** (for Directus):
```javascript
// extensions/modules/search-memories/index.ts
import { defineModule } from '@directus/extensions-sdk';

export default defineModule({
  id: 'search-memories',
  name: 'Memory Search',
  routes: [
    {
      path: '',
      component: () => import('./views/search.vue')
    }
  ]
});
```

The search module connects to the Query API (`/search/combined` endpoint) to run fast searches across all memories and conversations.

### 6. User Roles & Permissions

Create a role for memory management:

```javascript
{
  "role": "memory_curator",
  "permissions": [
    {
      "collection": "memories",
      "action": "read",
      "fields": ["*"]
    },
    {
      "collection": "memories",
      "action": "update",
      "fields": ["tags", "content"]
    },
    {
      "collection": "memories",
      "action": "delete"
    },
    {
      "collection": "tags",
      "action": "read"
    },
    {
      "collection": "conversations",
      "action": "read",
      "fields": ["*"]
    }
  ]
}
```

## API Endpoints in Directus

Directus automatically exposes REST APIs for all collections:

```bash
# Get all memories
GET /api/items/memories?limit=100&sort=-timestamp

# Search memories (Directus full-text search)
GET /api/items/memories?filter[content][_contains]=search_term

# Get a memory with related tags
GET /api/items/memories/MEMORY_ID?fields=*.*

# Update a memory
PATCH /api/items/memories/MEMORY_ID
Content-Type: application/json

{
  "tags": "project,work,decision",
  "content": "Updated memory content"
}

# Get all tags with counts
GET /api/items/tags

# Get memories by tag
GET /api/items/memory_tags?filter[tag_id][_eq]=TAG_ID&fields=memory_id.*.*
```

## Sync with Query API

While Directus provides native UI, the Query API (`query-api.js`) offers:

1. **Faster searches** - FTS5 indexed full-text search
2. **Relevance ranking** - Returns results ordered by relevance
3. **Combined search** - Searches memories and conversations together
4. **JSON API** - Easy for programmatic access

They work together:
- **Query API** → Ultra-fast searches for the agent
- **Directus UI** → Beautiful browsing and curation for Matt

## Environment Variables

Create a `.env` file in the Directus project:

```bash
# Database
DB_CLIENT=sqlite3
DB_FILENAME=/path/to/workspace/memory/memory.db

# Admin
ADMIN_EMAIL=matt@example.com
ADMIN_PASSWORD=secure_password_here
PUBLIC_URL=http://localhost:8055

# Security
KEY=your_secret_key
SECRET=your_secret

# API
REST_QUERY_LIMIT_DEFAULT=100
REST_QUERY_LIMIT_MAX=1000
```

## Deployment

### Local Development
```bash
npm run dev
# Opens http://localhost:8055
```

### Production (Docker)
```bash
docker compose up -d
```

### Cloud Deployment

Directus can be deployed to:
- **Vercel** (with external database)
- **Railway**
- **Heroku**
- **AWS/DigitalOcean** (self-hosted Docker)

For this setup, recommend self-hosted so the memory.db stays local on Matt's machine.

## Backup & Export

Directus has built-in backup features:

1. **Admin Panel** → Settings → Data Backup
2. **Export Collections** as CSV/JSON

Or use SQLite directly:
```bash
# Backup memory database
cp /path/to/workspace/memory/memory.db \
   /path/to/workspace/memory/memory.db.backup

# Export as JSON
sqlite3 memory.db ".mode json" ".output memories.json" "SELECT * FROM memories;"
```

## Troubleshooting

### Tables Not Appearing
1. Go to Admin Settings
2. Click "Sync with Database"
3. Tables should auto-populate

### Search Not Working
1. Ensure sync-service.js has run (`npm run sync`)
2. Check that memories are in the database: `sqlite3 memory.db "SELECT COUNT(*) FROM memories;"`
3. Verify FTS indexes exist: `sqlite3 memory.db "SELECT * FROM sqlite_master WHERE type='table' AND name LIKE '%fts%';"`

### Performance Issues
1. Check indexes: `sqlite3 memory.db ".indices"`
2. Run VACUUM: `sqlite3 memory.db "VACUUM;"`
3. Rebuild FTS: `sqlite3 memory.db "INSERT INTO memories_fts(rowid, message_text) SELECT rowid, content FROM memories;"`

## Next Steps

1. Install Directus locally
2. Run: `npm install` in memory/ directory
3. Run: `npm run sync` to populate database
4. Start Directus: `npm run dev`
5. Access at http://localhost:8055
6. Create views as described above
7. Configure the Query API for agent access

See `MEMORY_SYSTEM.md` for complete architecture.
