"""Screenshot pages in headless Chrome and check them for horizontal overflow.

Usage: python3 -I tools/shoot.py OUTDIR [PATH ...] [--base URL] [--nojs] [--viewport]

Needs tools/serve.sh running. Each PATH (default: index.html) is shot at
desktop (1280x900) and phone (390x844) width, in light and dark color schemes
(emulated prefers-color-scheme), as a full-page PNG in OUTDIR. --viewport shoots
only the first screen instead of the full page; --nojs turns JavaScript off.
Prints one line per shot and flags any page wider than its viewport.
"""
import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.request

import websocket

DEFAULT_PATHS = ["index.html"]
SIZES = {"desktop": (1280, 900, False), "phone": (390, 844, True)}
SETTLE_JS = """new Promise(r => document.fonts.ready.then(() =>
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 400)))))"""
OVERFLOW_JS = """(() => {
  const w = document.documentElement.clientWidth;
  const wide = [...document.querySelectorAll('body *')]
    .filter(e => e.getBoundingClientRect().right > w + 1)
    .filter(e => !e.closest('[data-overflow-ok]'))
    .slice(0, 5)
    .map(e => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''));
  return {extra: document.documentElement.scrollWidth - w, wide};
})()"""


class Chrome:
    def __init__(self):
        self.profile = tempfile.mkdtemp(prefix="shoot-")
        self.proc = subprocess.Popen(
            ["google-chrome", "--headless=new", "--remote-debugging-port=0",
             f"--user-data-dir={self.profile}", "--no-first-run",
             "--hide-scrollbars", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        port_file = os.path.join(self.profile, "DevToolsActivePort")
        for _ in range(100):
            if os.path.exists(port_file) and open(port_file).read().strip():
                break
            time.sleep(0.1)
        port = open(port_file).read().split()[0]
        targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list"))
        page = next(t for t in targets if t["type"] == "page")
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], suppress_origin=True)
        self.next_id = 0

    def send(self, method, wait_event=None, **params):
        self.next_id += 1
        my_id = self.next_id
        self.ws.send(json.dumps({"id": my_id, "method": method, "params": params}))
        result, seen_event = None, wait_event is None
        while result is None or not seen_event:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == my_id:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                result = msg["result"]
            elif msg.get("method") == wait_event:
                seen_event = True
        return result

    def evaluate(self, expr):
        r = self.send("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True)
        return r["result"].get("value")

    def close(self):
        self.ws.close()
        self.proc.terminate()
        self.proc.wait()
        shutil.rmtree(self.profile, ignore_errors=True)


def slug(path, size, scheme):
    name = re.sub(r"[^A-Za-z0-9]+", "-", path.replace(".html", ""))
    return f"{name.strip('-')}_{size}_{scheme}.png"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("outdir")
    ap.add_argument("paths", nargs="*", default=DEFAULT_PATHS)
    ap.add_argument("--base", default="http://localhost:8000/")
    ap.add_argument("--nojs", action="store_true")
    ap.add_argument("--viewport", action="store_true")
    ap.add_argument("--sizes", default="desktop,phone")
    ap.add_argument("--schemes", default="light,dark")
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)

    chrome = Chrome()
    try:
        chrome.send("Page.enable")
        if args.nojs:
            chrome.send("Emulation.setScriptExecutionDisabled", value=True)
        for path in args.paths:
            for size in args.sizes.split(","):
                w, h, mobile = SIZES[size]
                chrome.send("Emulation.setDeviceMetricsOverride",
                            width=w, height=h, deviceScaleFactor=1, mobile=mobile)
                for scheme in args.schemes.split(","):
                    chrome.send("Emulation.setEmulatedMedia",
                                features=[{"name": "prefers-color-scheme", "value": scheme}])
                    chrome.send("Page.navigate", wait_event="Page.loadEventFired",
                                url=args.base + path)
                    if not args.nojs:
                        chrome.evaluate(SETTLE_JS)
                    else:
                        time.sleep(0.6)
                    check = chrome.evaluate(OVERFLOW_JS) if not args.nojs else None
                    if args.viewport:
                        shot = chrome.send("Page.captureScreenshot", format="png")
                    else:
                        m = chrome.send("Page.getLayoutMetrics")["cssContentSize"]
                        shot = chrome.send("Page.captureScreenshot", format="png",
                                           captureBeyondViewport=True,
                                           clip={"x": 0, "y": 0, "width": w,
                                                 "height": m["height"], "scale": 1})
                    out = os.path.join(args.outdir, slug(path, size, scheme))
                    with open(out, "wb") as f:
                        f.write(base64.b64decode(shot["data"]))
                    flag = ""
                    if check and check["extra"] > 0:
                        flag = f"  OVERFLOW +{check['extra']}px {check['wide']}"
                    print(f"{out}{flag}")
    finally:
        chrome.close()


if __name__ == "__main__":
    main()
