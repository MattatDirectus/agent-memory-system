# Agent Memory System

Local SQLite + Directus memory layer for AI agents (Claude, OpenClaw, etc).

## What It Does

Your AI agent can now remember past conversations, decisions, and context. Fully self-hosted, no vendor lock-in.

- **SQLite** - Ultra-fast indexed search (<500ms on thousands of memories)
- **Directus** - Beautiful dashboard to browse, tag, and organize memories
- **Sync service** - Auto-imports your conversation logs and memory files
- **REST API** - Agent can search memories programmatically

## Quick Start

One command to set up everything:

```bash
npm run setup
```

This handles:
- ✓ Installing dependencies
- ✓ Creating SQLite database
- ✓ Initializing schema
- ✓ Setting up Directus UI
- ✓ Starting sync service + API + Directus

Done! You'll get three URLs:
- **Query API:** `http://localhost:3333`
- **Directus Dashboard:** `http://localhost:8055`
- **Health Check:** `http://localhost:3333/health`

**Want to do it step-by-step instead?** See [QUICKSTART.md](./QUICKSTART.md)

## Full Documentation

- **[SETUP_WIZARD.md](./SETUP_WIZARD.md)** - What the wizard does + troubleshooting
- **[QUICKSTART.md](./QUICKSTART.md)** - Manual step-by-step setup (if you prefer)
- **[MEMORY_SYSTEM.md](./MEMORY_SYSTEM.md)** - Complete architecture & API reference
- **[DIRECTUS_SETUP.md](./DIRECTUS_SETUP.md)** - Web UI setup (optional)
- **[AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md)** - How to use it in your agent
- **[SETUP_PROMPT.md](./SETUP_PROMPT.md)** - Paste into Claude to auto-setup

## How It Works

```
Your memory files (MEMORY.md + daily logs)
         ↓
     Sync service (watches for changes)
         ↓
     SQLite database (indexed, fast)
         ↓
     ┌─────────────────────────────┐
     │  Query API (localhost:3333)  │
     │  Directus UI (localhost:8055)│
     └─────────────────────────────┘
         ↓
     Agent searches + Human browsing
```

## Use Cases

### Agent

```python
# Search for past decisions
POST /search/memories
{"q": "directus roadmap", "limit": 5}

# Get memory with context
GET /memories/MEMORY_ID
```

### You

- Open Directus dashboard (`http://localhost:8055`)
- Browse all memories with timeline view
- Tag and organize by project/person/context
- Export/backup

## Features

- ✅ Auto-sync MEMORY.md + daily logs
- ✅ Full-text search (FTS5 indexed)
- ✅ <500ms queries on 50k+ memories
- ✅ RBAC via Directus (team/co-worker access control)
- ✅ Self-hosted (no vendor lock-in)
- ✅ Tag-based organization
- ✅ Snippet extraction with context
- ✅ Health checks and monitoring

## Tech Stack

- Node.js (16+)
- SQLite 3 (built-in, no server)
- Express.js (REST API)
- Directus (optional UI)

Everything runs locally on your machine.

## Performance

| Query | Time |
|-------|------|
| Simple search | ~50ms |
| Complex search | ~100-150ms |
| Tag filter | ~30ms |

## License

MIT

## Contributing

This is open source. Issues and PRs welcome.

## Questions?

See the docs linked above, or open an issue.

---

**Built to be the collaborative memory layer for humans and agents.** 🧠
