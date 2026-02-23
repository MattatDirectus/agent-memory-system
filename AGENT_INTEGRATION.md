# Agent Integration Guide

How the OpenClaw agent will use the memory system to search and recall context.

## Overview

Every time the agent (Claude) is active, it can query the memory system to:
- Search for relevant past conversations
- Find related decisions or context
- Provide memory-grounded responses
- Build continuity across sessions

## Integration Point

The agent receives a **memory context hook** with every message that includes:

1. A 2-3 sentence reminder that memory search is available
2. A small list of potentially relevant memories (if any)
3. Instructions for how to search for more

Example reminder:
```
💾 Memory System Available: You can search across past conversations
and decisions. Use /memory search query to recall context. Current
relevant memory: "Feb 16 conversation about Directus AI strategy"
```

## Query API Integration

### Python Example (for agent)

```python
import requests
import json

MEMORY_API_BASE = "http://localhost:3333"

class MemoryClient:
    def __init__(self, base_url=MEMORY_API_BASE):
        self.base_url = base_url
    
    def search_memories(self, query, limit=10):
        """Search memory entries by keyword"""
        response = requests.post(
            f"{self.base_url}/search/memories",
            json={"q": query, "limit": limit}
        )
        return response.json() if response.ok else None
    
    def search_conversations(self, query, limit=10):
        """Search conversation history"""
        response = requests.post(
            f"{self.base_url}/search/conversations",
            json={"q": query, "limit": limit}
        )
        return response.json() if response.ok else None
    
    def search_combined(self, query, limit=20):
        """Search both memories and conversations together"""
        response = requests.post(
            f"{self.base_url}/search/combined",
            json={"q": query, "limit": limit}
        )
        return response.json() if response.ok else None
    
    def search_by_tag(self, tag, limit=50):
        """Find all memories with a specific tag"""
        response = requests.post(
            f"{self.base_url}/search/tag",
            json={"tag": tag, "limit": limit}
        )
        return response.json() if response.ok else None
    
    def get_memory(self, memory_id):
        """Get a specific memory with context"""
        response = requests.get(
            f"{self.base_url}/memories/{memory_id}"
        )
        return response.json() if response.ok else None
    
    def get_recent(self, limit=20, memory_type=None):
        """Get recent memories"""
        params = {"limit": limit}
        if memory_type:
            params["type"] = memory_type
        
        response = requests.get(
            f"{self.base_url}/memories/recent",
            params=params
        )
        return response.json() if response.ok else None
    
    def get_tags(self):
        """Get all available tags"""
        response = requests.get(f"{self.base_url}/tags")
        return response.json() if response.ok else None

# Usage examples
memory = MemoryClient()

# Search for Directus strategy memories
results = memory.search_memories("directus ai strategy", limit=5)
if results:
    for entry in results['results']:
        print(f"Found: {entry['source_file']}")
        print(f"Snippet: {entry['snippet']}")

# Search conversations about paid ads
convos = memory.search_conversations("paid ads", limit=3)

# Combined search
all_results = memory.search_combined("two am tv", limit=20)

# Get all project memories
projects = memory.search_by_tag("project", limit=50)

# Get a specific memory
memory_detail = memory.get_memory("memory_id_123")

# Get recent daily memories
recent = memory.get_recent(limit=20, memory_type="daily")

# Get all tags
all_tags = memory.get_tags()
```

### JavaScript Example (for Node.js agent)

```javascript
const fetch = require('node-fetch');

class MemoryClient {
  constructor(baseUrl = 'http://localhost:3333') {
    this.baseUrl = baseUrl;
  }

  async searchMemories(query, limit = 10) {
    const response = await fetch(`${this.baseUrl}/search/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, limit })
    });
    return response.json();
  }

  async searchConversations(query, limit = 10) {
    const response = await fetch(`${this.baseUrl}/search/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, limit })
    });
    return response.json();
  }

  async searchCombined(query, limit = 20) {
    const response = await fetch(`${this.baseUrl}/search/combined`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, limit })
    });
    return response.json();
  }

  async searchByTag(tag, limit = 50) {
    const response = await fetch(`${this.baseUrl}/search/tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, limit })
    });
    return response.json();
  }

  async getMemory(memoryId) {
    const response = await fetch(`${this.baseUrl}/memories/${memoryId}`);
    return response.json();
  }

  async getRecent(limit = 20, type = null) {
    const params = new URLSearchParams({ limit });
    if (type) params.append('type', type);
    
    const response = await fetch(
      `${this.baseUrl}/memories/recent?${params}`
    );
    return response.json();
  }

  async getTags() {
    const response = await fetch(`${this.baseUrl}/tags`);
    return response.json();
  }
}

// Usage
const memory = new MemoryClient();

// Search for project memories
memory.searchMemories('directus roadmap').then(results => {
  console.log(`Found ${results.count} entries`);
  results.results.forEach(entry => {
    console.log(`- ${entry.source_file}: ${entry.snippet}`);
  });
});

// Search conversations about specific topic
memory.searchConversations('paid ads strategy').then(results => {
  results.results.forEach(conv => {
    console.log(`${conv.date}: ${conv.snippet}`);
  });
});

