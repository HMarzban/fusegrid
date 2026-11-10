#!/usr/bin/env node
/* Chrome-side readability gates (UI upgrade appendix section 11) on a shots.mjs output dir. Dev only, zero deps (PNG decoding is node:zlib through
   tools/pixel/rgba.mjs), never imported by src/ and not in the precache.

   node tools/ui/gates.mjs <dir> [flags]
     --strict   a skipped gate fails too (the release run), and so does a dir without the shots.json manifest; n/a never fails
   Reads every capture dump <screen>.<look>.w<n>[.t125][.phone].json in <dir> (written by tools/ui/shots.mjs: flags, read-back, canvas content boxes
   and window.__GAME__.ui.snap(), the page's probe record), its PNG and, when shots took one, its .notext.png twin, computes the gates of
   tools/ui/lib/gatelib.mjs (how each is measured, and when each is pass / fail / skipped / n/a, is in that file's header) with the screen's
   required gates (`need`, tools/ui/lib/screens.mjs), and writes <dir>/gates.json: a summary, then per capture and per gate its status, value,
   threshold, the pair or text it was measured on, and every item.
   A gate that needs probe data the page does not record yet is "skipped: no probe data"; a required gate an instrumented page does not declare is
   "skipped: required, not declared"; neither is ever a pass.
   shots.json, the manifest shots.mjs writes before it captures, lists every capture it meant to take: one listed but missing (a screen it did not
   reach, a run that crashed) is an error.
   Exit 1 on any fail, on an error (a listed capture missing, a dump whose PNG is missing), on a dir with no capture, and under --strict on any skip or
   a missing manifest; else 0. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unpng } from "../pixel/rgba.mjs";
import { evaluate, tally, REQUIRED } from "./lib/gatelib.mjs";
import { SCREENS, parseCapName } from "./lib/screens.mjs";

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
  const screens = {}, caps = [], errors = [], warnings = [], mf = join(a.dir, "shots.json");
  const manifest = existsSync(mf) ? JSON.parse(readFileSync(mf, "utf8")) : null;
  if (!manifest) warnings.push("no shots.json manifest in " + a.dir + ": a capture shots.mjs failed to take cannot be detected" + (a.strict ? " (a fail under --strict)" : ""));
  for (const n of (manifest && manifest.intended) || []) if (!files.includes(n + ".json")) { errors.push(n + ": listed in shots.json, no capture"); screens[n] = { error: "listed in shots.json, no capture" }; }
  for (const f of files.sort()) {
    const base = f.replace(/\.json$/, ""), d = JSON.parse(readFileSync(join(a.dir, f), "utf8")), png = join(a.dir, d.file || base + ".png");
    if (!existsSync(png)) { errors.push(base + ": no PNG " + png); screens[base] = { screen: d.screen, error: "no PNG" }; continue; }
    const nt = d.notext ? join(a.dir, d.notext) : null, need = SCREENS[d.screen] ? SCREENS[d.screen].need : REQUIRED;
    const gates = evaluate(d, unpng(readFileSync(png)), nt && existsSync(nt) ? unpng(readFileSync(nt)) : null, need);
    screens[base] = { screen: d.screen, flags: d.flags, page: d.ui ? d.ui.page : null, need, gates };
    caps.push({ gates });
  }
  const t = tally(caps), exit = errors.length || (a.strict && !manifest) ? 1 : t.exit(a.strict);
  const out = { dir: a.dir, strict: a.strict, summary: { captures: t.captures, pass: t.pass, fail: t.fail, skipped: t.skipped, na: t.na, errors, warnings, exit }, screens };
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
    for (const w of S.warnings) console.error("gates: " + w);
    console.log("gates: " + S.captures + " captures, " + S.pass + " pass, " + S.fail + " fail, " + S.skipped + " skipped, " + S.na + " n/a, " + S.errors.length + " errors" + (r.strict ? " (strict)" : "") + " -> " + join(r.dir, "gates.json"));
    if (!S.captures) console.error("gates: no capture dump in " + r.dir);
    process.exitCode = S.exit;
  } catch (e) {
    console.error("gates: " + ((e && e.message) || e));
    process.exitCode = 1;
  }
}
