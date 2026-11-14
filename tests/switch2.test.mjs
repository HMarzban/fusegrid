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

// ---- Task 7: vibration over WebHID, a vibrationActuator stand-in ----
import { rumblePacket } from "../src/app/switch2.js";
/* The encoder of the trial page the owner felt shake (.superpowers/sdd/2026-11-14-switch2-webusb-spike/index.html), ported here as the reference. */
const trial = (seq, s, w) => { const lo = Math.round(s * 29000), hi = Math.round(w * 29000), hf = 0x187, lf = 0x112; const p = new Uint8Array(63); p[0] = 0x50 | (seq & 15);
  p[1] = hf & 255; p[2] = ((hi >> 4) & 0xfc) | ((hf >> 8) & 3); p[3] = ((hi >> 12) | (lf << 4)) & 255; p[4] = ((lo & 0xc0) | ((lf >> 4) & 0x3f)) & 255; p[5] = (lo >> 8) & 255; p.set(p.slice(0, 6), 0x10); return p; };
const amps = (p) => [p[2] & 0xfc, p[3] & 0x0f, p[4] & 0xc0, p[5]];

test("rumblePacket: 63 bytes, the felt encoder byte for byte, no amplitude bits at rest, bytes 0-5 again at 0x10", () => {
  const z = rumblePacket(0, 0, 0);
  assert.equal(z.length, 63);
  assert.equal(z[0], 0x50);
  assert.deepEqual(amps(z), [0, 0, 0, 0]);
  const p = rumblePacket(3, 1, 0.5);
  assert.equal(p[0], 0x53);
  assert.deepEqual(Array.from(p.slice(0, 6)), Array.from(p.slice(0x10, 0x16)));
  assert.deepEqual(Array.from(p.slice(0, 6)), [0x53, 0x87, 0x89, 0x23, 0x51, 0x71]);
  for (const [q, s, w] of [[0, 0, 0], [3, 1, 0.5], [17, 0.35, 0.7], [15, 0.8, 0.6], [9, 0.4, 0]]) assert.deepEqual(Array.from(rumblePacket(q, s, w)), Array.from(trial(q, s, w)), [q, s, w].join());
  assert.deepEqual(Array.from(rumblePacket(1, 2, -1)), Array.from(trial(1, 1, 0)), "clamped to 0..1");
  assert.deepEqual(Array.from(rumblePacket(1, NaN, NaN)), Array.from(trial(1, 0, 0)), "NaN is 0");
});

/* A fake clock (no timer runs in Node) and a fake WebHID device / navigator.hid / document / window. */
const fakeClock = () => { const c = { t: 0, fs: new Map(), n: 0, now: () => c.t, every(f, ms) { c.ms = ms; c.fs.set(++c.n, f); return c.n; }, cancel(id) { c.fs.delete(id); },
  go(ms) { for (let i = 0; i < ms; i++) { c.t++; if (c.t % c.ms === 0) for (const f of [...c.fs.values()]) f(); } } }; return c; };
const target = () => { const ls = {}; return { ls, addEventListener(t, f) { (ls[t] = ls[t] || []).push(f); }, removeEventListener(t, f) { ls[t] = (ls[t] || []).filter((g) => g !== f); }, fire(t, e) { for (const f of [...(ls[t] || [])]) f(e); }, n: (t) => (ls[t] || []).length }; };
const hidDev = (o = {}) => { const d = { vendorId: 0x057e, productId: o.pid || 0x2069, opened: !!o.opened, sent: [],
  async open() { if (o.openFails) throw new Error("x"); d.opened = true; }, sendReport(id, data) { d.sent.push([id, Array.from(data)]); return Promise.resolve(); } }; return d; };
const hidOf = (o = {}) => Object.assign(target(), { asked: 0, granted: o.granted || [], async getDevices() { return this.granted; },
  requestDevice(opts) { this.asked++; this.lastFilters = opts.filters; if (o.reject) return Promise.reject(Object.assign(new Error("x"), { name: o.reject })); return Promise.resolve(o.pick ? [o.pick] : []); } });
