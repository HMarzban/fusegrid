#!/usr/bin/env node
/* Chrome-side readability gates (UI upgrade appendix section 11) on a shots.mjs output dir. Dev only, zero deps (PNG decoding is node:zlib through
   tools/pixel/rgba.mjs), never imported by src/ and not in the precache.

   node tools/ui/gates.mjs <dir> [flags]
     --strict   a skipped gate fails too (the release run); n/a never fails
   Reads every capture dump <screen>.<look>.w<n>[.t125][.phone].json in <dir> (written by tools/ui/shots.mjs: flags, read-back, canvas rects and
   window.__GAME__.ui.snap(), the page's probe record), its PNG and, when shots took one, its .notext.png twin, computes the gates of
   tools/ui/lib/gatelib.mjs (how each is measured is in that file's header) and writes <dir>/gates.json: a summary, then per capture and per gate
   its status (pass | fail | skipped | n/a), value, threshold, the pair or text it was measured on, and every item.
   A gate that needs probe data the page does not record yet is "skipped: no probe data", never a pass.
   Exit 1 on any fail, on a dump whose PNG is missing, on a dir with no capture, and under --strict on any skip; else 0. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unpng } from "../pixel/rgba.mjs";
import { evaluate, tally } from "./lib/gatelib.mjs";
import { parseCapName } from "./lib/screens.mjs";

export function parseArgs(argv) {
  const a = { dir: null, strict: false };
  for (const k of argv) {
    if (k === "--strict") a.strict = true;
    else if (k.startsWith("--")) throw new Error("unknown flag " + k + " (see the header of tools/ui/gates.mjs)");
    else if (a.dir) throw new Error("one capture dir, got " + a.dir + " and " + k);
    else a.dir = resolve(k);
  }
  if (!a.dir) throw new Error("usage: node tools/ui/gates.mjs <dir> [--strict]");
  return a;
}

export function gateDir(a) {
  const files = readdirSync(a.dir).filter((f) => f.endsWith(".json") && parseCapName(f.replace(/\.json$/, ".png")));
  const screens = {}, caps = [], errors = [];
  for (const f of files.sort()) {
    const base = f.replace(/\.json$/, ""), d = JSON.parse(readFileSync(join(a.dir, f), "utf8")), png = join(a.dir, d.file || base + ".png");
    if (!existsSync(png)) { errors.push(base + ": no PNG " + png); screens[base] = { screen: d.screen, error: "no PNG" }; continue; }
    const nt = d.notext ? join(a.dir, d.notext) : null;
    const gates = evaluate(d, unpng(readFileSync(png)), nt && existsSync(nt) ? unpng(readFileSync(nt)) : null);
    screens[base] = { screen: d.screen, flags: d.flags, page: d.ui ? d.ui.page : null, gates };
    caps.push({ gates });
  }
  const t = tally(caps), exit = errors.length ? 1 : t.exit(a.strict);
  const out = { dir: a.dir, strict: a.strict, summary: { captures: t.captures, pass: t.pass, fail: t.fail, skipped: t.skipped, na: t.na, errors, exit }, screens };
  writeFileSync(join(a.dir, "gates.json"), JSON.stringify(out, null, 1));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = gateDir(parseArgs(process.argv.slice(2)));
    for (const [n, s] of Object.entries(r.screens)) {
      if (s.error) { console.log(n + "  ERROR " + s.error); continue; }
      const by = (st) => Object.entries(s.gates).filter(([, g]) => g.status === st).map(([k, g]) => k + (g.value != null ? " " + g.value : ""));
      console.log(n + "  fail [" + by("fail").join(", ") + "]  skipped " + by("skipped").length + "  pass " + by("pass").length + "  n/a " + by("n/a").length);
    }
    const S = r.summary;
    console.log("gates: " + S.captures + " captures, " + S.pass + " pass, " + S.fail + " fail, " + S.skipped + " skipped, " + S.na + " n/a" + (r.strict ? " (strict)" : "") + " -> " + join(r.dir, "gates.json"));
    if (!S.captures) console.error("gates: no capture dump in " + r.dir);
    process.exitCode = S.exit;
  } catch (e) {
    console.error("gates: " + ((e && e.message) || e));
    process.exitCode = 1;
  }
}
