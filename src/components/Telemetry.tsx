import { useEffect, useState } from 'react';
import { MESH_API_BASE, OPENCODE_BASE } from '../config';
import { readMesh, readSessions } from '../services/store';
import type { MeshSnapshot } from '../services/store';
/**
 * Database-driven telemetry: mesh inventory rows + session counts,
 * refreshed on mount and every 60s. Degrades per-source (one backend
 * down never blanks the other).
 */
export function Telemetry(props: {
  meshOnline: boolean;
  dashboardOnline: boolean;
  onCounts(n: { nodes: number; findings: number; sessions: number | null }): void;
  onSnapshot(m: MeshSnapshot | null): void;
}) {
  const [mesh, setMesh] = useState<MeshSnapshot | null>(null);
  const [sessions, setSessions] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let nodes = 0;
      let findings = 0;
      let sess: number | null = null;
      if (props.meshOnline) {
        try {
          const m = await readMesh(MESH_API_BASE);
          if (!cancelled) {
            setMesh(m);
            props.onSnapshot(m);
            nodes = m.nodes.length;
            findings = m.findings.length;
          }
        } catch {
          if (!cancelled) {
            setMesh(null);
            props.onSnapshot(null);
          }
        }
      } else {
        setMesh(null);
        props.onSnapshot(null);
      }
      if (props.dashboardOnline) {
        try {
          const s = await readSessions(OPENCODE_BASE);
          if (!cancelled) {
            setSessions(s.total);
            sess = s.total;
          }
        } catch {
          if (!cancelled) setSessions(null);
        }
      } else {
        setSessions(null);
      }
      if (!cancelled) props.onCounts({ nodes, findings, sessions: sess });
    };
    void load();
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.meshOnline, props.dashboardOnline]);

  return (
    <div>
      <h2>
        Telemetry{' '}
        <span className="muted">
          sessions {sessions ?? '—'} · nodes {mesh?.nodes.length ?? '—'} ·
          findings {mesh?.findings.length ?? '—'}
        </span>
      </h2>
      {!mesh && !props.meshOnline && (
        <p className="muted">Mesh telemetry needs the mesh API.</p>
      )}
      {mesh?.available === false && (
        <p className="muted">Mesh API up, no inventory on this node.</p>
      )}
      {mesh && mesh.available && mesh.findings.length > 0 && (
        <div>
          <h3>Open findings ({mesh.findings.length})</h3>
          <ul>
            {mesh.findings.map((f) => (
              <li key={f.id}>
                <strong>{f.kind}</strong> — {f.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
