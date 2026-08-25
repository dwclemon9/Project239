import type { Intensity, Session, VolumeBucket, WeekSummary, Wellness } from './types';

// ---------------------------------------------------------------------------
// Dates. Everything is a plain YYYY-MM-DD string in local terms; no Date math
// on timestamps, so a session never drifts across a day boundary by timezone.
// ---------------------------------------------------------------------------

export function todayISO(): string {
  const now = new Date();
  return isoFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function isoFromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function toUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso: string, days: number): string {
  const dt = toUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / 86_400_000);
}

/** Training weeks run Monday -> Sunday, the way a mileage week is counted. */
export function weekStart(iso: string): string {
  const dow = toUTC(iso).getUTCDay();          // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7));
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, months: number): string {
  const [y, m] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------------------------------------------------------------------------
// Training load
// ---------------------------------------------------------------------------

/**
 * Session load, sRPE style: minutes x RPE. When RPE is missing we fall back to
 * a default for the session type, so a log with sparse RPE still trends.
 */
const DEFAULT_RPE: Record<string, number> = {
  recovery: 3, shakeout: 3, easy: 4, long: 6, tempo: 7,
  workout: 8, race: 9, strength: 5, cross_train: 4, off: 0,
};

export function sessionLoad(session: Pick<Session, 'type' | 'rpe' | 'duration_sec'>): number {
  if (!session.duration_sec) return 0;
  const rpe = session.rpe ?? DEFAULT_RPE[session.type] ?? 5;
  return (session.duration_sec / 60) * rpe;
}

export interface LoadStatus {
  acute: number;        // 7-day load total
  chronic: number;      // 28-day load, scaled to a 7-day equivalent
  ratio: number | null; // acute:chronic; null until there is enough history
  zone: 'undertrained' | 'optimal' | 'high' | 'spike' | 'unknown';
}

/**
 * Acute:chronic workload ratio. The widely used sweet spot is roughly
 * 0.8-1.3; above ~1.5 is the classic "spiked your mileage" signal. It is a
 * trend indicator, not a diagnosis — it needs ~4 weeks of history to mean much.
 */
export function loadStatus(sessions: Session[], asOf: string): LoadStatus {
  const acuteStart = addDays(asOf, -6);
  const chronicStart = addDays(asOf, -27);

  let acute = 0;
  let chronic = 0;
  for (const s of sessions) {
    if (s.date > asOf || s.date < chronicStart) continue;
    const load = sessionLoad(s);
    chronic += load;
    if (s.date >= acuteStart) acute += load;
  }

  const chronicWeekly = chronic / 4;
  if (chronicWeekly <= 0) return { acute, chronic: chronicWeekly, ratio: null, zone: 'unknown' };

  const ratio = acute / chronicWeekly;
  const zone =
    ratio < 0.8 ? 'undertrained' :
    ratio <= 1.3 ? 'optimal' :
    ratio <= 1.5 ? 'high' : 'spike';
  return { acute, chronic: chronicWeekly, ratio, zone };
}

// ---------------------------------------------------------------------------
// Weekly rollups
// ---------------------------------------------------------------------------

/**
 * Fold sessions into pre-built period buckets. Buckets are created up front —
 * including empty ones — so a chart's x-axis stays a true timeline rather than
 * silently closing the gap over a week you did not run.
 */
function bucketize(
  sessions: Session[],
  starts: Array<{ start: string; label: string; title: string }>,
  periodStart: (date: string) => string,
): VolumeBucket[] {
  const buckets = new Map<string, VolumeBucket>();
  for (const spec of starts) {
    buckets.set(spec.start, {
      ...spec, distance_m: 0, easy_m: 0, moderate_m: 0, hard_m: 0,
      duration_sec: 0, sessions: 0, load: 0,
    });
  }

  for (const s of sessions) {
    const bucket = buckets.get(periodStart(s.date));
    if (!bucket) continue;                      // outside the window on screen
    const meters = s.distance_m ?? 0;
    bucket.distance_m += meters;
    bucket.duration_sec += s.duration_sec ?? 0;
    bucket.load += sessionLoad(s);
    if (s.type !== 'off') bucket.sessions += 1;
    if (s.intensity === 'hard') bucket.hard_m += meters;
    else if (s.intensity === 'moderate') bucket.moderate_m += meters;
    else bucket.easy_m += meters;
  }

  return [...buckets.values()];
}

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The seven days of one training week, Monday through Sunday. */
export function dailySummaries(sessions: Session[], anyDateInWeek: string): VolumeBucket[] {
  const monday = weekStart(anyDateInWeek);
  const starts = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { start: date, label: WEEKDAY[i], title: formatDayTitle(date) };
  });
  return bucketize(sessions, starts, (date) => date);
}

/** Trailing training weeks, Monday-anchored, oldest first. */
export function weeklySummaries(sessions: Session[], weeks: number, asOf: string): WeekSummary[] {
  const thisWeek = weekStart(asOf);
  const starts = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    return { start, label: shortDate(start), title: `Week of ${shortDate(start)}` };
  });
  return bucketize(sessions, starts, weekStart);
}

