/**
 * Guided operations: each card deduces the exact terminal commands from
 * live state and offers them for copy (click) or paste-and-run. Direct
 * (one glance: what + where) and guided (numbered steps) in one card.
 * Nothing executes from the browser — the terminal stays the actuator.
 */

export interface GuideCard {
  id: string;
  title: string;
  when: string;
  steps: string[];
  commands: string[];
}

export function guideCards(state: {
  meshOnline: boolean;
  dashboardOnline: boolean;
  meshNodes: number;
  openFindings: number;
  sessions: number | null;
}): GuideCard[] {
  const cards: GuideCard[] = [];
  if (!state.meshOnline) {
    cards.push({
      id: 'mesh-api-down',
      title: 'Start the mesh API',
      when: 'mesh dot is red on the serving host',
      steps: [
        'Open a terminal on the host that should serve it.',
        'Enable helpers once (PATH + validator + sudoers).',
        'Start the API, then re-check this page.',
      ],
      commands: [
        'cd ~/Documents/d565411ff353dd7f/repo/proxmox-dual-plane-mesh',
        'sudo ./scripts/mesh.sh install-helpers',
        'sudo ./scripts/mesh.sh api-up 5409',
        './scripts/mesh.sh api-status 5409',
      ],
    });
  }
  if (state.meshOnline && state.meshNodes === 0) {
    cards.push({
      id: 'no-nodes',
      title: 'Onboard the first node',
      when: 'mesh API answers but the registry is empty',
      steps: [
        'On the lighthouse (holds ca.key), sign a bundle.',
        'Join from the new node with the printed Node ID.',
        'Verify, then shred the bundle on both ends.',
      ],
      commands: [
        'sudo ./scripts/mesh.sh onboard <name> 10.100.0.<n>/24 "agents,telemetry" [mid8]',
        'sudo ./scripts/mesh.sh join-from owner@<lighthouse-lan> <name>',
        'sudo ./scripts/mesh.sh verify 10.100.0.1',
        'sudo ./scripts/mesh.sh shred <name>',
      ],
    });
  }
  if (state.openFindings > 0) {
    cards.push({
      id: 'findings-open',
      title: `Clear ${state.openFindings} open finding(s)`,
      when: 'inventory sync reports drift',
      steps: [
        'List findings with kinds.',
        'Run the matching fix (reservation, forward, stale peer).',
        'Re-import eero state and re-run sync to close them.',
      ],
      commands: [
        './scripts/mesh-inventory.py findings',
        'python3 scripts/eero-forward.py ensure-lab <net> <mac> <ip> <name> --mid <mid8>',
        './scripts/mesh-inventory.py import-eero <net>',
        './scripts/mesh-inventory.py sync',
      ],
    });
  }
  if (!state.dashboardOnline) {
    cards.push({
      id: 'dashboard-down',
      title: 'Start the dashboard stack',
      when: 'dashboard dot is red where services should live',
      steps: [
        'From the opencode checkout: check env, mint certs, start web.',
        'Trust the CA once per client machine.',
        'Verify rev freshness (stale=false).',
      ],
      commands: [
        'cd /home/owner/Documents/9e3e0363-0237-4c38-93dc-ce25e2f1ec37/repo',
        './scripts/ensure-env.sh && ./docker/certs-init.sh && ./scripts/web.sh',
        './docker/certs-trust.sh',
        'curl -k https://127.0.0.1:5099/api/rev',
      ],
    });
  }
  return cards;
}
