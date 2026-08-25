'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { fromUnit, parseNumber, parseText, parseTimeToSeconds } from '@/lib/format';
import {
  deleteNiggle, deleteRace, deleteSession, getAthlete, saveNiggle, saveRace,
  saveSession, saveWellness, updateAthlete,
} from '@/lib/queries';
import type { Intensity, SessionType, Slot, Surface, Season } from '@/lib/types';

function revalidateAll() {
  revalidatePath('/', 'layout');
}

// --- sessions --------------------------------------------------------------

/** What the session form renders back to the athlete when a save is rejected. */
export interface SessionFormState {
  error: string | null;
  /**
   * Echo of what was typed. React resets an uncontrolled form once its action
   * resolves, so a rejected save has to hand the values back or the athlete
   * loses everything they just entered.
   */
  values?: Record<string, string>;
  /** Bumps on each rejection so the form remounts against the echoed values. */
  attempt?: number;
}

// The uncontrolled fields on the session form; the rest are React state and
// survive the reset on their own.
const ECHOED_FIELDS = [
  'date', 'slot', 'title', 'distance', 'duration', 'rpe', 'feel',
  'surface', 'shoes', 'avg_hr', 'max_hr', 'notes',
] as const;

function reject(prev: SessionFormState, formData: FormData, error: string): SessionFormState {
  const values: Record<string, string> = {};
  for (const field of ECHOED_FIELDS) {
    const value = formData.get(field);
    if (value != null) values[field] = String(value);
  }
  return { error, values, attempt: (prev.attempt ?? 0) + 1 };
}

/**
 * Distance is typed in the athlete's display unit and stored in meters; rep
 * distances are typed in meters, the way track reps are actually named.
 */
export async function saveSessionAction(
  _prev: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const unit = getAthlete().distance_unit;
  const idRaw = parseNumber(formData.get('id'));
  const distance = parseNumber(formData.get('distance'));

  const input = {
    date: String(formData.get('date') ?? '').trim(),
    slot: (formData.get('slot') as Slot) ?? 'am',
    type: (formData.get('type') as SessionType) ?? 'easy',
    title: parseText(formData.get('title')),
    distance_m: distance == null ? null : fromUnit(distance, unit),
    duration_sec: parseTimeToSeconds(parseText(formData.get('duration'))),
    intensity: (formData.get('intensity') as Intensity) ?? 'easy',
    rpe: parseNumber(formData.get('rpe')),
    surface: (parseText(formData.get('surface')) as Surface | null) ?? null,
    shoes: parseText(formData.get('shoes')),
    avg_hr: parseNumber(formData.get('avg_hr')),
    max_hr: parseNumber(formData.get('max_hr')),
    feel: parseNumber(formData.get('feel')),
    notes: parseText(formData.get('notes')),
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return reject(_prev, formData, 'A session needs a valid date.');
  }

  const repDistances = formData.getAll('rep_distance');
  const repTimes = formData.getAll('rep_time');
  const repRests = formData.getAll('rep_rest');
  const reps = repDistances
    .map((_, i) => ({
      set_index: 1,
      rep_index: i + 1,
      distance_m: parseNumber(repDistances[i] ?? null),
      duration_sec: parseTimeToSeconds(parseText(repTimes[i] ?? null)),
      rest_sec: parseTimeToSeconds(parseText(repRests[i] ?? null)),
      note: null,
    }))
    // A blank row is the athlete leaving the last rep unfilled, not a data point.
    .filter((r) => r.distance_m != null || r.duration_sec != null)
    .map((r, i) => ({ ...r, rep_index: i + 1 }));

  const liftNames = formData.getAll('lift_exercise');
  const lifts = liftNames
    .map((name, i) => ({
      exercise: String(name).trim(),
      sets: parseNumber(formData.getAll('lift_sets')[i] ?? null),
      reps: parseNumber(formData.getAll('lift_reps')[i] ?? null),
      load_kg: parseNumber(formData.getAll('lift_load')[i] ?? null),
      note: null,
    }))
    .filter((l) => l.exercise !== '');

  let id: number;
  try {
    id = saveSession(input, reps, lifts, idRaw ?? undefined);
  } catch (err) {
    // One session per date per slot — the athlete is re-logging a day they
    // already have, so point them at it instead of failing with a stack trace.
    if (err instanceof Error && /UNIQUE constraint failed: session\.date/.test(err.message)) {
      const slot = input.slot.toUpperCase();
      const other = input.slot === 'am' ? 'PM' : 'AM';
      return reject(
        _prev,
        formData,
        `An ${slot} session is already logged on ${input.date}. ` +
          `Edit that one from the log, or set this to ${other} if it was a double.`,
      );
    }
    throw err;
  }

  revalidateAll();
  redirect(`/log/${id}`);   // throws NEXT_REDIRECT, so it must stay out of the try
}

