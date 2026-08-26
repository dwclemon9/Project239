/**
 * Clears the training log and restores the profile defaults, leaving an empty
 * log ready for real training.
 *
 *   npm run reset
 *
 * The charts anchor to your first logged session, so once this is done the
 * weekly chart starts at the week you next log and the monthly chart starts
 * that month — no empty periods from before the log existed.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const DB_PATH = process.env.PROJECT239_DB ?? path.join(process.cwd(), 'data', 'training.db');

if (!fs.existsSync(DB_PATH)) {
  console.log(`No log at ${DB_PATH} yet — nothing to reset.`);
  process.exit(0);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'schema.sql'), 'utf8'));

const counts = {
  sessions: db.prepare('SELECT COUNT(*) AS n FROM session').get().n,
  reps: db.prepare('SELECT COUNT(*) AS n FROM rep').get().n,
  wellness: db.prepare('SELECT COUNT(*) AS n FROM wellness').get().n,
  races: db.prepare('SELECT COUNT(*) AS n FROM race').get().n,
};
const total = Object.values(counts).reduce((a, b) => a + b, 0);

if (total > 0 && !process.argv.includes('--yes')) {
  console.log(`This will permanently delete everything in ${DB_PATH}:`);
  for (const [name, n] of Object.entries(counts)) console.log(`  ${n} ${name}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('\nType "yes" to continue: ')).trim().toLowerCase();
  rl.close();
  if (answer !== 'yes') {
    console.log('Cancelled. Nothing was deleted.');
    process.exit(0);
  }
}

db.exec(`
  DELETE FROM rep;
  DELETE FROM lift;
  DELETE FROM session;
  DELETE FROM wellness;
  DELETE FROM race;
  DELETE FROM niggle;
`);

// The athlete row goes too: the app recreates it from DEFAULT_ATHLETE in
// src/lib/db.ts the next time it starts, so the profile defaults live in
// exactly one place rather than being restated here.
db.exec('DELETE FROM athlete;');

console.log('Log cleared and profile reset.');
console.log('Start the app (npm run dev) and the charts will begin at whatever you log first.');
