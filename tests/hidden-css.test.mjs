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

/* v202 Task 3.6: the DOM cards wear the world kit as custom properties. They are static JUNGLE (world 1) values, since the DOM cannot import
   render/kit at boot, so this pins each one equal to worldTokens(1) and the cards to the variables, never a raw hex. */
const { worldTokens } = await import("../src/render/kit/tokens.js");
const T = worldTokens(1), root = /:root\{([^}]*--k-[^}]*)\}/.exec(css);
const K = {};
if (root) for (const m of root[1].matchAll(/--k-([\w]+):([^;}]+)/g)) K[m[1]] = m[2].trim();
const WANT = { pane: T.pane, well: T.well, key: T.key, hover: T.lip, band: T.band, lit: T.lit, frame: T.frame, ink: T.ink, off: T.off, dk: T.dk, cor: T.cor };
for (const [k, v] of Object.entries(WANT)) check("--k-" + k + " equals worldTokens(1)." + k, K[k] === v, K[k] + " vs " + v);
const rules = (re) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => re.test(m[1].trim())).map((m) => m[2]);
const cards = css.slice(css.indexOf("#upd{"), css.indexOf(".muted{"));
check("the cards carry no raw palette hex (the old #37f0d0 / #2a3550 / #7385ad family)", !/#(37f0d0|2a3550|7385ad|dfe7f5|26324a|141a2b)\b|rgba\(10,14,24|rgba\(55,240,208/i.test(cards));
const eq = rules(/^#ana \.yes,#ana \.no$/);
check("ALLOW and NO THANKS share ONE rule (same size, weight, border, fill)", eq.length === 1 && /height:\d+px/.test(eq[0]) && /border:1px solid var\(--k-frame\)/.test(eq[0]) && /background:var\(--k-band\)/.test(eq[0]));
check("on touch they are one rule too, 44px", /body\[data-lay=p\] #ana \.yes,body\[data-lay=l\] #ana \.yes,body\[data-lay=p\] #ana \.no,body\[data-lay=l\] #ana \.no\{height:44px\}/.test(css));
const upd = readFileSync(new URL("../src/app/update.js", import.meta.url), "utf8"), ana = readFileSync(new URL("../src/app/analytics.js", import.meta.url), "utf8");
check("label first, keycap last on RELOAD, LATER, ALLOW, NO THANKS", /RELOAD <kbd>U<\/kbd>/.test(upd) && /LATER <kbd>EAST<\/kbd>/.test(upd) && /ALLOW <kbd>Y<\/kbd>/.test(ana) && /NO THANKS <kbd>N<\/kbd>/.test(ana) && !/<kbd>[^<]*<\/kbd>(RELOAD|LATER|ALLOW|NO THANKS)/.test(upd + ana));
const markup = html.slice(html.indexOf('<div id="load"'), html.indexOf('id="loadjs"'));
check("the load card: label first, keycap last (RETRY ENTER, USE CLASSIC 2D ESC), the keycaps a keyboard layout's only", /<span id="loadretryw">RETRY<\/span><kbd id="loadretryk">ENTER<\/kbd>/.test(markup) && /<span id="loadkeepw">USE CLASSIC 2D<\/span><kbd id="loadkeepk">ESC<\/kbd>/.test(markup) &&
  /body\[data-lay=p\] #loadretryk,body\[data-lay=l\] #loadretryk,body\[data-lay=p\] #loadkeepk,body\[data-lay=l\] #loadkeepk\{display:none\}/.test(css));
/* spec §3 type rule: no monospace for words, letter-spacing 0 on sentences; mono only inside a kbd */
const mono = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /monospace/.test(m[2]) && /#(upd|ana|load)/.test(m[1]) && !/kbd|#loadretryk|#loadkeepk/.test(m[1])).map((m) => m[1].trim());
check("the DOM cards set no word in monospace (only a kbd keycap is mono)", mono.length === 0, mono.join(" | "));
const spaced = ["#upd i", "#upd .later", "#ana i", "#loadmsg", "#load b"].filter((s) => !rules(new RegExp("^" + s.replace(/[.#]/g, "\\$&") + "$")).some((r) => /letter-spacing:0(;|$)/.test(r)));
check("the cards' sentences, LATER and the load card's wordmark sit at letter-spacing 0", spaced.length === 0, spaced.join(","));
const { LABEL } = await import("../src/render/words.js");
const { lum } = await import("../src/render/kit/tokens.js");
check("hover fill is visibly lighter than the resting band", lum(K.hover) > 2 * lum(K.band) && !/--k-keyhi/.test(css), lum(K.hover) + " vs " + lum(K.band));
const loadjs = html.slice(html.indexOf('id="loadjs"'), html.indexOf("</script>", html.indexOf('id="loadjs"')));
check("the load failure copy names ART STYLE (the player word)", loadjs.includes(LABEL.ART_STYLE + " IN SETTINGS") && loadjs.includes(LABEL.ART_STYLE + " IS IN SETTINGS"));
check("#updbg blurs through CSS on a DOM element, not a canvas", /#updbg\{[^}]*backdrop-filter:blur/.test(css));

console.log("\n  HIDDEN CSS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
