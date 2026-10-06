#!/usr/bin/env node

// One-time, idempotent copy of the marketing D1's signup accounts into the
// existing learning D1. Source records are never deleted or modified.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.join(__dirname, '..');
const backupDir = '/tmp/apex-fusion-backups-20261006';
const sourceBackup = path.join(backupDir, 'marketing-d1.sql');
const targetBackup = path.join(backupDir, 'learning-d1.sql');
const applying = process.argv.includes('--apply');

function query(db, sql) {
  const output = execFileSync('npx', ['wrangler', '--config', 'wrangler.toml', 'd1', 'execute', db, '--remote', '--command', sql, '--yes', '--json'], {
    cwd: backendRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const jsonStart = output.indexOf('[\n');
  const parsed = JSON.parse(jsonStart >= 0 ? output.slice(jsonStart) : output);
  return parsed.flatMap((result) => result.results ?? []);
}

function literal(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function execute(db, sql) {
  query(db, sql);
}

function main() {
  const sourceUsers = query('apex-fusion-marketing-db',
    'SELECT id, role, first_name, last_name, email, phone_number, password_hash, signup_date, status FROM users ORDER BY id');
  const targetUsers = query('apex-fusion-db', 'SELECT id, email, role, password_hash FROM users');
  const targetByEmail = new Map(targetUsers.map((row) => [String(row.email).toLowerCase(), row]));
  const profileRows = query('apex-fusion-marketing-db', 'SELECT user_id, dob, gender, location, institution_name, grade_or_subject FROM profiles');
  const preferenceRows = query('apex-fusion-marketing-db', 'SELECT user_id, opt_in_email, opt_in_sms, opt_in_push, preferred_content_type FROM marketing_preferences');
  const activityRows = query('apex-fusion-marketing-db', 'SELECT id, user_id, action_type, timestamp, device_type, referral_source FROM signup_activity ORDER BY id');
  const profileByUser = new Map(profileRows.map((row) => [row.user_id, row]));
  const preferenceByUser = new Map(preferenceRows.map((row) => [row.user_id, row]));
  const collisions = sourceUsers.map((source) => ({
    source,
    target: targetByEmail.get(String(source.email).toLowerCase()),
  })).filter(({ target }) => target);
  const passwordConflicts = collisions.filter(({ source, target }) => source.password_hash !== target.password_hash).length;
  const roleConflicts = collisions.filter(({ source, target }) => String(source.role).toLowerCase() !== String(target.role).toLowerCase()).length;

  console.log(JSON.stringify({
    sourceAccounts: sourceUsers.length,
    alreadyPresentByEmail: collisions.length,
    duplicateCredentialConflicts: passwordConflicts,
    legacyCredentialAliasesToPreserve: passwordConflicts,
    duplicateRoleConflicts: roleConflicts,
    profileRows: profileRows.length,
    preferenceRows: preferenceRows.length,
    activityRows: activityRows.length,
    mode: applying ? 'apply' : 'preview',
  }, null, 2));
  if (!applying) return;

  for (const backup of [sourceBackup, targetBackup]) {
    const file = fs.statSync(backup);
    if (!file.isFile() || file.size === 0 || (file.mode & 0o077) !== 0) {
      throw new Error('Secure database backups are missing or have unsafe permissions. Re-export both databases before applying.');
    }
  }

  for (const user of sourceUsers) {
    const email = String(user.email).trim().toLowerCase();
    const profile = profileByUser.get(user.id);
    const preferences = preferenceByUser.get(user.id);
    const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    const role = String(user.role ?? 'Student').toLowerCase();
    const status = String(user.status ?? 'Active').toLowerCase();
    const studentClass = profile?.grade_or_subject ?? null;
    const userId = Number(user.id);

    // Resolve any same-email account to its existing canonical ID. Never
    // overwrite a learning account or its credentials.
    execute('apex-fusion-db', `INSERT OR IGNORE INTO users (name, email, phone, role, class, created_at, updated_at, password_hash, status)
      VALUES (${literal(fullName)}, ${literal(email)}, ${literal(user.phone_number)}, ${literal(role)}, ${literal(studentClass)},
        ${literal(user.signup_date)}, ${literal(user.signup_date)}, ${literal(user.password_hash)}, ${literal(status)})`);
    const canonical = query('apex-fusion-db', `SELECT id FROM users WHERE lower(email) = ${literal(email)}`)[0];
    if (!canonical) throw new Error(`Account reconciliation did not produce a destination user (source ID ${userId}).`);
    const canonicalId = Number(canonical.id);
    const priorDestination = targetByEmail.get(email);
    if (priorDestination && priorDestination.password_hash !== user.password_hash) {
      execute('apex-fusion-db', `INSERT OR IGNORE INTO user_password_aliases (user_id, password_hash, source)
        VALUES (${canonicalId}, ${literal(user.password_hash)}, 'apex-fusion-marketing-db')`);
    }

    if (profile) {
      execute('apex-fusion-db', `INSERT OR IGNORE INTO profiles (user_id, dob, gender, location, institution_name, grade_or_subject)
        VALUES (${canonicalId}, ${literal(profile.dob)}, ${literal(profile.gender)}, ${literal(profile.location)}, ${literal(profile.institution_name)}, ${literal(profile.grade_or_subject)})`);
    }
    if (preferences) {
      execute('apex-fusion-db', `INSERT OR IGNORE INTO marketing_preferences (user_id, opt_in_email, opt_in_sms, opt_in_push, preferred_content_type)
        VALUES (${canonicalId}, ${Number(preferences.opt_in_email) ? 1 : 0}, ${Number(preferences.opt_in_sms) ? 1 : 0}, ${Number(preferences.opt_in_push) ? 1 : 0}, ${literal(preferences.preferred_content_type)})`);
    }
    const userActivity = activityRows.filter((activity) => Number(activity.user_id) === userId);
    for (const activity of userActivity) {
      execute('apex-fusion-db', `INSERT OR IGNORE INTO signup_activity (source_activity_id, user_id, action_type, timestamp, device_type, referral_source)
        VALUES (${Number(activity.id)}, ${canonicalId}, ${literal(activity.action_type)}, ${literal(activity.timestamp)}, ${literal(activity.device_type)}, ${literal(activity.referral_source)})`);
    }
  }

  const result = query('apex-fusion-db', `SELECT
    (SELECT COUNT(*) FROM users WHERE email IN (SELECT email FROM users)) AS destination_accounts,
    (SELECT COUNT(*) FROM signup_activity WHERE source_activity_id IS NOT NULL) AS imported_activity`)[0];
  console.log(JSON.stringify({ completed: true, importedSourceAccounts: sourceUsers.length, destinationAccounts: result.destination_accounts, importedActivity: result.imported_activity }));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Migration failed.');
  process.exitCode = 1;
}
