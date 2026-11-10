#!/usr/bin/env node
/* Chrome-side readability gates (UI upgrade appendix section 11) on a shots.mjs output dir. Dev only, zero deps (PNG decoding is node:zlib through
   tools/pixel/rgba.mjs), never imported by src/ and not in the precache.

   node tools/ui/gates.mjs <dir> [flags]
     --strict   a skipped gate fails too (the release run), and so does a dir without the shots.json manifest; n/a never fails
   Judges the LATEST run in <dir>/shots.json (the manifest tools/ui/shots.mjs writes before it captures and again at the end) and nothing else:
   exactly the captures that run reports as taken. Every name that run meant to take and did not (a screen not reached, a page exception, a crash),
   every run error, and a run that did not complete are errors (exit 1 in both modes). A dump or PNG in <dir> the latest run does not own (an
   earlier run's) is ignored with a warning, never judged. Without a manifest (a dir assembled by hand) every capture dump in <dir> is judged, with
   a warning. Each judged capture: its dump <screen>.<look>.w<n>[.t125][.phone].json (flags, read-back, canvas content boxes and
   window.__GAME__.ui.snap(), the page's probe record), its PNG and, when shots took one, its .notext.png twin, through the gates of
   tools/ui/lib/gatelib.mjs (how each is measured, and when each is pass / fail / skipped / n/a, is in that file's header) with the screen's
   `need` (tools/ui/lib/screens.mjs); a dump, PNG or twin that is missing or does not parse is an error for that capture.
   Writes <dir>/gates.json: a summary, then per capture and per gate its status, value, threshold, the pair or text it was measured on, and every
   item. Any earlier gates.json is removed first, and a run that aborts (an unreadable manifest or dir) writes one that says error and why, so a
   stale pass file is never left behind.
   A gate that needs probe data the page does not record yet is "skipped: no probe data"; a required gate an instrumented page does not declare is
   "skipped: required, not declared"; neither is ever a pass.
   Exit 1 on any fail, on any error, on a dir with no capture, and under --strict on any skip or a missing manifest; else 0. */
import { readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unpng } from "../pixel/rgba.mjs";
import { evaluate, tally, EXEMPTABLE } from "./lib/gatelib.mjs";
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

const png = (p) => { const img = unpng(readFileSync(p)); if (!(img.width > 0 && img.height > 0)) throw new Error("an empty PNG"); return img; };

export function gateDir(a) {
  const out = join(a.dir, "gates.json"), mf = join(a.dir, "shots.json");
  rmSync(out, { force: true });
  const present = readdirSync(a.dir).filter((f) => f.endsWith(".json") && parseCapName(f.replace(/\.json$/, ".png"))).map((f) => f.replace(/\.json$/, "")).sort();
  const screens = {}, caps = [], errors = [], warnings = [];
  let judge = present, latest = null;
  if (existsSync(mf)) {
    const man = JSON.parse(readFileSync(mf, "utf8")), runs = man && Array.isArray(man.runs) ? man.runs : [];
    latest = runs[runs.length - 1];
    if (!latest || !Array.isArray(latest.intended) || !Array.isArray(latest.captures)) throw new Error("shots.json has no run with intended and captures lists");
    const taken = new Set(latest.captures), failed = latest.failed || {};
    for (const e of latest.errors || []) errors.push("latest run: " + e);
    if (!latest.done) errors.push("latest run: it did not complete");
    for (const n of latest.intended) if (!taken.has(n)) { errors.push(n + ": not taken by the latest run" + (failed[n] ? " (" + failed[n] + ")" : "")); screens[n] = { error: failed[n] || "not taken by the latest run" }; }
    for (const n of present) if (!taken.has(n)) warnings.push(n + ": in the dir but not taken by the latest run, ignored");
    judge = [...taken].sort();
  } else warnings.push("no shots.json manifest in " + a.dir + ": every dump here is judged and a capture shots.mjs failed to take cannot be detected" + (a.strict ? " (a fail under --strict)" : ""));
  for (const base of judge) {
    try {
      const jf = join(a.dir, base + ".json");
      if (!existsSync(jf)) throw new Error("no dump " + jf);
      const d = JSON.parse(readFileSync(jf, "utf8")), pf = join(a.dir, d.file || base + ".png");
      if (!existsSync(pf)) throw new Error("no PNG " + pf);
      const nt = d.notext ? join(a.dir, d.notext) : null;
      if (nt && !existsSync(nt)) throw new Error("no text-hidden twin " + nt);
      const need = SCREENS[d.screen] ? SCREENS[d.screen].need : EXEMPTABLE, gates = evaluate(d, png(pf), nt ? png(nt) : null, need);
      screens[base] = { screen: d.screen, flags: d.flags, page: d.ui ? d.ui.page : null, need, gates };
      caps.push({ gates });
    } catch (e) {
      errors.push(base + ": " + ((e && e.message) || e));
      screens[base] = { error: (e && e.message) || String(e) };
    }
  }
  const t = tally(caps), exit = errors.length || (a.strict && !latest) ? 1 : t.exit(a.strict);
  const res = { dir: a.dir, strict: a.strict, run: latest ? { flags: latest.flags, done: !!latest.done } : null, summary: { captures: t.captures, pass: t.pass, fail: t.fail, skipped: t.skipped, na: t.na, errors, warnings, exit }, screens };
  writeFileSync(out, JSON.stringify(res, null, 1));
  return res;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let a = null;
  try {
    a = parseArgs(process.argv.slice(2));
    const r = gateDir(a);
    for (const [n, s] of Object.entries(r.screens)) {
      if (s.error) { console.log(n + "  ERROR " + s.error); continue; }
      const by = (st) => Object.entries(s.gates).filter(([, g]) => g.status === st).map(([k, g]) => k + (g.value != null ? " " + g.value : ""));
      console.log(n + "  fail [" + by("fail").join(", ") + "]  skipped " + by("skipped").length + "  pass " + by("pass").length + "  n/a " + by("n/a").length);
    }
    const S = r.summary;
    for (const w of S.warnings) console.error("gates: " + w);
    for (const e of S.errors) console.error("gates: ERROR " + e);
    console.log("gates: " + S.captures + " captures, " + S.pass + " pass, " + S.fail + " fail, " + S.skipped + " skipped, " + S.na + " n/a, " + S.errors.length + " errors" + (r.strict ? " (strict)" : "") + " -> " + join(r.dir, "gates.json"));
    if (!S.captures) console.error("gates: no capture judged in " + r.dir);
    process.exitCode = S.exit;
  } catch (e) {
    const why = (e && e.message) || String(e);
    console.error("gates: " + why);
    if (a && existsSync(a.dir)) try { writeFileSync(join(a.dir, "gates.json"), JSON.stringify({ dir: a.dir, strict: a.strict, error: why, summary: { exit: 1, error: why } }, null, 1)); } catch {}
    process.exitCode = 1;
  }
}
