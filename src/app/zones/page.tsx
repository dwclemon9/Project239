import Link from 'next/link';
import { getAthlete } from '@/lib/queries';
import { resolveZones } from '@/lib/training';
import { formatDuration, METERS_PER_MILE, metersPer } from '@/lib/format';

export const dynamic = 'force-dynamic';

// Rep distances a distance runner actually splits, for the pace table.
const REP_DISTANCES = [200, 400, 600, 800, 1000, 1200, 1600, 3200];

export default function ZonesPage() {
  const athlete = getAthlete();
  const unit = athlete.distance_unit;

  if (!athlete.threshold_pace_sec) {
    return (
      <div className="card">
        <div className="empty">
          Set your threshold pace in <Link href="/settings">settings</Link> and the
          zones show up here.
        </div>
      </div>
    );
  }

  const zones = resolveZones(athlete.threshold_pace_sec);
  // Zone offsets are defined per mile; convert once for a km-based athlete.
  const perUnit = (secPerMile: number) => secPerMile * (metersPer(unit) / METERS_PER_MILE);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Pace zones</h1>
          <p>
            Anchored to a threshold pace of{' '}
            {formatDuration(perUnit(athlete.threshold_pace_sec))} /{unit}. These are a
            starting point — adjust them against how the work actually goes.
          </p>
        </div>
        <Link href="/settings" className="btn">Change threshold</Link>
      </div>

      <div className="card">
        <div className="card-head"><h2>Zones</h2></div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Zone</th><th className="num">Pace /{unit}</th>
                <th>Intensity</th><th>What it is for</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.key}>
                  <td>
                    <span className="chip">
                      <span className="legend-swatch" style={{ background: `var(--intensity-${z.intensity})` }} />
                      {z.label}
                    </span>
                  </td>
                  <td className="num">
                    {formatDuration(perUnit(z.fastSec))} – {formatDuration(perUnit(z.slowSec))}
                  </td>
                  <td className="small">{z.intensity}</td>
                  <td className="muted small">{z.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Rep splits</h2>
          <span className="sub">Target time per rep at the middle of each zone</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Zone</th>
                {REP_DISTANCES.map((d) => <th className="num" key={d}>{d}m</th>)}
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => {
                const midSecPerMile = (z.fastSec + z.slowSec) / 2;
                return (
                  <tr key={z.key}>
                    <td>{z.label}</td>
                    {REP_DISTANCES.map((d) => (
                      <td className="num" key={d}>
                        {formatDuration((d / METERS_PER_MILE) * midSecPerMile)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
