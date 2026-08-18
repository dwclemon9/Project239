import type { DistanceUnit } from './types';

export const METERS_PER_MILE = 1609.344;
export const METERS_PER_KM = 1000;

export function metersPer(unit: DistanceUnit): number {
  return unit === 'km' ? METERS_PER_KM : METERS_PER_MILE;
}

/** Meters -> the athlete's display unit, as a number. */
export function toUnit(meters: number, unit: DistanceUnit): number {
  return meters / metersPer(unit);
}

export function fromUnit(value: number, unit: DistanceUnit): number {
  return value * metersPer(unit);
}

export function formatDistance(meters: number | null, unit: DistanceUnit, digits = 1): string {
  if (meters == null) return '—';
  return `${toUnit(meters, unit).toFixed(digits)} ${unit}`;
}

/** Seconds -> h:mm:ss, or m:ss under an hour. Rounds to whole seconds. */
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Rep times are read at a finer grain than run durations — a 400 in 58.4 is a
 * different rep than a 58.9 — so keep a tenth when the value carries one.
 */
export function formatRepTime(seconds: number | null): string {
  if (seconds == null) return '\u2014';
  const total = Math.round(seconds * 10) / 10;   // settle the rounding before splitting
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  const showTenths = Math.abs(s - Math.round(s)) > 1e-9;
  const sStr = showTenths ? s.toFixed(1) : String(Math.round(s));
  if (m === 0) return sStr;
  return `${m}:${s < 10 ? '0' : ''}${sStr}`;
}

/** Pace per display unit, e.g. "6:42 /mi". Returns "—" when it can't be computed. */
export function formatPace(
  meters: number | null,
  seconds: number | null,
  unit: DistanceUnit,
): string {
  if (!meters || !seconds || meters <= 0 || seconds <= 0) return '—';
  return `${formatDuration(paceSecPerUnit(meters, seconds, unit))} /${unit}`;
}

export function paceSecPerUnit(meters: number, seconds: number, unit: DistanceUnit): number {
  return seconds / (meters / metersPer(unit));
}

/** Parse "6:42", "402", or "6:42.5" into seconds. Returns null on anything else. */
export function parseTimeToSeconds(input: string | null | undefined): number | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (raw === '') return null;
  const parts = raw.split(':');
  if (parts.length > 3) return null;
  let seconds = 0;
  for (const part of parts) {
    if (!/^\d*\.?\d*$/.test(part) || part === '' || part === '.') return null;
    seconds = seconds * 60 + Number(part);
  }
  return Number.isFinite(seconds) ? seconds : null;
}

export function parseNumber(input: FormDataEntryValue | null): number | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseText(input: FormDataEntryValue | null): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  return raw === '' ? null : raw;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  easy: 'Easy run',
  long: 'Long run',
  workout: 'Workout',
  tempo: 'Tempo',
  recovery: 'Recovery',
  shakeout: 'Shakeout',
  race: 'Race',
  strength: 'Strength',
  cross_train: 'Cross-train',
  off: 'Off',
};

export function sessionTypeLabel(type: string): string {
  return SESSION_TYPE_LABELS[type] ?? type;
}

export function formatDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}