export async function deleteSessionAction(formData: FormData): Promise<void> {
  const id = parseNumber(formData.get('id'));
  if (id == null) throw new Error('Missing session id.');
  deleteSession(id);
  revalidateAll();
  redirect('/log');
}

// --- wellness --------------------------------------------------------------

export async function saveWellnessAction(formData: FormData): Promise<void> {
  const date = String(formData.get('date') ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('A check-in needs a valid date.');

  saveWellness({
    date,
    sleep_hours: parseNumber(formData.get('sleep_hours')),
    sleep_quality: parseNumber(formData.get('sleep_quality')),
    soreness: parseNumber(formData.get('soreness')),
    fatigue: parseNumber(formData.get('fatigue')),
    stress: parseNumber(formData.get('stress')),
    motivation: parseNumber(formData.get('motivation')),
    resting_hr: parseNumber(formData.get('resting_hr')),
    body_mass_kg: parseNumber(formData.get('body_mass_kg')),
    note: parseText(formData.get('note')),
  });
  revalidateAll();
  redirect('/wellness');
}

// --- races -----------------------------------------------------------------

export async function saveRaceAction(formData: FormData): Promise<void> {
  const time = parseTimeToSeconds(parseText(formData.get('time')));
  const distance = parseNumber(formData.get('distance_m'));
  const event = parseText(formData.get('event'));
  const date = String(formData.get('date') ?? '').trim();

  if (!event || time == null || distance == null) {
    throw new Error('A race needs an event, a distance, and a time.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('A race needs a valid date.');

  saveRace(
    {
      date,
      meet: parseText(formData.get('meet')),
      event,
      distance_m: distance,
      time_sec: time,
      season: (parseText(formData.get('season')) as Season | null) ?? null,
      place: parseNumber(formData.get('place')),
      splits: parseText(formData.get('splits')),
      notes: parseText(formData.get('notes')),
    },
    parseNumber(formData.get('id')) ?? undefined,
  );
  revalidateAll();
  redirect('/races');
}

export async function deleteRaceAction(formData: FormData): Promise<void> {
  const id = parseNumber(formData.get('id'));
  if (id == null) throw new Error('Missing race id.');
  deleteRace(id);
  revalidateAll();
  redirect('/races');
}

// --- niggles ---------------------------------------------------------------

export async function saveNiggleAction(formData: FormData): Promise<void> {
  const bodyPart = parseText(formData.get('body_part'));
  const start = String(formData.get('date_start') ?? '').trim();
  if (!bodyPart) throw new Error('A niggle needs a body part.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error('A niggle needs a start date.');

  saveNiggle(
    {
      date_start: start,
      date_end: parseText(formData.get('date_end')),
      body_part: bodyPart,
      severity: parseNumber(formData.get('severity')),
      note: parseText(formData.get('note')),
    },
    parseNumber(formData.get('id')) ?? undefined,
  );
  revalidateAll();
  redirect('/wellness');
}

export async function deleteNiggleAction(formData: FormData): Promise<void> {
  const id = parseNumber(formData.get('id'));
  if (id == null) throw new Error('Missing niggle id.');
  deleteNiggle(id);
  revalidateAll();
  redirect('/wellness');
}

// --- settings --------------------------------------------------------------

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const name = parseText(formData.get('name'));
  if (!name) throw new Error('Name cannot be empty.');

  updateAthlete({
    name,
    school: parseText(formData.get('school')),
    class_year: parseText(formData.get('class_year')),
    primary_events: parseText(formData.get('primary_events')),
    threshold_pace_sec: parseTimeToSeconds(parseText(formData.get('threshold_pace'))),
    max_hr: parseNumber(formData.get('max_hr')),
    resting_hr: parseNumber(formData.get('resting_hr')),
    distance_unit: formData.get('distance_unit') === 'km' ? 'km' : 'mi',
  });
  revalidateAll();
  redirect('/settings');
}
