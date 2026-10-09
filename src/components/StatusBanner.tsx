import type { HealthStatus } from '../services/health';
import type { LnaState } from '../services/lna';
import { isGitHubPages } from '../config';

export function StatusBanner(props: { mesh: HealthStatus; opencode: HealthStatus; lna: LnaState }) {
  const { mesh, opencode, lna } = props;
  const dot = (ok: boolean) => (ok ? '🟢' : '🔴');
  return (
    <header className="banner" role="status" aria-live="polite">
      <div>
        <strong>mesh API</strong> {dot(mesh.isAvailable)}{' '}
        {mesh.isAvailable ? 'Online' : 'Offline'}
      </div>
      <div>
        <strong>dashboard</strong> {dot(opencode.isAvailable)}{' '}
        {opencode.isAvailable ? 'Online' : 'Offline'}
      </div>
      {!mesh.isAvailable && !opencode.isAvailable && (
        <div className="onboard">
          {isGitHubPages ? (
            <p>
              No backend detected. This page is a live demo — run the stack
              locally for full features: clone the repos,{' '}
              <code>./scripts/web.sh</code>, then rejoin the mesh. See{' '}
              <code>docs/ANYWHERE.md</code>.
            </p>
          ) : lna === 'denied' ? (
            <p>
              Chrome is blocking this public page from reaching your local
              backends (Local Network Access: denied). Grant it: address-bar
              icon → Site settings → Local network access → Allow, then
              reload. (Localhost-served copies of this portal need no grant.)
            </p>
          ) : (
            <p>
              Backend unreachable or untrusted. If services run here, trust
              the local CA (<code>./docker/certs-trust.sh</code>) and reload.
              HTTPS fetch failures are opaque by design — this card means
              "down, untrusted, or permission-denied", never a diagnosis.
            </p>
          )}
        </div>
      )}
    </header>
  );
}
