# Project239

A training dashboard and workout log built for a D1 mid-distance / distance
runner. Local-first: your whole training history lives in one SQLite file on
your own machine. No account, no server, no one else reading your log.

## Running it

```bash
npm install
npm run seed      # optional: 12 weeks of demo training so the dashboard isn't blank
npm run dev       # http://localhost:3000
```

`npm run seed -- --reset` wipes the log first. To start genuinely clean, delete
`data/training.db` — it is gitignored, so your log never lands in a commit.

```bash
npm test          # unit tests for the training math
npm run build     # production build
```

## What it does

**Dashboard** — the numbers that actually change training decisions:

- Last 7 days and current-week volume, with the change against the prior week.
- **Weekly volume by intensity** over 12 weeks, stacked easy / moderate / hard,
  with a 4-week rolling average line.
- **Acute:chronic workload ratio** — 7-day training load against your 28-day
  norm. Roughly 0.8–1.3 is the productive range; past ~1.5 you have spiked your
  load. It needs about four weeks of history before it means anything.
- **Easy volume share** — the 80/20 check. If quality creeps past ~25% of your
  weekly volume, the tile says so.
- Readiness trend from your morning check-ins, personal bests, open niggles,
  and recent sessions.

**Log** — sessions grouped by training week. Each session carries distance,
duration, derived pace, RPE, intensity, surface, shoes, heart rate, and notes.

- **Reps.** A workout is not one number. The rep builder adds "6 × 800m" in one
  click, then you fill in splits at the track. The session page shows each rep's
  pace, rest, and its delta against the session average, so you can see the
  workout fall apart (or not) rep by rep.
- **Doubles.** Two sessions per date, AM and PM.
- **Strength.** Lifts attach to a session — exercise, sets, reps, load.

**Check-in** — the two-minute morning entry: sleep, sleep quality, fatigue,
soreness, stress, motivation, resting HR, body mass. It feeds a 0–100 readiness
score, which is deliberately withheld until at least three fields are filled so
a half-finished check-in never reads as a precise number. Niggles and injuries
are tracked here too; an open one shows on the dashboard.

**Races** — every race with splits and place, plus an automatic PR board (best
time at each distance, derived rather than flagged by hand).

**Zones** — pace zones anchored to your threshold pace, with a target-split
table for 200m through 3200m. A starting point to adjust against how the work
actually goes, not gospel.

## How the data is modeled

Distances are stored in meters, times in seconds, loads in kilograms —
always. Display units are a presentation concern, so switching between miles
and kilometers in settings never rewrites your history.

| Table | What it holds |
|---|---|
| `athlete` | Single-row profile: threshold pace, units, HR, events |
| `session` | One training session; `UNIQUE (date, slot)` allows AM/PM doubles |
| `rep` | Individual reps inside a workout |
| `lift` | Strength work attached to a session |
| `wellness` | One morning check-in per day |
| `race` | Races; PRs are derived by query, not stored as a flag |
| `niggle` | Injuries and niggles; open ones have no end date |

Training weeks run Monday → Sunday. Dates are plain `YYYY-MM-DD` strings
throughout, never timestamps, so a session logged late at night can't drift
into the wrong day.

## Stack

Next.js 15 (App Router, server components, server actions), TypeScript,
better-sqlite3, and hand-written CSS. Charts are inline SVG with no charting
library. Both themes are explicitly designed — see `docs/design-notes.md`.

## Where to take it next

- Import from Strava or a Garmin `.fit`/`.gpx` export so runs land automatically.
- A planned-vs-actual view: enter the week's plan, compare against what happened.
- Share a read-only view with your coach (this is the point where it stops being
  local-only and needs real auth).
- Season planning backwards from goal meets, with target weekly volume per block.
