#!/usr/bin/env node

/**
 * Migration Runner for D1 Database
 * Runs all migration files in order from the migrations directory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const DB_NAME = 'apex-fusion-marketing-db';
const MARKETING_MIGRATION = '0001_marketing_signup.sql';

function getMigrationFiles() {
  return [MARKETING_MIGRATION];
}

async function runMigration(migrationFile, isLocal = false) {
  const filePath = path.join(MIGRATIONS_DIR, migrationFile);
  console.log(`\n📋 Running migration: ${migrationFile}`);
  
  try {
    const localFlag = isLocal ? '--local' : '';
    const command = `npx wrangler d1 execute ${DB_NAME} ${localFlag} --file="${filePath}"`;
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ Migration ${migrationFile} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Migration ${migrationFile} failed:`, error.message);
    return false;
  }
}

async function runAllMigrations(isLocal = false) {
  const migrationFiles = getMigrationFiles();
  
  if (migrationFiles.length === 0) {
    console.log('No migration files found.');
    return;
  }
  
  console.log(`Found ${migrationFiles.length} migration files`);
  console.log('=====================================');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const file of migrationFiles) {
    const success = await runMigration(file, isLocal);
    if (success) {
      successCount++;
    } else {
      failCount++;
      console.log(`⚠️  Stopping migration run due to failure`);
      break;
    }
  }
  
  console.log('\n=====================================');
  console.log(`Migration Summary:`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${migrationFiles.length}`);
}

async function main() {
  const args = process.argv.slice(2);
  const isLocal = args.includes('--local') || args.includes('-l');
  const specificMigration = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-'));
  
  if (specificMigration) {
    console.log(`Running specific migration: ${specificMigration}`);
    await runMigration(specificMigration, isLocal);
  } else {
    console.log(`Running all migrations ${isLocal ? '(local)' : '(production)'}`);
    await runAllMigrations(isLocal);
  }
}

main().catch(console.error);
