import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAthlete, getSession } from '@/lib/queries';
import {
  formatDayLabel, formatDistance, formatDuration, formatPace, formatRepTime,
  paceSecPerUnit, sessionTypeLabel,
} from '@/lib/format';
import { sessionLoad } from '@/lib/training';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(Number(id));
  if (!session) notFound();

  const unit = getAthlete().distance_unit;
  const repTimes = session.reps.map((r) => r.duration_sec).filter((t): t is number => t != null);
  const avgRep = repTimes.length ? repTimes.reduce((a, b) => a + b, 0) / repTimes.length : null;
  const fastest = repTimes.length ? Math.min(...repTimes) : null;
  const slowest = repTimes.length ? Math.max(...repTimes) : null;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{session.title ?? sessionTypeLabel(session.type)}</h1>
          <p>
            {formatDayLabel(session.date)}
            {session.slot === 'pm' ? ' · PM' : ''} · {sessionTypeLabel(session.type)} ·{' '}
            {session.intensity}
          </p>
        </div>
        <div className="row">
          <Link href={`/log/${session.id}/edit`} className="btn">Edit</Link>
          <Link href="/log" className="btn">Back to log</Link>
        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <table>
            <tbody>
              <Row label="Distance" value={formatDistance(session.distance_m, unit, 2)} />
              <Row label="Duration" value={formatDuration(session.duration_sec)} />
              <Row label="Average pace" value={formatPace(session.distance_m, session.duration_sec, unit)} />
              <Row label="RPE" value={session.rpe == null ? '—' : `${session.rpe} / 10`} />
              <Row label="Feel" value={session.feel == null ? '—' : `${session.feel} / 5`} />
              <Row label="Training load" value={String(Math.round(sessionLoad(session)))} />
              <Row label="Heart rate" value={
                session.avg_hr || session.max_hr
                  ? `${session.avg_hr ?? '—'} avg · ${session.max_hr ?? '—'} max`
                  : '—'
              } />
              <Row label="Surface" value={session.surface ?? '—'} />
              <Row label="Shoes" value={session.shoes ?? '—'} />
            </tbody>
          </table>
        </div>
      </div>

      {session.reps.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Reps</h2>
            <span className="sub">
              {fastest != null && slowest != null &&
                `fastest ${formatRepTime(fastest)} · slowest ${formatRepTime(slowest)} · avg ${formatRepTime(avgRep!)}`}
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th className="num">Distance</th>
                  <th className="num">Time</th>
                  <th className="num">Pace</th>
                  <th className="num">Rest</th>
                  <th className="num">Δ vs avg</th>
                </tr>
              </thead>
              <tbody>
                {session.reps.map((rep, i) => {
                  const delta = avgRep != null && rep.duration_sec != null
                    ? rep.duration_sec - avgRep
                    : null;
                  return (
                    <tr key={rep.id}>
                      <td className="muted">{i + 1}</td>
                      <td className="num">{rep.distance_m == null ? '—' : `${rep.distance_m} m`}</td>
                      <td className="num">{formatRepTime(rep.duration_sec)}</td>
                      <td className="num">
                        {rep.distance_m && rep.duration_sec
                          ? `${formatDuration(paceSecPerUnit(rep.distance_m, rep.duration_sec, unit))} /${unit}`
                          : '—'}
                      </td>
                      <td className="num">{formatRepTime(rep.rest_sec)}</td>
                      <td className="num" style={{
                        color: delta == null ? undefined
                          : delta <= 0 ? 'var(--success-text)' : 'var(--text-secondary)',
                      }}>
                        {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}s`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {session.lifts.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Strength</h2></div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Exercise</th><th className="num">Sets</th>
                  <th className="num">Reps</th><th className="num">Load</th>
                </tr>
              </thead>
              <tbody>
                {session.lifts.map((lift) => (
                  <tr key={lift.id}>
                    <td>{lift.exercise}</td>
                    <td className="num">{lift.sets ?? '—'}</td>
                    <td className="num">{lift.reps ?? '—'}</td>
                    <td className="num">{lift.load_kg == null ? '—' : `${lift.load_kg} kg`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {session.notes && (
        <div className="card">
          <div className="card-head"><h2>Notes</h2></div>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{session.notes}</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th style={{ width: '40%' }}>{label}</th>
      <td className="num">{value}</td>
    </tr>
  );
}
