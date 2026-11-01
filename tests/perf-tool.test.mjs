/* tools/perf/frames.mjs (#34): the pure frame math and the flags. Nothing here
   spawns a browser. */
import test from "node:test";
import assert from "node:assert/strict";
import { pct, periodOf, dropped, summarize, parseArgs, findHeaded, WORK_MIN } from "../tools/perf/frames.mjs";

test("pct is nearest-rank on a sorted list", () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.deepEqual([pct(a, 50), pct(a, 95), pct(a, 99), pct(a, 100)], [5, 10, 10, 10]);
  assert.equal(pct([], 50), 0);
});

test("dropped counts missed vsyncs, not jitter", () => {
  const P = 1000 / 60;
  assert.equal(dropped([P, P + 2, P - 2, P], P), 0);
  assert.equal(dropped([P * 2], P), 1);
  assert.equal(dropped([P * 3, P], P), 2);
  assert.equal(dropped([P * 1.6], P), 1);
  assert.equal(dropped([P], 0), 0);
  assert.equal(periodOf([16.6, 16.7, 33.4, 16.7, 16.8]), 16.7);
});

test("summarize: frames the gate skipped do not flatter the work median", () => {
  const s = summarize([16.7, 16.7, 16.7, 33.4], [0.01, 2, 0.01, 4], 16.7);
  assert.equal(s.dropped, 1);
  assert.equal(s.drawnFrames, 2);
  assert.equal(s.work.med, 2);
  assert.equal(s.work.max, 4);
  assert.equal(s.interval.max, 33.4);
  assert.ok(Math.abs(s.workMean - 1.505) < 0.01);
  assert.ok(WORK_MIN > 0.01);
});

test("parseArgs: defaults and flags, unknown ones refused", () => {
  const d = parseArgs([]);
  assert.deepEqual(d.looks, ["2d", "px", "3d"]);
  assert.deepEqual(d.only, ["desk", "phone", "rate"]);
  assert.match(d.out, /\.superpowers\//);
  const a = parseArgs(["--looks", "3d", "--only", "flush", "--tile", "1", "--fps", "2", "--at", "-1450,160", "--throttle", "6", "--secs", "3"]);
  assert.deepEqual([a.looks, a.only, a.tile, a.fps, a.at, a.throttle, a.secs], [["3d"], ["flush"], 1, 2, "-1450,160", 6, 3]);
  assert.throws(() => parseArgs(["--only", "uncapped"]));
  assert.throws(() => parseArgs(["--bogus"]));
});

test("findHeaded: $CHROME wins; no tree means no browser, never the headless shell", () => {
  assert.equal(findHeaded({ CHROME: "/x/y" }), "/x/y");
  assert.equal(findHeaded({}, "/nope"), null);
});
