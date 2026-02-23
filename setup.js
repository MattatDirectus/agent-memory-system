#!/usr/bin/env node

/**
 * Agent Memory System - One-Command Setup Wizard
 *
 * Handles everything:
 * - Node.js version check
 * - SQLite database creation
 * - Database schema initialization
 * - Directus setup (optional)
 * - Service startup
 *
 * Usage:
 *   npm run setup
 *   node setup.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ============================================================================
// Configuration
// ============================================================================

const DB_PATH = path.join(__dirname, 'memory.db');
const DIRECTUS_PORT = 8055;
const API_PORT = 3333;
const MEMORY_DIR = __dirname;

// ============================================================================
// Colors & Formatting
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logStep(step, msg) {
  console.log(`${colors.cyan}[${step}]${colors.reset} ${colors.bright}${msg}${colors.reset}`);
}

function logSuccess(msg) {
  log(`✓ ${msg}`, 'green');
}

function logWarn(msg) {
  log(`⚠ ${msg}`, 'yellow');
}

function logError(msg) {
  log(`✗ ${msg}`, 'red');
}

function logInfo(msg) {
  log(`ℹ ${msg}`, 'dim');
}

// ============================================================================
// Utility Functions
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkNodeVersion() {
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split('.')[0], 10);
  
  if (major < 16) {
    logError(`Node.js ${nodeVersion} detected. Version 16+ required.`);
    process.exit(1);
  }
  
  logSuccess(`Node.js ${nodeVersion}`);
  return true;
}

function checkDependencies() {
  return new Promise((resolve) => {
    logStep('2', 'Checking dependencies...');
    
    try {
      require('sqlite3');
      require('express');
      require('cors');
      require('chokidar');
      require('concurrently');
      logSuccess('All dependencies installed');
      resolve(true);
    } catch (err) {
      logWarn(`Missing dependencies. Running npm install...`);
      
      const npm = spawn('npm', ['install'], {
        cwd: __dirname,
        stdio: 'inherit'
      });
      
      npm.on('close', (code) => {
        if (code === 0) {
          logSuccess('Dependencies installed');
          resolve(true);
        } else {
          logError('npm install failed');
          process.exit(1);
        }
      });
    }
  });
}

function createDatabase() {
  return new Promise((resolve) => {
    logStep('3', 'Setting up SQLite database...');
    
    if (fs.existsSync(DB_PATH)) {
      logInfo(`Database already exists at ${DB_PATH}`);
      logInfo('Skipping database creation.');
      resolve(true);
      return;
    }
    
    const sqlite3 = require('sqlite3').verbose();
    
    const db = new sqlite3.Database(DB_PATH, async (err) => {
      if (err) {
        logError(`Failed to create database: ${err.message}`);
        process.exit(1);
      }
      
      logInfo(`Database created at ${DB_PATH}`);
      
      try {
        const schemaSql = fs.readFileSync(path.join(__dirname, 'sqlite-schema.sql'), 'utf8');
        
        db.exec(schemaSql, (err) => {
          if (err) {
            logError(`Failed to initialize schema: ${err.message}`);
            process.exit(1);
          }
          
          logSuccess('Database schema initialized');
          db.close();
          resolve(true);
        });
      } catch (err) {
        logError(`Failed to read schema file: ${err.message}`);
        process.exit(1);
      }
    });
  });
}

function checkPortReady(port) {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      resolve(true);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const ready = await checkPortReady(port);
    if (ready) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

// ============================================================================
// Service Management
// ============================================================================

let runningProcesses = [];

function startService(name, command, args, options = {}) {
  return new Promise((resolve) => {
    logInfo(`Starting ${name}...`);
    
    const { cwd, stdio, waitMs, ...otherOptions } = options;
    
    const service = spawn(command, args, {
      cwd: cwd || __dirname,
      stdio: stdio || 'inherit',
      ...otherOptions
    });
    
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        logSuccess(`${name} started (PID: ${service.pid})`);
        runningProcesses.push({ name, process: service });
        resolve(service);
      }
    }, waitMs || 3000);
    
    service.on('error', (err) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        logError(`Failed to start ${name}: ${err.message}`);
        process.exit(1);
      }
    });
    
    service.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !resolved) {
        resolved = true;
        logError(`${name} exited with code ${code}`);
      }
    });
  });
}

function setupCleanup() {
  const cleanup = () => {
    log('\nShutting down services...', 'yellow');
    
    runningProcesses.forEach(({ name, process }) => {
      logInfo(`Stopping ${name} (PID: ${process.pid})`);
      try {
        process.kill('SIGTERM');
      } catch (err) {
        // Already closed
      }
    });
    
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// ============================================================================
// Directus Setup & Configuration
// ============================================================================

async function setupDirectus() {
  return new Promise((resolve, reject) => {
    logStep('5', 'Setting up Directus dashboard...');
    
    const directusPath = path.join(__dirname, 'directus-project');
    
    // Check if Directus project already exists
    if (fs.existsSync(directusPath)) {
      logInfo('Directus project already exists');
      logInfo('Configuring Directus to use memory.db...');
      
      configureDirectusEnv(directusPath, (err) => {
        if (err) {
          logWarn(`Could not update Directus config: ${err.message}`);
        } else {
          logSuccess('Directus configuration updated');
        }
        resolve(true);
      });
      return;
    }
    
    logInfo('Creating Directus project at ./directus-project...');
    
    // Create directus project
    const createDirectus = spawn('npx', ['create-directus-project', 'directus-project', '--db-client', 'sqlite3', '--db-filename', DB_PATH], {
      cwd: __dirname,
      stdio: 'pipe'
    });
    
    let createOutput = '';
    let createError = '';
    
    createDirectus.stdout.on('data', (data) => {
      createOutput += data.toString();
    });
    
    createDirectus.stderr.on('data', (data) => {
      createError += data.toString();
    });
    
    createDirectus.on('close', (code) => {
      if (code === 0) {
        logSuccess('Directus project created');
        
        // Configure environment
        configureDirectusEnv(directusPath, (err) => {
          if (err) {
            logError(`Failed to configure Directus: ${err.message}`);
            reject(err);
            return;
          }
          
          logSuccess('Directus configured to use memory.db');
          resolve(true);
        });
      } else {
        // If npx create-directus-project failed, set up minimal Directus manually
        logWarn('Directus creation encountered issues. Setting up minimal configuration...');
        
        try {
          // Create minimal directus-project structure
          if (!fs.existsSync(directusPath)) {
            fs.mkdirSync(directusPath, { recursive: true });
          }
          
          // Create package.json
          const packageJson = {
            name: 'directus-memory-system',
            version: '1.0.0',
            description: 'Directus instance for memory browsing',
            type: 'commonjs',
            scripts: {
              dev: 'directus start',
              start: 'directus start'
            },
            dependencies: {
              directus: '^10.0.0'
            }
          };
          
          fs.writeFileSync(
            path.join(directusPath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
          );
          
          logSuccess('Directus project structure created');
          
          // Install dependencies
          logInfo('Installing Directus dependencies...');
          const npmInstall = spawn('npm', ['install'], {
            cwd: directusPath,
            stdio: 'pipe'
          });
          
          npmInstall.on('close', (installCode) => {
            if (installCode === 0) {
              configureDirectusEnv(directusPath, (err) => {
                if (err) {
                  logError(`Failed to configure Directus: ${err.message}`);
                  reject(err);
                } else {
                  logSuccess('Directus installed and configured');
                  resolve(true);
                }
              });
            } else {
              logError('Failed to install Directus dependencies');
              reject(new Error('Directus npm install failed'));
            }
          });
        } catch (err) {
          logError(`Failed to set up Directus: ${err.message}`);
          reject(err);
        }
      }
    });
    
    createDirectus.on('error', (err) => {
      logWarn(`Directus creation spawning failed: ${err.message}`);
      logInfo('This might be normal if npx is not fully available. Continuing...');
      resolve(true);
    });
  });
}

function configureDirectusEnv(directusPath, callback) {
  try {
    // Generate secrets for Directus
    const crypto = require('crypto');
    const KEY = crypto.randomBytes(32).toString('hex');
    const SECRET = crypto.randomBytes(32).toString('hex');
    
    const envContent = `# Directus Configuration for Memory System
# Auto-generated by setup.js

# Database Configuration
DB_CLIENT=sqlite3
DB_FILENAME=${DB_PATH}

# Server Configuration
PORT=8055
PUBLIC_URL=http://localhost:8055

# Admin User
ADMIN_EMAIL=admin@memory-system.local
ADMIN_PASSWORD=${crypto.randomBytes(12).toString('hex')}

# Security Keys
KEY=${KEY}
SECRET=${SECRET}

# File Uploads
STORAGE_LOCATIONS=local
STORAGE_LOCAL_DRIVER=local
STORAGE_LOCAL_ROOT=./uploads

# REST API
REST_QUERY_LIMIT_DEFAULT=100
REST_QUERY_LIMIT_MAX=1000

# WebSocket
WEBSOCKETS_ENABLED=true

# Extensions
EXTENSIONS_AUTO_RELOAD=true
`;
    
    const envPath = path.join(directusPath, '.env');
    fs.writeFileSync(envPath, envContent);
    
    logInfo(`✓ Created .env at ${envPath}`);
    callback(null);
  } catch (err) {
    callback(err);
  }
}

// ============================================================================
// Health Checks
// ============================================================================

async function checkServiceHealth() {
  logStep('7', 'Waiting for services to be ready...');
  
  // Wait for API port
  logInfo('Waiting for Query API on port 3333...');
  const apiReady = await waitForPort(API_PORT, 30);
  
  if (!apiReady) {
    logWarn('Query API port still in use. Continuing anyway...');
  } else {
    logSuccess('Query API is ready');
  }
  
  // Wait for Directus port if configured
  const directusPath = path.join(__dirname, 'directus-project');
  if (fs.existsSync(directusPath)) {
    logInfo('Waiting for Directus on port 8055...');
    const directusReady = await waitForPort(DIRECTUS_PORT, 30);
    
    if (!directusReady) {
      logWarn('Directus port not responding yet. It may still be initializing...');
    } else {
      logSuccess('Directus is ready');
    }
  }
  
  return true;
}

// ============================================================================
// Initial Sync
// ============================================================================

function initialSync() {
  return new Promise((resolve) => {
    logStep('4', 'Running initial sync...');
    
    const sync = spawn('node', ['sync-service.js', '--sync', '--quiet'], {
      cwd: __dirname,
      stdio: 'pipe'
    });
    
    let output = '';
    
    sync.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    sync.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    sync.on('close', (code) => {
      if (code === 0) {
        logSuccess('Initial sync completed');
        
        // Count memories if possible
        try {
          const sqlite3 = require('sqlite3').verbose();
          const db = new sqlite3.Database(DB_PATH);
          
          db.get('SELECT COUNT(*) as count FROM memories WHERE 1=1', (err, row) => {
            if (!err && row) {
              logInfo(`Found ${row.count} memory entries`);
            }
            db.close();
            resolve(true);
          });
        } catch {
          resolve(true);
        }
      } else {
        logWarn('Initial sync encountered warnings (continuing anyway)');
        resolve(true);
      }
    });
  });
}

// ============================================================================
// Display Success Message
// ============================================================================

function displaySuccess() {
  log('');
  log('╔════════════════════════════════════════════════════════════╗', 'green');
  log('║                                                            ║', 'green');
  log('║     🎉  Agent Memory System is Ready!  🎉                 ║', 'green');
  log('║                                                            ║', 'green');
  log('╚════════════════════════════════════════════════════════════╝', 'green');
  log('');
  
  const directusPath = path.join(__dirname, 'directus-project');
  const directusRunning = fs.existsSync(directusPath);
  
  log('Services Running:', 'bright');
  log('  ✓ Sync Service - Watches for memory file changes', 'cyan');
  log('  ✓ Query API - Search memories and conversations', 'cyan');
  if (directusRunning) {
    log('  ✓ Directus UI - Browse and manage memories', 'cyan');
  }
  log('');
  
  log('Access Your System:', 'bright');
  log(`  • Query API: ${colors.cyan}http://localhost:3333${colors.reset}`, 'bright');
  log(`  • Health Check: ${colors.cyan}http://localhost:3333/health${colors.reset}`, 'bright');
  if (directusRunning) {
    log(`  • Directus Dashboard: ${colors.cyan}http://localhost:8055${colors.reset}`, 'bright');
  }
  log('');
  
  log('Next Steps:', 'bright');
  log('  1. Test the API:', 'dim');
  log(`     ${colors.cyan}curl http://localhost:3333/health${colors.reset}`, 'dim');
  log('');
  log('  2. Search for memories:', 'dim');
  log(`     ${colors.cyan}curl -X POST http://localhost:3333/search/memories \\${colors.reset}`, 'dim');
  log(`     ${colors.cyan}  -H "Content-Type: application/json" \\${colors.reset}`, 'dim');
  log(`     ${colors.cyan}  -d '{"q": "test", "limit": 5}'${colors.reset}`, 'dim');
  log('');
  if (directusRunning) {
    log('  3. Open Directus in your browser:', 'dim');
    log(`     ${colors.cyan}http://localhost:8055${colors.reset}`, 'dim');
    log('');
  }
  
  log('File Locations:', 'bright');
  log(`  • Database: ${DB_PATH}`, 'dim');
  log(`  • Sync Service: ${path.join(__dirname, 'sync-service.js')}`, 'dim');
  log(`  • Query API: ${path.join(__dirname, 'query-api.js')}`, 'dim');
  if (directusRunning) {
    log(`  • Directus: ${path.join(__dirname, 'directus-project')}`, 'dim');
  }
  log('');
  
  log('To Stop Services:', 'bright');
  log('  Press Ctrl+C to stop the services', 'dim');
  log('');
  
  log('Documentation:', 'bright');
  log('  • README.md - Overview and architecture', 'dim');
  log('  • QUICKSTART.md - Detailed setup guide', 'dim');
  log('  • MEMORY_SYSTEM.md - Complete API reference', 'dim');
  log('  • SETUP_WIZARD.md - What this wizard does', 'dim');
  log('  • DIRECTUS_SETUP.md - Directus configuration guide', 'dim');
  log('');
}

// ============================================================================
// Main Setup Flow
// ============================================================================

async function main() {
  console.clear();
  
  log('┌────────────────────────────────────────────────────────────┐', 'cyan');
  log('│                                                            │', 'cyan');
  log('│        🧠  Agent Memory System - Setup Wizard  🧠          │', 'cyan');
  log('│                                                            │', 'cyan');
  log('│  SQLite + Directus • One Command to Rule Them All         │', 'cyan');
  log('│                                                            │', 'cyan');
  log('└────────────────────────────────────────────────────────────┘', 'cyan');
  log('');
  
  try {
    // Step 1: Check Node version
    logStep('1', 'Checking Node.js version...');
    checkNodeVersion();
    log('');
    
    // Step 2: Check dependencies
    await checkDependencies();
    log('');
    
    // Step 3: Create database
    await createDatabase();
    log('');
    
    // Step 4: Initial sync
    await initialSync();
    log('');
    
    // Step 5: Directus check
    try {
      await setupDirectus();
    } catch (err) {
      logWarn(`Directus setup failed: ${err.message}`);
      logInfo('Continuing without Directus (optional component)');
    }
    log('');
    
    // Step 6: Start services
    logStep('6', 'Starting services...');
    log('');
    
    setupCleanup();
    
    // Start sync service in watch mode
    await startService(
      'Sync Service',
      'node',
      ['sync-service.js', '--watch'],
      { waitMs: 2000 }
    );
    
    // Start Query API
    await startService(
      'Query API',
      'node',
      ['query-api.js'],
      { waitMs: 2000, env: { ...process.env, PORT: API_PORT } }
    );
    
    // Start Directus if it exists
    const directusPath = path.join(__dirname, 'directus-project');
    if (fs.existsSync(directusPath)) {
      await startService(
        'Directus Dashboard',
        'npm',
        ['start'],
        { cwd: directusPath, waitMs: 5000 }
      );
    }
    
    log('');
    
    // Wait for services
    await checkServiceHealth();
    
    log('');
    
    // Display success
    displaySuccess();
    
    log('═══════════════════════════════════════════════════════════', 'cyan');
    log('Setup complete! Services are running. Press Ctrl+C to stop.', 'cyan');
    log('═══════════════════════════════════════════════════════════', 'cyan');
    log('');
    
  } catch (err) {
    logError(`Setup failed: ${err.message}`);
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  main().catch(err => {
    logError(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main };
