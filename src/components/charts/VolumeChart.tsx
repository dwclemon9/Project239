'use client';

import { useState } from 'react';
import { niceTicks, roundedTopBar } from '@/lib/scale';
import { formatDuration, toUnit } from '@/lib/format';
import type { DistanceUnit, VolumeBucket } from '@/lib/types';

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
  buckets: VolumeBucket[];
  unit: DistanceUnit;
  /** Column header for the table view, e.g. "Week of", "Day", "Month". */
  periodHeader: string;
  /** Accessible summary of what the bars cover. */
  description: string;
  /**
   * Trailing average drawn as a neutral annotation. Omit it on short spans
   * (a single week of days) where a rolling mean says nothing.
   */
  averageWindow?: number;
  /**
   * Floor for the axis top. Without it, a week you have not started yet draws a
   * 0-1 axis ticked in quarter miles, which reads as broken rather than empty.
   */
  minAxisTop?: number;
}

export default function VolumeChart({
  buckets, unit, periodHeader, description, averageWindow, minAxisTop = 1,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const totals = buckets.map((b) => toUnit(b.distance_m, unit));
  const ticks = niceTicks(Math.max(...totals, minAxisTop));
  const top = ticks[ticks.length - 1];
  const y = (value: number) => PAD.top + PLOT_H - (value / top) * PLOT_H;

  const band = PLOT_W / Math.max(buckets.length, 1);
  const barW = Math.min(band * 0.62, 46);

  // Rolling average, drawn as a neutral annotation rather than a second series
  // — the stack already owns the blue ramp.
  const showAverage = averageWindow != null && buckets.length > averageWindow;
  const rollingPath = !showAverage
    ? null
    : totals
        .map((_, i) => {
          const slice = totals.slice(Math.max(0, i - (averageWindow - 1)), i + 1);
          const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
          return `${i === 0 ? 'M' : 'L'}${PAD.left + band * (i + 0.5)},${y(mean)}`;
        })
        .join(' ');

  const active = hover == null ? null : buckets[hover];

  return (
    <div>
      <div className="legend" style={{ marginBottom: 10 }}>
        {BANDS.map((b) => (
          <span className="legend-item" key={b.key}>
            <span className="legend-swatch" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
        {showAverage && (
          <span className="legend-item">
            <span className="legend-rule" style={{ background: 'var(--text-muted)' }} />
            {averageWindow}-period average
          </span>
        )}
      </div>

      <div className="chart-wrap">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={description}
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

          {buckets.map((bucket, i) => {
            const x = PAD.left + band * (i + 0.5) - barW / 2;
            let cursor = 0;
            const segments = BANDS.map((b) => {
              const value = toUnit(bucket[b.key], unit);
              const from = cursor;
              cursor += value;
              return { ...b, from, to: cursor, value };
            }).filter((s) => s.value > 0);

            return (
              <g key={bucket.start} opacity={hover == null || hover === i ? 1 : 0.55}>
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

          {rollingPath && (
            <path d={rollingPath} fill="none" stroke="var(--text-muted)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
          )}

          {buckets.map((bucket, i) => (
            <text
              key={bucket.start}
              x={PAD.left + band * (i + 0.5)} y={H - 10}
              textAnchor="middle" fill="var(--text-muted)" fontSize="11"
            >
              {bucket.label}
            </text>
          ))}

          {/* Hit areas span the full band so the target is never the bar's width. */}
          {buckets.map((bucket, i) => (
            <rect
              key={`hit-${bucket.start}`}
              x={PAD.left + band * i} y={PAD.top} width={band} height={PLOT_H}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${bucket.title}: ${toUnit(bucket.distance_m, unit).toFixed(1)} ${unit}`}
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
              transform: hover! > buckets.length / 2 ? 'translate(-108%, 0)' : 'translate(8%, 0)',
            }}
          >
            <div className="tooltip-title">{active.title}</div>
            <div className="tooltip-row">
              <span>Total</span><b>{toUnit(active.distance_m, unit).toFixed(1)} {unit}</b>
            </div>
            {BANDS.map((b) => (
              <div className="tooltip-row" key={b.key}>
                <span>{b.label}</span><b>{toUnit(active[b.key], unit).toFixed(1)}</b>
              </div>
            ))}
            <div className="tooltip-row"><span>Sessions</span><b>{active.sessions}</b></div>
            <div className="tooltip-row">
              <span>Time</span><b>{formatDuration(active.duration_sec || null)}</b>
            </div>
          </div>
        )}
      </div>

      <details className="table-view">
        <summary>Table view</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{periodHeader}</th>
                <th className="num">Easy</th>
                <th className="num">Moderate</th>
                <th className="num">Hard</th>
                <th className="num">Total ({unit})</th>
                <th className="num">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {[...buckets].reverse().map((b) => (
                <tr key={b.start}>
                  <td>{b.title}</td>
                  <td className="num">{toUnit(b.easy_m, unit).toFixed(1)}</td>
                  <td className="num">{toUnit(b.moderate_m, unit).toFixed(1)}</td>
                  <td className="num">{toUnit(b.hard_m, unit).toFixed(1)}</td>
                  <td className="num">{toUnit(b.distance_m, unit).toFixed(1)}</td>
                  <td className="num">{b.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
