export type StatStatus = 'good' | 'warning' | 'serious' | 'critical';

const STATUS_COLOR: Record<StatStatus, string> = {
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  serious: 'var(--status-serious)',
  critical: 'var(--status-critical)',
};

// A status color never carries meaning alone — every tile pairs it with a glyph
// and a written label.
const STATUS_GLYPH: Record<StatStatus, string> = {
  good: '✓', warning: '!', serious: '▲', critical: '▲',
};

interface Props {
  label: string;
  value: string;
  unit?: string;
  meta?: string;
  status?: StatStatus;
  statusLabel?: string;
}

export default function StatTile({ label, value, unit, meta, status, statusLabel }: Props) {
  return (
    <div className="card">
      <div className="tile-label">{label}</div>
      <div className="tile-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {meta && <div className="tile-meta">{meta}</div>}
      {status && statusLabel && (
        <div className="status-row" style={{ color: STATUS_COLOR[status] }}>
          <span aria-hidden="true">{STATUS_GLYPH[status]}</span>
          <span>{statusLabel}</span>
        </div>
      )}
    </div>
  );
}
