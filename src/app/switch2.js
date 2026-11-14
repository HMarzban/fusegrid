/* Wakes a Switch 2 Pro Controller over WebUSB, so the browser's Gamepad API sees it at all. Lazy: loaded only where usbReach is true.
   The start-up packets and their order come from SDL (src/joystick/hidapi/SDL_hidapi_switch2.c, zlib licence), with the
   report-format packet at 09 instead of SDL's 05: in 09 the pad sends HID report 0x09, which the browser maps to a gamepad and
   gamepad.js KNOWN puts in the standard order (measured on the owner's pad, Chrome on macOS, 2026-11-14). Nothing here reads a
   global: usb and the pad list are injected. The device id is matched, never printed or stored. */
export const SW2_VENDOR = 0x057e;
export const SW2_USB = Object.freeze([0x2069]);
const SEEN = /057e\W+(product:\s*)?2069/i;
const PACKETS = [
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
];
const IFACE = 1, EP_OUT = 2;

/** The ten start-up packets, fresh each call. */
export const initPackets = () => PACKETS.map((s) => Uint8Array.from(s.split(" "), (h) => parseInt(h, 16)));

const isPad = (d) => !!d && d.vendorId === SW2_VENDOR && SW2_USB.includes(d.productId);

/** Opens, claims the vendor interface, sends the start-up, then lets the interface and the device go: the pad keeps streaming on its own. */
export async function wake(device) {
  try {
    if (!device.opened) await device.open();
    if (device.configuration == null) await device.selectConfiguration(1);
  } catch (_) {
    return "failed";
  }
  try {
    await device.claimInterface(IFACE);
  } catch (_) {
    return "busy";
  }
  let out = "woken";
  try {
    for (const p of initPackets()) {
      const r = await device.transferOut(EP_OUT, p);
      if (!r || r.status !== "ok") { out = "failed"; break; }
    }
  } catch (_) {
    out = "failed";
  }
  try { await device.releaseInterface(IFACE); } catch (_) {}
  try { await device.close(); } catch (_) {}
  return out;
}

const MEASURED = new Set(["macOS"]);
/** True only where the CONNECT path is measured: WebUSB present, the page allowed to use it, a measured platform. */
export function usbReach({ usb, policy, platform }) {
  if (!usb) return false;
  if (policy && typeof policy.allowsFeature === "function" && !policy.allowsFeature("usb")) return false;
  return MEASURED.has(platform);
}

/* Vibration over WebHID (Task 7): SDL's HD rumble in report format 09, the encoder of the trial page the owner felt shake (2026-11-14). */
const HD_MAX = 29000, HF = 0x187, LF = 0x112, EVERY_MS = 12;
const amp = (v) => Math.round((v > 0 ? Math.min(1, v) : 0) * HD_MAX);
/** The 63 data bytes of HID output report 0x02: sequence, SDL's EncodeHDRumble(0x187, hi, 0x112, lo), bytes 0-5 again at 0x10. strong / weak 0..1. */
export function rumblePacket(seq, strong, weak) {
  const lo = amp(strong), hi = amp(weak), p = new Uint8Array(63);
  p[0] = 0x50 | (seq & 15);
  p[1] = HF & 255; p[2] = ((hi >> 4) & 0xfc) | ((HF >> 8) & 3); p[3] = ((hi >> 12) | (LF << 4)) & 255; p[4] = ((lo & 0xc0) | ((LF >> 4) & 0x3f)) & 255; p[5] = (lo >> 8) & 255;
  p.set(p.subarray(0, 6), 0x10);
  return p;
}
const CLOCK = { now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()), every: (f, ms) => setInterval(f, ms), cancel: (id) => clearInterval(id) };

