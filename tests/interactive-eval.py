#!/usr/bin/env python3
"""interactive-eval.py — visible-Chrome UX evaluation for mesh-portal.

Runs REAL google-chrome-stable HEADED (watch on :0) with slow motion so
the operator follows along. Each step records: timings, console errors,
pageerrors, blocker class, screenshot. Bottlenecks surface sorted slowest
first; blockers print with the exact fix.

  python3 tests/interactive-eval.py [--shots DIR] [--slow MS]

Blocker classes: CERT-AUTHORITY, CERT-DOMAIN, CORS, LNA-DENIED, DOWN,
SLOW, CONSOLE, OK. Exit 0 all-OK-or-known-offline, 1 blocker found.
"""
import json
import os
import sys
import time

SLOW_PAGE_MS = 15000
SLOW_SETTLE_MS = 20000

STEPS = [
    {"name": "pages-offline",
     "url": "https://swipswaps.github.io/mesh-portal/",
     "expect": "offline-banner",
     "shot": "eval-01-pages-offline.png"},
    {"name": "dashboard-direct",
     "url": "https://127.0.0.1:5099/",
     "expect": "dashboard-rows",
     "shot": "eval-02-dashboard-direct.png"},
    {"name": "portal-local-preview",
     "url": "http://127.0.0.1:4173/",
     "expect": "portal-backend",
     "shot": "eval-03-portal-local.png"},
]

# Both-devices API matrix: every backend on every node, from the one
# browser. DOWN here is data, not noise — e.g. .45:5409 DOWN surfaces
# the outstanding lighthouse adoption item.
DEVICES = [
    ("ws24-mesh-api", "https://10.100.0.24:5409/api/rev"),
    ("ws24-loopback-api", "http://127.0.0.1:5409/api/rev"),
    ("ws24-dashboard-mesh", "https://10.100.0.24:5099/api/rev"),
    ("ws24-dashboard-loop", "https://127.0.0.1:5099/api/rev"),
    ("lh-mesh-api", "http://10.100.0.1:5409/api/rev"),
    ("lh-dashboard-mesh", "https://10.100.0.1:5099/api/rev"),
]


def classify(err_text, lna_state):
    t = (err_text or "").lower()
    if "cert_authority_invalid" in t or "authority_invalid" in t:
        return ("CERT-AUTHORITY",
                "trust the CA: ./docker/certs-trust.sh, relaunch browser")
    if "cert_common_name_invalid" in t or "bad_cert_domain" in t:
        return ("CERT-DOMAIN",
                "SANs wrong: ./docker/certs-init.sh --rotate, restart caddy")
    if lna_state == "denied":
        return ("LNA-DENIED",
                "address-bar icon -> Site settings -> Local network access"
                " -> Allow, reload")
    if "cors" in t:
        return ("CORS", "backend must send ACAO + private-network headers")
    if "failed to fetch" in t or "net::" in t or "timeout" in t:
        return ("DOWN", "backend not listening here; start it or fix URL")
    return ("UNKNOWN", err_text[:160])


