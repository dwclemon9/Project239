'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { saveSessionAction, deleteSessionAction, type SessionFormState } from '@/app/actions';
import { formatRepTime, toUnit } from '@/lib/format';
import type { DistanceUnit, SessionWithDetail } from '@/lib/types';

const TYPES = [
  'easy', 'long', 'workout', 'tempo', 'recovery',
  'shakeout', 'race', 'strength', 'cross_train', 'off',
] as const;

const TYPE_LABELS: Record<string, string> = {
  easy: 'Easy run', long: 'Long run', workout: 'Workout', tempo: 'Tempo',
  recovery: 'Recovery', shakeout: 'Shakeout', race: 'Race', strength: 'Strength',
  cross_train: 'Cross-train', off: 'Off',
};

// The intensity a session type defaults to, so the 80/20 split stays honest
// without the athlete setting it by hand every time.
const TYPE_INTENSITY: Record<string, 'easy' | 'moderate' | 'hard'> = {
  easy: 'easy', recovery: 'easy', shakeout: 'easy', off: 'easy',
  cross_train: 'easy', long: 'easy', strength: 'moderate', tempo: 'moderate',
  workout: 'hard', race: 'hard',
};

interface RepRow { distance: string; time: string; rest: string }
interface LiftRow { exercise: string; sets: string; reps: string; load: string }

const BLANK_REP: RepRow = { distance: '', time: '', rest: '' };
const BLANK_LIFT: LiftRow = { exercise: '', sets: '', reps: '', load: '' };

interface Props {
  session: SessionWithDetail | null;
  unit: DistanceUnit;
  defaultDate: string;
}

const NO_ERROR: SessionFormState = { error: null };

