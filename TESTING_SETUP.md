# Testing the Setup Wizard - Directus Integration

This guide documents how to test the updated setup wizard with full Directus integration.

## Test Scenarios

### Scenario 1: Fresh Clone (First Time)

**Goal:** Verify that `npm run setup` works on a fresh installation with Directus

**Steps:**

1. **Start fresh** (simulate new machine):
   ```bash
   cd /tmp
   rm -rf agent-memory-system-test
   git clone <repo-url> agent-memory-system-test
   cd agent-memory-system-test
   ```

2. **Run setup:**
   ```bash
   npm run setup
   ```

3. **Verify output includes all three services:**
   - ✓ Node.js version
   - ✓ Dependencies installed
   - ✓ SQLite database created
   - ✓ Initial sync completed
   - ✓ Directus project created
   - ✓ Sync Service started
   - ✓ Query API started
   - ✓ Directus Dashboard started

4. **Test Query API:**
   ```bash
   curl http://localhost:3333/health
   ```
   Should respond with status 200 and JSON health info

5. **Test Directus:**
   - Open browser to `http://localhost:8055`
   - Should see Directus login page
   - Check that `.env` exists in `directus-project/` with admin credentials

6. **Verify database connection:**
   - Login to Directus with auto-generated credentials (from `directus-project/.env`)
   - Go to **Data** tab
   - Should see SQLite tables: `memories`, `conversations`, `sessions`, `tags`, etc.
   - Should see that it's using `memory.db`

7. **Stop services:**
   ```bash
   Ctrl+C
   ```

**Expected Result:**
- ✅ All three services start
- ✅ Both localhost:3333 and localhost:8055 respond
- ✅ Directus connects to memory.db
- ✅ No errors in output

---

### Scenario 2: Re-running Setup (Idempotent)

**Goal:** Verify that re-running setup is safe and doesn't break things

**Steps:**

1. **Setup already ran** (from Scenario 1, but restart the process)
2. **Run setup again:**
   ```bash
   npm run setup
   ```

3. **Verify it detects existing components:**
   - Should say "Database already exists" (skips creation)
   - Should say "Directus project already exists" (skips recreation)
   - Should still start all services

4. **Test both services again:**
   ```bash
   curl http://localhost:3333/health
   curl http://localhost:8055 (in browser)
   ```

**Expected Result:**
- ✅ Setup completes faster (no Directus install)
- ✅ Services start successfully
- ✅ No data is lost
- ✅ Both services still work

---

### Scenario 3: Port Conflicts

**Goal:** Verify helpful error messages if ports are already in use

**Steps:**

1. **Block port 8055** (start something else):
   ```bash
   # Terminal 1: Block the port
   python3 -m http.server 8055 &
   ```

2. **Run setup:**
   ```bash
   npm run setup
   ```

3. **Verify behavior:**
   - Should detect port conflict
   - Should either:
     - Show a warning but continue
     - Suggest alternative port
   - Services should still start on available ports

**Expected Result:**
- ✅ Clear warning about port conflict
- ✅ Setup continues (or offers alternatives)
- ✅ User knows what to do

---

### Scenario 4: Verify Directus Can See memory.db

**Goal:** Confirm Directus is actually using the SQLite database

**Steps:**

1. **Setup is running:**
   ```bash
   npm run setup
   ```

2. **Add some test data:**
   ```bash
   sqlite3 memory.db <<EOF
   INSERT INTO memories (id, type, source_file, content, timestamp)
   VALUES ('test-1', 'long_term', 'MEMORY.md', 'Test memory entry', 1708540000);
   EOF
   ```

3. **Open Directus:**
   - Go to `http://localhost:8055`
   - Login with auto-generated credentials
   - Navigate to **Collections** → **Memories**
   - Should see the test entry

4. **Verify the entry:**
   - Click on the memory entry
   - Should show: ID=test-1, Type=long_term, Content=Test memory entry

**Expected Result:**
- ✅ Directus immediately sees data changes in memory.db
- ✅ Data displays correctly
- ✅ Sync works bidirectionally

---

### Scenario 5: Sync Service + Directus Integration

**Goal:** Verify that new memories are visible in Directus

**Steps:**

1. **Setup running**