def main():
    shots = "docs/screenshots"
    slow = 400
    args = sys.argv[1:]
    while args:
        if args[0] == "--shots":
            shots = args[1]
            args = args[2:]
        elif args[0] == "--slow":
            slow = int(args[1])
            args = args[2:]
        else:
            print("usage: interactive-eval.py [--shots DIR] [--slow MS]")
            return 2
    os.makedirs(shots, exist_ok=True)

    from playwright.sync_api import sync_playwright

    report = {"steps": [], "blockers": [], "started": time.time()}
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=False,
                              slow_mo=slow,
                              args=["--window-size=1360,850"])
        ctx = b.new_context(viewport={"width": 1360, "height": 850},
                            ignore_https_errors=False)
        pg = ctx.new_page()
        for st in STEPS:
            rec = {"step": st["name"], "url": st["url"]}
            errs = []
            pg.on("console", lambda m: errs.append(
                m.type + ": " + m.text[:150]) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(
                "pageerror: " + str(e)[:150]))
            t0 = time.time()
            try:
                pg.goto(st["url"], wait_until="domcontentloaded",
                        timeout=30000)
                rec["load_ms"] = int((time.time() - t0) * 1000)
            except Exception as e:
                rec["load_ms"] = int((time.time() - t0) * 1000)
                rec["blocker"], rec["fix"] = classify(str(e), "")
                rec["console"] = errs
                report["steps"].append(rec)
                report["blockers"].append(rec)
                continue
            pg.wait_for_timeout(9000)
            rec["settle_ms"] = int((time.time() - t0) * 1000)
            rec["title"] = pg.title()[:60]
            rec["text"] = pg.evaluate(
                "document.body.innerText.slice(0,220)").replace("\n", " | ")
            try:
                lna = pg.evaluate(
                    "(async () => { try { return (await navigator.permissions"
                    ".query({name:'local-network-access'})).state; }"
                    "catch(e){ return 'unsupported'; } })()")
            except Exception:
                lna = "unknown"
            rec["lna"] = lna
            shot = os.path.join(shots, st["shot"])
            pg.screenshot(path=shot)
            rec["shot"] = shot
            rec["console"] = errs
            if rec["settle_ms"] > SLOW_SETTLE_MS:
                rec["blocker"] = "SLOW"
                rec["fix"] = "settle >%ds; profile heaviest fetch" % (
                    SLOW_SETTLE_MS // 1000)
                report["blockers"].append(rec)
            elif errs and "pageerror" in " ".join(errs):
                rec["blocker"] = "CONSOLE"
                rec["fix"] = "fix throwing code path (see console)"
                report["blockers"].append(rec)
            else:
                rec["blocker"] = "OK"
            # Per-step backend probe with classification.
            probe = pg.evaluate(
                """(async () => {
                  const urls = {
                    mesh: 'MESHURL', dash: 'DASHURL'};
                  const out = {};
                  for (const [k, u] of Object.entries(urls)) {
                    try {
                      const r = await fetch(u, {signal: AbortSignal.timeout(12000)});
                      out[k] = 'OK ' + r.status;
                    } catch (e) { out[k] = 'ERR ' + String(e).slice(0, 80); }
                  }
                  return out;
                })()""".replace("MESHURL", "https://127.0.0.1:5409/api/rev")
                    .replace("DASHURL", "https://127.0.0.1:5099/api/rev"))
            rec["probes"] = probe
            for k, v in probe.items():
                if v.startswith("ERR"):
                    b_, f_ = classify(v, lna)
                    report["blockers"].append(
                        {"step": st["name"] + ":" + k, "blocker": b_,
                         "fix": f_, "detail": v})
            report["steps"].append(rec)

        # Both-devices matrix on a FRESH page (local preview origin:
        # loopback + mesh IPs without LNA friction). Fresh page isolates
        # connection state accumulated across the stepped navigations,
        # which flaked loopback fetches under load.
        pg2 = ctx.new_page()
        pg2.goto("http://127.0.0.1:4173/", wait_until="domcontentloaded",
                 timeout=20000)
        pg = pg2
        pg.wait_for_timeout(2000)
        matrix = pg.evaluate(
            """(async () => {
              const devs = DEVICES_PLACEHOLDER;
              const out = {};
          for (const [name, u] of devs) {
            // Stagger: the portal app probes on its own 10s cycle; spacing
            // matrix fetches avoids burst collision on the single box.
            // One retry: separates transient (tether/CPU) from real, and
            // the report records which needed it.
            await new Promise((r) => setTimeout(r, 1500));
            let last = '';
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const r = await fetch(u, {signal: AbortSignal.timeout(12000)});
                out[name] = 'OK ' + r.status + ' ' +
                  (await r.text()).slice(0, 90) +
                  (attempt ? ' (retry)' : '');
                last = '';
                break;
              } catch (e) {
                last = 'ERR ' + String(e).slice(0, 90);
                await new Promise((r) => setTimeout(r, 2000));
              }
            }
            if (last) out[name] = last;
          }
          return out;
            })()""".replace("DEVICES_PLACEHOLDER", json.dumps(DEVICES)))
        report["matrix"] = matrix
        for name, res in matrix.items():
            print("MATRIX %s -> %s" % (name, res))
            if res.startswith("ERR"):
                b_, f_ = classify(res, "")
                # .45 endpoints DOWN is the known outstanding item, not new.
                known = "lighthouse adoption (mesh-api not deployed there yet)"
                report["blockers"].append(
                    {"step": "matrix:" + name, "blocker": b_,
                     "fix": f_ if not name.startswith("lh-") else known,
                     "detail": res})

        print(json.dumps(report, indent=1)[:4000])
        slow_rank = sorted(report["steps"],
                           key=lambda r: r.get("settle_ms", 0), reverse=True)
        print("--- slowest first ---")
        for r in slow_rank:
            print("%s load=%sms settle=%sms blocker=%s" % (
                r["step"], r.get("load_ms"), r.get("settle_ms"),
                r.get("blocker")))
        print("--- blockers: %d ---" % len(report["blockers"]))
    b.close()
    return 0 if not report["blockers"] else 1


sys.exit(main())
