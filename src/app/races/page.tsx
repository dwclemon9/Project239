import { deleteRaceAction, saveRaceAction } from '@/app/actions';
import { listRaces, personalBests } from '@/lib/queries';
import { formatDayLabel, formatRepTime, paceSecPerUnit, formatDuration } from '@/lib/format';
import { getAthlete } from '@/lib/queries';
import { todayISO } from '@/lib/training';

export const dynamic = 'force-dynamic';

const COMMON_EVENTS = [
  { label: '800m', meters: 800 },
  { label: '1000m', meters: 1000 },
  { label: '1500m', meters: 1500 },
  { label: 'Mile', meters: 1609.344 },
  { label: '3000m', meters: 3000 },
  { label: '5000m', meters: 5000 },
  { label: '6K XC', meters: 6000 },
  { label: '8K XC', meters: 8000 },
  { label: '10,000m', meters: 10000 },
];

export default function RacesPage() {
  const races = listRaces();
  const pbs = personalBests();
  const pbIds = new Set(pbs.map((r) => r.id));
  const unit = getAthlete().distance_unit;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Races</h1>
          <p>{races.length} race{races.length === 1 ? '' : 's'} logged · {pbs.length} personal best{pbs.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <form action={saveRaceAction} className="card">
        <div className="card-head"><h2>Add a race</h2></div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="date">Date</label>
            <input id="date" name="date" type="date" required defaultValue={todayISO()} />
          </div>
          <div className="field">
            <label htmlFor="event">Event</label>
            <input id="event" name="event" type="text" required list="event-list" placeholder="1500m" />
            <datalist id="event-list">
              {COMMON_EVENTS.map((e) => <option key={e.label} value={e.label} />)}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="distance_m">Distance (m)</label>
            <input id="distance_m" name="distance_m" type="number" step="0.001" min="1" required
                   list="distance-list" placeholder="1500" />
            <datalist id="distance-list">
              {COMMON_EVENTS.map((e) => <option key={e.label} value={e.meters} />)}
            </datalist>
            <span className="hint">Groups PRs across meets.</span>
          </div>
          <div className="field">
            <label htmlFor="time">Time</label>
            <input id="time" name="time" type="text" required placeholder="3:58.4" inputMode="numeric" />
            <span className="hint">mm:ss.t or seconds</span>
          </div>
          <div className="field">
            <label htmlFor="season">Season</label>
            <select id="season" name="season" defaultValue="">
              <option value="">—</option>
              <option value="xc">Cross country</option>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="place">Place</label>
            <input id="place" name="place" type="number" min="1" />
          </div>
          <div className="field">
            <label htmlFor="meet">Meet</label>
            <input id="meet" name="meet" type="text" placeholder="Conference Championships" />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="splits">Splits</label>
            <input id="splits" name="splits" type="text" placeholder="64 / 66 / 63 / 59" />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" placeholder="Tactics, conditions, how it felt." />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Save race</button>
        </div>
      </form>

      {pbs.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Personal bests</h2>
            <span className="sub">Best time at each distance</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Event</th><th className="num">Time</th>
                  <th className="num">Pace</th><th>Date</th><th>Meet</th>
                </tr>
              </thead>
              <tbody>
                {pbs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.event}</td>
                    <td className="num">{formatRepTime(r.time_sec)}</td>
                    <td className="num">
                      {formatDuration(paceSecPerUnit(r.distance_m, r.time_sec, unit))} /{unit}
                    </td>
                    <td className="small">{formatDayLabel(r.date)}</td>
                    <td className="muted small">{r.meet ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h2>All races</h2></div>
        {races.length === 0 ? (
          <div className="empty">No races logged yet.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Event</th><th className="num">Time</th>
                  <th className="num">Place</th><th>Meet</th><th>Splits</th><th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {races.map((r) => (
                  <tr key={r.id}>
                    <td className="small">{formatDayLabel(r.date)}</td>
                    <td>
                      {r.event}
                      {pbIds.has(r.id) && (
                        <span className="chip" style={{ marginLeft: 6, color: 'var(--success-text)' }}>
                          <span aria-hidden="true">✓</span> PR
                        </span>
                      )}
                    </td>
                    <td className="num">{formatRepTime(r.time_sec)}</td>
                    <td className="num">{r.place ?? '—'}</td>
                    <td className="muted small">{r.meet ?? '—'}</td>
                    <td className="muted small">{r.splits ?? '—'}</td>
                    <td>
                      <form action={deleteRaceAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="btn" style={{ padding: '4px 8px' }}
                                aria-label={`Delete ${r.event} on ${r.date}`}>×</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