const PRO = { id: "Switch 2 Pro Controller (Vendor: 057e Product: 2069)", connected: true };
const zeros = (d) => d.sent.filter(([, p]) => amps(p).every((b) => b === 0)).length;
const live = async (o = {}) => {
  const d = o.dev || hidDev(), hid = hidOf({ granted: [d] }), clock = fakeClock(), doc = Object.assign(target(), { hidden: false }), win = target();
  const w = createWaker({ usb: usbOf(), pads: () => (o.pads || [PRO]), hid, doc, win, clock });
  assert.equal(await w.restore(), true);
  return { w, d, hid, clock, doc, win, a: w.actuator() };
};

test("actuator(): null with no HID device; once a granted one opens, the same dual-rumble stand-in every call, only for a Switch 2 Pro", async () => {
  const none = createWaker({ usb: usbOf(), pads: () => [] });
  assert.equal(none.actuator(), null);
  assert.equal(none.vibOffer(), false, "no WebHID: never offered");
  const { w, d, a } = await live();
  assert.ok(d.opened);
  assert.ok(a && a.type === "dual-rumble" && Array.from(a.effects).join() === "dual-rumble" && typeof a.playEffect === "function" && typeof a.reset === "function");
  assert.equal(w.actuator(), a);
  assert.equal(w.actuator(PRO), a);
  assert.equal(w.actuator({ id: "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)" }), null);
  assert.equal(w.vibOffer(), false, "allowed already: not offered again");
  await assert.rejects(a.playEffect("trigger-rumble", { duration: 10 }));
});

test("while on it sends every 12 ms, then one zero packet at the end, and resolves complete", async () => {
  const { d, clock, a } = await live();
  let res = null;
  a.playEffect("dual-rumble", { startDelay: 0, duration: 100, strongMagnitude: 1, weakMagnitude: 0.5 }).then((r) => (res = r));
  assert.equal(d.sent.length, 1, "the first packet at once");
  assert.equal(clock.ms, 12);
  clock.go(96);
  assert.equal(d.sent.length, 9, "0, 12, ... 96");
  assert.ok(d.sent.every(([id]) => id === 0x02));
  assert.deepEqual(d.sent[1][1].slice(1, 6), Array.from(rumblePacket(0, 1, 0.5).slice(1, 6)));
  assert.equal(zeros(d), 0);
  clock.go(12);
  assert.equal(zeros(d), 1);
  assert.deepEqual(amps(d.sent.at(-1)[1]), [0, 0, 0, 0]);
  const n = d.sent.length;
  clock.go(120);
  assert.equal(d.sent.length, n, "nothing after the end, the loop is gone");
  assert.equal(clock.fs.size, 0);
  await tick();
  assert.equal(res, "complete");
  assert.deepEqual(d.sent.map(([, p]) => p[0] & 15), d.sent.map((_, i) => i & 15), "the sequence counts every packet");
});

test("a second playEffect before the first ends is not cut by the first one's end; the first resolves preempted", async () => {
  const { d, clock, a } = await live();
  const out = [];
  a.playEffect("dual-rumble", { duration: 60, strongMagnitude: 0.5, weakMagnitude: 0 }).then((r) => out.push("a " + r));
  clock.go(36);
  a.playEffect("dual-rumble", { duration: 100, strongMagnitude: 0, weakMagnitude: 0.7 }).then((r) => out.push("b " + r));
  clock.go(60); // past the first one's end (60)
  assert.equal(zeros(d), 0, "the first one's end sends no zero");
  assert.deepEqual(amps(d.sent.at(-1)[1]), amps(rumblePacket(0, 0, 0.7)), "the second one still drives the motor");
  clock.go(48);
  assert.equal(zeros(d), 1, "one zero, at the second one's end");
  await tick();
  assert.deepEqual(out, ["a preempted", "b complete"]);
});

