import { createWorld, loadLevel } from "../src/core/sim.js";
import { applyPower, POWER } from "../src/core/entities.js";
import { CFG } from "../src/core/config.js";
import { createAudio } from "../src/audio.js";
import * as audioMod from "../src/audio.js";
import { drawIcon, paintItemFace } from "../src/render/sprites.js";
import { createRenderer } from "../src/render/renderer.js";
import { initFx, onEvent, getFx } from "../src/render/fx.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}

const IDS = [
  "fire",
  "bomb",
  "speed",
  "heart",
  "shield",
  "kick",
  "throw",
  "pass",
  "line",
  "power",
  "pierce",
  "remote",
];

const APPLY = {
  fire: (w, p) => p.range === 2,
  bomb: (w, p) => p.bombs === 2,
  speed: (w, p) => p.speed === CFG.PLAYER_START.speed + CFG.SPEED_UP,
  heart: (w) => w.lives === CFG.PLAYER_START.lives + 1,
  shield: (w, p) => p.shield === true,
  kick: (w, p) => p.kick === true,
  throw: (w, p) => p.throw === true,
  pass: (w, p) => p.passing === true,
  line: (w, p) => p.bombKind === "line",
  power: (w, p) => p.bombKind === "power",
  pierce: (w, p) => p.bombKind === "pierce",
  remote: (w, p) => p.remote === true,
};

