// Rebind capture: the release check, then the arm delay.
import { BTN, MOVE_ORDER, keyName, refuseBtn, refuseKey } from "./controls.js";

const ARM_MS = 200, CANCELLED = "CANCELLED · NOTHING CHANGED", MOVE_SUB = "ARROWS STAY ON";
const nameOf = (dev, id) => (dev === "key" ? keyName(id) : BTN[id].w);

/** One capture at a time: no timeout, armed once all input is up for 200 ms; later MOVE steps and a retry after a refusal need only the release. */
export function createCapture() {
  let st = null, down = true, relT = null;
  const close = () => { st = null; };
  const relabel = () => {
    if (!st.moveCap) return;
    st.action = "MOVE · " + (st.step + 1) + " OF 4";
    st.prompt = "PRESS " + MOVE_ORDER[st.step];
    st.sub = MOVE_SUB;
    st.warn = 0;
  };
  const armed = (t) => !!st && !down && relT !== null && (st.opened || t - relT >= ARM_MS);
  const refuse = (line) => { st.sub = line; st.warn = 1; return { kind: "refused", line }; };
  return {
    /** Starts listening; the press that opened it counts as held until a tick sees it released. */
    open(spec, t) {
      const moveCap = spec.action === "MOVE" && spec.dev === "key";
      const now = moveCap ? "" : spec.curName || (spec.cur ? nameOf(spec.dev, spec.cur) : "");
      st = { id: spec.action, dev: spec.dev, cur: spec.cur, moveCap: moveCap ? 1 : 0, step: 0, set: [], now, warn: 0, action: spec.action,
        prompt: spec.dev === "key" ? "PRESS A KEY" : "PRESS A BUTTON", sub: now ? "NOW " + now : "" };
      relabel();
      down = true;
      relT = null;
    },
    /** Moves the arm clock: any input down restarts it, the first quiet tick starts it. */
    tick(t, anyDown) {
      if (!st) return;
      if (anyDown) { down = true; relT = null; }
      else if (down) { down = false; relT = t; }
    },
    /** Takes one press; every press but a cancel needs a release before the next one counts. */
    feed(kind, id, t) {
      if (!st) return { kind: "ignored" };
      if (kind === "key" ? id === "Escape" : id === "START") { close(); return { kind: "cancel", line: CANCELLED }; }
      if (kind === "btn" && (id === "LS" || id === "RS")) return st.dev === "key" ? { kind: "ignored" } : refuse(refuseBtn(id));
      const live = armed(t), mine = kind === (st.dev === "key" ? "key" : "btn");
      down = true;
      relT = null;
      if (!live || !mine) return { kind: "ignored" };
      if (st.moveCap) st.opened = true;
      const why = kind === "key" ? refuseKey(id) : refuseBtn(id);
      if (why) { st.opened = true; return refuse(why); }
      if (st.moveCap) {
        if (st.set.includes(id)) return refuse("ALREADY IN THIS MOVE SET");
        st.set.push(id);
        st.step++;
        if (st.step < 4) { relabel(); return { kind: "step", value: [...st.set] }; }
        const value = [...st.set];
        close();
        return { kind: "commit", value };
      }
      const same = id === st.cur;
      close();
      return same ? { kind: "commit", value: id, same: true, line: "NO CHANGE" } : { kind: "commit", value: id };
    },
    /** Closes without a result; the caller owns the status line. */
    cancel() { close(); },
    /** The plate's words, or null; word names the cancel input, by default the captured device's. */
    view(word) {
      if (!st) return null;
      const w = word || (st.dev === "key" ? "ESC" : "START");
      return { id: st.id, dev: st.dev, action: st.action, prompt: st.prompt, sub: st.sub, warn: st.warn, step: st.step, set: [...st.set], moveCap: st.moveCap,
        foot: w + " CANCELS" + (st.now ? " · " + st.now + " KEEPS IT" : "") };
    },
    /** True once a press would count. */
    armed,
  };
}
