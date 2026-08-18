import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Local-first: the whole log is one SQLite file in the repo's data/ directory.
// Override with PROJECT239_DB to point at a different file (tests, a backup).
const DB_PATH = process.env.PROJECT239_DB ?? path.join(process.cwd(), 'data', 'training.db');

declare global {
  // eslint-disable-next-line no-var
  var __project239_db: Database.Database | undefined;
}

function open(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'schema.sql'), 'utf8'));

  const athlete = db.prepare('SELECT COUNT(*) AS n FROM athlete').get() as { n: number };
  if (athlete.n === 0) {
    db.prepare(
      `INSERT INTO athlete (id, name, primary_events, threshold_pace_sec, distance_unit)
       VALUES (1, 'Athlete', '1500m / 5000m', 330, 'mi')`,
    ).run();
  }
  return db;
}

// Next.js dev reloads the module graph on every edit; reusing the handle keeps
// us from opening a new connection per hot reload.
export const db: Database.Database = globalThis.__project239_db ?? open();
if (process.env.NODE_ENV !== 'production') globalThis.__project239_db = db;
