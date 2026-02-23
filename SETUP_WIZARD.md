# Setup Wizard Documentation

## What Is It?

The **Setup Wizard** (`setup.js`) is a one-command initialization script that handles everything needed to get the Agent Memory System running locally—including Directus!

Instead of running 8-10 different commands manually (checking versions, installing dependencies, initializing databases, creating Directus, starting services), you run just one:

```bash
npm run setup
```

The wizard:
- ✅ Checks your Node.js version
- ✅ Installs dependencies
- ✅ Creates the SQLite database
- ✅ Initializes the database schema
- ✅ Runs initial sync
- ✅ **Creates and configures Directus project**
- ✅ **Starts all services (sync service + API + Directus)**
- ✅ Shows you the URLs to use

## How It Works

### Step-by-Step

```
1. Node.js Check
   └─ Ensures you have Node.js 16+

2. Dependencies Check
   └─ Installs npm packages if missing

3. Database Setup
   └─ Creates memory.db (SQLite)
   └─ Initializes tables from sqlite-schema.sql

4. Initial Sync
   └─ Imports any existing MEMORY.md files

5. Directus Setup
   └─ Creates directus-project/ folder
   └─ Configures .env to use memory.db
   └─ Generates admin credentials
   └─ Installs Directus dependencies

6. Service Startup
   └─ Starts Sync Service (watches for file changes)
   └─ Starts Query API (localhost:3333)
   └─ Starts Directus UI (localhost:8055)

7. Health Check
   └─ Verifies all services are running

8. Success!
   └─ Shows you all three URLs and next steps
```

### What Gets Created

**Files:**
- `memory.db` - SQLite database (in the repo root)
- `directus-project/` - (Optional) Directus project folder

**Services:**
- **Sync Service** - Watches your memory files for changes
- **Query API** - Runs on `http://localhost:3333`

## Usage

### First Time Setup

```bash
# Clone the repo
git clone <repo-url>
cd agent-memory-system

# One command to set everything up
npm run setup
```

That's it! Both services will start and display their URLs.

### On a New Machine

Same command works on any machine (macOS, Linux, Windows with WSL):

```bash
git clone <repo-url>
cd agent-memory-system
npm run setup
```

The wizard detects what's already there and skips unnecessary steps.

### Subsequent Runs

If you want to just start the services (after setup):

```bash
npm start
```

This runs both the sync service and API without the wizard checks.

## What Each Component Does

### Sync Service (`sync-service.js`)

Watches for changes to your memory files:
- Detects new/modified `MEMORY.md`
- Detects new/modified `memory/*.md` files (daily logs)
- Automatically imports them into SQLite
- Runs in background, listening for file changes

Started by wizard with: `node sync-service.js --watch`

### Query API (`query-api.js`)

Provides REST endpoints for searching memories:
- `POST /search/memories` - Full-text search
- `POST /search/conversations` - Search chat logs
- `GET /memories/recent` - Get latest entries
- `GET /tags` - List all tags
- `GET /health` - Health check

Started by wizard with: `node query-api.js` (PORT=3333)

### Directus Dashboard (`directus-project/`)

A beautiful, powerful web UI for browsing, organizing, and managing your memories.

**Features:**
- Browse all memories in a searchable, sortable grid
- View conversations and sessions
- Tag and organize memories
- Create custom views and dashboards
- Full REST API for automation
- User roles and permissions (if you want to share)

Automatically set up by the wizard at:
- **Location:** `./directus-project/` folder
- **Database:** Connected to `memory.db` (SQLite)
- **Admin Credentials:** Auto-generated (saved in `.env`)
- **URL:** `http://localhost:8055`

Started by wizard with: `npm start` (from directus-project directory)

If Directus setup fails, it's optional—you can still use the Query API. But we recommend getting it running for the best experience!

## Environment

The wizard sets up these defaults:

| Setting | Value |
|---------|-------|
| Node.js Version | 16+ |
| SQLite Location | `./memory.db` |
| Sync Service | Watches `./` and `./memory/` |
| Query API Port | `3333` |
| Directus Port | `8055` |
| Directus Folder | `./directus-project` |
| Directus Database | `memory.db` (SQLite) |
| Admin Email | `admin@memory-system.local` |
| Admin Password | Auto-generated (in `.env`) |

## Troubleshooting

### "Command not found: node"

Your Node.js installation isn't in your PATH. Install from https://nodejs.org

### "npm: permission denied"

You might need to use `sudo npm` or fix npm permissions. See npm docs.

### "Port 3333 already in use"

Something else is using port 3333. Either:
1. Stop the other service
2. Change the port: `PORT=4444 npm run api`

### "sqlite3 install fails"

This usually means you need build tools. On macOS:
```bash
xcode-select --install
npm install
```

### "Database locked"

You have two instances of the sync service running. Kill the extra:
```bash
ps aux | grep sync-service
kill <PID>
```

### Setup hangs or seems frozen

The wizard may be waiting for ports to become available. Give it ~30 seconds. If it still hangs, press `Ctrl+C` and try again.

## Advanced Usage

### Manual Steps (If You Prefer)

You can skip the wizard and do things step-by-step:

