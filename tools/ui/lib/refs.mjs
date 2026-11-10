/* compare.mjs's halves (dev only, never imported by src/): which approved mock frame a capture is judged against, and the side-by-side sheet.
   tools/ui/refmap.json maps keys screen[.look][.wN][.t125][.phone] to a frame path relative to --ref (the round 7 mock root, whose lane folders hold
   png/d-*.png desktop and png/p-*.png phone frames). The most specific key wins: look and world, then world, then look, then the bare screen; phone
   and 125 % are never dropped, so a phone capture never meets a desktop frame and a 125 % capture never a 100 % one. */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ORDER, parseCapName } from "./screens.mjs";

export function refKeys(o) {
  const tail = (o.t125 ? ".t125" : "") + (o.phone ? ".phone" : ""), w = ".w" + o.world, l = "." + o.look;
  return [o.screen + l + w, o.screen + w, o.screen + l, o.screen].map((k) => k + tail);
}
export function findRef(map, o) {
  for (const k of refKeys(o)) if (typeof map[k] === "string") return map[k];
  return null;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/* the sheet for every capture in dir (text-hidden twins left out): the mock frame by absolute file URL beside the capture, both at one width */
export function compareHtml(dir, ref, map, exists) {
  const caps = readdirSync(dir).map((f) => [f, parseCapName(f)]).filter(([, o]) => o)
    .sort(([a, x], [b, y]) => ORDER.indexOf(x.screen) - ORDER.indexOf(y.screen) || (a < b ? -1 : a > b ? 1 : 0));
  let n = 0;
  const rows = caps.map(([f, o]) => {
    const r = findRef(map, o), abs = r && join(ref, r), ok = abs && exists(abs);
    if (ok) n++;
    const mock = !r ? `<div class="none">no reference</div>` : ok ? `<img src="${esc(pathToFileURL(abs).href)}" alt="">` : `<div class="none">missing on disk: ${esc(abs)}</div>`;
    return `<section class="${o.phone ? "ph" : ""}"><h2>${esc(f)}</h2><div class="pair"><figure>${mock}<figcaption>mock: ${esc(r || "none")}</figcaption></figure>` +
      `<figure><img src="${esc(f)}" alt=""><figcaption>game: ${esc(f)}</figcaption></figure></div></section>`;
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI compare</title>
<style>:root{color-scheme:dark}body{margin:0;padding:16px;background:#121016;color:#e8dccb;font:14px/1.4 system-ui,sans-serif}h1{font-size:18px;margin:0 0 4px}
p{margin:0 0 16px;color:#a99}section{margin:0 0 28px}section.ph{max-width:900px}h2{font-size:14px;margin:0 0 6px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
figure{margin:0}img{display:block;width:100%;height:auto;background:#000}figcaption{font-size:12px;color:#a99;margin-top:4px;word-break:break-all}
.none{display:flex;align-items:center;justify-content:center;aspect-ratio:16/9;background:#1d1a22;border:1px dashed #554;color:#a99}</style></head><body>
<h1>Mock (left) beside game (right)</h1><p>${caps.length} captures, ${n} with a reference. Mock frames load from file:// paths: open this file directly, not through serve.js.</p>
${rows.join("\n")}
</body></html>
`;
}