/** The waker: auto() for pads already granted and plugged in later, request() for the chooser (call it inside the press's own handler); with WebHID, allow() asks for vibration on its own press and actuator() is the pad's stand-in vibrationActuator. */
export function createWaker({ usb, pads, hid, win, doc, clock }) {
  let st = "idle", busy = null, onConnect = null;
  const playing = () => {
    let list = [];
    try { list = Array.from((pads && pads()) || []); } catch (_) {}
    return list.some((g) => g && g.connected !== false && typeof g.id === "string" && SEEN.test(g.id));
  };
  /* The stand-in: one per waker, the same object every call; live only while an opened HID device backs it. */
  const ck = clock || CLOCK;
  let dev = null, seq = 0, loop = null, cur = null, token = 0, hidBusy = null, hidOn = false, offs = [];
  const send = (s, w) => { const d = dev; if (!d) return; try { const r = d.sendReport(0x02, rumblePacket(seq++, s, w)); if (r && r.catch) r.catch(() => {}); } catch (_) {} };
  const settle = (how) => { const c = cur; cur = null; if (c) c.done(how); };
  const halt = (how) => { if (loop !== null) { ck.cancel(loop); loop = null; } settle(how); send(0, 0); };
  const tick = () => {
    if (!cur) return;
    const t = ck.now();
    if (t < cur.from) return;
    if (t >= cur.until) { halt("complete"); return; }
    send(cur.s, cur.w);
  };
  const stand = {
    type: "dual-rumble",
    effects: Object.freeze(["dual-rumble"]),
    playEffect(type, p) {
      if (type !== "dual-rumble") return Promise.reject(new TypeError("dual-rumble only"));
      const o = p || {}, t = ck.now(), me = ++token;
      settle("preempted"); // the older effect ends here; its own end can no longer cut this one
      return new Promise((done) => {
        cur = { me, done, s: +o.strongMagnitude || 0, w: +o.weakMagnitude || 0, from: t + Math.max(0, +o.startDelay || 0), until: t + Math.max(0, +o.startDelay || 0) + Math.max(0, +o.duration || 0) };
        if (loop === null) loop = ck.every(tick, EVERY_MS);
        tick();
      });
    },
    reset() { token++; halt("preempted"); return Promise.resolve("complete"); },
  };
  const isHid = (d) => isPad(d) && typeof d.sendReport === "function";
  const adopt = (d) => {
    if (!isHid(d) || dev === d) return Promise.resolve(!!dev);
    return Promise.resolve(d.opened ? null : d.open()).then(() => { dev = d; return true; }, () => false);
  };
  const hidListen = () => {
    if (hidOn || !hid) return;
    hidOn = true;
    const add = (o, t, f) => { if (o && typeof o.addEventListener === "function") { o.addEventListener(t, f); offs.push(() => o.removeEventListener(t, f)); } };
    add(hid, "disconnect", (e) => { if (e && e.device && e.device === dev) { halt("preempted"); dev = null; } });
    add(hid, "connect", (e) => { if (!dev && e && isHid(e.device)) adopt(e.device); }); // a replugged pad the player allowed comes back as a new device
    add(doc, "visibilitychange", () => { if (doc.hidden) halt("preempted"); });
    add(win, "pagehide", () => halt("preempted"));
  };
  /** Adopts a HID device the player allowed before (no chooser). */
  async function restore() {
    if (!hid) return false;
    hidListen();
    let list = [];
    try { list = (await hid.getDevices()).filter(isHid); } catch (_) {}
    for (const d of list) if (await adopt(d)) return true;
    return false;
  }
  /** The vibration chooser: call it inside the press's own handler, nothing awaited before it. "allowed", "cancelled", "blocked" or "failed". */
  function allow() {
    if (hidBusy) return hidBusy;
    if (!hid) return Promise.resolve("failed");
    hidListen();
    let ask;
    try { ask = hid.requestDevice({ filters: SW2_USB.map((productId) => ({ vendorId: SW2_VENDOR, productId })) }); } catch (e) { ask = Promise.reject(e); }
    hidBusy = Promise.resolve(ask)
      .then(
        (ds) => { const d = Array.from(ds || []).find(isHid); return d ? adopt(d).then((ok) => (ok ? "allowed" : "failed")) : "cancelled"; },
        (e) => (e && e.name === "SecurityError" ? "blocked" : "failed"),
      )
      .finally(() => { hidBusy = null; });
    return hidBusy;
  }
  const run = (device) => {
    st = "waking";
    return wake(device).then((r) => (st = r));
  };
  async function auto() {
    await restore();
    if (!onConnect) {
      onConnect = (e) => { if (isPad(e && e.device)) run(e.device); };
      usb.addEventListener("connect", onConnect);
    }
    if (playing()) return 0;
    let list = [];
    try { list = (await usb.getDevices()).filter(isPad); } catch (_) {}
    let n = 0;
    for (const d of list) if ((await run(d)) === "woken") n++;
    return n;
  }
  function request() {
    if (busy) return busy;
    st = "waking";
    busy = usb
      .requestDevice({ filters: SW2_USB.map((productId) => ({ vendorId: SW2_VENDOR, productId })) })
      .then(
        (d) => (d ? run(d) : (st = "cancelled")),
        (e) => (st = e && e.name === "NotFoundError" ? "cancelled" : e && e.name === "SecurityError" ? "blocked" : "failed"),
      )
      .finally(() => { busy = null; });
    return busy;
  }
  return {
    auto,
    request,
    state: () => st,
    allow,
    restore,
    /** The stand-in vibrationActuator while an allowed HID device is open, else null; with a pad g, null unless g is a Switch 2 Pro. */
    actuator: (g) => (dev && (g === undefined || (g && typeof g.id === "string" && SEEN.test(g.id))) ? stand : null),
    /** True where ALLOW VIBRATION is worth a press: WebHID here, no device allowed yet, a Switch 2 Pro in the pad list. */
    vibOffer: () => !!hid && !dev && playing(),
    stop() {
      if (onConnect) usb.removeEventListener("connect", onConnect);
      onConnect = null;
      if (dev) halt("preempted");
      for (const f of offs) f();
      offs = []; hidOn = false;
    },
  };
}
