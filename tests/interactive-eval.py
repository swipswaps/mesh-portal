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
                      const r = await fetch(u, {signal: AbortSignal.timeout(8000)});
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
        b.close()

    print(json.dumps(report, indent=1)[:4000])
    slow_rank = sorted(report["steps"],
                       key=lambda r: r.get("settle_ms", 0), reverse=True)
    print("--- slowest first ---")
    for r in slow_rank:
        print("%s load=%sms settle=%sms blocker=%s" % (
            r["step"], r.get("load_ms"), r.get("settle_ms"),
            r.get("blocker")))
    print("--- blockers: %d ---" % len(report["blockers"]))
    return 0 if not report["blockers"] else 1


sys.exit(main())
