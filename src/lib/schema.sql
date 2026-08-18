-- Project239 — training log schema for a mid-distance / distance athlete.
-- Canonical storage units: meters for distance, seconds for time, kilograms for load.
-- Display units are a presentation concern (see src/lib/format.ts).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS athlete (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  name               TEXT    NOT NULL,
  school             TEXT,
  class_year         TEXT,
  primary_events     TEXT,                                   -- free text, e.g. "800m / 1500m"
  threshold_pace_sec INTEGER,                                -- sec per mile at lactate threshold; anchors pace zones
  max_hr             INTEGER,
  resting_hr         INTEGER,
  distance_unit      TEXT    NOT NULL DEFAULT 'mi' CHECK (distance_unit IN ('mi', 'km')),
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One row per training session. Doubles are two rows sharing a date.
CREATE TABLE IF NOT EXISTS session (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT    NOT NULL,                             -- YYYY-MM-DD (local)
  slot         TEXT    NOT NULL DEFAULT 'am' CHECK (slot IN ('am', 'pm')),
  type         TEXT    NOT NULL CHECK (type IN (
                 'easy', 'long', 'workout', 'tempo', 'recovery',
                 'shakeout', 'race', 'strength', 'cross_train', 'off')),
  title        TEXT,
  distance_m   REAL,
  duration_sec INTEGER,
  intensity    TEXT    NOT NULL DEFAULT 'easy' CHECK (intensity IN ('easy', 'moderate', 'hard')),
  rpe          INTEGER CHECK (rpe BETWEEN 1 AND 10),          -- session RPE, drives training load
  surface      TEXT    CHECK (surface IN ('track', 'road', 'trail', 'grass', 'treadmill', 'indoor')),
  shoes        TEXT,
  avg_hr       INTEGER,
  max_hr       INTEGER,
  feel         INTEGER CHECK (feel BETWEEN 1 AND 5),          -- 1 rough -> 5 great
  notes        TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (date, slot)
);

CREATE INDEX IF NOT EXISTS idx_session_date ON session (date DESC);
CREATE INDEX IF NOT EXISTS idx_session_type ON session (type);

-- Individual reps inside a workout: 6x800, 4x1mi, 200m strides.
CREATE TABLE IF NOT EXISTS rep (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   INTEGER NOT NULL REFERENCES session (id) ON DELETE CASCADE,
  set_index    INTEGER NOT NULL DEFAULT 1,                   -- for sets of reps, e.g. 2 x (4x400)
  rep_index    INTEGER NOT NULL,
  distance_m   REAL,
  duration_sec REAL,
  rest_sec     INTEGER,
  note         TEXT
);

CREATE INDEX IF NOT EXISTS idx_rep_session ON rep (session_id, set_index, rep_index);

-- Lifts and general strength work attached to a session.
CREATE TABLE IF NOT EXISTS lift (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES session (id) ON DELETE CASCADE,
  exercise   TEXT    NOT NULL,
  sets       INTEGER,
  reps       INTEGER,
  load_kg    REAL,
  note       TEXT
);

CREATE INDEX IF NOT EXISTS idx_lift_session ON lift (session_id);

-- Morning check-in. One row per day; the readiness score is derived, not stored.
CREATE TABLE IF NOT EXISTS wellness (
  date          TEXT PRIMARY KEY,
  sleep_hours   REAL,
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5), -- 5 = slept great
  soreness      INTEGER CHECK (soreness      BETWEEN 1 AND 5), -- 5 = very sore
  fatigue       INTEGER CHECK (fatigue       BETWEEN 1 AND 5), -- 5 = wrecked
  stress        INTEGER CHECK (stress        BETWEEN 1 AND 5), -- 5 = very stressed
  motivation    INTEGER CHECK (motivation    BETWEEN 1 AND 5), -- 5 = fired up
  resting_hr    INTEGER,
  body_mass_kg  REAL,
  note          TEXT
);

-- Races. PRs are derived by querying best time per event rather than stored as a flag.
CREATE TABLE IF NOT EXISTS race (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT    NOT NULL,
  meet       TEXT,
  event      TEXT    NOT NULL,                               -- display label, e.g. "1500m"
  distance_m REAL    NOT NULL,                               -- canonical distance for PR grouping
  time_sec   REAL    NOT NULL,
  season     TEXT    CHECK (season IN ('xc', 'indoor', 'outdoor')),
  place      INTEGER,
  splits     TEXT,                                           -- free text, e.g. "64 / 66 / 63"
  notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_race_event ON race (distance_m, time_sec);

-- Niggles and injuries. An open entry has date_end IS NULL.
CREATE TABLE IF NOT EXISTS niggle (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date_start TEXT    NOT NULL,
  date_end   TEXT,
  body_part  TEXT    NOT NULL,
  severity   INTEGER CHECK (severity BETWEEN 1 AND 5),
  note       TEXT
);
