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

/** The waker: auto() for pads already granted and plugged in later, request() for the chooser (call it inside the press's own handler). */
export function createWaker({ usb, pads }) {
  let st = "idle", busy = null, onConnect = null;
  const playing = () => {
    let list = [];
    try { list = Array.from((pads && pads()) || []); } catch (_) {}
    return list.some((g) => g && g.connected !== false && typeof g.id === "string" && SEEN.test(g.id));
  };
  const run = (device) => {
    st = "waking";
    return wake(device).then((r) => (st = r));
  };
  async function auto() {
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
    stop() { if (onConnect) usb.removeEventListener("connect", onConnect); onConnect = null; },
  };
}
