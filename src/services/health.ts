/**
 * Backend health, one instance per origin (mesh API, opencode dashboard).
 * Adapted from receipts-ocr dockerHealthService, hardened per evaluation:
 * - absent backends probe QUIETLY (browsers log failed fetches regardless;
 *   a 60s backoff after consecutive failures keeps the console clean).
 * - pause during heavy local work (drills/renders) to avoid false reds.
 * - HTTPS self-signed backends fail opaquely (TypeError, no reason);
 *   status distinguishes only up/down, and the UI pairs "down" with the
 *   trust card (certs-trust.sh) rather than claiming a diagnosis.
 */

export interface HealthStatus {
  isAvailable: boolean;
  lastChecked: Date;
  consecutiveFailures: number;
  detail?: string;
}

const FAST_MS = 10000;
const QUIET_MS = 60000;
const TIMEOUT_MS = 4000;

export class HealthProbe {
  private status: HealthStatus = {
    isAvailable: false,
    lastChecked: new Date(),
    consecutiveFailures: 0,
  };
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private failures = 0;
  private lastAttempt = 0;

  constructor(private readonly revUrl: string) {}

  start(onChange?: (s: HealthStatus) => void): void {
    void this.check().then(onChange);
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.paused) return;
      void this.check().then(onChange);
    }, FAST_MS);
    // Quiet backoff is applied inside check() by skipping.
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }

  getStatus(): HealthStatus {
    return { ...this.status };
  }

  async forceCheck(): Promise<HealthStatus> {
    this.failures = 0;
    return this.check();
  }

  private async check(): Promise<HealthStatus> {
    // Quiet backoff: after 3 consecutive failures the 10s ticker keeps
    // firing, but probes go out at most once a minute (browsers log every
    // failed fetch; frequency is the only console-spam lever we own).
    if (this.failures >= 3 && Date.now() - this.lastAttempt < QUIET_MS) {
      return this.getStatus();
    }
    this.lastAttempt = Date.now();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const r = await fetch(this.revUrl, { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) {
        this.failures = 0;
        this.status = { isAvailable: true, lastChecked: new Date(), consecutiveFailures: 0 };
        return this.getStatus();
      }
      throw new Error('http ' + r.status);
    } catch (e) {
      this.failures += 1;
      this.status = {
        isAvailable: false,
        lastChecked: new Date(),
        consecutiveFailures: this.failures,
        detail: e instanceof Error ? e.message.slice(0, 120) : 'unreachable',
      };
      return this.getStatus();
    }
  }
}
