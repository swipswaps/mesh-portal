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

import type { HealAction } from '../services/store';

export function History(props: {
  latency: LatencyRow[];
  availability: Record<string, { checks: number; up_pct: number | null; avg_ms: number | null }>;
  actions: HealAction[];
  stale: boolean;
}) {
  const { latency, availability, actions, stale } = props;
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
      <h2>
        Availability history{' '}
        {stale && <span className="muted">(cached — backend unreachable)</span>}
      </h2>
      <ul>
        {Object.entries(availability).map(([net, a]) => (
          <li key={net}>
            <code>{net}</code> {a.up_pct ?? '—'}% up · {a.checks} checks · avg{' '}
            {a.avg_ms ?? '—'}ms
          </li>
        ))}
      </ul>
      {actions.length > 0 && (
        <div>
          <h3>Heal actions ({actions.length})</h3>
          <ul>
            {actions.slice(0, 10).map((a, i) => (
              <li key={i}>
                <span className="muted">{a.ts}</span> #{a.finding_id} {a.action} →{' '}
                <strong>{a.result}</strong>
                {a.note ? ` — ${a.note.slice(0, 100)}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Array.from(byNet.entries()).map(([net, rows]) => {
        const vals = rows.map((r) => r.avg_ms ?? 0);
        const max = Math.max(1, ...vals);
        const min = Math.min(...vals);
        const pts = points(rows).split(' ');
        return (
          <div key={net}>
            <h3>
              {net} <span className="muted">({rows.length} checks, ms)</span>
            </h3>
            <svg
              viewBox={`0 0 ${W} ${H + 28}`}
              width="100%"
              role="img"
              aria-label={`latency history for ${net}`}
            >
              <text x={PAD} y={PAD + 4} fill="#8b949e" fontSize="9">
                max {max.toFixed(1)}ms
              </text>
              <text x={PAD} y={H - PAD} fill="#8b949e" fontSize="9">
                min {min.toFixed(1)}ms
              </text>
              <polyline points={points(rows)} fill="none" stroke="#58a6ff" strokeWidth="2" />
              {rows.map((r, i) => {
                const [x, y] = pts[i].split(',').map(Number);
                return (
                  <circle key={i} cx={x} cy={y} r="3.5" fill={dotColor(r)}>
                    <title>{`${r.ts} ${r.recv}/${r.sent} avg ${r.avg_ms ?? '?'}ms → ${r.target}`}</title>
                  </circle>
                );
              })}
              <text x={PAD} y={H + 16} fill="#8b949e" fontSize="9">
                {(rows[0]?.ts ?? '').slice(5, 16).replace('T', ' ')}
              </text>
              <text x={W - PAD} y={H + 16} fill="#8b949e" fontSize="9" textAnchor="end">
                {(rows[rows.length - 1]?.ts ?? '').slice(5, 16).replace('T', ' ')}
              </text>
            </svg>
            <details>
              <summary className="muted">
                data ({rows.length} rows)
              </summary>
              <table>
                <thead>
                  <tr>
                    <th>time</th>
                    <th>target</th>
                    <th>recv/sent</th>
                    <th>avg ms</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.ts.slice(5, 19).replace('T', ' ')}</td>
                      <td>{r.target}</td>
                      <td>
                        {r.recv}/{r.sent}
                      </td>
                      <td>{r.avg_ms ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        );
      })}
    </div>
  );
}
