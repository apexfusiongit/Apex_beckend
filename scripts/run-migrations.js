#!/usr/bin/env node

/**
 * Applies the reviewed, non-destructive migration sequence. Defaults to local;
 * pass --remote explicitly to change production D1.
 */
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dbName = 'apex-fusion-db';
const migrationsDir = path.join(__dirname, '..', 'migrations');
const local = !process.argv.includes('--remote');
const location = local ? ['--local'] : ['--remote'];

function wrangler(args) {
  const config = local ? ['--config', 'wrangler.local.toml'] : ['--config', 'wrangler.toml'];
  const output = execFileSync('npx', ['wrangler', ...config, 'd1', 'execute', dbName, ...location, ...args, '--yes', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const jsonStart = output.indexOf('[\n');
  return JSON.parse(jsonStart >= 0 ? output.slice(jsonStart) : output);
}

function executeFile(name) {
  console.log(`Applying ${name} to ${local ? 'local' : 'remote'} D1`);
  wrangler(['--file', path.join(migrationsDir, name)]);
}

function execute(command) {
  return wrangler(['--command', command]);
}

function query(sql) {
  const response = execute(sql);
  return response.flatMap((item) => item.results ?? []);
}

function main() {
  execute('CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const applied = new Set(query('SELECT name FROM _applied_migrations').map((row) => row.name));
  const ordered = ['0001_core_baseline.sql', '0031_platform_extensions.sql', '0032_payment_webhooks.sql'];

  for (const name of ordered) {
    if (applied.has(name)) {
      console.log(`Skipping already applied ${name}`);
      continue;
    }
    executeFile(name);
    execute(`INSERT INTO _applied_migrations (name) VALUES ('${name}')`);
  }
  console.log(`Migrations complete on ${local ? 'local' : 'remote'} D1.`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
