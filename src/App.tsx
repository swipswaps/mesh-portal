import { useEffect, useRef, useState } from 'react';
import { MESH_API_BASE, OPENCODE_BASE, isGitHubPages } from './config';
import { queryLna, type LnaState } from './services/lna';
import { HealthProbe, type HealthStatus } from './services/health';
import { StatusBanner } from './components/StatusBanner';
import { MeshView } from './components/MeshView';
import { Telemetry } from './components/Telemetry';
import { Guide } from './components/Guide';
import { History } from './components/History';
import type { MeshSnapshot } from './services/store';
import './App.css';

const fresh = (): HealthStatus => ({
  isAvailable: false,
  lastChecked: new Date(),
  consecutiveFailures: 0,
});

export default function App() {
  const [mesh, setMesh] = useState<HealthStatus>(fresh);
  const [opencode, setOpencode] = useState<HealthStatus>(fresh);
  const [lna, setLna] = useState<LnaState>('unknown');
  const [snapshot, setSnapshot] = useState<MeshSnapshot | null>(null);
  const [counts, setCounts] = useState<{ nodes: number; findings: number; sessions: number | null }>({
    nodes: 0,
    findings: 0,
    sessions: null,
  });
  const probes = useRef<{ mesh: HealthProbe; opencode: HealthProbe } | null>(null);

  useEffect(() => {
    const m = new HealthProbe(`${MESH_API_BASE}/api/rev`);
    const o = new HealthProbe(`${OPENCODE_BASE}/api/rev`);
    if (isGitHubPages) {
      m.staticHosting();
      o.staticHosting();
    }
    probes.current = { mesh: m, opencode: o };
    m.start(setMesh);
    o.start(setOpencode);
    void queryLna().then(setLna);
    return () => {
      m.stop();
      o.stop();
      probes.current = null;
    };
  }, []);

  return (
    <div className="app">
      <h1>mesh-portal</h1>
      <StatusBanner mesh={mesh} opencode={opencode} lna={lna} />
      <main>
        <MeshView online={mesh.isAvailable} />
        <Telemetry
          meshOnline={mesh.isAvailable}
          dashboardOnline={opencode.isAvailable}
          onCounts={setCounts}
          onSnapshot={setSnapshot}
        />
        <History
          latency={snapshot?.latency ?? []}
          availability={snapshot?.availability ?? {}}
        />
        <Guide
          meshOnline={mesh.isAvailable}
          dashboardOnline={opencode.isAvailable}
          meshNodes={counts.nodes}
          openFindings={counts.findings}
          sessions={counts.sessions}
        />
      </main>
    </div>
  );
}
