# Agent Memory System - Quick Start

Get everything running in seconds.

## The Easy Way (Recommended)

One command sets everything up:

```bash
npm run setup
```

That's it! The sync service, API, and Directus will start automatically. You'll see:

```
✓ Node.js v18.17.0
✓ All dependencies installed
✓ Database schema initialized
✓ Initial sync completed
✓ Directus configured and started

🎉  Agent Memory System is Ready!

Services Running:
  ✓ Sync Service - Watches for memory file changes
  ✓ Query API - Search memories and conversations
  ✓ Directus UI - Browse and manage memories

Access Your System:
  • Query API: http://localhost:3333
  • Directus Dashboard: http://localhost:8055
```

You can now:
1. Use the **API** programmatically: `http://localhost:3333`
2. Browse **Directus** in your browser: `http://localhost:8055`

Press `Ctrl+C` to stop services.

---

## The Step-by-Step Way (If You Prefer)

If you'd rather understand each step, here's how to do it manually.

### Prerequisites

- Node.js 16+ (`node --version`)
- npm 8+ (`npm --version`)
- SQLite 3 (pre-installed on macOS/Linux)

### Step 1: Install Dependencies

```bash
npm install
```

This installs: sqlite3, express, cors, chokidar (~50MB)

### Step 2: Initialize Database

Create the database and schema:

```bash
npm run init
```

You'll see:
```
✓ Connected to SQLite database: /path/to/memory.db
✓ Database schema initialized
```

### Step 3: Sync Existing Memories

Import all your MEMORY.md and daily logs into SQLite:

```bash
npm run sync
```

Output:
```
📚 Syncing all memory files...
✓ Synced MEMORY.md: 8 entries
✓ Synced 2026-02-16.md: 5 entries
✓ Synced 2026-02-11.md: 7 entries
✓ Sync complete: 20 total entries
```

This reads:
- `./MEMORY.md` (in your workspace)
- `./memory/*.md` (daily logs)

Parses sections, auto-tags based on headings, stores in SQLite.

### Step 4: Start Services

Run both sync watcher and API server:

```bash
npm start
```

You'll see:
```
✓ Connected to SQLite database
👁️  Watching for changes... (press Ctrl+C to stop)

🧠 Memory API running on port 3333
📖 Database: /path/to/memory.db

📚 Available endpoints:
   POST /search/memories - Search memories
   POST /search/conversations - Search conversations
   POST /search/combined - Search everything
   POST /search/tag - Search by tag
   GET  /memories/recent - Get recent entries
   GET  /memories/:id - Get single memory
   GET  /tags - List all tags
   GET  /health - Health check
```

This runs:
- **Sync service** in watch mode (auto-updates when files change)
- **Query API** on http://localhost:3333

---

## Testing It Works

### Health Check

```bash
curl http://localhost:3333/health
```

Response:
```json
{
  "status": "ok",
  "database": "/path/to/memory.db",
  "timestamp": "2026-02-22T14:33:00Z"
}
```

### Search Memories

```bash
curl -X POST http://localhost:3333/search/memories \
  -H "Content-Type: application/json" \
  -d '{"q": "directus", "limit": 5}'
```

Returns matching memories with snippets.

### Get Recent

```bash
curl http://localhost:3333/memories/recent?limit=10
```

### Get All Tags

```bash
curl http://localhost:3333/tags
```

---

## Daily Workflow

You don't need to do anything special. The system works like this:

1. **Write normally** - Update MEMORY.md and daily logs as usual
2. **Auto-sync** - Sync service detects changes and updates database
3. **Agent can search** - Next time agent needs a memory, Query API has it
4. **Optional browsing** - Open Directus to browse/tag memories

## File Changes

**When you edit files:**
- `MEMORY.md` → Sync service detects, imports sections into `memories` table
- `memory/2026-02-XX.md` → Auto-detected and synced

**Tags are auto-extracted** from heading names:
- `## Key Projects` → "project" tag
- `## How to Work with Matt` → "context", "communication" tags
- `## Recent Wins` → "win" tag

---

## Directus Dashboard

**Directus is now automatically set up!** 🎉

It's already running at `http://localhost:8055` as part of `npm run setup`.

**Your First Time in Directus:**

1. Open `http://localhost:8055` in your browser
2. Login with credentials (auto-generated in `directus-project/.env`)
3. You'll see the Data tab with your SQLite tables:
   - `memories` - Your long-term and daily memories
   - `conversations` - Chat logs from sessions
   - `tags` - Tags for organizing
   - `sessions` - Conversation sessions
   - `snippets` - Important conversation excerpts

4. Click on **Collections** → **Memories** to browse your memory database

For detailed configuration and advanced features, see [DIRECTUS_SETUP.md](./DIRECTUS_SETUP.md).

---

## Troubleshooting

### "Cannot find module 'sqlite3'"

```bash
npm install
```

### "Database locked"

Already running sync in another terminal?
```bash
ps aux | grep node
kill <PID>
```

Then try again.

### No memories found?

Ensure sync ran successfully:
```bash
sqlite3 memory.db
sqlite> SELECT COUNT(*) FROM memories;
```

If 0, run: `npm run sync`

### API not responding?

Check it's running:
```bash
curl http://localhost:3333/health
```

If not, restart: Ctrl+C and then `npm start`

### Port already in use?

Something else is using port 3333:
```bash
# Find what's using it
lsof -i :3333

# Kill the process
kill -9 <PID>
```

Or use a different port:
```bash
PORT=4444 npm run api
```

---

## Keep It Running

### Option 1: Development Mode

```bash
npm start
```

Runs in foreground. Stop with Ctrl+C.

### Option 2: Background Service

**macOS (launchd):**
```bash
cat > ~/Library/LaunchAgents/com.memory-system.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.memory-system</string>
  <key>ProgramArguments</key>
  <array>
    <string>npm</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/path/to/agent-memory-system</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.memory-system.plist
```

**Linux (systemd):**
```bash
sudo nano /etc/systemd/system/memory-system.service
```

```ini
[Unit]
Description=Memory System Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/path/to/agent-memory-system
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable memory-system
sudo systemctl start memory-system
sudo systemctl status memory-system
```

---

## Next Steps

- **Full system docs:** [MEMORY_SYSTEM.md](./MEMORY_SYSTEM.md)
- **Wizard explanation:** [SETUP_WIZARD.md](./SETUP_WIZARD.md)
- **Directus UI:** [DIRECTUS_SETUP.md](./DIRECTUS_SETUP.md)
- **Agent integration:** [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md)

---

**Ready?** Run `npm run setup` and start using your agent memory! 🧠