/** Trailing calendar months, oldest first. */
export function monthlySummaries(sessions: Session[], months: number, asOf: string): VolumeBucket[] {
  const thisMonth = monthStart(asOf);
  const starts = Array.from({ length: months }, (_, i) => {
    const start = addMonths(thisMonth, -(months - 1 - i));
    const [year, month] = start.split('-').map(Number);
    return {
      start,
      // Year only where it changes, so the axis does not repeat "2026" twelve times.
      label: month === 1 ? `${MONTH[0]} '${String(year).slice(2)}` : MONTH[month - 1],
      title: `${MONTH[month - 1]} ${year}`,
    };
  });
  return bucketize(sessions, starts, monthStart);
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTH[m - 1]} ${d}`;
}

function formatDayTitle(iso: string): string {
  const dow = toUTC(iso).getUTCDay();
  return `${WEEKDAY[(dow + 6) % 7]}, ${shortDate(iso)}`;
}

/** Share of running volume that is genuinely easy — the 80/20 check. */
export function easyShare(buckets: VolumeBucket[]): number | null {
  const total = buckets.reduce((sum, b) => sum + b.distance_m, 0);
  if (total <= 0) return null;
  return buckets.reduce((sum, b) => sum + b.easy_m, 0) / total;
}

/** Trailing n-day distance total, inclusive of asOf. */
export function distanceInWindow(sessions: Session[], asOf: string, days: number): number {
  const start = addDays(asOf, -(days - 1));
  return sessions
    .filter((s) => s.date >= start && s.date <= asOf)
    .reduce((sum, s) => sum + (s.distance_m ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/**
 * A 0-100 readiness score from the morning check-in. Sleep and fatigue carry
 * the most weight; the score is only shown when at least three inputs exist,
 * so a half-filled check-in never reads as a precise number.
 */
export function readinessScore(w: Wellness | undefined | null): number | null {
  if (!w) return null;
  const parts: number[] = [];
  const scale = (v: number | null, invert: boolean) =>
    v == null ? null : invert ? (5 - v) / 4 : (v - 1) / 4;

  const weighted: Array<[number | null, number]> = [
    [w.sleep_hours == null ? null : Math.min(w.sleep_hours, 9) / 9, 2],
    [scale(w.sleep_quality, false), 1.5],
    [scale(w.fatigue, true), 2],
    [scale(w.soreness, true), 1.5],
    [scale(w.stress, true), 1],
    [scale(w.motivation, false), 1],
  ];

  let sum = 0;
  let weight = 0;
  for (const [value, wt] of weighted) {
    if (value == null) continue;
    parts.push(value);
    sum += Math.max(0, Math.min(1, value)) * wt;
    weight += wt;
  }
  if (parts.length < 3 || weight === 0) return null;
  return Math.round((sum / weight) * 100);
}

// ---------------------------------------------------------------------------
// Pace zones
// ---------------------------------------------------------------------------

export interface PaceZone {
  key: string;
  label: string;
  description: string;
  /** Offsets in seconds per mile relative to threshold pace. */
  offsetFast: number;
  offsetSlow: number;
  intensity: Intensity;
}

/**
 * Zones anchored to threshold (~1-hour race) pace, in seconds per mile.
 * Offsets follow the common Daniels-style spread; they are a starting point to
 * be adjusted against how the athlete actually runs, not gospel.
 */
export const PACE_ZONES: PaceZone[] = [
  { key: 'recovery',  label: 'Recovery',   description: 'Shakeouts, doubles, day after a workout', offsetFast: 105, offsetSlow: 150, intensity: 'easy' },
  { key: 'easy',      label: 'Easy',       description: 'The bulk of the week, aerobic base',      offsetFast: 75,  offsetSlow: 105, intensity: 'easy' },
  { key: 'steady',    label: 'Steady',     description: 'Strong aerobic, long-run finishes',       offsetFast: 35,  offsetSlow: 75,  intensity: 'moderate' },
  { key: 'threshold', label: 'Threshold',  description: 'Tempo and cruise intervals',              offsetFast: -10, offsetSlow: 15,  intensity: 'moderate' },
  { key: 'interval',  label: 'Interval',   description: 'VO2max work, 3-5 min reps',               offsetFast: -35, offsetSlow: -15, intensity: 'hard' },
  { key: 'rep',       label: 'Repetition', description: 'Speed and economy, 200-600m reps',        offsetFast: -70, offsetSlow: -40, intensity: 'hard' },
];

export interface ResolvedZone extends PaceZone {
  fastSec: number;
  slowSec: number;
}

/** Zone paces in seconds per mile, given the athlete's threshold pace. */
export function resolveZones(thresholdPaceSec: number): ResolvedZone[] {
  return PACE_ZONES.map((z) => ({
    ...z,
    fastSec: thresholdPaceSec + z.offsetFast,
    slowSec: thresholdPaceSec + z.offsetSlow,
  }));
}
