/* THROWAWAY tile art export harness (2026-10-23). Starts this worktree's own
   PORT=0 server + a headless shell (fresh profile), hands back a page
   evaluator, and stops both by PID. */
import {rmSync} from "node:fs";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
export const WT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const OUT = process.env.TILEART_OUT || "/Users/macbook/workspace/rollblock/.superpowers/sdd/2026-10-23-tile-art/round3/floor/";
process.env.CHROME = process.env.CHROME || process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const {startServer, startChrome, cdp, openPage, parseArgs} = await import(WT + "/tools/pixel/shot.mjs");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function withPage(fn, {gpu = true, render = "2d", size = "1366x768", dpr = 1} = {}) {
  const srv = await startServer();
  let chr, c;
  try {
    chr = await startChrome(gpu);
    c = await cdp(chr.ws);
    const P = await openPage(c, parseArgs(["--size", size, "--dpr", String(dpr), "--render", render]), "http://127.0.0.1:" + srv.port + "/index.html?render=" + render + "&debug=1");
    P.port = srv.port;
    return await fn(P);
  } finally {
    try { c && c.close(); } catch (e) {}
    if (chr) { try { process.kill(chr.proc.pid); } catch (e) {} await sleep(300); try { rmSync(chr.dir, {recursive: true, force: true}); } catch (e) {} }
    try { process.kill(srv.proc.pid); } catch (e) {}
  }
}
export const b64png = (d) => Buffer.from(d.replace(/^data:image\/png;base64,/, ""), "base64");
/* the eight tiles: [world, piece, biome, internal spec] */
export const TILES = [
  ["jungle", "booster", "JUNGLE", {kind: "BLOOM", state: 0}],
  ["ice", "ice-patch", "ICE", {kind: "GLIDE", gx: 3, gy: 4, outer: ["N", "E", "S", "W"]}],
  ["factory", "conveyor", "FACTORY", {kind: "BELT", dir: 0, exit: false, phase: 0}],
  ["water", "stream", "WATER", {kind: "STREAM", dir: 0, phase: 0, outer: ["N", "S"]}],
  ["arena", "trap", "ARENA", {kind: "PLATE", state: 0}],
  ["sand", "quicksand", "SAND", {kind: "QUICK", state: 0, outer: ["N", "E", "S", "W"]}],
  ["void", "portal", "VOID", {kind: "PORTAL", pair: 1, outer: ["N", "E", "S", "W"]}],
  ["crown", "gate", "CROWN", {kind: "GATE", state: 0, lit: 2, outer: ["N", "E", "S", "W"]}],
];
export const HEAT = ["core", "plus", "max"];
