export type SessionType =
  | 'easy' | 'long' | 'workout' | 'tempo' | 'recovery'
  | 'shakeout' | 'race' | 'strength' | 'cross_train' | 'off';

export type Intensity = 'easy' | 'moderate' | 'hard';
export type Slot = 'am' | 'pm';
export type Surface = 'track' | 'road' | 'trail' | 'grass' | 'treadmill' | 'indoor';
export type Season = 'xc' | 'indoor' | 'outdoor';
export type DistanceUnit = 'mi' | 'km';

export interface Athlete {
  id: 1;
  name: string;
  school: string | null;
  class_year: string | null;
  primary_events: string | null;
  threshold_pace_sec: number | null;
  max_hr: number | null;
  resting_hr: number | null;
  distance_unit: DistanceUnit;
  created_at: string;
}

export interface Session {
  id: number;
  date: string;
  slot: Slot;
  type: SessionType;
  title: string | null;
  distance_m: number | null;
  duration_sec: number | null;
  intensity: Intensity;
  rpe: number | null;
  surface: Surface | null;
  shoes: string | null;
  avg_hr: number | null;
  max_hr: number | null;
  feel: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rep {
  id: number;
  session_id: number;
  set_index: number;
  rep_index: number;
  distance_m: number | null;
  duration_sec: number | null;
  rest_sec: number | null;
  note: string | null;
}

export interface Lift {
  id: number;
  session_id: number;
  exercise: string;
  sets: number | null;
  reps: number | null;
  load_kg: number | null;
  note: string | null;
}

export interface Wellness {
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  soreness: number | null;
  fatigue: number | null;
  stress: number | null;
  motivation: number | null;
  resting_hr: number | null;
  body_mass_kg: number | null;
  note: string | null;
}

export interface Race {
  id: number;
  date: string;
  meet: string | null;
  event: string;
  distance_m: number;
  time_sec: number;
  season: Season | null;
  place: number | null;
  splits: string | null;
  notes: string | null;
}

export interface Niggle {
  id: number;
  date_start: string;
  date_end: string | null;
  body_part: string;
  severity: number | null;
  note: string | null;
}

export interface SessionWithDetail extends Session {
  reps: Rep[];
  lifts: Lift[];
}

/** A Monday-anchored training week. */
export interface WeekSummary {
  weekStart: string;
  distance_m: number;
  easy_m: number;
  moderate_m: number;
  hard_m: number;
  duration_sec: number;
  sessions: number;
  load: number;
}