2. **Add a memory file:**
   ```bash
   cat > memory/2026-02-22-test.md << EOF
   # Test Entry for Setup Wizard

   This is a test entry to verify sync service works with Directus.

   - Point 1
   - Point 2
   - Point 3
   EOF
   ```

3. **Watch sync service output:**
   - Should detect file change
   - Should import to SQLite
   - Should show success message

4. **Open Directus:**
   - Refresh collections
   - Go to **Memories**
   - New entry should appear

**Expected Result:**
- ✅ Sync service detects file changes
- ✅ Memories appear in Directus within seconds
- ✅ Content is correctly parsed

---

### Scenario 6: Edge Cases

#### 6a: Node version too old

```bash
# Test with Node 14
nvm use 14
npm run setup
```

Expected: Should fail with clear message: "Node.js X.X.X detected. Version 16+ required."

#### 6b: SQLite install fails (macOS)

```bash
npm run setup
```

If fails at sqlite3 build:
```bash
xcode-select --install
npm run setup
```

Expected: Should prompt or suggest this solution

#### 6c: Directus creation fails

The setup script handles this gracefully:
- Tries `npx create-directus-project`
- If that fails, sets up minimal structure manually
- Continues without blocking other services

Expected: Services still start, user gets warning about Directus

---

## Manual Testing Checklist

Before marking setup complete, verify:

- [ ] `npm run setup` completes without errors
- [ ] All three services start (Sync, API, Directus)
- [ ] `http://localhost:3333/health` responds
- [ ] `http://localhost:8055` shows Directus login
- [ ] Directus can connect to memory.db
- [ ] Admin credentials work (from `directus-project/.env`)
- [ ] Rerunning setup is safe (idempotent)
- [ ] Documentation is updated and accurate
- [ ] Error messages are helpful
- [ ] Cleanup (Ctrl+C) properly stops all services

---

## Testing Commands

Quick test suite to validate setup:

```bash
#!/bin/bash
# test-setup.sh - Validate the complete setup

set -e

echo "🧪 Testing Agent Memory System Setup"
echo ""

# Test 1: Setup
echo "Test 1: Running setup..."
npm run setup &
SETUP_PID=$!

# Give it time to start
sleep 10

# Test 2: Query API
echo "Test 2: Checking Query API..."
curl -f http://localhost:3333/health || echo "❌ API not responding"

# Test 3: Directus (just check it's listening)
echo "Test 3: Checking Directus port..."
curl -I http://localhost:8055 2>/dev/null | head -1 || echo "⚠️  Directus not responding (might still be initializing)"

# Test 4: Database
echo "Test 4: Checking database..."
sqlite3 memory.db "SELECT COUNT(*) FROM memories;" || echo "❌ Database not accessible"

# Cleanup
echo ""
echo "Stopping services..."
kill $SETUP_PID 2>/dev/null || true

echo ""
echo "✅ All tests complete!"
```

---

## Troubleshooting During Testing

### "Directus creation failed"

Check that npm/npx can reach registry:
```bash
npx --version
npm config get registry
```

### "Port already in use"

Find and kill conflicting processes:
```bash
lsof -i :3333
lsof -i :8055
kill -9 <PID>
```

### "Sync service not detecting changes"

Verify chokidar is working:
```bash
ls -la memory/
node sync-service.js --sync --verbose
```

### "Directus not connecting to database"

Check .env file:
```bash
cat directus-project/.env | grep DB_
```

Verify file exists:
```bash
ls -la memory.db
file memory.db  # Should be SQLite
```

---

## Performance Expectations

**First Run (Fresh Clone):**
- Total time: 2-5 minutes
  - npm install: ~1 minute
  - Directus setup: ~2 minutes
  - Service startup: ~30 seconds

**Subsequent Runs:**
- Total time: ~10-15 seconds

**Service Response Times:**
- API health check: <100ms
- Directus login: 1-3 seconds
- Query memory: <500ms

---

## When Testing is Complete

After successful testing:

1. ✅ Update any issues found
2. ✅ Document any workarounds needed
3. ✅ Push changes to main branch
4. ✅ Create release notes

---

## Reference Files

- `setup.js` - The main wizard script
- `SETUP_WIZARD.md` - User documentation
- `QUICKSTART.md` - Quick reference
- `README.md` - Overview
- `DIRECTUS_SETUP.md` - Directus configuration details

---

**Last Updated:** February 22, 2026
**Tested On:** macOS (Darwin)
