import { connect } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const c = await connect(9371);
for (const [n, w, h, m, dark] of [["phone", 390, 844, true, false], ["ipad", 820, 1180, true, false], ["desk-dark", 1440, 900, false, true]]) {
  await c.viewport(w, h, m);
  await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }] });
  await c.go("http://localhost:4701/coverage-board", 4000);
  if (dark) await c.ev(`document.documentElement.classList.add('dark'); return 1`);
  const info = await c.ev(`const n=document.querySelector('nav[aria-label=Board]').getBoundingClientRect(); return {scrollW:document.documentElement.scrollWidth, innerW:innerWidth, navH:Math.round(n.height), broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length, afters:[...document.querySelectorAll('img')].filter(i=>i.src.includes('/after/')).length}`);
  console.log(n, JSON.stringify(info));
  await c.ev(`[...document.querySelectorAll('nav button')].find(b=>b.textContent.startsWith('Acts that end'))?.click(); await new Promise(r=>setTimeout(r,800)); return 1`);
  writeFileSync(`size-${n}.png`, Buffer.from((await c.send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
}
c.close();
