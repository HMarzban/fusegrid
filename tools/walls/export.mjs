#!/usr/bin/env node
/* Detail pass 2026-10-23 (throwaway): drives export.html in a fresh
   chrome-headless-shell (--gpu, ANGLE Metal) against TWO loopback servers,
   this worktree (tree=new) and a git archive of main (tree=today), and writes
   every CLASSIC / REAL 3D tile PNG. Both servers and Chrome are stopped by
   PID; the temp profile is deleted.
   node tools/walls/export.mjs <outDir> <mainArchiveDir> */
import {spawn} from "node:child_process";
import {writeFileSync, mkdirSync, rmSync, copyFileSync} from "node:fs";
import {join} from "node:path";
import {startChrome, cdp, openPage} from "../pixel/shot.mjs";
const OUT = process.argv[2], MAIN = process.argv[3], HERE = new URL("../../", import.meta.url).pathname;
const serve = (cwd) => new Promise((ok, no) => {
  const p = spawn(process.execPath, ["serve.js"], {cwd, env: {...process.env, PORT: "0"}, stdio: ["ignore", "pipe", "pipe"]});
  p.stdout.on("data", (b) => { const m = /127\.0\.0\.1:(\d+)/.exec(String(b)); if (m) ok({proc: p, port: +m[1]}); });
  p.on("exit", (c) => no(new Error("server exited " + c)));
});
mkdirSync(join(MAIN, "tools/walls"), {recursive: true});
copyFileSync(join(HERE, "tools/walls/export.html"), join(MAIN, "tools/walls/export.html"));
const A = await serve(HERE), B = await serve(MAIN);
let chr = null;
const files = [];
try {
  chr = await startChrome(true);
  const c = await cdp(chr.ws);
  for (const [tree, port] of [["new", A.port], ["today", B.port]]) {
    const pg = await openPage(c, {w: 400, h: 400, dpr: 1, mobile: false}, `http://127.0.0.1:${port}/tools/walls/export.html?tree=${tree}`);
    let o = null;
    for (let i = 0; i < 100 && !o; i++) { await new Promise((r) => setTimeout(r, 150)); o = await pg.ev("window.__OUT||null").catch(() => null); }
    if (!o) throw new Error(tree + ": no output " + pg.errors.join(" | "));
    if (pg.errors.length) console.error(tree, "page errors:", pg.errors.join(" | "));
    for (const [k, url] of Object.entries(o)) { const f = k + ".png"; mkdirSync(join(OUT, k.split("/")[0]), {recursive: true}); writeFileSync(join(OUT, f), Buffer.from(url.split(",")[1], "base64")); files.push(f); }
  }
  c.close();
} finally {
  if (chr) { chr.proc.kill("SIGTERM"); await new Promise((r) => setTimeout(r, 400)); try { rmSync(chr.dir, {recursive: true, force: true}); } catch (_) {} }
  A.proc.kill("SIGTERM"); B.proc.kill("SIGTERM");
}
console.log(JSON.stringify(files));
