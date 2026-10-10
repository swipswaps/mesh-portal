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

export interface LatencyRow {
  ts: string;
  network: string;
  target: string;
  sent: number;
  recv: number;
  avg_ms: number | null;
}

export interface HealAction {
  ts: string;
  finding_id: number;
  action: string;
  result: string;
  note: string;
}

export interface MeshSnapshot {
  available: boolean;
  nodes: MeshNode[];
  peers: Array<{ mesh_ip: string }>;
  findings: MeshFinding[];
  counts: { devices?: number; reservations?: number; forwards?: number };
  latency: LatencyRow[];
  availability: Record<string, { checks: number; up_pct: number | null; avg_ms: number | null }>;
  actions: HealAction[];
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
    latency: d.latency ?? [],
    availability: d.availability ?? {},
    actions: d.actions ?? [],
  };
}

export interface SessionCounts {
  available: boolean;
  total: number;
}

const SNAP_KEY = 'mesh-portal:last-good-snapshot';

export function loadCached(): MeshSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.latency)) return null;
    return d as MeshSnapshot;
  } catch {
    return null;
  }
}

export function saveCached(s: MeshSnapshot): void {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify({ ...s, cachedAt: new Date().toISOString() }));
  } catch {
    /* storage full/blocked: live data still renders */
  }
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
