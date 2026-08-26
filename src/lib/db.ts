import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Local-first: the whole log is one SQLite file in the repo's data/ directory.
// Override with PROJECT239_DB to point at a different file (tests, a backup).
const DB_PATH = process.env.PROJECT239_DB ?? path.join(process.cwd(), 'data', 'training.db');

/**
 * The profile a fresh log starts with. `npm run reset` restores these too, so
 * there is exactly one place to change who the log belongs to.
 */
export const DEFAULT_ATHLETE = {
  name: 'Daniel Cortese',
  school: 'Davidson College',
  class_year: null as string | null,
  primary_events: null as string | null,
  threshold_pace_sec: 330,
  max_hr: null as number | null,
  resting_hr: null as number | null,
  distance_unit: 'mi',
};

export const INSERT_DEFAULT_ATHLETE = `
  INSERT INTO athlete (id, name, school, class_year, primary_events,
                       threshold_pace_sec, max_hr, resting_hr, distance_unit)
  VALUES (1, @name, @school, @class_year, @primary_events,
          @threshold_pace_sec, @max_hr, @resting_hr, @distance_unit)
  ON CONFLICT (id) DO UPDATE SET
    name = excluded.name, school = excluded.school, class_year = excluded.class_year,
    primary_events = excluded.primary_events, distance_unit = excluded.distance_unit`;

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
  if (athlete.n === 0) db.prepare(INSERT_DEFAULT_ATHLETE).run(DEFAULT_ATHLETE);
  return db;
}

// Next.js dev reloads the module graph on every edit; reusing the handle keeps
// us from opening a new connection per hot reload.
export const db: Database.Database = globalThis.__project239_db ?? open();
if (process.env.NODE_ENV !== 'production') globalThis.__project239_db = db;
