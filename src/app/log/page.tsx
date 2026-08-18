import Link from 'next/link';
import { getAthlete, listSessions } from '@/lib/queries';
import { formatDayLabel, formatDuration, formatPace, sessionTypeLabel, toUnit } from '@/lib/format';
import { weekStart } from '@/lib/training';

export const dynamic = 'force-dynamic';

const TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'easy', label: 'Easy' },
  { value: 'workout', label: 'Workouts' },
  { value: 'long', label: 'Long' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'race', label: 'Races' },
  { value: 'strength', label: 'Strength' },
];

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const athlete = getAthlete();
  const unit = athlete.distance_unit;
  const sessions = listSessions({ type: type || undefined, limit: 200 });

  // Group by training week so the log reads the way a week is planned.
  const groups = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = weekStart(s.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Training log</h1>
          <p>{sessions.length} session{sessions.length === 1 ? '' : 's'}</p>
        </div>
        <Link href="/log/new" className="btn btn-primary">Log session</Link>
      </div>

      {/* One filter row above everything it scopes. */}
      <div className="row">
        {TYPE_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/log?type=${f.value}` : '/log'}
            className="chip"
            style={
              (type ?? '') === f.value
                ? { background: 'var(--series-1)', color: '#fff' }
                : undefined
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      {sessions.length === 0 ? (
        <div className="card">
          <div className="empty">
            Nothing here yet. <Link href="/log/new">Log a session</Link>.
          </div>
        </div>
      ) : (
        [...groups.entries()].map(([week, items]) => {
          const total = items.reduce((sum, s) => sum + (s.distance_m ?? 0), 0);
          return (
            <div className="card" key={week}>
              <div className="card-head">
                <h2>Week of {formatDayLabel(week)}</h2>
                <span className="sub">
                  {toUnit(total, unit).toFixed(1)} {unit} · {items.length} session
                  {items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Session</th>
                      <th>Intensity</th>
                      <th className="num">Distance</th>
                      <th className="num">Time</th>
                      <th className="num">Pace</th>
                      <th className="num">RPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => (
                      <tr key={s.id}>
                        <td className="small">
                          {formatDayLabel(s.date)}
                          {s.slot === 'pm' ? ' · pm' : ''}
                        </td>
                        <td>
                          <Link href={`/log/${s.id}`}>{s.title ?? sessionTypeLabel(s.type)}</Link>
                          <div className="muted small">{sessionTypeLabel(s.type)}</div>
                        </td>
                        <td>
                          <span className="chip">
                            <span
                              className="legend-swatch"
                              style={{ background: `var(--intensity-${s.intensity})` }}
                            />
                            {s.intensity}
                          </span>
                        </td>
                        <td className="num">
                          {s.distance_m ? `${toUnit(s.distance_m, unit).toFixed(1)} ${unit}` : '—'}
                        </td>
                        <td className="num">{formatDuration(s.duration_sec)}</td>
                        <td className="num">{formatPace(s.distance_m, s.duration_sec, unit)}</td>
                        <td className="num">{s.rpe ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
