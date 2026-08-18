/**
 * Fills the log with ~12 weeks of plausible mid-distance training so the
 * dashboard has something to show before you have logged anything real.
 *
 *   npm run seed            # adds demo data alongside whatever is there
 *   npm run seed -- --reset # wipes the log first
 *
 * This is throwaway demo data. Delete data/training.db to start clean.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.PROJECT239_DB ?? path.join(process.cwd(), 'data', 'training.db');
const MI = 1609.344;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'schema.sql'), 'utf8'));

if (process.argv.includes('--reset')) {
  db.exec('DELETE FROM rep; DELETE FROM lift; DELETE FROM session; DELETE FROM wellness; DELETE FROM race; DELETE FROM niggle;');
}

// Deterministic pseudo-random, so re-seeding produces the same week.
let seed = 239;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const jitter = (base, spread) => base + (rand() - 0.5) * 2 * spread;

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (date, n) => {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
};

const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
const mondayOffset = (today.getUTCDay() + 6) % 7;
const thisMonday = addDays(today, -mondayOffset);
const WEEKS = 12;

db.prepare(
  `INSERT INTO athlete (id, name, school, class_year, primary_events, threshold_pace_sec, max_hr, resting_hr, distance_unit)
   VALUES (1, 'Athlete', 'State University', 'Junior', '1500m / 5000m', 330, 192, 42, 'mi')
   ON CONFLICT (id) DO UPDATE SET
     school = excluded.school, class_year = excluded.class_year,
     primary_events = excluded.primary_events, threshold_pace_sec = excluded.threshold_pace_sec,
     max_hr = excluded.max_hr, resting_hr = excluded.resting_hr`,
).run();

const insertSession = db.prepare(
  `INSERT INTO session (date, slot, type, title, distance_m, duration_sec, intensity, rpe, surface, shoes, avg_hr, feel, notes)
   VALUES (@date, @slot, @type, @title, @distance_m, @duration_sec, @intensity, @rpe, @surface, @shoes, @avg_hr, @feel, @notes)
   ON CONFLICT (date, slot) DO NOTHING`,
);
const insertRep = db.prepare(
  `INSERT INTO rep (session_id, set_index, rep_index, distance_m, duration_sec, rest_sec)
   VALUES (?, 1, ?, ?, ?, ?)`,
);
const insertWellness = db.prepare(
  `INSERT INTO wellness (date, sleep_hours, sleep_quality, soreness, fatigue, stress, motivation, resting_hr, body_mass_kg, note)
   VALUES (@date, @sleep_hours, @sleep_quality, @soreness, @fatigue, @stress, @motivation, @resting_hr, @body_mass_kg, @note)
   ON CONFLICT (date) DO NOTHING`,
);

// Workout menu, cycled across the block.
const WORKOUTS = [
  { title: '6 x 800m @ 5k pace', reps: 6, dist: 800, target: 148, rest: 120 },
  { title: '5 x 1000m @ threshold', reps: 5, dist: 1000, target: 200, rest: 90 },
  { title: '12 x 400m @ mile pace', reps: 12, dist: 400, target: 66, rest: 75 },
  { title: '4 x 1200m cut-down', reps: 4, dist: 1200, target: 224, rest: 150 },
  { title: '8 x 600m @ 3k pace', reps: 8, dist: 600, target: 106, rest: 120 },
  { title: '3 x 2000m @ threshold', reps: 3, dist: 2000, target: 410, rest: 120 },
];

const easyPace = 435; // sec/mile
let sessionCount = 0;
let repCount = 0;

for (let w = WEEKS - 1; w >= 0; w--) {
  const monday = addDays(thisMonday, -7 * w);
  const weekIndex = WEEKS - 1 - w;
  // Build up, with a down week every fourth.
  const isDownWeek = weekIndex % 4 === 3;
  const base = 46 + weekIndex * 1.9;
  const weeklyMiles = isDownWeek ? base * 0.78 : base;

  const workout = WORKOUTS[weekIndex % WORKOUTS.length];
  const longRun = Math.round(weeklyMiles * 0.24);
  const workoutMiles = 9;
  const tempoMiles = isDownWeek ? 0 : 8;
  const remaining = Math.max(weeklyMiles - longRun - workoutMiles - tempoMiles, 12);
  const easyDay = remaining / 4;

  const plan = [
    { offset: 0, type: 'easy', miles: easyDay, title: 'Easy + strides' },
    { offset: 1, type: 'workout', miles: workoutMiles, title: workout.title, workout },
    { offset: 2, type: 'easy', miles: easyDay, title: 'Easy' },
    { offset: 3, type: tempoMiles ? 'tempo' : 'easy', miles: tempoMiles || easyDay, title: tempoMiles ? '4 mile tempo' : 'Easy' },
    { offset: 4, type: 'easy', miles: easyDay, title: 'Easy + drills' },
    { offset: 5, type: 'long', miles: longRun, title: 'Long run' },
    { offset: 6, type: easyDay > 6 ? 'recovery' : 'off', miles: easyDay > 6 ? 5 : 0, title: 'Recovery' },
  ];

  for (const day of plan) {
    const date = addDays(monday, day.offset);
    if (date > today) continue;
    if (day.type === 'off') {
      insertSession.run({
        date: iso(date), slot: 'am', type: 'off', title: 'Off', distance_m: null,
        duration_sec: null, intensity: 'easy', rpe: null, surface: null, shoes: null,
        avg_hr: null, feel: null, notes: null,
      });
      continue;
    }

    const intensity =
      day.type === 'workout' ? 'hard' : day.type === 'tempo' ? 'moderate' : 'easy';
    const paceSec =
      day.type === 'workout' ? 390 : day.type === 'tempo' ? 372 : day.type === 'long' ? 420 : easyPace;
    const miles = Math.max(jitter(day.miles, 0.4), 3);
    const rpe = day.type === 'workout' ? 8 : day.type === 'tempo' ? 7 : day.type === 'long' ? 6 : 4;

    const info = insertSession.run({
      date: iso(date),
      slot: 'am',
      type: day.type,
      title: day.title,
      distance_m: miles * MI,
      duration_sec: Math.round(miles * jitter(paceSec, 8)),
      intensity,
      rpe,
      surface: day.type === 'workout' ? 'track' : 'road',
      shoes: day.type === 'workout' ? 'Spikes / super trainers' : 'Daily trainers',
      avg_hr: Math.round(jitter(day.type === 'easy' ? 138 : 162, 6)),
      feel: Math.max(1, Math.min(5, Math.round(jitter(4, 1)))),
      notes: day.type === 'workout' ? 'Felt controlled through rep 4, last two were a grind.' : null,
    });

    if (info.changes === 0) continue;
    sessionCount += 1;
    const sessionId = info.lastInsertRowid;

    if (day.workout) {
      const { reps, dist, target, rest } = day.workout;
      for (let r = 1; r <= reps; r++) {
        // Slight positive split as the workout goes on, plus noise.
        const drift = (r - 1) * 0.35;
        insertRep.run(sessionId, r, dist, Number(jitter(target + drift, 1.2).toFixed(1)), rest);
        repCount += 1;
      }
    }

    // Doubles on the two biggest weeks of the block.
    if (weekIndex >= WEEKS - 3 && (day.offset === 1 || day.offset === 4)) {
      const pmMiles = jitter(4, 0.5);
      const pm = insertSession.run({
        date: iso(date), slot: 'pm', type: 'recovery', title: 'PM shakeout',
        distance_m: pmMiles * MI, duration_sec: Math.round(pmMiles * 470),
        intensity: 'easy', rpe: 3, surface: 'road', shoes: 'Daily trainers',
        avg_hr: 128, feel: 4, notes: null,
      });
      if (pm.changes > 0) sessionCount += 1;
    }
  }

  // Morning check-ins, a bit worse in the heavy weeks.
  for (let d = 0; d < 7; d++) {
    const date = addDays(monday, d);
    if (date > today) continue;
    const strain = isDownWeek ? -0.6 : weekIndex / 8;
    insertWellness.run({
      date: iso(date),
      sleep_hours: Number(jitter(7.6 - strain * 0.4, 0.7).toFixed(1)),
      sleep_quality: clamp(Math.round(jitter(4 - strain * 0.4, 0.8))),
      soreness: clamp(Math.round(jitter(2 + strain * 0.6, 0.8))),
      fatigue: clamp(Math.round(jitter(2.2 + strain * 0.7, 0.8))),
      stress: clamp(Math.round(jitter(2.4, 0.9))),
      motivation: clamp(Math.round(jitter(4 - strain * 0.3, 0.7))),
      resting_hr: Math.round(jitter(43 + strain * 2, 2)),
      body_mass_kg: Number(jitter(63.5, 0.5).toFixed(1)),
      note: null,
    });
  }
}

const insertRace = db.prepare(
  `INSERT INTO race (date, meet, event, distance_m, time_sec, season, place, splits, notes)
   VALUES (@date, @meet, @event, @distance_m, @time_sec, @season, @place, @splits, @notes)`,
);
const races = [
  { date: iso(addDays(thisMonday, -7 * 9)), meet: 'Season Opener', event: '1500m', distance_m: 1500, time_sec: 238.6, season: 'outdoor', place: 5, splits: '62 / 64 / 63', notes: 'Rust buster, sat in too long.' },
  { date: iso(addDays(thisMonday, -7 * 5)), meet: 'Invitational', event: '5000m', distance_m: 5000, time_sec: 878.2, season: 'outdoor', place: 3, splits: '69 / 70 / 71 / 70 / 68', notes: 'Even effort, good close.' },
  { date: iso(addDays(thisMonday, -7 * 2)), meet: 'Conference', event: '1500m', distance_m: 1500, time_sec: 232.9, season: 'outdoor', place: 2, splits: '60 / 62 / 62', notes: 'PR. Went with the move at 800.' },
];
for (const race of races) {
  const exists = db.prepare('SELECT 1 FROM race WHERE date = ? AND event = ?').get(race.date, race.event);
  if (!exists) insertRace.run(race);
}

function clamp(n) {
  return Math.max(1, Math.min(5, n));
}

console.log(`Seeded ${sessionCount} sessions, ${repCount} reps, and ${races.length} races into ${DB_PATH}`);
