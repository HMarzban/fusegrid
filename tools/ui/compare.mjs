#!/usr/bin/env node
/* Mock beside game, for the art reviewer (dev only, zero deps, never imported by src/ and not in the precache).

   node tools/ui/compare.mjs <dir> --ref <mock dir> [flags]
     --ref DIR   the approved mock frames' root (required): .superpowers/sdd/notes/v202-ui-upgrade/round7, whose lane folders hold png/d-*.png
                 (desktop, 1366x768 at 2x) and png/p-*.png (phone, 393x852 at 3x); git-ignored and only on the owner's machine
     --map FILE  the reference map (default tools/ui/refmap.json, tracked): keys screen[.look][.wN][.t125][.phone] -> a frame path relative to --ref
   Writes <dir>/compare.html: for every capture shots.mjs wrote in <dir> (text-hidden twins left out), its mock frame beside it at the same displayed
   width, labelled with both file names; a screen the map has no frame for (or whose frame is not on disk) says so. The most specific key wins (look
   and world, then world, then look, then the bare screen), but phone and 125 % are never dropped. Mock PNGs are never copied: the page references
   them by absolute file:// URL, so open compare.html directly in a browser, not through serve.js. Exit 1 on a bad flag or a missing dir. */
import { writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compareHtml } from "./lib/refs.mjs";

const UI = dirname(fileURLToPath(import.meta.url));

export function parseArgs(argv) {
  const a = { dir: null, ref: null, map: join(UI, "refmap.json") };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--ref") { if (!v) throw new Error("--ref wants the mock frames' root dir"); a.ref = resolve(v); i++; }
    else if (k === "--map") { if (!v) throw new Error("--map wants a JSON file"); a.map = resolve(v); i++; }
    else if (k.startsWith("--")) throw new Error("unknown flag " + k + " (see the header of tools/ui/compare.mjs)");
    else if (a.dir) throw new Error("one capture dir, got " + a.dir + " and " + k);
    else a.dir = resolve(k);
  }
  if (!a.dir || !a.ref) throw new Error("usage: node tools/ui/compare.mjs <dir> --ref <mock dir> [--map FILE]");
  for (const [n, p] of [["capture dir", a.dir], ["--ref", a.ref]]) if (!existsSync(p) || !statSync(p).isDirectory()) throw new Error(n + " is not a dir: " + p);
  return a;
}

export function compareDir(a) {
  const map = JSON.parse(readFileSync(a.map, "utf8")), out = join(a.dir, "compare.html");
  writeFileSync(out, compareHtml(a.dir, a.ref, map, (p) => existsSync(p)));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log("compare: " + compareDir(parseArgs(process.argv.slice(2)))); }
  catch (e) { console.error("compare: " + ((e && e.message) || e)); process.exitCode = 1; }
}
