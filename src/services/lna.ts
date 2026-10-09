/**
 * Local Network Access (Chrome 153+: public pages need an explicit grant
 * to fetch loopback/LAN/mesh addresses — beyond CORS and Private-Network
 * headers, which we already serve). The failure is opaque (TypeError), but
 * the permission state is queryable, so the UI can name the fix instead of
 * shrugging "unreachable".
 *
 * States: 'granted' | 'denied' | 'prompt' | 'unsupported' (browser without
 * the API — e.g. Firefox — where classic CORS rules still apply).
 */

export type LnaState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown';

export async function queryLna(): Promise<LnaState> {
  try {
    const nav = navigator as Navigator & {
      permissions?: { query(o: { name: string }): Promise<{ state: string }> };
    };
    if (!nav.permissions || typeof nav.permissions.query !== 'function') {
      return 'unsupported';
    }
    const r = await nav.permissions.query({ name: 'local-network-access' });
    if (r.state === 'granted' || r.state === 'denied' || r.state === 'prompt') {
      return r.state;
    }
    return 'unknown';
  } catch {
    return 'unsupported';
  }
}
