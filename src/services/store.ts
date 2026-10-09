/**
 * Database-driven telemetry: typed readers over the mesh inventory DB
 * (served by mesh-api.py) and the dashboard read APIs. Every view below
 * renders from these rows — no hardcoded state, no assumptions.
 */

export interface MeshNode {
  name: string;
  mesh_ip: string;
  machine_id: string;
  onboarded_at?: string;
}

export interface MeshFinding {
  id: number;
  ts?: string;
  kind: string;
  detail: string;
}

export interface MeshSnapshot {
  available: boolean;
  nodes: MeshNode[];
  peers: Array<{ mesh_ip: string }>;
  findings: MeshFinding[];
  counts: { devices?: number; reservations?: number; forwards?: number };
}

export async function readMesh(base: string): Promise<MeshSnapshot> {
  const r = await fetch(`${base}/api/mesh`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('http ' + r.status);
  const d = await r.json();
  return {
    available: !!d.available,
    nodes: d.nodes ?? [],
    peers: d.peers ?? [],
    findings: d.findings ?? [],
    counts: d.counts ?? {},
  };
}

export interface SessionCounts {
  available: boolean;
  total: number;
}

export async function readSessions(base: string): Promise<SessionCounts> {
  // limit=500: /api/sessions paginates, and this number is displayed as a
  // total — limit=1 once lied "sessions 1" here.
  const r = await fetch(`${base}/api/sessions?limit=500`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error('http ' + r.status);
  const d = await r.json();
  const total = Array.isArray(d) ? d.length : (d.total ?? d.sessions ?? 0);
  return { available: true, total: Number(total) || 0 };
}