export default function SessionForm({ session, unit, defaultDate }: Props) {
  const [state, formAction, pending] = useActionState(saveSessionAction, NO_ERROR);
  // A rejected save hands back what was typed; fall back to the saved session,
  // then to a blank form.
  const echoed = state.values;
  const initial = (field: string, saved: string | number | null | undefined) =>
    echoed?.[field] ?? (saved == null ? '' : String(saved));

  const [type, setType] = useState<string>(session?.type ?? 'easy');
  const [intensity, setIntensity] = useState(session?.intensity ?? 'easy');
  const [reps, setReps] = useState<RepRow[]>(
    session && session.reps.length > 0
      ? session.reps.map((r) => ({
          distance: r.distance_m == null ? '' : String(r.distance_m),
          time: r.duration_sec == null ? '' : formatRepTime(r.duration_sec),
          rest: r.rest_sec == null ? '' : formatRepTime(r.rest_sec),
        }))
      : [],
  );
  const [lifts, setLifts] = useState<LiftRow[]>(
    session && session.lifts.length > 0
      ? session.lifts.map((l) => ({
          exercise: l.exercise,
          sets: l.sets == null ? '' : String(l.sets),
          reps: l.reps == null ? '' : String(l.reps),
          load: l.load_kg == null ? '' : String(l.load_kg),
        }))
      : [],
  );
  const [builderCount, setBuilderCount] = useState('6');
  const [builderDistance, setBuilderDistance] = useState('800');

  function onTypeChange(next: string) {
    setType(next);
    setIntensity(TYPE_INTENSITY[next] ?? 'easy');
  }

  function addRepSet() {
    const count = Math.min(Math.max(Number(builderCount) || 0, 0), 40);
    const distance = builderDistance.trim();
    if (count === 0 || distance === '') return;
    setReps((prev) => [...prev, ...Array.from({ length: count }, () => ({ ...BLANK_REP, distance }))]);
  }

  function updateRep(i: number, patch: Partial<RepRow>) {
    setReps((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function updateLift(i: number, patch: Partial<LiftRow>) {
    setLifts((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  return (
    <form key={state.attempt ?? 0} action={formAction} className="stack">
      {session && <input type="hidden" name="id" value={session.id} />}

      {state.error && (
        <div className="banner-error" role="alert">
          <span aria-hidden="true">▲</span>
          <span>{state.error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h2>Session</h2></div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="date">Date</label>
            <input id="date" name="date" type="date" required defaultValue={echoed?.date ?? session?.date ?? defaultDate} />
          </div>
          <div className="field">
            <label htmlFor="slot">Slot</label>
            <select id="slot" name="slot" defaultValue={echoed?.slot ?? session?.slot ?? 'am'}>
              <option value="am">AM</option>
              <option value="pm">PM (double)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="type">Type</label>
            <select id="type" name="type" value={type} onChange={(e) => onTypeChange(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="intensity">Intensity</label>
            <select
              id="intensity" name="intensity" value={intensity}
              onChange={(e) => setIntensity(e.target.value as typeof intensity)}
            >
              <option value="easy">Easy</option>
              <option value="moderate">Moderate</option>
              <option value="hard">Hard</option>
            </select>
            <span className="hint">
              Fallback only — with reps or a duration logged, pace decides the split.
            </span>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="title">Title</label>
            <input
              id="title" name="title" type="text" defaultValue={initial('title', session?.title)}
              placeholder="6 x 800m @ 5k pace, 2:00 jog"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Volume &amp; effort</h2></div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="distance">Distance ({unit})</label>
            <input
              id="distance" name="distance" type="number" step="0.01" min="0"
              defaultValue={
                echoed?.distance ??
                (session?.distance_m ? toUnit(session.distance_m, unit).toFixed(2) : '')
              }
            />
          </div>
          <div className="field">
            <label htmlFor="duration">Duration</label>
            <input
              id="duration" name="duration" type="text" inputMode="numeric"
              placeholder="52:30"
              defaultValue={
                echoed?.duration ?? (session?.duration_sec ? formatHMS(session.duration_sec) : '')
              }
            />
            <span className="hint">mm:ss or h:mm:ss</span>
          </div>
          <div className="field">
            <label htmlFor="rpe">RPE (1–10)</label>
            <input id="rpe" name="rpe" type="number" min="1" max="10"
                   defaultValue={initial('rpe', session?.rpe)} />
            <span className="hint">Feeds the training-load ratio.</span>
          </div>
          <div className="field">
            <label htmlFor="feel">Feel (1–5)</label>
            <input id="feel" name="feel" type="number" min="1" max="5"
                   defaultValue={initial('feel', session?.feel)} />
          </div>
          <div className="field">
            <label htmlFor="surface">Surface</label>
            <select id="surface" name="surface" defaultValue={initial('surface', session?.surface)}>
              <option value="">—</option>
              {['track', 'road', 'trail', 'grass', 'treadmill', 'indoor'].map((s) => (
                <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="shoes">Shoes</label>
            <input id="shoes" name="shoes" type="text" defaultValue={initial('shoes', session?.shoes)} />
          </div>
          <div className="field">
            <label htmlFor="avg_hr">Avg HR</label>
            <input id="avg_hr" name="avg_hr" type="number" min="0"
                   defaultValue={initial('avg_hr', session?.avg_hr)} />
          </div>
          <div className="field">
            <label htmlFor="max_hr">Max HR</label>
            <input id="max_hr" name="max_hr" type="number" min="0"
                   defaultValue={initial('max_hr', session?.max_hr)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Reps</h2>
          <span className="sub">Distances in meters, times as mm:ss or seconds</span>
        </div>

        <div className="row" style={{ marginBottom: 14 }}>
          <input
            type="number" min="1" max="40" value={builderCount}
            onChange={(e) => setBuilderCount(e.target.value)}
            aria-label="Number of reps" style={{ width: 68 }}
          />
          <span className="muted">×</span>
          <input
            type="text" value={builderDistance} onChange={(e) => setBuilderDistance(e.target.value)}
            aria-label="Rep distance in meters" style={{ width: 88 }}
          />
          <span className="muted small">m</span>
          <button type="button" className="btn" onClick={addRepSet}>Add reps</button>
          {reps.length > 0 && (
            <button type="button" className="btn" onClick={() => setReps([])}>Clear</button>
          )}
        </div>

        {reps.length === 0 ? (
          <div className="empty">No reps on this session.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Distance (m)</th>
                  <th>Time</th>
                  <th>Rest</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {reps.map((rep, i) => (
                  <tr key={i}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <input
                        name="rep_distance" type="text" inputMode="numeric" value={rep.distance}
                        onChange={(e) => updateRep(i, { distance: e.target.value })}
                        aria-label={`Rep ${i + 1} distance in meters`}
                      />
                    </td>
                    <td>
                      <input
                        name="rep_time" type="text" inputMode="numeric" value={rep.time}
                        placeholder="2:24" onChange={(e) => updateRep(i, { time: e.target.value })}
                        aria-label={`Rep ${i + 1} time`}
                      />
                    </td>
                    <td>
                      <input
                        name="rep_rest" type="text" inputMode="numeric" value={rep.rest}
                        placeholder="2:00" onChange={(e) => updateRep(i, { rest: e.target.value })}
                        aria-label={`Rep ${i + 1} rest`}
                      />
                    </td>
                    <td>
                      <button
                        type="button" className="btn"
                        onClick={() => setReps((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remove rep ${i + 1}`}
                        style={{ padding: '4px 8px' }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => setReps((prev) => [...prev, { ...BLANK_REP }])}>
            Add one rep
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Strength</h2>
          <span className="sub">Load in kg</span>
        </div>
        {lifts.length === 0 ? (
          <div className="empty">No lifts on this session.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Exercise</th><th>Sets</th><th>Reps</th><th>Load</th><th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {lifts.map((lift, i) => (
                  <tr key={i}>
                    <td>
                      <input name="lift_exercise" type="text" value={lift.exercise}
                             onChange={(e) => updateLift(i, { exercise: e.target.value })}
                             aria-label={`Lift ${i + 1} exercise`} />
                    </td>
                    <td>
                      <input name="lift_sets" type="number" min="0" value={lift.sets}
                             onChange={(e) => updateLift(i, { sets: e.target.value })}
                             aria-label={`Lift ${i + 1} sets`} />
                    </td>
                    <td>
                      <input name="lift_reps" type="number" min="0" value={lift.reps}
                             onChange={(e) => updateLift(i, { reps: e.target.value })}
                             aria-label={`Lift ${i + 1} reps`} />
                    </td>
                    <td>
                      <input name="lift_load" type="number" min="0" step="0.5" value={lift.load}
                             onChange={(e) => updateLift(i, { load: e.target.value })}
                             aria-label={`Lift ${i + 1} load in kg`} />
                    </td>
                    <td>
                      <button type="button" className="btn" style={{ padding: '4px 8px' }}
                              onClick={() => setLifts((prev) => prev.filter((_, idx) => idx !== i))}
                              aria-label={`Remove lift ${i + 1}`}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => setLifts((prev) => [...prev, { ...BLANK_LIFT }])}>
            Add lift
          </button>
        </div>
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes" name="notes" defaultValue={initial('notes', session?.notes)}
            placeholder="How it felt, conditions, what the coach said, anything nagging."
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : session ? 'Save changes' : 'Save session'}
        </button>
        <Link href={session ? `/log/${session.id}` : '/log'} className="btn">Cancel</Link>
        <span className="spacer" />
      </div>

      {session && (
        <div className="form-actions">
          <button
            type="submit" className="btn btn-danger"
            formAction={deleteSessionAction}
            formNoValidate
          >
            Delete session
          </button>
        </div>
      )}
    </form>
  );
}

function formatHMS(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}