test("reset(), visibilitychange to hidden, pagehide and a HID disconnect each send one zero packet at once and stop the loop", async () => {
  for (const how of ["reset", "hidden", "pagehide", "disconnect"]) {
    const { w, d, hid, clock, doc, win, a } = await live();
    let res = null;
    a.playEffect("dual-rumble", { duration: 400, strongMagnitude: 1, weakMagnitude: 1 }).then((r) => (res = r));
    clock.go(24);
    const n = d.sent.length;
    if (how === "reset") assert.equal(await a.reset(), "complete");
    if (how === "hidden") { doc.hidden = true; doc.fire("visibilitychange"); }
    if (how === "pagehide") win.fire("pagehide");
    if (how === "disconnect") hid.fire("disconnect", { device: d });
    assert.equal(d.sent.length, n + 1, how + ": one packet at once");
    assert.equal(zeros(d), 1, how + ": a zero");
    clock.go(200);
    assert.equal(d.sent.length, n + 1, how + ": nothing after it");
    await tick();
    assert.equal(res, "preempted", how);
    if (how === "disconnect") assert.equal(w.actuator(), null, "a pad gone: no stand-in");
    w.stop();
    assert.ok(["disconnect", "connect"].every((t) => hid.n(t) === 0) && doc.n("visibilitychange") === 0 && win.n("pagehide") === 0, how + ": stop() lets every listener go");
  }
});

test("visible again sends nothing; a replugged pad the player allowed comes back with no chooser", async () => {
  const { w, d, hid, doc } = await live();
  doc.hidden = false; doc.fire("visibilitychange");
  assert.equal(d.sent.length, 0);
  hid.fire("disconnect", { device: d });
  assert.equal(w.actuator(), null);
  const d2 = hidDev();
  hid.fire("connect", { device: Object.assign(hidDev(), { vendorId: 0x045e }) });
  hid.fire("connect", { device: d2 });
  await tick();
  assert.ok(d2.opened && w.actuator() !== null && hid.asked === 0);
});

test("allow(): the chooser filters the Switch 2 Pro, asked inside the call; each outcome has its own word; a second ask while open is the same ask", async () => {
  const pick = hidDev(), hid = hidOf({ pick });
  const w = createWaker({ usb: usbOf(), pads: () => [PRO], hid, clock: fakeClock() });
  assert.equal(w.vibOffer(), true, "WebHID, a Switch 2 playing, none allowed: offered");
  const p = w.allow(), q = w.allow();
  assert.equal(hid.asked, 1, "requestDevice inside the press, nothing awaited before it");
  assert.equal(p, q);
  assert.deepEqual(hid.lastFilters, [{ vendorId: 0x057e, productId: 0x2069 }]);
  assert.equal(await p, "allowed");
  assert.ok(pick.opened && w.actuator() !== null && !w.vibOffer());
  const mk = (o) => createWaker({ usb: usbOf(), pads: () => [PRO], hid: hidOf(o), clock: fakeClock() });
  assert.equal(await mk({}).allow(), "cancelled", "WebHID answers a closed chooser with an empty list");
  assert.equal(await mk({ reject: "SecurityError" }).allow(), "blocked");
  assert.equal(await mk({ reject: "NotAllowedError" }).allow(), "failed");
  const bad = mk({ pick: hidDev({ openFails: true }) });
  assert.equal(await bad.allow(), "failed");
  assert.equal(bad.actuator(), null);
  assert.equal(createWaker({ usb: usbOf(), pads: () => [] , hid: hidOf({}) }).vibOffer(), false, "no Switch 2 in the pad list: not offered");
});

test("auto() restores the HID device the player allowed before it looks at the pads, with no chooser", async () => {
  const d = hidDev(), hid = hidOf({ granted: [Object.assign(hidDev(), { productId: 0x2009 }), d] });
  const w = createWaker({ usb: usbOf(), pads: () => [PRO], hid, clock: fakeClock() });
  assert.equal(await w.auto(), 0, "the pad already plays: nothing to wake");
  assert.ok(d.opened && w.actuator() !== null && hid.asked === 0);
  w.stop();
});
