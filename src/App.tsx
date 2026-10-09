import { useEffect, useRef, useState } from 'react';
import { MESH_API_BASE, OPENCODE_BASE, isGitHubPages } from './config';
import { HealthProbe, type HealthStatus } from './services/health';
import { StatusBanner } from './components/StatusBanner';
import { MeshView } from './components/MeshView';
import './App.css';

const fresh = (): HealthStatus => ({
  isAvailable: false,
  lastChecked: new Date(),
  consecutiveFailures: 0,
});

export default function App() {
  const [mesh, setMesh] = useState<HealthStatus>(fresh);
  const [opencode, setOpencode] = useState<HealthStatus>(fresh);
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
    return () => {
      m.stop();
      o.stop();
      probes.current = null;
    };
  }, []);

  return (
    <div className="app">
      <h1>mesh-portal</h1>
      <StatusBanner mesh={mesh} opencode={opencode} />
      <main>
        <MeshView online={mesh.isAvailable} />
      </main>
    </div>
  );
}
