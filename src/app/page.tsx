import Link from 'next/link';
import StatTile, { type StatStatus } from '@/components/StatTile';
import VolumeChart from '@/components/charts/VolumeChart';
import TrendChart, { type TrendPoint } from '@/components/charts/TrendChart';
import {
  earliestSessionDate, getAthlete, listNiggles, listWellness, personalBests,
  repsBySessionSince, sessionsSince,
} from '@/lib/queries';
import {
  addDays, dailySummaries, dateRange, distanceInWindow, daysBetween, loadStatus,
  monthlySummaries, monthStart, readinessScore, todayISO, weeklySummaries,
  weekStart, withIntensity,
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

  // A full year in one read: every rollup below filters by date, so the daily,
  // weekly and monthly charts all come off this single query.
  const sessions = sessionsSince(366, today);
  // Volume is classified per segment, so the rollups need each session's reps.
  const volume = withIntensity(
    sessions,
    repsBySessionSince(366, today),
    athlete.threshold_pace_sec,
  );
  const days = dailySummaries(volume, today);

  // Charts begin where training began. Padding the axis with periods from
  // before the first logged session would draw empty bars for weeks that were
  // never part of this log at all.
  const earliest = earliestSessionDate();
  const weekCount = earliest
    ? clamp(daysBetween(weekStart(earliest), weekStart(today)) / 7 + 1, 1, 12)
    : 1;
  const monthCount = earliest ? clamp(monthsBetween(earliest, today) + 1, 1, 12) : 1;

  const weeks = weeklySummaries(volume, weekCount, today);
  const months = monthlySummaries(volume, monthCount, today);
  const thisWeek = weeks[weeks.length - 1];
  const load = loadStatus(sessions, today);
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
  const last31 = distanceInWindow(sessions, today, 31);
  const prev31 = distanceInWindow(sessions, addDays(today, -31), 31);
  const loadCopy = load.zone === 'unknown' ? null : LOAD_COPY[load.zone];
  const todayCheckin = wellnessByDate.get(today);

  // Identity line: whatever of events / school is filled in, then the week.
  const subtitle = [athlete.primary_events, athlete.school]
    .filter((part): part is string => Boolean(part))
    .concat(`week of ${formatDayLabel(weekStart(today))}`)
    .join(' · ');

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{athlete.name}</h1>
          <p>{subtitle}</p>
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
          meta={windowDelta(last7, prev7, 'the week before')}
        />
        <StatTile
          label="Last 31 days"
          value={toUnit(last31, unit).toFixed(1)}
          unit={unit}
          meta={windowDelta(last31, prev31, 'the 31 days before')}
        />
        <StatTile
          label="Acute : chronic load"
          value={load.ratio == null ? '—' : load.ratio.toFixed(2)}
          meta={
            load.ratio == null
              ? 'Needs 4 weeks of history before it means anything'
              : `7-day load ${Math.round(load.acute)} vs 28-day norm ${Math.round(load.chronic)}`
          }
          status={loadCopy?.status}
          statusLabel={loadCopy?.label}
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
          <h2>This week, day by day</h2>
          <span className="sub">
            {toUnit(thisWeek.distance_m, unit).toFixed(1)} {unit} · week of{' '}
            {formatDayLabel(weekStart(today))}
          </span>
        </div>
        <VolumeChart
          buckets={days}
          unit={unit}
          periodHeader="Day"
          minAxisTop={8}
          description={`Running volume for each day of the week of ${weekStart(today)}, split by intensity`}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Weekly volume</h2>
          <span className="sub">
            {weeks.length} week{weeks.length === 1 ? '' : 's'} · {unit}
          </span>
        </div>
        <VolumeChart
          buckets={weeks}
          unit={unit}
          periodHeader="Week of"
          minAxisTop={20}
          averageWindow={4}
          description={`Weekly running volume over ${weeks.length} weeks, split by intensity`}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Monthly volume</h2>
          <span className="sub">
            {months.length} month{months.length === 1 ? '' : 's'} · {unit}
          </span>
        </div>
        <VolumeChart
          buckets={months}
          unit={unit}
          periodHeader="Month"
          minAxisTop={80}
          averageWindow={3}
          description={`Monthly running volume over the last ${months.length} months, split by intensity`}
        />
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

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(Math.round(value), high));
}

/** Whole calendar months from one date to another. */
function monthsBetween(from: string, to: string): number {
  const key = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
  return key(monthStart(to)) - key(monthStart(from));
}

/** "+12% vs the week before", or a note when there is nothing to compare to. */
function windowDelta(current: number, previous: number, label: string): string {
  if (previous <= 0) return `Nothing logged in ${label}`;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct > 0 ? '+' : ''}${pct}% vs ${label}`;
}