{
  check(
    "POWER catalog is 12 named pickups",
    POWER.length === 12 &&
      POWER.every(
        (d) => d.t && d.name && d.help && typeof d.apply === "function",
      ),
    POWER.map((d) => d.t).join(","),
  );
  check(
    "POWER ids stay the 12 icon keys",
    POWER.map((d) => d.t).join(",") === IDS.join(","),
    POWER.map((d) => d.t).join(","),
  );
  const cols = POWER.map((d) => d.col);
  check(
    "POWER colors are unique hexes",
    cols.length === 12 &&
      cols.every((c) => /^#[0-9a-f]{6}$/i.test(c)) &&
      new Set(cols).size === 12,
    cols.join(","),
  );
  check(
    "FLAME / PIERCE keep pinned hexes",
    POWER.find((d) => d.t === "fire").col === "#ff8a3c" &&
      POWER.find((d) => d.t === "pierce").col === "#8f8fff",
  );
  for (const t of IDS) {
    const w = createWorld(1, 1);
    const p = w.players[0];
    p.range = 1;
    p.bombs = 1;
    p.speed = CFG.PLAYER_START.speed;
    w.lives = CFG.PLAYER_START.lives;
    const def = POWER.find((d) => d.t === t);
    applyPower(w, def, p.x, p.y);
    check("apply " + t + " unchanged", !!def && APPLY[t](w, p), t);
    const ev = w.events.find((e) => e.t === "power");
    check(
      "applyPower event keeps t=power + kind=" + t,
      !!ev && ev.kind === t && ev.col === def.col,
      ev ? JSON.stringify(ev) : "missing",
    );
  }
}

{
  const sfxOf = audioMod.sfxOf;
  check("sfxOf exported", typeof sfxOf === "function");
  if (typeof sfxOf === "function") {
    check(
      "sfxOf routes power+kind to item_*",
      sfxOf({ t: "power", kind: "heart" }) === "item_heart",
    );
    check(
      "sfxOf leaves action names alone",
      sfxOf({ t: "kick" }) === "kick" && sfxOf({ t: "power" }) === "power",
    );
  }
  const itemOf = audioMod.itemOf;
  const CUE = audioMod.ITEM_CUE;
  check("ITEM_CUE covers 12 kinds", !!CUE && IDS.every((t) => CUE[t]));
  if (typeof itemOf === "function" && CUE) {
    const f0s = IDS.map((t) => itemOf(t).f0);
    check(
      "itemOf f0 is unique per kind",
      f0s.every((f) => typeof f === "number") && new Set(f0s).size === 12,
      f0s.join(","),
    );
    check(
      "item cues stay <=200ms",
      IDS.every((t) => {
        const c = itemOf(t);
        return (c.dur || 0) + (c.when || 0) <= 0.2;
      }),
    );
    const kick = itemOf("kick"),
      thrw = itemOf("throw");
    check(
      "item KICK is a down-slap, THROW is a rising whoosh",
      kick.osc === "sine" &&
        thrw.osc === "sawtooth" &&
        kick.f1 < kick.f0 &&
        thrw.f1 > thrw.f0 &&
        kick.f0 < 220 &&
        thrw.f0 > 380,
    );
    const bomb = itemOf("bomb"),
      pwr = itemOf("power");
    check(
      "item BOMB is a low thunk, POWER is a pip sting",
      bomb.f0 < 250 &&
        !bomb.pip &&
        pwr.f0 > 500 &&
        !!pwr.pip &&
        pwr.pip > pwr.f0,
    );
  }
}

{
  initFx();
  onEvent(
    { seed: 1, level: 1 },
    { t: "power", x: 100, y: 120, col: "#ff3b5c", kind: "heart" },
  );
  const parts = getFx();
  check(
    "power grab emits a burst, not a blink",
    parts.length >= 18,
    String(parts.length),
  );
  check(
    "power grab includes streaks",
    parts.some((p) => p.streak),
    parts.filter((p) => p.streak).length,
  );
  check(
    "power grab keeps the pickup color",
    parts.some((p) => p.color === "#ff3b5c"),
  );
  initFx();
  onEvent({ seed: 1, level: 1 }, { t: "kick", x: 0, y: 0 });
  check(
    "kick action FX still speaks",
    getFx().length >= 8,
    String(getFx().length),
  );
}

{
  function auto(v0) {
    return {
      value: v0 || 0,
      setValueAtTime(v) {
        if (this._f0 == null) this._f0 = v;
        this.value = v;
      },
      exponentialRampToValueAtTime(v) {
        this.value = v;
      },
    };
  }
  const ac = {
    currentTime: 0,
    state: "running",
    sampleRate: 44100,
    destination: { name: "dest" },
    starts: [],
    createOscillator() {
      const o = {
        type: "",
        frequency: auto(0),
        connect() {},
        start() {
          ac.starts.push({
            f: o.frequency.value,
            f0: o.frequency._f0 != null ? o.frequency._f0 : o.frequency.value,
            type: o.type,
          });
        },
        stop() {},
      };
      return o;
    },
    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: auto(350),
        Q: { value: 1 },
        connect() {},
      };
    },
    createBuffer() {
      return { getChannelData() {
        return new Float32Array(8);
      } };
    },
    createBufferSource() {
      return {
        buffer: null,
        connect() {},
        start() {
          ac.starts.push({ type: "noise", f: 0 });
        },
        stop() {},
      };
    },
    createGain() {
      return {
        gain: {
          value: 0,
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    },
    resume() {},
  };
  class FakeAC {
    constructor() {
      return ac;
    }
  }
  globalThis.window = { AudioContext: FakeAC };
  const a = createAudio();
  a.unlock();
  ac.starts.length = 0;
  a.play("power");
  check("play(power) still speaks", ac.starts.length >= 2, String(ac.starts.length));
  ac.starts.length = 0;
  a.play("item_fire");
  const fire = ac.starts.filter((s) => s.type !== "noise").map((s) => s.f0);
  ac.starts.length = 0;
  a.play("item_heart");
  const heart = ac.starts.filter((s) => s.type !== "noise").map((s) => s.f0);
  check(
    "grab-FLAME ≠ grab-HEART",
    fire.length >= 1 &&
      heart.length >= 1 &&
      fire.join(",") !== heart.join(","),
    fire.join(",") + " vs " + heart.join(","),
  );
  let threw = false;
  try {
    IDS.forEach((t) => a.play("item_" + t));
  } catch (e) {
    threw = true;
  }
  check("item_* SFX names no-throw", !threw);
}

{
  const plays = [];
  const r = createRenderer(null, { audio: { play: (n) => plays.push(n) } });
  const w = createWorld(5, 1);
  loadLevel(w, 1, false);
  w.events.push({ t: "power", x: 0, y: 0, col: "#ff3b5c", kind: "heart" });
  r.render(w, 1 / 60);
  check(
    "renderer plays item_heart for power+kind",
    plays.join() === "item_heart",
    plays.join(),
  );
  plays.length = 0;
  w.events.push({ t: "boom", x: 0, y: 0 });
  r.render(w, 1 / 60);
  check("renderer still plays action names", plays.join() === "boom");
}

{
  function stub() {
    const ops = [];
    const c = {
      _ops: ops,
      save() {
        ops.push("save");
      },
      restore() {
        ops.push("restore");
      },
      translate() {
        ops.push("translate");
      },
      scale() {
        ops.push("scale");
      },
      beginPath() {
        ops.push("beginPath");
      },
      closePath() {
        ops.push("closePath");
      },
      moveTo(x, y) {
        ops.push(["m", +x.toFixed(2), +y.toFixed(2)]);
      },
      lineTo(x, y) {
        ops.push(["l", +x.toFixed(2), +y.toFixed(2)]);
      },
      quadraticCurveTo() {
        ops.push("quad");
      },
      bezierCurveTo() {
        ops.push("bez");
      },
      arc() {
        ops.push("arc");
      },
      arcTo() {
        ops.push("arcTo");
      },
      fill() {
        ops.push("fill");
      },
      stroke() {
        ops.push("stroke");
      },
      fillRect() {
        ops.push("fillRect");
      },
      rect() {
        ops.push("rect");
      },
      fillText() {
        ops.push("fillText");
      },
      setLineDash(d) {
        ops.push(["dash", d && d.length]);
      },
    };
    return new Proxy(c, {
      set(t, p, v) {
        if (typeof p !== "symbol") t._ops.push("set:" + String(p));
        t[p] = v;
        return true;
      },
    });
  }
  const sigs = {};
  for (const t of IDS) {
    const c = stub();
    drawIcon(c, t, "#ffffff", 0);
    const paints = c._ops.filter(
      (o) =>
        o === "fill" ||
        o === "stroke" ||
        o === "fillRect" ||
        o === "beginPath" ||
        o === "arc",
    ).length;
    check("drawIcon paints " + t, paints >= 3, String(paints));
    sigs[t] = JSON.stringify(c._ops);
  }
  let distinct = true;
  for (let i = 0; i < IDS.length; i++)
    for (let j = i + 1; j < IDS.length; j++)
      if (sigs[IDS[i]] === sigs[IDS[j]]) distinct = false;
  check("drawIcon silhouettes are distinct", distinct);
  const sh = stub();
  drawIcon(sh, "shield", "#6fb7ff", 0);
  check(
    "SHIELD has no letter glyph",
    !sh._ops.includes("fillText"),
    sh._ops.filter((o) => o === "fillText").length,
  );
  const faceSigs = {};
  for (const t of IDS) {
    const c = stub();
    paintItemFace(c, t, "#ffffff");
    const paints = c._ops.filter(
      (o) =>
        o === "fill" ||
        o === "stroke" ||
        o === "fillRect" ||
        o === "beginPath",
    ).length;
    check("paintItemFace paints " + t, paints >= 4, String(paints));
    faceSigs[t] = JSON.stringify(c._ops);
  }
  let faceDistinct = true;
  for (let i = 0; i < IDS.length; i++)
    for (let j = i + 1; j < IDS.length; j++)
      if (faceSigs[IDS[i]] === faceSigs[IDS[j]]) faceDistinct = false;
  check("paintItemFace silhouettes are distinct", faceDistinct);
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
