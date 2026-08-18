'use client';

import { useState } from 'react';
import { niceTicks } from '@/lib/scale';
import { formatShortDate } from '@/lib/format';

const W = 560;
const H = 200;
const PAD = { top: 12, right: 14, bottom: 28, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export interface TrendPoint {
  date: string;
  value: number | null;
}

interface Props {
  points: TrendPoint[];
  label: string;
  unitSuffix?: string;
  /** Fixed axis top when the measure has a natural ceiling (a 0-100 score). */
  max?: number;
  emptyMessage?: string;
}

/**
 * Single-series trend line with a crosshair. One series means no legend box —
 * the card title names it. Gaps in the data break the line rather than
 * interpolating across days that were never logged.
 */
export default function TrendChart({ points, label, unitSuffix = '', max, emptyMessage }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  if (values.length === 0) {
    return <div className="empty">{emptyMessage ?? `No ${label.toLowerCase()} logged yet.`}</div>;
  }

  const ticks = max ? niceTicks(max, 3) : niceTicks(Math.max(...values), 3);
  const top = Math.max(ticks[ticks.length - 1], max ?? 0);
  const y = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H;
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W);

  // Break the path wherever a day has no value.
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p.value == null) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`);
  });
  if (current.length > 1) segments.push(current.join(' '));

  const lastIndex = points.reduce((acc, p, i) => (p.value != null ? i : acc), 0);
  const active = hover != null ? points[hover] : null;

  return (
    <div>
      <div className="chart-wrap">
        <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img"
             aria-label={`${label} trend over the last ${points.length} days`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
                    stroke={t === 0 ? 'var(--axis)' : 'var(--gridline)'} strokeWidth="1" />
              <text x={PAD.left - 7} y={y(t) + 4} textAnchor="end" fill="var(--text-muted)"
                    fontSize="11" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t}
              </text>
            </g>
          ))}

          {hover != null && points[hover].value != null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + PLOT_H}
                  stroke="var(--axis)" strokeWidth="1" />
          )}

          {segments.map((d) => (
            <path key={d.slice(0, 24)} d={d} fill="none" stroke="var(--series-1)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {/* Direct-label the endpoint only; the axis and tooltip carry the rest. */}
          {points[lastIndex].value != null && (
            <>
              <circle cx={x(lastIndex)} cy={y(points[lastIndex].value!)} r="4"
                      fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth="2" />
              <text x={x(lastIndex) - 8} y={y(points[lastIndex].value!) - 9} textAnchor="end"
                    fill="var(--text-primary)" fontSize="12" fontWeight="600">
                {round(points[lastIndex].value!)}{unitSuffix}
              </text>
            </>
          )}

          {hover != null && points[hover].value != null && (
            <circle cx={x(hover)} cy={y(points[hover].value!)} r="4.5"
                    fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth="2" />
          )}

          <text x={PAD.left} y={H - 9} fill="var(--text-muted)" fontSize="11">
            {formatShortDate(points[0].date)}
          </text>
          <text x={W - PAD.right} y={H - 9} textAnchor="end" fill="var(--text-muted)" fontSize="11">
            {formatShortDate(points[points.length - 1].date)}
          </text>

          {points.map((p, i) => (
            <rect key={p.date} x={x(i) - PLOT_W / points.length / 2} y={PAD.top}
                  width={PLOT_W / points.length} height={PLOT_H} fill="transparent"
                  tabIndex={p.value == null ? -1 : 0} role="button"
                  aria-label={`${formatShortDate(p.date)}: ${p.value == null ? 'not logged' : round(p.value) + unitSuffix}`}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
          ))}
        </svg>

        {active && (
          <div className="tooltip" style={{
            left: `${(x(hover!) / W) * 100}%`,
            top: 0,
            transform: hover! > points.length / 2 ? 'translate(-108%, 0)' : 'translate(8%, 0)',
          }}>
            <div className="tooltip-title">{formatShortDate(active.date)}</div>
            <div className="tooltip-row">
              <span>{label}</span>
              <b>{active.value == null ? 'not logged' : `${round(active.value)}${unitSuffix}`}</b>
            </div>
          </div>
        )}
      </div>

      <details className="table-view">
        <summary>Table view</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Date</th><th className="num">{label}</th></tr>
            </thead>
            <tbody>
              {[...points].reverse().filter((p) => p.value != null).map((p) => (
                <tr key={p.date}>
                  <td>{formatShortDate(p.date)}</td>
                  <td className="num">{round(p.value!)}{unitSuffix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function round(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