```bash
# Install dependencies
npm install

# Initialize database
npm run init

# Sync memories
npm run sync

# Start services
npm start
```

### Check Database Manually

```bash
# Install sqlite3 CLI if needed (macOS)
brew install sqlite3

# Connect to database
sqlite3 memory.db

# See what tables exist
.tables

# Count memories
SELECT COUNT(*) FROM memories;

# Exit
.quit
```

### View Service Logs

The wizard streams service logs to console by default. To capture them:

```bash
npm run setup > setup.log 2>&1 &
tail -f setup.log
```

## Customization

### Change Ports

Edit `setup.js` to change default ports:

```javascript
const DIRECTUS_PORT = 8055;  // Change this
const API_PORT = 3333;       // Or this
```

Then rebuild: `npm run setup`

### Add More Services

Edit `setup.js` to add services to the startup sequence. For example, to add Directus auto-setup:

```javascript
// In the main() function, uncomment:
// await startService('Directus', ...)
```

### Disable Color Output

For CI/CD environments, you can modify setup.js to disable colors:

```javascript
// Comment out color codes:
// const colors = { ... }
```

## What Happens If Setup Fails?

The wizard has error handling:

1. **Missing dependencies** → Runs `npm install`
2. **Database creation fails** → Exits with error message
3. **Port already in use** → Warns but continues (services might not start)
4. **Schema loading fails** → Exits with helpful error

In all cases, you'll get a clear error message explaining what went wrong.

## First Run Expectations

### Time

- First time: **2-5 minutes** (includes Directus install and setup)
  - Node dependency install: ~30-60s
  - Directus project creation: ~60-90s
  - Service startup: ~10-30s
- Subsequent runs: **~10-15 seconds** (just starts services)

### Output

You'll see progress like:

```
┌────────────────────────────────────────────────────────────┐
│        🧠  Agent Memory System - Setup Wizard  🧠          │
│                                                            │
│  SQLite + Directus • One Command to Rule Them All         │
│                                                            │
└────────────────────────────────────────────────────────────┘

[1] Checking Node.js version...
✓ Node.js v18.17.0

[2] Checking dependencies...
✓ All dependencies installed

[3] Setting up SQLite database...
✓ Database created at ./memory.db
✓ Database schema initialized

[4] Running initial sync...
✓ Initial sync completed
ℹ Found 0 memory entries

[5] Setting up Directus dashboard...
ℹ Creating Directus project at ./directus-project...
✓ Directus project created
✓ Directus configured to use memory.db
✓ Created .env with admin credentials

[6] Starting services...

ℹ Starting Sync Service...
✓ Sync Service started (PID: 12345)

ℹ Starting Query API...
✓ Query API started (PID: 12346)

ℹ Starting Directus Dashboard...
✓ Directus Dashboard started (PID: 12347)

[7] Waiting for services to be ready...
✓ Query API is ready
✓ Directus is ready

╔════════════════════════════════════════════════════════════╗
║     🎉  Agent Memory System is Ready!  🎉                 ║
╚════════════════════════════════════════════════════════════╝

Services Running:
  ✓ Sync Service - Watches for memory file changes
  ✓ Query API - Search memories and conversations
  ✓ Directus UI - Browse and manage memories

Access Your System:
  • Query API: http://localhost:3333
  • Health Check: http://localhost:3333/health
  • Directus Dashboard: http://localhost:8055

Next Steps:
  1. Test the API:
     curl http://localhost:3333/health

  2. Search for memories:
     curl -X POST http://localhost:3333/search/memories \
       -H "Content-Type: application/json" \
       -d '{"q": "test", "limit": 5}'

  3. Open Directus in your browser:
     http://localhost:8055

═══════════════════════════════════════════════════════════
Setup complete! Services are running. Press Ctrl+C to stop.
═══════════════════════════════════════════════════════════
```

## Why This Approach?

### Problems We Solved

**Before (Old Way):**
```
npm install
npm run init
npm run sync
npm run api &
npm run watch &
# Confusing. Did both start? Where are the logs?
```

**After (One Command):**
```
npm run setup
# Everything set up and running. Clear feedback.
```

### Design Principles

1. **Zero Configuration** - Just run the command, nothing to edit
2. **Clear Feedback** - See exactly what's happening
3. **Error Recovery** - Detect issues and fix them automatically
4. **Idempotent** - Safe to run multiple times
5. **Non-Technical Friendly** - Explanations, not jargon

## For Sharing (LinkedIn, etc.)

You can share the setup experience like this:

> "With just one command, anyone can set up a local AI agent memory system that combines SQLite for fast search and Directus for beautiful browsing:"
>
> ```bash
> npm run setup
> ```
>
> No Docker, no manual config, no waiting. Everything is self-hosted on your machine. ✨

## Next Reading

- **README.md** - Overview of the entire system
- **QUICKSTART.md** - Detailed step-by-step (if you prefer manual setup)
- **MEMORY_SYSTEM.md** - Complete API documentation
- **DIRECTUS_SETUP.md** - Setting up the optional UI dashboard

---

**That's the Setup Wizard!** 🚀

It's designed to make getting started as frictionless as possible, whether you're technical or not.
