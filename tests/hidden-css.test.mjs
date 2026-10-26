import { readFileSync } from "node:fs";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}

/* The UA stylesheet hides [hidden] with display:none, but any author rule that
   sets display on the same element wins, so `el.hidden = true` silently stops
   hiding it. That shipped once (v185: the consent card's ALLOW left the card
   up; the NEW VERSION card had the same flaw since v179). Every #id rule with a
   visible display needs its own #id[hidden]{display:none}, unless the element
   is never hidden. */
const NEVER_HIDDEN = ["wrap"];
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = html.slice(html.indexOf("<style"), html.indexOf("</style>")).replace(/\/\*[\s\S]*?\*\//g, "");
const shown = new Set(), hides = new Set();
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const d = /(?:^|[;\s])display:\s*([\w-]+)/.exec(m[2]);
  if (!d) continue;
  for (const sel of m[1].split(",").map((x) => x.trim())) {
    const id = /^#([\w-]+)$/.exec(sel), hid = /^#([\w-]+)\[hidden\]$/.exec(sel);
    if (hid && d[1] === "none") hides.add(hid[1]);
    else if (id && d[1] !== "none") shown.add(id[1]);
  }
}
check("the scan finds the cards' display rules", shown.has("upd") && shown.has("ana") && shown.has("tbomb"), [...shown].join(","));
for (const id of shown) {
  if (NEVER_HIDDEN.includes(id)) continue;
  check("#" + id + " sets display, so it carries #" + id + "[hidden]{display:none}", hides.has(id));
}

console.log("\n  HIDDEN CSS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
