/**
 * Backend origins, derived from where the page itself loads.
 * Mirrors the receipts-ocr pattern (verified portable across
 * Pages / localhost / LAN), extended for two backends + mesh IPs.
 *
 * - GitHub Pages: no backend assumed; probe loopback mesh/local
 *   origins directly (fail-fast, silent) and render onboarding.
 * - localhost: mesh API on 5409, opencode dashboard on 5099 (https).
 * - LAN or mesh host: same hostname, same ports (https).
 */

export const isGitHubPages =
  typeof window !== 'undefined' &&
  window.location.hostname.includes('github.io');

export const MESH_API_PORT = 5409;
export const OPENCODE_PORT = 5099;

function sameHost(port: number): string {
  return `https://${window.location.hostname}:${port}`;
}

export const MESH_API_BASE = (() => {
  if (typeof window === 'undefined') return 'https://127.0.0.1:5409';
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'https://127.0.0.1:5409';
  if (h.includes('github.io')) return 'https://127.0.0.1:5409';
  return sameHost(MESH_API_PORT);
})();

export const OPENCODE_BASE = (() => {
  if (typeof window === 'undefined') return 'https://127.0.0.1:5099';
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'https://127.0.0.1:5099';
  if (h.includes('github.io')) return 'https://127.0.0.1:5099';
  return sameHost(OPENCODE_PORT);
})();
