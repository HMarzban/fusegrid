import test from "node:test";
import assert from "node:assert/strict";
import { SW2_USB, initPackets, wake, usbReach, createWaker } from "../src/app/switch2.js";

const hex = (s) => Uint8Array.from(s.trim().split(/\s+/), (h) => parseInt(h, 16));
/* The bytes the local bridge sent (pro2wake.py, SDL's sequence) with the report-format packet at 09: what the owner's pad answered on 2026-11-14. */
const VERIFIED = [
  "07 91 00 01 00 00 00 00",
  "0c 91 00 02 00 04 00 00 27 00 00 00",
  "11 91 00 01 00 00 00 00",
  "0a 91 00 08 00 14 00 00 01 ff ff ff ff ff ff ff ff 35 00 46 00 00 00 00 00 00 00 00",
  "0c 91 00 04 00 04 00 00 27 00 00 00",
  "01 91 00 0c 00 00 00 00",
  "01 91 00 01 00 00 00 00",
  "08 91 00 02 00 04 00 00 01 00 00 00",
  "03 91 00 0a 00 04 00 00 09 00 00 00",
  "03 91 00 0d 00 08 00 00 01 00 ff ff ff ff ff ff",
].map(hex);

function dev(o = {}) {
  const calls = [];
  const d = {
    vendorId: 0x057e, productId: o.pid || 0x2069, opened: false, configuration: o.noConfig ? null : { configurationValue: 1 }, calls,
    async open() { calls.push("open"); d.opened = true; },
    async close() { calls.push("close"); d.opened = false; },
    async selectConfiguration(n) { calls.push("config " + n); d.configuration = { configurationValue: n }; },
    async claimInterface(n) { calls.push("claim " + n); if (o.busy) throw Object.assign(new Error("busy"), { name: "NetworkError" }); },
    async releaseInterface(n) { calls.push("release " + n); },
    async transferOut(ep, data) { calls.push(["out", ep, Array.from(data)]); return { status: o.stall ? "stall" : "ok", bytesWritten: data.length }; },
    async transferIn() { calls.push("in"); return { status: "ok" }; },
  };
  return d;
}
function usbOf(o = {}) {
  const ls = {};
  const u = {
    granted: o.granted || [], asked: 0,
    async getDevices() { return u.granted; },
    async requestDevice(opts) { u.asked++; u.lastFilters = opts.filters; if (o.reject) throw Object.assign(new Error("x"), { name: o.reject }); return o.pick; },
    addEventListener(t, f) { (ls[t] = ls[t] || []).push(f); },
    removeEventListener(t, f) { ls[t] = (ls[t] || []).filter((g) => g !== f); },
    fire(t, e) { for (const f of ls[t] || []) f(e); },
    count: (t) => (ls[t] || []).length,
  };
  return u;
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const outs = (d) => d.calls.filter((c) => Array.isArray(c));

test("initPackets is the verified start-up, format 09, each packet p[5] + 8 long", () => {
  const p = initPackets();
  assert.equal(p.length, 10);
  p.forEach((x, i) => assert.deepEqual(Array.from(x), Array.from(VERIFIED[i]), "packet " + i));
  for (const x of p) assert.equal(x.length, x[5] + 8);
  assert.deepEqual(SW2_USB, [0x2069]);
});

test("wake opens, claims interface 1, sends every packet to endpoint 2, then lets the interface go", async () => {
  const d = dev();
  assert.equal(await wake(d), "woken");
  assert.equal(d.calls[0], "open");
  assert.equal(d.calls[1], "claim 1");
  assert.deepEqual(outs(d).map((c) => c[1]), Array(10).fill(2));
  assert.deepEqual(outs(d).map((c) => c[2]), VERIFIED.map((x) => Array.from(x)));
  assert.ok(!d.calls.includes("in"), "no reads pile up");
  assert.ok(!d.calls.some((c) => typeof c === "string" && c.startsWith("config")), "a configured pad is not reconfigured");
  assert.equal(d.calls.at(-1), "close");
  assert.ok(d.calls.includes("release 1"));
});

test("wake selects configuration 1 only when the pad has none", async () => {
  const d = dev({ noConfig: true });
  await wake(d);
  assert.equal(d.calls[1], "config 1");
});

test("wake: a refused claim is busy, a stalled packet is failed", async () => {
  assert.equal(await wake(dev({ busy: true })), "busy");
  assert.equal(await wake(dev({ stall: true })), "failed");
});

test("usbReach: only with WebUSB, the page allowed, on a measured platform", () => {
  const usb = usbOf();
  const yes = { allowsFeature: (f) => f === "usb" }, no = { allowsFeature: () => false };
  assert.equal(usbReach({ usb: null, policy: yes, platform: "macOS" }), false);
  assert.equal(usbReach({ usb, policy: no, platform: "macOS" }), false);
  for (const p of ["Windows", "Linux", "Android", "Chrome OS", "", undefined]) assert.equal(usbReach({ usb, policy: yes, platform: p }), false, String(p));
  assert.equal(usbReach({ usb, policy: yes, platform: "macOS" }), true);
  assert.equal(usbReach({ usb, policy: null, platform: "macOS" }), true, "no policy object: nothing denies it");
});

test("auto wakes a permitted pad with no chooser, and leaves one already playing alone", async () => {
  const d = dev(), usb = usbOf({ granted: [d] });
  const w = createWaker({ usb, pads: () => [] });
  assert.equal(await w.auto(), 1);
  assert.equal(usb.asked, 0);
  assert.equal(outs(d).length, 10);
  w.stop();
  const d2 = dev(), usb2 = usbOf({ granted: [d2] });
  const live = { id: "Switch 2 Pro Controller (Vendor: 057e Product: 2069)", connected: true };
  const w2 = createWaker({ usb: usb2, pads: () => [null, live] });
  assert.equal(await w2.auto(), 0);
  assert.equal(d2.calls.length, 0);
  w2.stop();
});

test("auto listens for a plugged-in pad until stop", async () => {
  const usb = usbOf();
  const w = createWaker({ usb, pads: () => [] });
  await w.auto();
  const d = dev(), other = Object.assign(dev(), { vendorId: 0x045e });
  usb.fire("connect", { device: other });
  usb.fire("connect", { device: d });
  await tick(); await tick();
  assert.equal(other.calls.length, 0);
  assert.equal(outs(d).length, 10);
  w.stop();
  assert.equal(usb.count("connect"), 0);
  const late = dev();
  usb.fire("connect", { device: late });
  await tick();
  assert.equal(late.calls.length, 0);
});

test("request: the chooser filters the known pads, and every outcome has its own word", async () => {
  const ok = usbOf({ pick: dev() });
  const w = createWaker({ usb: ok, pads: () => [] });
  assert.equal(await w.request(), "woken");
  assert.deepEqual(ok.lastFilters, [{ vendorId: 0x057e, productId: 0x2069 }]);
  assert.equal(w.state(), "woken");
  assert.equal(await createWaker({ usb: usbOf({ reject: "NotFoundError" }), pads: () => [] }).request(), "cancelled");
  assert.equal(await createWaker({ usb: usbOf({ reject: "SecurityError" }), pads: () => [] }).request(), "blocked");
  assert.equal(await createWaker({ usb: usbOf({ pick: dev({ busy: true }) }), pads: () => [] }).request(), "busy");
  assert.equal(await createWaker({ usb: usbOf({ reject: "TypeError" }), pads: () => [] }).request(), "failed");
});

test("request always wakes, even a pad already playing; a second ask while waking is the same ask", async () => {
  const d = dev(), usb = usbOf({ pick: d });
  const w = createWaker({ usb, pads: () => [{ id: "057e-2069-x", connected: true }] });
  const a = w.request(), b = w.request();
  assert.equal(a, b);
  assert.equal(await a, "woken");
  assert.equal(usb.asked, 1);
  assert.equal(outs(d).length, 10);
});
