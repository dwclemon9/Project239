'use client';

import { useState } from 'react';
import { niceTicks, roundedTopBar } from '@/lib/scale';
import { formatShortDate, toUnit } from '@/lib/format';
import type { DistanceUnit, WeekSummary } from '@/lib/types';

const W = 760;
const H = 250;
const PAD = { top: 12, right: 12, bottom: 30, left: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const GAP = 2; // surface gap between stacked segments, never a border

// Ordinal ramp: intensity is an ordered category, so one hue, light -> dark.
const BANDS = [
  { key: 'easy_m', label: 'Easy', color: 'var(--intensity-easy)' },
  { key: 'moderate_m', label: 'Moderate', color: 'var(--intensity-moderate)' },
  { key: 'hard_m', label: 'Hard', color: 'var(--intensity-hard)' },
] as const;

interface Props {
  weeks: WeekSummary[];
  unit: DistanceUnit;
}

export default function WeeklyVolumeChart({ weeks, unit }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const totals = weeks.map((w) => toUnit(w.distance_m, unit));
  const ticks = niceTicks(Math.max(...totals, 1));
  const top = ticks[ticks.length - 1];
  const y = (value: number) => PAD.top + PLOT_H - (value / top) * PLOT_H;

  const band = PLOT_W / Math.max(weeks.length, 1);
  const barW = Math.min(band * 0.62, 46);

  // Four-week rolling average, drawn as a neutral annotation rather than a
  // second series — the stack already owns the blue ramp.
  const rolling = totals.map((_, i) => {
    const slice = totals.slice(Math.max(0, i - 3), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const rollingPath = rolling
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${PAD.left + band * (i + 0.5)},${y(v)}`)
    .join(' ');

  const active = hover == null ? null : weeks[hover];

  return (
    <div>
      <div className="legend" style={{ marginBottom: 10 }}>
        {BANDS.map((b) => (
          <span className="legend-item" key={b.key}>
            <span className="legend-swatch" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
        <span className="legend-item">
          <span className="legend-rule" style={{ background: 'var(--text-muted)' }} />
          4-week average
        </span>
      </div>

      <div className="chart-wrap">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Weekly running volume over the last ${weeks.length} weeks, split by intensity`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
                stroke={t === 0 ? 'var(--axis)' : 'var(--gridline)'} strokeWidth="1"
              />
              <text
                x={PAD.left - 8} y={y(t) + 4} textAnchor="end"
                fill="var(--text-muted)" fontSize="11" style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {t}
              </text>
            </g>
          ))}

          {weeks.map((week, i) => {
            const x = PAD.left + band * (i + 0.5) - barW / 2;
            let cursor = 0;
            const segments = BANDS.map((b) => {
              const value = toUnit(week[b.key], unit);
              const from = cursor;
              cursor += value;
              return { ...b, from, to: cursor, value };
            }).filter((s) => s.value > 0);

            return (
              <g key={week.weekStart} opacity={hover == null || hover === i ? 1 : 0.55}>
                {segments.map((s, idx) => {
                  const yTop = y(s.to);
                  const isTop = idx === segments.length - 1;
                  const rawH = y(s.from) - yTop;
                  const h = isTop ? rawH : Math.max(rawH - GAP, 0.5);
                  return isTop ? (
                    <path key={s.key} d={roundedTopBar(x, yTop, barW, h)} fill={s.color} />
                  ) : (
                    <rect key={s.key} x={x} y={yTop + GAP} width={barW} height={h} fill={s.color} />
                  );
                })}
              </g>
            );
          })}

          <path d={rollingPath} fill="none" stroke="var(--text-muted)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />

          {weeks.map((week, i) => (
            <text
              key={week.weekStart}
              x={PAD.left + band * (i + 0.5)} y={H - 10}
              textAnchor="middle" fill="var(--text-muted)" fontSize="11"
            >
              {formatShortDate(week.weekStart)}
            </text>
          ))}

          {/* Hit areas span the full band so the target is never the bar's width. */}
          {weeks.map((week, i) => (
            <rect
              key={`hit-${week.weekStart}`}
              x={PAD.left + band * i} y={PAD.top} width={band} height={PLOT_H}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`Week of ${formatShortDate(week.weekStart)}: ${toUnit(week.distance_m, unit).toFixed(1)} ${unit}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>

        {active && (
          <div
            className="tooltip"
            style={{
              left: `${((PAD.left + band * (hover! + 0.5)) / W) * 100}%`,
              top: 0,
              transform: hover! > weeks.length / 2 ? 'translate(-108%, 0)' : 'translate(8%, 0)',
            }}
          >
            <div className="tooltip-title">Week of {formatShortDate(active.weekStart)}</div>
            <div className="tooltip-row">
              <span>Total</span><b>{toUnit(active.distance_m, unit).toFixed(1)} {unit}</b>
            </div>
            {BANDS.map((b) => (
              <div className="tooltip-row" key={b.key}>
                <span>{b.label}</span><b>{toUnit(active[b.key], unit).toFixed(1)}</b>
              </div>
            ))}
            <div className="tooltip-row"><span>Sessions</span><b>{active.sessions}</b></div>
          </div>
        )}
      </div>

      <details className="table-view">
        <summary>Table view</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Week of</th>
                <th className="num">Easy</th>
                <th className="num">Moderate</th>
                <th className="num">Hard</th>
                <th className="num">Total ({unit})</th>
                <th className="num">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map((w) => (
                <tr key={w.weekStart}>
                  <td>{formatShortDate(w.weekStart)}</td>
                  <td className="num">{toUnit(w.easy_m, unit).toFixed(1)}</td>
                  <td className="num">{toUnit(w.moderate_m, unit).toFixed(1)}</td>
                  <td className="num">{toUnit(w.hard_m, unit).toFixed(1)}</td>
                  <td className="num">{toUnit(w.distance_m, unit).toFixed(1)}</td>
                  <td className="num">{w.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