// Get all memories with "project" tag
memory.searchByTag('project').then(results => {
  console.log(`Found ${results.count} projects`);
});
```

### cURL Examples

```bash
# Health check
curl http://localhost:3333/health

# Search memories
curl -X POST http://localhost:3333/search/memories \
  -H "Content-Type: application/json" \
  -d '{"q": "directus strategy", "limit": 5}'

# Search conversations
curl -X POST http://localhost:3333/search/conversations \
  -H "Content-Type: application/json" \
  -d '{"q": "paid ads", "limit": 10}'

# Combined search
curl -X POST http://localhost:3333/search/combined \
  -H "Content-Type: application/json" \
  -d '{"q": "two am tv", "limit": 20}'

# Search by tag
curl -X POST http://localhost:3333/search/tag \
  -H "Content-Type: application/json" \
  -d '{"tag": "project"}'

# Get recent memories
curl "http://localhost:3333/memories/recent?limit=20&type=daily"

# Get a specific memory
curl "http://localhost:3333/memories/MEMORY_ID"

# Get all tags
curl http://localhost:3333/tags
```

## Agent Behavior

### How the Agent Uses Memory

1. **On Session Start**
   - Agent reads MEMORY.md to understand Matt and context
   - Optionally queries recent memories for quick warmup
   - Sets up memory search capability

2. **During Conversation**
   - When Matt mentions something specific, agent can search
   - When responding with decisions, agent can check past decisions
   - When unsure about context, agent can search for clarification

3. **Making Recommendations**
   - Agent searches for related past ideas or attempts
   - Avoids repeating suggestions that didn't work
   - Builds on successful patterns

4. **End of Session**
   - Agent can optionally summarize important decisions
   - These get written to daily memory file
   - Sync service auto-imports to database

### Example: Agent Helping with Directus Decision

**Matt asks:** "Should we go with the paid ads strategy for Directus?"

**Agent flow:**
1. Search for past Directus strategy decisions
2. Find: "Feb 16 conversation about infrastructure vs. features"
3. Find: "Multiple paid ads attempts, no clear wins yet"
4. Search for: "What channels are currently working"
5. Find: "Inbound 99% of pipeline, paid only ~1%"
6. Provide recommendation grounded in past context

**Response includes:** "Based on our Feb 16 notes, you've tried paid ads multiple times without traction. Current data shows inbound is 99% effective. However, if you want to crack paid, we should first nail down the ICP you discussed on [date]..."

### Error Handling

```python
# If memory API is unavailable
def safe_search(query):
    try:
        results = memory.search_memories(query)
        if results and results['count'] > 0:
            return results['results'][:3]  # Top 3 matches
    except Exception as e:
        print(f"Memory search failed: {e}")
        return None  # Gracefully degrade
    return []

# Agent can function without memory, but with reduced context
if memory_results:
    response = f"Relevant memory: {memory_results[0]['snippet']}. " + response
else:
    response = response  # Just use normal response
```

## Monitoring

### Check API Health

```bash
# Is API running?
curl http://localhost:3333/health

# Is sync service running?
ps aux | grep sync-service

# How many memories?
sqlite3 ./memory.db \
  "SELECT COUNT(*) FROM memories;"

# How many tags?
sqlite3 ./memory.db \
  "SELECT COUNT(*) FROM tags;"
```

### Debug Searches

```bash
# Why didn't this search return results?
sqlite3 ./memory.db
sqlite> SELECT * FROM memories WHERE content LIKE '%search_term%' LIMIT 5;

# Check if memory was actually synced
sqlite> SELECT source_file, COUNT(*) FROM memories GROUP BY source_file;

# Verify FTS index is built
sqlite> SELECT COUNT(*) FROM memories_fts;
```

## Performance Expectations

- **Simple search** (1-2 words): ~50ms
- **Complex query** (phrase or multi-word): ~100-150ms
- **Tag filter**: ~30-50ms
- **Combined search** (memories + conversations): ~150ms

All well under 500ms. If slower, likely means database needs indexing refresh:

```bash
sqlite3 memory.db "VACUUM; ANALYZE;"
```

## Future Enhancements

Potential improvements as the system matures:

1. **Automatic relevance ranking** - AI scores which memories are most relevant
2. **Conversation snippets** - Extract key insights from long conversations
3. **Weekly digests** - Auto-summarize week's decisions
4. **Memory decay** - Older memories show up less in searches
5. **Related memories** - "Similar to this memory..." suggestions
6. **Multi-agent memories** - If other agents need to access same system
7. **Memory export** - One-click backup to cloud

---

## Testing Integration

Quick test to verify everything works:

```bash
# 1. Start memory system
npm start  # (in memory/ directory)

# 2. Health check
curl http://localhost:3333/health
# Should return status: ok

# 3. Check recent memories
curl http://localhost:3333/memories/recent?limit=5
# Should return recent entries

# 4. Test search
curl -X POST http://localhost:3333/search/memories \
  -H "Content-Type: application/json" \
  -d '{"q": "directus", "limit": 3}'
# Should return matching memories

# 5. Integration ready!
```

---

See `MEMORY_SYSTEM.md` for full API reference and architecture details.
