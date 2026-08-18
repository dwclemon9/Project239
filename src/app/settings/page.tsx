import { saveSettingsAction } from '@/app/actions';
import { getAthlete } from '@/lib/queries';
import { formatDuration, METERS_PER_MILE, metersPer } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const athlete = getAthlete();
  const unit = athlete.distance_unit;
  const thresholdInUnit = athlete.threshold_pace_sec
    ? formatDuration(athlete.threshold_pace_sec * (metersPer(unit) / METERS_PER_MILE))
    : '';

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Your profile drives pace zones, units, and the dashboard header.</p>
        </div>
      </div>

      <form action={saveSettingsAction} className="card">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" required defaultValue={athlete.name} />
          </div>
          <div className="field">
            <label htmlFor="school">School</label>
            <input id="school" name="school" type="text" defaultValue={athlete.school ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="class_year">Class year</label>
            <input id="class_year" name="class_year" type="text" defaultValue={athlete.class_year ?? ''}
                   placeholder="Sophomore" />
          </div>
          <div className="field">
            <label htmlFor="primary_events">Primary events</label>
            <input id="primary_events" name="primary_events" type="text"
                   defaultValue={athlete.primary_events ?? ''} placeholder="1500m / 5000m" />
          </div>
          <div className="field">
            <label htmlFor="distance_unit">Distance unit</label>
            <select id="distance_unit" name="distance_unit" defaultValue={unit}>
              <option value="mi">Miles</option>
              <option value="km">Kilometers</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="threshold_pace">Threshold pace (per mile)</label>
            <input id="threshold_pace" name="threshold_pace" type="text" inputMode="numeric"
                   placeholder="5:30"
                   defaultValue={athlete.threshold_pace_sec ? formatDuration(athlete.threshold_pace_sec) : ''} />
            <span className="hint">
              Roughly your one-hour race pace. Always entered per mile
              {unit === 'km' && `; that is ${thresholdInUnit} /km`}.
            </span>
          </div>
          <div className="field">
            <label htmlFor="max_hr">Max HR</label>
            <input id="max_hr" name="max_hr" type="number" min="0" defaultValue={athlete.max_hr ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="resting_hr">Resting HR</label>
            <input id="resting_hr" name="resting_hr" type="number" min="0"
                   defaultValue={athlete.resting_hr ?? ''} />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Save settings</button>
        </div>
      </form>

      <div className="card">
        <div className="card-head"><h2>Your data</h2></div>
        <p className="small muted" style={{ margin: 0 }}>
          Everything lives in a single SQLite file at <code>data/training.db</code>,
          on this machine only. Back it up by copying that file; it is gitignored so
          your log never ends up in a commit.
        </p>
      </div>
    </div>
  );
}
