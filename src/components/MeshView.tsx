import { useEffect, useState } from 'react';
import { MESH_API_BASE } from '../config';

interface MeshState {
  available: boolean;
  nodes: Array<{ name: string; mesh_ip: string; machine_id: string }>;
  peers: Array<{ mesh_ip: string }>;
  findings: Array<{ id: number; kind: string; detail: string }>;
}

export function MeshView(props: { online: boolean }) {
  const [state, setState] = useState<MeshState | null>(null);
  useEffect(() => {
    if (!props.online) {
      setState(null);
      return;
    }
    let cancelled = false;
    fetch(`${MESH_API_BASE}/api/mesh`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((d) => {
        if (!cancelled) setState(d);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [props.online]);
  if (!props.online) return <p className="muted">Mesh view needs the mesh API.</p>;
  if (!state) return <p className="muted">Loading mesh state…</p>;
  if (!state.available) return <p className="muted">No inventory on this node.</p>;
  // Findings render once, in Telemetry — not duplicated here.
  return (
    <div>
      <h2>Nodes ({state.nodes.length})</h2>
      <ul>
        {state.nodes.map((n) => (
          <li key={n.name}>
            <code>{n.name}</code> {n.mesh_ip} <span className="muted">{n.machine_id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
