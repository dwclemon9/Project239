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

## Intensity is a property of segments, not sessions

The first version put a session's whole distance into one band, so a 9-mile
workout with 6 x 800m counted 9 miles as hard when only 3 of them were. That
overstated quality volume badly enough to make the 80/20 tile lie — it read 52%
easy on training that was really 89% easy.

`intensitySplit` divides a session's distance across the three bands:

1. **Reps logged** — each timed rep is banded by its own pace; whatever distance
   is left over is warmup, cooldown and recovery jog, which are easy by
   definition. An untimed rep takes the session's declared band, since it is
   still quality work.
2. **No reps** — the session's average pace bands the whole thing.
3. **No pace derivable** (no duration, or no threshold pace set) — falls back to
   the intensity declared on the form.

The band edges are relative to threshold pace, in seconds per mile:
`MODERATE_FAST_EDGE = -10`, `MODERATE_SLOW_EDGE = +30`. So threshold through
roughly marathon pace is moderate, faster is hard, easier is easy — which is the
distinction the 80/20 rule is actually about. Both constants are exported and
meant to be tuned against how the athlete actually runs.

Two guards worth keeping: rep distance is capped at the session's own distance,
so a mistyped rep cannot invent volume that was never run; and the three bands
always sum to exactly the session distance, which a test asserts directly.

The declared `intensity` field survives as the fallback, and the session page
names which of the three rules produced its split — the classification should
never look like magic.

## Refusing to report numbers that aren't earned

Two places deliberately show nothing rather than something plausible:

- **Acute:chronic load** needs `CHRONIC_WINDOW_DAYS` (28) of history. The ratio
  divides the 7-day load by a 28-day average; on a log that is nine days old
  that average is spread over three weeks of nothing, so ordinary training
  reads as a 2.5 spike. A young log gets `ratio: null` and says why.
- **Readiness** needs at least three fields in the check-in.

The charts follow the same principle from the other side: they start at the
first logged session rather than padding the axis backwards, so a bar on screen
always means a period the athlete actually trained through.

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
- **One chart component, three periods.** `VolumeChart` takes pre-built
  `VolumeBucket`s and never knows whether a bar is a day, a week, or a month.
  The rollups in `training.ts` share one bucketizer, so a fix to the intensity
  split or the empty-period handling lands on all three at once.
- **The rolling average is an annotation, not a series** — drawn in muted ink so
  it does not compete with the ramp for meaning, and suppressed entirely when
  there are not more buckets than the window (a 3-month average over 3 months
  is just the data again).
- **Every period gets an axis floor** (`minAxisTop`). Without one, a week you
  have not started yet draws a 0-1 axis ticked in quarter miles, which reads as
  broken rather than empty.
- **One y-axis, ever.** No dual-scale charts.
- **Status colors are reserved** for load and readiness state, never for a data
  series, and always ship with a glyph and a written label so color never
  carries the meaning alone.
- Every chart has a **table-view twin** in a `<details>` block, hover tooltips
  that enhance rather than gate the values, and hit areas that span the whole
  band rather than the mark.
- Direct labels are selective — the endpoint of a trend, never a number on
  every point.

## Form errors

`session` has `UNIQUE (date, slot)`, which is what makes doubles work — but it
also means re-logging a day you already have is a constraint violation, and an
athlete will do that. `saveSessionAction` catches it and returns a readable
message naming the free slot, rather than throwing.

React 19 resets an uncontrolled form once its action resolves, so a rejected
save has to hand back what was typed or the athlete loses the whole entry. The
action echoes the scalar fields in its returned state and bumps an `attempt`
counter that re-keys the form; reps and lifts are React state and survive on
their own.

## Theming

Light values are defined on bare `:root`. Dark redefines only what changes, in
two places: a `prefers-color-scheme` media query guarded with
`:not([data-theme="light"])`, and an explicit `:root[data-theme="dark"]` block.
No color has its only definition inside a media query.

## Imports carry explicit `.ts` extensions

`training.ts` imports a constant from `format.ts` by its full filename. The test
suite runs on Node's type-stripping loader, which resolves ESM strictly and will
not guess an extension, while the bundler is happy either way. Writing the
extension is what lets the same modules be imported by both without duplicating
constants across files.

## The macOS launcher

`scripts/mac/install.sh` writes a LaunchAgent that runs `scripts/mac/serve.sh`
at login. Two details are load-bearing:

- **The node path is resolved at install time and written into the job.**
  launchd starts with a bare PATH, so a node installed through nvm — which
  lives only in a shell profile — would be invisible at login. The installer
  detects nvm and warns that switching versions means re-running it.
- **Builds are staged.** `next build` empties its output directory before it
  starts, so building into `.next` destroys the running dashboard the moment a
  build fails. `next.config.ts` reads `NEXT_DIST_DIR`, the launcher builds into
  `.next-build`, and only a successful build gets moved into place. This was
  found by deliberately breaking a source file and watching the first version
  of the script report "serving the previous build" and then exit, because
  there was no previous build left to serve.

A stamp file holds the commit and lockfile hash the current build came from, so
an unchanged checkout skips the build and starts in about two seconds.

## Local-first

One SQLite file at `data/training.db`, gitignored. `better-sqlite3` is
synchronous, which suits server components — no connection pool, no async
plumbing, and the whole log is a file you can copy to back up.

The connection is cached on `globalThis` in development so Next's hot reload
does not open a new handle on every edit.
