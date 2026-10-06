#!/usr/bin/env node

/**
 * Script to create an admin user directly in the database
 * Usage: node scripts/create-admin.js <email> <password> <name>
 * Example: node scripts/create-admin.js admin@example.com SecurePass123! "Admin User"
 *
 * Note: This script uses a simple hash for compatibility. For production,
 * register as a regular user first, then update the role in the database.
 */

const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');

// PBKDF2 password hashing (matches the utils/password.ts implementation)
async function hashPassword(password) {
  // Generate a random salt
  const salt = crypto.randomBytes(16);

  // Derive key using PBKDF2
  const keyMaterial = crypto.pbkdf2Sync(
    password,
    salt,
    100000,
    32,
    'sha256'
  );

  // Combine salt and hash
  const combined = Buffer.concat([salt, keyMaterial]);

  // Convert to hex string
  return combined.toString('hex');
}

function executeRemote(sql) {
  try {
    const output = execFileSync('npx', ['wrangler', 'd1', 'execute', 'apex-fusion-db', '--remote', '--command', sql, '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const jsonStart = output.indexOf('[\n');
    return JSON.parse(jsonStart >= 0 ? output.slice(jsonStart) : output);
  } catch (error) {
    console.error('Error executing SQL:', error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('Usage: node scripts/create-admin.js <email> <password> <name>');
    console.log('Example: node scripts/create-admin.js admin@example.com SecurePass123! "Admin User"');
    process.exit(1);
  }

  const [email, password, name] = args;

  console.log(`Creating admin user...`);
  console.log(`Email: ${email}`);
  console.log(`Name: ${name}`);

  // Hash the password
  const passwordHash = await hashPassword(password);
  console.log(`Password hash: ${passwordHash}`);

  // Check if user already exists
  const checkResult = executeRemote(`SELECT id, email FROM users WHERE email = '${email.toLowerCase()}'`);
  if (checkResult[0]?.results?.length > 0) {
    console.log('Error: User with this email already exists');
    process.exit(1);
  }

  // Insert the admin user
  const sql = `INSERT INTO users (name, email, password_hash, role, status) VALUES ('${name}', '${email.toLowerCase()}', '${passwordHash}', 'admin', 'active')`;
  console.log(`Executing: ${sql}`);

  const result = executeRemote(sql);
  console.log('Admin user created successfully!');
  console.log('Result:', result);
  console.log('\nYou can now login with:');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main().catch(error => {
  console.error('Failed to create admin:', error);
  process.exit(1);
});
