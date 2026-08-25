import { db } from './db';
import { addDays } from './training';
import type {
  Athlete, Lift, Niggle, Race, Rep, Session, SessionWithDetail, Wellness,
} from './types';

// --- athlete ---------------------------------------------------------------

export function getAthlete(): Athlete {
  return db.prepare('SELECT * FROM athlete WHERE id = 1').get() as Athlete;
}

export function updateAthlete(patch: Partial<Omit<Athlete, 'id' | 'created_at'>>): void {
  const fields = Object.keys(patch);
  if (fields.length === 0) return;
  const assignments = fields.map((f) => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE athlete SET ${assignments} WHERE id = 1`).run(patch);
}

// --- sessions --------------------------------------------------------------

export function listSessions(opts: { since?: string; limit?: number; type?: string } = {}): Session[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (opts.since) { where.push('date >= @since'); params.since = opts.since; }
  if (opts.type)  { where.push('type = @type');   params.type = opts.type; }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = opts.limit ? 'LIMIT @limit' : '';
  if (opts.limit) params.limit = opts.limit;
  return db
    .prepare(`SELECT * FROM session ${clause} ORDER BY date DESC, slot DESC ${limit}`)
    .all(params) as Session[];
}

/** Sessions in the trailing window used by the dashboard's load and volume math. */
export function sessionsSince(days: number, asOf: string): Session[] {
  return db
    .prepare('SELECT * FROM session WHERE date >= ? AND date <= ? ORDER BY date DESC, slot DESC')
    .all(addDays(asOf, -(days - 1)), asOf) as Session[];
}

/** Date of the first session ever logged, or null on an empty log. */
export function earliestSessionDate(): string | null {
  const row = db.prepare('SELECT MIN(date) AS date FROM session').get() as { date: string | null };
  return row?.date ?? null;
}

export function getSession(id: number): SessionWithDetail | null {
  const session = db.prepare('SELECT * FROM session WHERE id = ?').get(id) as Session | undefined;
  if (!session) return null;
  return {
    ...session,
    reps: db
      .prepare('SELECT * FROM rep WHERE session_id = ? ORDER BY set_index, rep_index')
      .all(id) as Rep[],
    lifts: db.prepare('SELECT * FROM lift WHERE session_id = ? ORDER BY id').all(id) as Lift[],
  };
}

type SessionInput = Omit<Session, 'id' | 'created_at' | 'updated_at'>;
type RepInput = Omit<Rep, 'id' | 'session_id'>;
type LiftInput = Omit<Lift, 'id' | 'session_id'>;

const INSERT_SESSION = `
  INSERT INTO session (date, slot, type, title, distance_m, duration_sec, intensity,
                       rpe, surface, shoes, avg_hr, max_hr, feel, notes)
  VALUES (@date, @slot, @type, @title, @distance_m, @duration_sec, @intensity,
          @rpe, @surface, @shoes, @avg_hr, @max_hr, @feel, @notes)`;

const UPDATE_SESSION = `
  UPDATE session SET date = @date, slot = @slot, type = @type, title = @title,
    distance_m = @distance_m, duration_sec = @duration_sec, intensity = @intensity,
    rpe = @rpe, surface = @surface, shoes = @shoes, avg_hr = @avg_hr, max_hr = @max_hr,
    feel = @feel, notes = @notes, updated_at = datetime('now')
  WHERE id = @id`;

/** Reps and lifts are replaced wholesale — the form always posts the full set. */
export const saveSession = db.transaction(
  (input: SessionInput, reps: RepInput[], lifts: LiftInput[], id?: number): number => {
    let sessionId = id;
    if (sessionId == null) {
      sessionId = Number(db.prepare(INSERT_SESSION).run(input).lastInsertRowid);
    } else {
      db.prepare(UPDATE_SESSION).run({ ...input, id: sessionId });
      db.prepare('DELETE FROM rep WHERE session_id = ?').run(sessionId);
      db.prepare('DELETE FROM lift WHERE session_id = ?').run(sessionId);
    }

    const insertRep = db.prepare(
      `INSERT INTO rep (session_id, set_index, rep_index, distance_m, duration_sec, rest_sec, note)
       VALUES (@session_id, @set_index, @rep_index, @distance_m, @duration_sec, @rest_sec, @note)`,
    );
    for (const rep of reps) insertRep.run({ ...rep, session_id: sessionId });

    const insertLift = db.prepare(
      `INSERT INTO lift (session_id, exercise, sets, reps, load_kg, note)
       VALUES (@session_id, @exercise, @sets, @reps, @load_kg, @note)`,
    );
    for (const lift of lifts) insertLift.run({ ...lift, session_id: sessionId });

    return sessionId;
  },
);

export function deleteSession(id: number): void {
  db.prepare('DELETE FROM session WHERE id = ?').run(id);
}

// --- wellness --------------------------------------------------------------

export function getWellness(date: string): Wellness | undefined {
  return db.prepare('SELECT * FROM wellness WHERE date = ?').get(date) as Wellness | undefined;
}

export function listWellness(since: string): Wellness[] {
  return db
    .prepare('SELECT * FROM wellness WHERE date >= ? ORDER BY date DESC')
    .all(since) as Wellness[];
}

export function saveWellness(entry: Wellness): void {
  db.prepare(
    `INSERT INTO wellness (date, sleep_hours, sleep_quality, soreness, fatigue, stress,
                           motivation, resting_hr, body_mass_kg, note)
     VALUES (@date, @sleep_hours, @sleep_quality, @soreness, @fatigue, @stress,
             @motivation, @resting_hr, @body_mass_kg, @note)
     ON CONFLICT (date) DO UPDATE SET
       sleep_hours = excluded.sleep_hours, sleep_quality = excluded.sleep_quality,
       soreness = excluded.soreness, fatigue = excluded.fatigue, stress = excluded.stress,
       motivation = excluded.motivation, resting_hr = excluded.resting_hr,
       body_mass_kg = excluded.body_mass_kg, note = excluded.note`,
  ).run(entry);
}

// --- races -----------------------------------------------------------------

export function listRaces(): Race[] {
  return db.prepare('SELECT * FROM race ORDER BY date DESC').all() as Race[];
}

export function saveRace(race: Omit<Race, 'id'>, id?: number): void {
  if (id == null) {
    db.prepare(
      `INSERT INTO race (date, meet, event, distance_m, time_sec, season, place, splits, notes)
       VALUES (@date, @meet, @event, @distance_m, @time_sec, @season, @place, @splits, @notes)`,
    ).run(race);
  } else {
    db.prepare(
      `UPDATE race SET date = @date, meet = @meet, event = @event, distance_m = @distance_m,
         time_sec = @time_sec, season = @season, place = @place, splits = @splits, notes = @notes
       WHERE id = @id`,
    ).run({ ...race, id });
  }
}

export function deleteRace(id: number): void {
  db.prepare('DELETE FROM race WHERE id = ?').run(id);
}

/** Best time per event distance — the PR board. */
export function personalBests(): Race[] {
  return db
    .prepare(
      `SELECT r.* FROM race r
       JOIN (SELECT distance_m, MIN(time_sec) AS best FROM race GROUP BY distance_m) b
         ON b.distance_m = r.distance_m AND b.best = r.time_sec
       GROUP BY r.distance_m
       ORDER BY r.distance_m`,
    )
    .all() as Race[];
}

// --- niggles ---------------------------------------------------------------

export function listNiggles(): Niggle[] {
  return db
    .prepare('SELECT * FROM niggle ORDER BY (date_end IS NOT NULL), date_start DESC')
    .all() as Niggle[];
}

export function saveNiggle(entry: Omit<Niggle, 'id'>, id?: number): void {
  if (id == null) {
    db.prepare(
      `INSERT INTO niggle (date_start, date_end, body_part, severity, note)
       VALUES (@date_start, @date_end, @body_part, @severity, @note)`,
    ).run(entry);
  } else {
    db.prepare(
      `UPDATE niggle SET date_start = @date_start, date_end = @date_end,
         body_part = @body_part, severity = @severity, note = @note WHERE id = @id`,
    ).run({ ...entry, id });
  }
}

export function deleteNiggle(id: number): void {
  db.prepare('DELETE FROM niggle WHERE id = ?').run(id);
}
