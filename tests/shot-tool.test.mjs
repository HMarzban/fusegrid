/* tools/pixel/shot.mjs (#29): parseArgs for the board flags, browser
   discovery over a fake ms-playwright tree, and the crash path. Nothing here
   spawns a browser: CHROME=/nope fails before any spawn, and /usr/bin/false
   stands in for a browser that dies at start. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, findChrome, loadExpr } from "../tools/pixel/shot.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOT = join(ROOT, "tools/pixel/shot.mjs");
const BIN = "chrome-headless-shell";

test("parseArgs: defaults leave the board alone", () => {
  const a = parseArgs([]);
  assert.equal(a.render, "px");
  assert.deepEqual(a.rooms, [1, 7, 8]);
  assert.deepEqual([a.seed, a.heat, a.pace, a.gen, a.pause], [null, null, null, null, false]);
  assert.match(a.out, /\.superpowers\//);
});

test("parseArgs: board flags, preset and pause", () => {
  const a = parseArgs(["--render", "2d", "--preset", "laptop", "--rooms", "1,3", "--seed", "4242", "--heat", "2", "--pace", "-1", "--gen", "2", "--pause", "--out", "/tmp/x", "--name", "t"]);
  assert.deepEqual([a.render, a.w, a.h, a.dpr, a.mobile], ["2d", 1366, 768, 1, false]);
  assert.deepEqual(a.rooms, [1, 3]);
  assert.deepEqual([a.seed, a.heat, a.pace, a.gen, a.pause, a.out, a.name], [4242, 2, -1, 2, true, "/tmp/x", "t"]);
  assert.equal(parseArgs(["--seed", "0", "--heat", "0", "--pace", "0"]).seed, 0);
  assert.equal(parseArgs(["--seed", "4294967295"]).seed, 4294967295);
  assert.equal(parseArgs(["--gen", "3"]).gen, 3);
});

test("parseArgs: refuses bad values and unknown flags", () => {
  for (const argv of [["--heat", "3"], ["--heat"], ["--pace", "2"], ["--pace", "-2"], ["--gen", "0"], ["--gen", "x"], ["--seed", "-1"], ["--seed", "4294967296"], ["--seed", "1.5"],
    ["--rooms", "0"], ["--rooms", "9"], ["--render", "iso"], ["--preset", "tv"], ["--size", "big"], ["--bogus"]])
    assert.throws(() => parseArgs(argv), Error, argv.join(" "));
});

test("loadExpr: sets only the flagged fields, then reloads the room", () => {
  const e = loadExpr({ seed: 7, heat: 2, pace: null, gen: 2 }, 3);
  assert.match(e, /G\.seed=7>>>0;G\.heat=2;if\('gen' in G\)G\.gen=2;/);
  assert.doesNotMatch(e, /G\.pace=/);
  assert.match(e, /m\.loadLevel\(G,3,true\)/);
  assert.doesNotMatch(loadExpr({ seed: null, heat: null, pace: null, gen: null }, 1), /G\.(seed|heat|pace|gen)=/);
});

test("findChrome: $CHROME wins, else the newest shell that holds a binary", () => {
  const base = mkdtempSync(join(tmpdir(), "fg-pw-"));
  try {
    const put = (v, plat = "chrome-headless-shell-mac-arm64") => { const d = join(base, "chromium_headless_shell-" + v, plat); mkdirSync(d, { recursive: true }); writeFileSync(join(d, BIN), ""); return join(d, BIN); };
    assert.equal(findChrome({}, base), null, "empty tree");
    assert.equal(findChrome({}, join(base, "missing")), null, "no ms-playwright dir");
    const v999 = put(999);
    const v1248 = put(1248);
    mkdirSync(join(base, "chromium_headless_shell-1300", "chrome-headless-shell-mac-arm64"), { recursive: true }); // newest, no binary
    put(2000, "chrome-mac-arm64"); // not a headless-shell platform dir
    mkdirSync(join(base, "chromium-1400"), { recursive: true }); // full chromium, not the shell
    writeFileSync(join(base, "chromium_headless_shell-1500"), ""); // a file, not a dir
    assert.equal(findChrome({}, base), v1248, "numeric order, binary required");
    assert.equal(findChrome({ CHROME: "/custom/chrome" }, base), "/custom/chrome", "CHROME overrides");
    rmSync(join(base, "chromium_headless_shell-1248"), { recursive: true });
    assert.equal(findChrome({}, base), v999);
    const linux = put(1600, "chrome-headless-shell-linux64");
    assert.equal(findChrome({}, base), linux, "any platform dir");
  } finally { rmSync(base, { recursive: true, force: true }); }
});

const runShot = (env, tmp) => spawnSync(process.execPath, [SHOT, "--render", "2d", "--rooms", "1", "--out", join(tmp, "out")], { cwd: ROOT, env: { ...process.env, TMPDIR: tmp, ...env }, encoding: "utf8", timeout: 60000 });
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code !== "ESRCH"; } };

test("CHROME=/nope exits non-zero before it starts a server", () => {
  const tmp = mkdtempSync(join(tmpdir(), "fg-shot-"));
  try {
    const r = runShot({ CHROME: "/nope" }, tmp);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /no browser at CHROME=\/nope/);
    assert.doesNotMatch(r.stderr, /serve\.js pid/);
    assert.deepEqual(readdirSync(tmp).filter((d) => d.startsWith("fg-px-")), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("a browser that dies at start: non-zero exit, server stopped by PID, no profile left", { skip: !existsSync("/usr/bin/false") && "no /usr/bin/false" }, () => {
  const tmp = mkdtempSync(join(tmpdir(), "fg-shot-"));
  try {
    const r = runShot({ CHROME: "/usr/bin/false" }, tmp);
    assert.notEqual(r.status, 0, r.stderr);
    assert.match(r.stderr, /chrome exited/);
    const m = /serve\.js pid (\d+)/.exec(r.stderr);
    assert.ok(m, "the server pid is reported: " + r.stderr);
    assert.equal(alive(+m[1]), false, "serve.js " + m[1] + " survived");
    assert.deepEqual(readdirSync(tmp).filter((d) => d.startsWith("fg-px-")), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("the header documents every flag parseArgs knows", () => {
  const src = readFileSync(SHOT, "utf8"), head = src.slice(0, src.indexOf("*/"));
  const flags = new Set([...src.matchAll(/k === "(--[a-z]+)"/g)].map((m) => m[1]));
  assert.ok(flags.size >= 15, [...flags].join(" "));
  for (const f of flags) assert.match(head, new RegExp("^\\s+" + f + "\\b", "m"), f + " missing from the header");
});
