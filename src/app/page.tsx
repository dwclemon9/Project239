import Link from 'next/link';
import StatTile, { type StatStatus } from '@/components/StatTile';
import WeeklyVolumeChart from '@/components/charts/WeeklyVolumeChart';
import TrendChart, { type TrendPoint } from '@/components/charts/TrendChart';
import { getAthlete, listNiggles, listWellness, personalBests, sessionsSince } from '@/lib/queries';
import {
  addDays, dateRange, distanceInWindow, easyShare, loadStatus, readinessScore,
  todayISO, weeklySummaries, weekStart,
} from '@/lib/training';
import {
  formatDayLabel, formatDuration, formatPace, formatRepTime, sessionTypeLabel, toUnit,
} from '@/lib/format';

export const dynamic = 'force-dynamic';

const LOAD_COPY: Record<string, { status: StatStatus; label: string }> = {
  optimal: { status: 'good', label: 'In the productive range' },
  undertrained: { status: 'warning', label: 'Detraining or tapering' },
  high: { status: 'serious', label: 'Ramping fast — watch it' },
  spike: { status: 'critical', label: 'Spiked load — back off' },
};

export default function Dashboard() {
  const today = todayISO();
  const athlete = getAthlete();
  const unit = athlete.distance_unit;

  // 12 weeks of history covers the chart, the 28-day load window, and trends.
  const sessions = sessionsSince(7 * 12, today);
  const weeks = weeklySummaries(sessions, 12, today);
  const thisWeek = weeks[weeks.length - 1];
  const lastWeek = weeks[weeks.length - 2];
  const load = loadStatus(sessions, today);
  const share = easyShare(weeks.slice(-4));
  const openNiggles = listNiggles().filter((n) => n.date_end == null);
  const pbs = personalBests();

  const wellnessSince = addDays(today, -29);
  const wellness = listWellness(wellnessSince);
  const wellnessByDate = new Map(wellness.map((w) => [w.date, w]));
  const readinessPoints: TrendPoint[] = dateRange(wellnessSince, today).map((date) => ({
    date,
    value: readinessScore(wellnessByDate.get(date)),
  }));

  const recent = sessions.slice(0, 8);
  const last7 = distanceInWindow(sessions, today, 7);
  const prev7 = distanceInWindow(sessions, addDays(today, -7), 7);
  const delta = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : null;
  const loadCopy = load.zone === 'unknown' ? null : LOAD_COPY[load.zone];
  const todayCheckin = wellnessByDate.get(today);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{athlete.name}</h1>
          <p>
            {athlete.primary_events ?? 'Distance'}
            {athlete.school ? ` · ${athlete.school}` : ''} · week of{' '}
            {formatDayLabel(weekStart(today))}
          </p>
        </div>
        {!todayCheckin && (
          <Link href="/wellness" className="btn">
            Log today&apos;s check-in
          </Link>
        )}
      </div>

      <div className="grid grid-tiles">
        <StatTile
          label="Last 7 days"
          value={toUnit(last7, unit).toFixed(1)}
          unit={unit}
          meta={
            delta == null
              ? 'No prior week to compare'
              : `${Math.round(delta) > 0 ? '+' : ''}${Math.round(delta)}% vs the week before`
          }
        />
        <StatTile
          label="This training week"
          value={toUnit(thisWeek.distance_m, unit).toFixed(1)}
          unit={unit}
          meta={`${thisWeek.sessions} session${thisWeek.sessions === 1 ? '' : 's'} · ${formatDuration(thisWeek.duration_sec || null)} on feet`}
        />
        <StatTile
          label="Acute : chronic load"
          value={load.ratio == null ? '—' : load.ratio.toFixed(2)}
          meta={
            load.ratio == null
              ? 'Needs ~4 weeks of logged sessions'
              : `7-day load ${Math.round(load.acute)} vs 28-day norm ${Math.round(load.chronic)}`
          }
          status={loadCopy?.status}
          statusLabel={loadCopy?.label}
        />
        <StatTile
          label="Easy volume, last 4 weeks"
          value={share == null ? '—' : `${Math.round(share * 100)}`}
          unit={share == null ? undefined : '%'}
          meta="Target is roughly 80% of weekly volume genuinely easy"
          status={share == null ? undefined : share >= 0.75 ? 'good' : 'warning'}
          statusLabel={
            share == null ? undefined : share >= 0.75 ? 'Aerobic base protected' : 'Quality creeping up'
          }
        />
      </div>

      {openNiggles.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Open niggles</h2>
            <Link href="/wellness" className="sub">
              Manage
            </Link>
          </div>
          <div className="row">
            {openNiggles.map((n) => (
              <span className="chip" key={n.id} style={{ color: 'var(--status-serious)' }}>
                <span aria-hidden="true">▲</span> {n.body_part}
                {n.severity ? ` · ${n.severity}/5` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Weekly volume by intensity</h2>
          <span className="sub">Last 12 weeks · {unit}</span>
        </div>
        <WeeklyVolumeChart weeks={weeks} unit={unit} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Readiness</h2>
            <span className="sub">From the morning check-in · last 30 days</span>
          </div>
          <TrendChart
            points={readinessPoints}
            label="Readiness"
            max={100}
            emptyMessage="Log a few morning check-ins and the trend shows up here."
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Personal bests</h2>
            <Link href="/races" className="sub">
              All races
            </Link>
          </div>
          {pbs.length === 0 ? (
            <div className="empty">No races logged yet.</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th className="num">Best</th>
                    <th>Meet</th>
                  </tr>
                </thead>
                <tbody>
                  {pbs.map((r) => (
                    <tr key={r.id}>
                      <td>{r.event}</td>
                      <td className="num">{formatRepTime(r.time_sec)}</td>
                      <td className="muted small">{r.meet ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent sessions</h2>
          <Link href="/log" className="sub">
            Full log
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty">
            Nothing logged yet. <Link href="/log/new">Log your first session</Link>.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Session</th>
                  <th className="num">Distance</th>
                  <th className="num">Time</th>
                  <th className="num">Pace</th>
                  <th className="num">RPE</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td className="small">
                      {formatDayLabel(s.date)}
                      {s.slot === 'pm' ? ' · pm' : ''}
                    </td>
                    <td>
                      <Link href={`/log/${s.id}`}>{s.title ?? sessionTypeLabel(s.type)}</Link>
                      <div className="muted small">{sessionTypeLabel(s.type)}</div>
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
        )}
      </div>
    </div>
  );
}
