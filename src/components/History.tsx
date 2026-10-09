import type { LatencyRow } from '../services/store';

/**
 * Availability + latency history, hand-rolled SVG (zero deps).
 * One sparkline per network (avg ms, oldest→newest), dot color = that
 * check's loss (green 0%, amber partial, red total). Summary row shows
 * per-network uptime % across all recorded checks.
 */
const W = 560;
const H = 120;
const PAD = 8;

function points(rows: LatencyRow[]): string {
  const vals = rows.map((r) => r.avg_ms ?? 0);
  const max = Math.max(1, ...vals);
  return rows
    .map((r, i) => {
      const x = PAD + (i * (W - 2 * PAD)) / Math.max(1, rows.length - 1);
      const y = H - PAD - ((r.avg_ms ?? 0) / max) * (H - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function dotColor(r: LatencyRow): string {
  if (!r.sent) return '#8b949e';
  const loss = 1 - r.recv / r.sent;
  if (loss === 0) return '#3fb950';
  if (loss < 1) return '#d29922';
  return '#f85149';
}

export function History(props: {
  latency: LatencyRow[];
  availability: Record<string, { checks: number; up_pct: number | null; avg_ms: number | null }>;
}) {
  const { latency, availability } = props;
  if (latency.length === 0 && Object.keys(availability).length === 0) {
    return <p className="muted">No latency history yet — roam tests and monitors record here.</p>;
  }
  const byNet = new Map<string, LatencyRow[]>();
  for (const r of latency) {
    const arr = byNet.get(r.network) ?? [];
    arr.push(r);
    byNet.set(r.network, arr);
  }
  for (const arr of byNet.values()) arr.reverse();
  return (
    <div>
      <h2>Availability history</h2>
      <ul>
        {Object.entries(availability).map(([net, a]) => (
          <li key={net}>
            <code>{net}</code> {a.up_pct ?? '—'}% up · {a.checks} checks · avg{' '}
            {a.avg_ms ?? '—'}ms
          </li>
        ))}
      </ul>
      {Array.from(byNet.entries()).map(([net, rows]) => (
        <div key={net}>
          <h3>
            {net} <span className="muted">({rows.length} checks, ms)</span>
          </h3>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={`latency history for ${net}`}
          >
            <polyline points={points(rows)} fill="none" stroke="#58a6ff" strokeWidth="2" />
            {rows.map((r, i) => {
              const [x, y] = points(rows).split(' ')[i].split(',').map(Number);
              return (
                <circle key={i} cx={x} cy={y} r="3.5" fill={dotColor(r)}>
                  <title>{`${r.ts} ${r.recv}/${r.sent} avg ${r.avg_ms ?? '?'}ms → ${r.target}`}</title>
                </circle>
              );
            })}
          </svg>
        </div>
      ))}
    </div>
  );
}
