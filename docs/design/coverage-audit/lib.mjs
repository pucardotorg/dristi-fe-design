// Minimal CDP client for a headless Chrome on a given port.
export async function connect(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) =>
    new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (code) => {
    const r = await send("Runtime.evaluate", { expression: `(async()=>{${code}})()`, awaitPromise: true, returnByValue: true });
    return r.result?.result?.value ?? (r.result?.exceptionDetails ? { error: r.result.exceptionDetails.exception?.description } : undefined);
  };
  const viewport = (w, h, mobile) =>
    send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile })
      .then(() => send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 0 }));
  const go = async (url, settle = 3000) => {
    await send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, settle));
  };
  const freeze = () => ev(`
    document.querySelectorAll('nextjs-portal').forEach(n=>n.remove()); document.querySelectorAll('[data-slot=segmented-control]').forEach(n=>n.style.setProperty('visibility','hidden','important'));
    const s=document.getElementById('__sweep')||Object.assign(document.createElement('style'),{id:'__sweep'});
    s.textContent='*,*::before,*::after{caret-color:transparent!important;animation-play-state:paused!important}';
    document.head.appendChild(s);
    document.getAnimations().forEach(a=>{try{a.finish()}catch(e){}});
    await new Promise(r=>setTimeout(r,250)); return 1`);
  const shot = async (maxH = 3600) => {
    const h = await ev(`return Math.min(${maxH}, Math.max(document.documentElement.scrollHeight, innerHeight))`);
    const w = await ev(`return innerWidth`);
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
    return Buffer.from(r.result.data, "base64");
  };
  return { send, ev, viewport, go, freeze, shot, close: () => ws.close() };
}

export const VIEWPORTS = [
  { key: "phone", w: 390, h: 844, mobile: true },
  { key: "ipad-p", w: 820, h: 1180, mobile: true },
  { key: "ipad-l", w: 1180, h: 820, mobile: true },
  { key: "desk", w: 1366, h: 900, mobile: false },
];

export async function setDark(c, on) {
  await c.ev(`document.documentElement.classList.toggle('dark', ${on}); document.documentElement.style.colorScheme='${on ? "dark" : "light"}'; await new Promise(r=>setTimeout(r,300)); return 1`);
}
