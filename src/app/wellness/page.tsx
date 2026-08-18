import { saveWellnessAction, saveNiggleAction, deleteNiggleAction } from '@/app/actions';
import TrendChart, { type TrendPoint } from '@/components/charts/TrendChart';
import { getWellness, listNiggles, listWellness } from '@/lib/queries';
import { addDays, dateRange, readinessScore, todayISO } from '@/lib/training';
import { formatDayLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

const SCALES: Array<{ name: string; label: string; hint: string }> = [
  { name: 'sleep_quality', label: 'Sleep quality', hint: '5 = slept great' },
  { name: 'fatigue', label: 'Fatigue', hint: '5 = wrecked' },
  { name: 'soreness', label: 'Soreness', hint: '5 = very sore' },
  { name: 'stress', label: 'Stress', hint: '5 = very stressed' },
  { name: 'motivation', label: 'Motivation', hint: '5 = fired up' },
];

export default function WellnessPage() {
  const today = todayISO();
  const existing = getWellness(today);
  const since = addDays(today, -29);
  const entries = listWellness(since);
  const byDate = new Map(entries.map((e) => [e.date, e]));

  const sleepPoints: TrendPoint[] = dateRange(since, today).map((date) => ({
    date,
    value: byDate.get(date)?.sleep_hours ?? null,
  }));
  const restingHrPoints: TrendPoint[] = dateRange(since, today).map((date) => ({
    date,
    value: byDate.get(date)?.resting_hr ?? null,
  }));

  const niggles = listNiggles();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Morning check-in</h1>
          <p>
            Two minutes a day. It is what makes the readiness trend and the load
            ratio worth reading.
          </p>
        </div>
      </div>

      <form action={saveWellnessAction} className="card">
        <div className="card-head">
          <h2>{existing ? 'Update today' : 'Today'}</h2>
          <span className="sub">{formatDayLabel(today)}</span>
        </div>
        <input type="hidden" name="date" value={today} />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="sleep_hours">Sleep (hours)</label>
            <input id="sleep_hours" name="sleep_hours" type="number" step="0.25" min="0" max="24"
                   defaultValue={existing?.sleep_hours ?? ''} />
          </div>
          {SCALES.map((s) => (
            <div className="field" key={s.name}>
              <label htmlFor={s.name}>{s.label}</label>
              <select id={s.name} name={s.name}
                      defaultValue={(existing?.[s.name as keyof typeof existing] as number | null) ?? ''}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="hint">{s.hint}</span>
            </div>
          ))}
          <div className="field">
            <label htmlFor="resting_hr">Resting HR</label>
            <input id="resting_hr" name="resting_hr" type="number" min="0"
                   defaultValue={existing?.resting_hr ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="body_mass_kg">Body mass (kg)</label>
            <input id="body_mass_kg" name="body_mass_kg" type="number" step="0.1" min="0"
                   defaultValue={existing?.body_mass_kg ?? ''} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="note">Note</label>
            <textarea id="note" name="note" defaultValue={existing?.note ?? ''} />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {existing ? 'Update check-in' : 'Save check-in'}
          </button>
        </div>
      </form>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Sleep</h2>
            <span className="sub">Hours · last 30 days</span>
          </div>
          <TrendChart points={sleepPoints} label="Sleep" unitSuffix="h" />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Resting heart rate</h2>
            <span className="sub">bpm · last 30 days</span>
          </div>
          <TrendChart points={restingHrPoints} label="Resting HR" />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Niggles &amp; injuries</h2>
          <span className="sub">Leave the end date blank while it is still going</span>
        </div>

        <form action={saveNiggleAction}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="body_part">Body part</label>
              <input id="body_part" name="body_part" type="text" required placeholder="Left achilles" />
            </div>
            <div className="field">
              <label htmlFor="date_start">Started</label>
              <input id="date_start" name="date_start" type="date" required defaultValue={today} />
            </div>
            <div className="field">
              <label htmlFor="date_end">Resolved</label>
              <input id="date_end" name="date_end" type="date" />
            </div>
            <div className="field">
              <label htmlFor="severity">Severity (1–5)</label>
              <input id="severity" name="severity" type="number" min="1" max="5" />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="niggle_note">Note</label>
              <input id="niggle_note" name="note" type="text" />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn">Add niggle</button>
          </div>
        </form>

        {niggles.length > 0 && (
          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Body part</th><th>Started</th><th>Resolved</th>
                  <th className="num">Severity</th><th>Note</th><th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {niggles.map((n) => (
                  <tr key={n.id}>
                    <td>{n.body_part}</td>
                    <td className="small">{formatDayLabel(n.date_start)}</td>
                    <td className="small">
                      {n.date_end ? formatDayLabel(n.date_end) : (
                        <span style={{ color: 'var(--status-serious)' }}>▲ open</span>
                      )}
                    </td>
                    <td className="num">{n.severity ?? '—'}</td>
                    <td className="muted small">{n.note ?? '—'}</td>
                    <td>
                      <form action={deleteNiggleAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <button type="submit" className="btn" style={{ padding: '4px 8px' }}
                                aria-label={`Delete ${n.body_part} entry`}>×</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Check-in history</h2></div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th className="num">Readiness</th><th className="num">Sleep</th>
                  <th className="num">Fatigue</th><th className="num">Soreness</th>
                  <th className="num">Resting HR</th><th>Note</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.date}>
                    <td className="small">{formatDayLabel(e.date)}</td>
                    <td className="num">{readinessScore(e) ?? '—'}</td>
                    <td className="num">{e.sleep_hours ?? '—'}</td>
                    <td className="num">{e.fatigue ?? '—'}</td>
                    <td className="num">{e.soreness ?? '—'}</td>
                    <td className="num">{e.resting_hr ?? '—'}</td>
                    <td className="muted small">{e.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
