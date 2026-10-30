// node cap.mjs flows.json → after screenshots at 1366×900, saved at half scale as JPG.
// steps: {go}, {click: text|/re/, in?}, {type: selector, text}, {key}, {js}, {wait}, {shot: name}
import { readFileSync } from "node:fs";
import sharp from "/Users/mohitkhetrapal/Documents/PUCAR/Case Access management/dristi-ds-bump/node_modules/sharp/lib/index.js";
import { connect } from "./lib.mjs";

const OUT = process.env.OUT ?? "/Users/mohitkhetrapal/Documents/PUCAR/Case Access management/dristi-ds-bump/apps/dristi-app/public/coverage-board/after/";
const BASE = process.env.BASE ?? "http://localhost:4701";
const flows = JSON.parse(readFileSync(new URL(process.argv[2], import.meta.url), "utf8"));
const c = await connect(9371);
await c.viewport(1366, 900, false);

for (const [name, steps] of Object.entries(flows)) {
  try {
    for (const s of steps) {
      if (s.go) await c.go(BASE + s.go, s.settle ?? 3500);
      if (s.click) {
        const r = await c.ev(`
          const want=${JSON.stringify(s.click)}; const re=want.startsWith('/')?new RegExp(want.slice(1,-1)):null;
          const scope=document.querySelector(${JSON.stringify(s.in || "body")})||document.body;
          const els=[...scope.querySelectorAll('button,a,[role=button],[role=tab],[role=menuitem],[role=radio],[role=option],label')].filter(e=>e.getBoundingClientRect().width>0);
          const el=els.find(e=>{const t=(e.getAttribute('aria-label')||e.textContent||'').trim().replace(/\\s+/g,' '); return re?re.test(t):t===want});
          if(!el) return 'NOT FOUND: '+els.slice(0,40).map(e=>(e.getAttribute('aria-label')||e.textContent).trim().slice(0,30)).join(' | ');
          el.click(); await new Promise(r=>setTimeout(r,${s.wait ?? 1200})); return 'ok'`);
        if (r !== "ok") throw new Error(`click ${s.click}: ${r}`);
      }
      if (s.type) {
        await c.ev(`const el=document.querySelector(${JSON.stringify(s.type)}); el.focus(); return 1`);
        await c.send("Input.insertText", { text: s.text });
        await new Promise((r) => setTimeout(r, 400));
      }
      if (s.files) {
        const doc = (await c.send("DOM.getDocument", { depth: -1 })).result.root.nodeId;
        const ids = (await c.send("DOM.querySelectorAll", { nodeId: doc, selector: "input[type=file]" })).result.nodeIds;
        for (const nodeId of ids) await c.send("DOM.setFileInputFiles", { nodeId, files: [s.files] });
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (s.js) {
        const r = await c.ev(s.js);
        if (s.log) console.log("  js", JSON.stringify(r));
      }
      if (s.wait && !s.click) await new Promise((r) => setTimeout(r, s.wait));
      if (s.shot) {
        await c.ev(`document.querySelectorAll('nextjs-portal').forEach(n=>n.remove()); document.getAnimations().forEach(a=>{try{a.finish()}catch(e){}}); await new Promise(r=>setTimeout(r,300)); return 1`);
        const png = Buffer.from((await c.send("Page.captureScreenshot", { format: "png" })).result.data, "base64");
        await sharp(png).resize(683).jpeg({ quality: 82 }).toFile(OUT + s.shot + ".jpg");
        console.log("shot", s.shot);
      }
    }
  } catch (e) {
    console.log("FAIL", name, String(e.message).slice(0, 600));
  }
}
c.close();
