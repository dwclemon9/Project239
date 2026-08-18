# Design notes

Short record of the decisions that are easy to get wrong later.

## Units

Meters, seconds, kilograms in the database. Nothing else. Every display unit is
converted at render time via `src/lib/format.ts`, so switching the athlete
between miles and kilometers is a settings change, not a migration.

Rep distances are the exception in the UI only: reps are *typed* in meters,
because that is how track reps are named ("6 × 800"), not because the storage
differs.

Times are read at two grains. Run durations round to the second
(`formatDuration`); rep splits keep a tenth when the value carries one
(`formatRepTime`), because a 400 in 58.4 is a different rep than a 58.9.

## Dates

Every date is a plain `YYYY-MM-DD` string, and all date arithmetic goes through
`src/lib/training.ts`. No `Date` objects with times, no UTC-vs-local conversion
on stored values. A run logged at 11pm belongs to that day, always.

Training weeks are Monday → Sunday, which is how a mileage week is counted.

## Training load

Session load is sRPE: `duration_minutes × RPE`. When RPE is missing, a per-type
default fills in (`workout` 8, `easy` 4, and so on) so a log with sparse RPE
still trends rather than collapsing to zero.

The acute:chronic ratio compares the trailing 7-day load against the trailing
28-day load scaled to a 7-day equivalent. It is a trend indicator, not a
diagnosis, and it returns `null` rather than a fabricated number when there is
no history. The zone bands (< 0.8 detraining, 0.8–1.3 productive, 1.3–1.5
ramping, > 1.5 spike) follow the commonly cited spread.

**A long run counts as easy volume.** For a distance runner it is aerobic work,
not quality. Defaulting it to "moderate" made the 80/20 split read as though
every week was too hard.

## Readiness

A 0–100 weighted score from the morning check-in. Sleep and fatigue carry the
most weight. It is withheld entirely until at least three fields are filled — a
half-finished check-in should not render as a confident number.

## Charts

Built as inline SVG, no charting library. The rules they follow:

- **Intensity is an ordinal category** (easy < moderate < hard), so the stacked
  volume chart uses a single-hue ramp, light → dark, not three unrelated colors.
  Both mode ramps were validated for monotone lightness, step separation, and
  contrast against their own surface:
  light `#86b6ef → #2a78d6 → #104281`, dark `#9ec5f4 → #3987e5 → #184f95`.
- **The 4-week average is an annotation, not a series** — drawn in muted ink so
  it does not compete with the ramp for meaning.
- **One y-axis, ever.** No dual-scale charts.
- **Status colors are reserved** for load and readiness state, never for a data
  series, and always ship with a glyph and a written label so color never
  carries the meaning alone.
- Every chart has a **table-view twin** in a `<details>` block, hover tooltips
  that enhance rather than gate the values, and hit areas that span the whole
  band rather than the mark.
- Direct labels are selective — the endpoint of a trend, never a number on
  every point.

## Theming

Light values are defined on bare `:root`. Dark redefines only what changes, in
two places: a `prefers-color-scheme` media query guarded with
`:not([data-theme="light"])`, and an explicit `:root[data-theme="dark"]` block.
No color has its only definition inside a media query.

## Local-first

One SQLite file at `data/training.db`, gitignored. `better-sqlite3` is
synchronous, which suits server components — no connection pool, no async
plumbing, and the whole log is a file you can copy to back up.

The connection is cached on `globalThis` in development so Next's hot reload
does not open a new handle on every edit.
