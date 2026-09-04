/* BROWSER ENTRY — wires input → deterministic sim → renderer.
   Only module that runs the RAF loop. Also owns the app SHELL
   (BOOT→INTRO→MENU⇄subs→GAME, src/app/menuapp.js): the sim steps ONLY while
   the shell is in GAME; other screens render the frozen arena behind menu
   chrome (src/render/shellview.js). The sim never sees any of this. */
import { CFG } from "./core/config.js";
import { createWorld, loadLevel, step } from "./core/sim.js";
import { createRenderer } from "./render/renderer.js";
import { makeHud } from "./render/scenes.js";
import { paintBombPad } from "./render/sprites.js";
import { dims, drawShell, kindSize } from "./render/shellview.js";
import { SCREEN, SOURCE_URL, createMenuApp } from "./app/menuapp.js";
import { clampHeat } from "./core/heat.js";
import { clampPact } from "./core/pact.js";
import { createDemo, stepDemo } from "./app/attract.js";
import { readFlags, locationSearch } from "./app/flags.js";
import { mountToolbar, setBtn } from "./app/toolbar.js";
import { mountDebugHook } from "./app/debughook.js";
import { introPhase, INTRO_DUR } from "./app/intro.js";
import { loadScores, recordScore, saveScores, scoreEntry } from "./app/highscores.js";
import { loadPactUnlocked, savePactUnlocked } from "./app/pactstore.js";
import { loadPace, savePace } from "./app/pacestore.js";
import { clampPace } from "./core/pace.js";
import { registerSW } from "./pwa/register.js";
import { Input } from "./input.js";
import { mountTouch } from "./touch.js";
import {
  createCamera,
  resetCamera,
  mountCameraCtl,
  transform as camTransform,
} from "./render/cameraCtl.js";
import { createRig, resetOrbit, mountOrbitCtl } from "./render/three/camrig.js";
import { loadRenderer3D } from "./render/three/load.js";
import { createLocalPair } from "./net/localpair.js";

export function createGame(canvas, opts = {}) {
  registerSW();
  /* flags parsed ONCE (src/app/flags.js): ?render=3d selects the real-3D
     path, ?render=iso pins the legacy dimetric path, ?play=1 skips the shell,
     ?net=local arms the two-peer proof, ?orbit=1 opts into right-drag orbit
     (wheel/pinch dolly stays always-on), ?debug=1 opens the window hook. */
  const flags = readFlags(locationSearch(), opts);
  const urlKind = flags.urlKind,
    autoplay = flags.autoplay,
    orbitEn = flags.orbit;
  const dateStr = () => new Date().toISOString().slice(0, 10);

  // frozen backdrop world: created exactly as today but NEVER forced to
  // "MENU" — it simply is not stepped until a run starts (spec §7 edit 1)
  const world = createWorld(
    opts.seed != null ? opts.seed : (Math.random() * 1e9) >>> 0,
    1,
  );
  loadLevel(world, 1, false);
  world.state = "PLAY";

  let fit = null;
  if (canvas) {
    canvas.width = CFG.COLS * CFG.TILE;
    canvas.height = CFG.ROWS * CFG.TILE;
    fit = () => {
      if (typeof window === "undefined") return;
      const maxW = window.innerWidth - 40,
        maxH = window.innerHeight - 180;
      const s = Math.max(
        0.3,
        Math.min(maxW / canvas.width, maxH / canvas.height, 1.8),
      );
      canvas.style.width = canvas.width * s + "px";
      canvas.style.height = canvas.height * s + "px";
      const glEl =
        typeof document !== "undefined" && document.getElementById("gl");
      if (glEl) {
        glEl.style.width = canvas.style.width;
        glEl.style.height = canvas.style.height;
      }
    };
    fit();
    if (typeof window !== "undefined") window.addEventListener("resize", fit);
  }

  const input = new Input(opts.canvasEl || canvas);
  /* C1 seam guard: the anti-double-fire pointerdown swallow below registers
     on the RENDER canvas while Input's fire latch listens on opts.canvasEl.
     When they differ, taps on canvasEl latch fire with no swallow to eat
     them — confirms double-fire silently. Warn so hosts notice. */
  if (opts.canvasEl && opts.canvasEl !== canvas)
    console.warn(
      "[rollblock] opts.canvasEl differs from the render canvas:" +
        " menu pointer confirms will double-fire (C1 swallow is bound to the" +
        " render canvas only). Pass the same element to both.",
    );
  /* virtual pad: #stage children (never canvas listeners — C1 swallow intact);
     desktop/headless builds nothing, update() is a silent no-op there */
  const touch = mountTouch(
    input,
    typeof document !== "undefined" && document
      ? document.getElementById("stage")
      : null,
  );
  if (typeof document !== "undefined" && document)
    paintBombPad(document.getElementById("tbomb"));
  let prevSt = null;

  /* USER CAMERA (spec §1): render-side closure state, NEVER in world/snapshot.
     Handlers self-gate on GAME via getActive; menus/attract stay authored.
     real3d §4: 2D/iso keep cameraCtl pan/zoom (cameraCtl untouched); kind "3d"
     hands the rig to camrig orbit/dolly instead — mutually exclusive gates. */
  const cam = createCamera();
  const rig = createRig();
  if (canvas) {
    mountCameraCtl({
      canvas,
      input,
      cam,
      getActive: () => app.screen === SCREEN.GAME && effKind() !== "3d",
      getKind: () => (effKind() === "iso" ? "3d" : "2d"),
    });
    mountOrbitCtl({
      canvas,
      input,
      camrig: rig,
      getActive: () =>
        app.screen === SCREEN.GAME && effKind() === "3d" && orbitEn,
      getDolly: () => app.screen === SCREEN.GAME && effKind() === "3d",
    });
  }

  const net = flags.netLocal ? createLocalPair(world, input) : null;

  /* run handoff (menu START / LEVEL select): fresh board, score reset */
  const onStart = (args) => {
    world.heat = clampHeat(args && args.heat);
    world.pact = clampPact(args && args.pact);
    world.pace = clampPace(args && args.pace);
    loadLevel(world, args.level, false);
    world.score = 0;
    world.state = "PLAY";
    app.inGame = true;
    prevSt = "PLAY";
    resetCamera(cam); // §2: every run starts framed
    resetOrbit(rig);
    setBtn("btnPause", "Pause");
  };

  const audio = opts.audio || null;
  /* P1 (§0.4): the boot jingle must never schedule against a suspended ctx —
     currentTime is frozen there, so all 5 oscillators land on one timestamp
     and replay as a chord-blob on the first gesture. Fire immediately only if
     already unlocked; otherwise defer to the unlock handler below. */
  let fireJingle = () => {};
  const onSource = () => {
    if (typeof window !== "undefined")
      window.open(SOURCE_URL, "_blank", "noopener,noreferrer");
  };
  const app = createMenuApp({
    level: 1,
    sound: true,
    pactUnlocked: loadPactUnlocked(),
    pace: loadPace(),
    onPaceChange: (p) => savePace(p),
    render3d: urlKind === "3d" || opts.render3d === true,
    audio,
    autoplay,
    onStart,
    onSource,
  }); /* §5 cue sheet — wired HERE in the app layer, never in render/sim. Wrappers
     shadow the machine methods so every successful transition plays exactly
     one cue; RENDER/SOUND confirms get uiTog instead of uiSel, and subscreen
     confirm (= back()) is cued once by the back wrapper alone. */
  if (audio) {
    const m0 = app.move.bind(app),
      b0 = app.back.bind(app),
      c0 = app.confirm.bind(app);
    app.move = (d, axis) => {
      const r = m0(d, axis);
      if (r) audio.play("uiMove");
      return r;
    };
    app.back = () => {
      const r = b0();
      if (r) audio.play("uiBack");
      return r;
    };
    app.confirm = () => {
      const sB = app.screen,
        cB = app.cursor,
        r = c0();
      if (!r) return r;
      if (sB === SCREEN.MENU && (cB === 2 || cB === 3)) audio.play("uiTog");
      else if (
        sB !== SCREEN.HOWTO &&
        sB !== SCREEN.SCORES &&
        sB !== SCREEN.ITEMS &&
        sB !== SCREEN.ENEMIES
      )
        audio.play("uiSel");
      return r;
    };
    fireJingle = () => {
      if (autoplay || fireJingle._done) return;
      fireJingle._done = true;
      audio.play("uiJingle");
    };
    if (audio.unlocked && audio.unlocked()) fireJingle();
  }
  if (autoplay) app.startRun();

  /* app.update() contract adapter over the live Input (held axes + fire) */
  const shellInput = {
    get input() {
      return input.input;
    },
    get confirmHeld() {
      return input._intent.fire;
    },
  };
  /* high-score persist through the guarded default store (§6) */
  const persistScore = () => {
    if (!(world.score > 0)) return;
    saveScores(recordScore(loadScores(), scoreEntry(world, dateStr())));
  };
  /* UI key side-channel: ALWAYS routed to the shell; M-in-PAUSE records the
     score then quits to MENU (spec §4 table). Machine self-gates elsewhere. */
  input.onUiKey = (code) => {
    if (code === "KeyR") {
      if (app.screen === SCREEN.GAME) {
        resetCamera(cam); // §2 reset, GAME only
        resetOrbit(rig); // real3d §4: 3D rig resets too
      }
      return;
    }
    if (code === "KeyM") {
      if (app.screen === SCREEN.GAME && app.worldState === "PAUSE") {
        persistScore();
        app.quitToMenu("PAUSE");
        if (world.state === "PAUSE") world.state = "PLAY"; // drop PAUSE overlay
        setBtn("btnPause", "Pause");
        prevSt = null;
      }
      return;
    }
    app.key(code);
  };

  const onPause = () => {
    if (app.screen !== SCREEN.GAME) return; // I2: pause exists only inside GAME;
    // outside it the world is a frozen backdrop and PAUSE would ghost-render
    if (world.state === "PLAY") {
      world.state = "PAUSE";
      setBtn("btnPause", "Resume");
    } else if (world.state === "PAUSE") {
      world.state = "PLAY";
      setBtn("btnPause", "Pause");
    }
  };
  input.onPause = onPause;

  /* pointer outside GAME = skip (INTRO) / confirm (menus) / exit ATTRACT.
     C1 single-fire: Input's fire latch listens on the SAME event (registered
     first, in the constructor), so swallow it here — otherwise the latched
     intent.fire re-enters as a rising-edge confirm on the next frame
     (auto-start after skip, toggles bouncing back, subscreens bouncing). */
  if (canvas) {
    canvas.addEventListener("pointerdown", () => {
      if (app.screen === SCREEN.GAME) return;
      input._intent.fire = false;
      if (app.screen === SCREEN.ATTRACT) {
        app.exitAttract();
        return;
      }
      if (app.screen === SCREEN.INTRO) app.skip();
      else app.confirm();
    });
  }
  /* pad taps bubble to #stage: exit ATTRACT too (spec §4 exit triggers).
     Toolbar buttons are NOT inside #stage — they unlock but never exit. */
  {
    const stageEl =
      typeof document !== "undefined" && document
        ? document.getElementById("stage")
        : null;
    if (stageEl)
      stageEl.addEventListener("pointerdown", () => {
        if (app.screen === SCREEN.ATTRACT) app.exitAttract();
      });
  }

  /* music unlock (spec §4): first gesture anywhere unlocks the loop.
     Window-level {once:true} catches canvas AND #stage pad taps; a toolbar
     button press also unlocks without exiting attract. */
  if (typeof window !== "undefined" && audio) {
    const unlockOnce = () => {
      audio.unlock();
      fireJingle();
    }; // P1: deferred jingle
    window.addEventListener("keydown", unlockOnce, { once: true });
    window.addEventListener("pointerdown", unlockOnce, { once: true });
  }

  /* ATTRACT demo world handle (src/app/attract.js): the shell machine only
     flips screens, the loop below creates/steps/discards the demo. */
  let demo = null;

  /* renderer cache per kind, lazily built. Tri-state (real3d §1/§7):
     "2d" classic (default, byte-identical), "3d" real-3D wrapper on the
     dual canvas (#gl under #c), "iso" legacy dimetric pinned by ?render=iso
     (menu toggle flips app.render3d between 3d/2d only). */
  const glCanvas =
    typeof document !== "undefined" && document
      ? document.getElementById("gl")
      : null;
  const rcache = {};
  function effKind() {
    if (urlKind === "iso") return "iso";
    return app.render3d ? "3d" : "2d";
  }
  let curKind = effKind();
  /* overlay #c keeps the CLASSIC space for 2d/3d; iso needs its projected
     dims. #gl is sized to the logical box (DPR handled in the wrapper) and
     [hidden]-toggled to kind "3d". */
  /* #c's 2D context must be alpha-capable: canvas contexts are first-call-
     wins, and the classic renderer requests {alpha:false}. If IT claims the
     context first, the 3D overlay later gets that same opaque context and
     clearRect composites as opaque black over #gl (black-screen bug). */
  if (canvas && canvas.getContext) canvas.getContext("2d", { alpha: true });
  function sizeCanvases(kind) {
    const { w, h } = kindSize(kind);
    if (canvas) {
      canvas.width = w;
      canvas.height = h;
    }
    if (glCanvas) {
      glCanvas.hidden = kind !== "3d";
    }
    if (fit) fit();
  }
  let createRenderer3D = opts.createRenderer3D || null;
  let threeP = null;
  function getRenderer(kind) {
    sizeCanvases(kind);
    if (rcache[kind]) return rcache[kind];
    if (kind === "3d" && !createRenderer3D) {
      if (!threeP)
        threeP = loadRenderer3D().then((m) => {
          createRenderer3D = m.createRenderer3D;
          if (effKind() === "3d") renderer = getRenderer("3d");
        });
      return rcache["2d"] || getRenderer("2d");
    }
    try {
      const hud =
        opts.hud || makeHud(typeof document !== "undefined" ? document : null);
      rcache[kind] =
        kind === "3d"
          ? createRenderer3D(glCanvas, canvas, {
              audio: opts.audio || null,
              hud,
              rig,
            })
          : createRenderer(canvas, { kind, audio: opts.audio || null, hud });
    } catch (e) {
      console.warn("renderer init failed", e);
      rcache[kind] = {
        ctx: { save() {}, restore() {}, translate() {}, scale() {} },
        render() {},
        consumeEvents() {},
      };
    }
    return rcache[kind];
  }
  if ((urlKind === "3d" || opts.render3d) && !createRenderer3D)
    loadRenderer3D().then((m) => {
      createRenderer3D = m.createRenderer3D;
      renderer = getRenderer("3d");
    });
  let renderer = getRenderer(curKind);

  let last = null,
    acc = 0,
    running = true;
  function loop(t) {
    if (last == null) last = t;
    let dt = (t - last) / 1000;
    last = t;
    dt = Math.min(dt, 0.25);
    const k = effKind();
    if (k !== curKind) {
      curKind = k;
      renderer = getRenderer(k);
    } // live RENDER toggle: cache swap
    touch.update(app.screen === SCREEN.GAME); // pad lives only inside GAME
    // §4 ducking: frame-polled, idempotent, self-heals across transitions
    if (audio) {
      audio.duck(app.screen === SCREEN.GAME && audio.unlocked());
      if (audio.setTrack) {
        const lvl =
          app.screen === SCREEN.ATTRACT && demo && demo.world
            ? demo.world.level
            : world.level;
        audio.setTrack(audio.cue ? audio.cue(app.screen, lvl) : "menu");
      }
      audio.pump();
    }
    if (app.screen === SCREEN.GAME) {
      // §1 score-record edge, frame-polled (main latches prev world state)
      if (app.noteWorldEdge(prevSt, world.state))
        saveScores(recordScore(loadScores(), scoreEntry(world, dateStr())));
      prevSt = world.state;
      acc += dt;
      let steps = 0;
      while (acc >= CFG.STEP) {
        if (net) net.drive();
        else {
          const it = input.intent();
          step(world, CFG.STEP, { 0: it });
          input.advance();
        }
        acc -= CFG.STEP;
        steps++;
        if (steps > 6) {
          acc = 0;
          break;
        } // hard cap (anti spiral-of-death)
      }
      if (world.finale && world.state === "MENU") {
        persistScore();
        savePactUnlocked();
        app.pactUnlocked = true;
        app.toMenu();
        world.finale = false;
        setBtn("btnPause", "Pause");
        prevSt = null;
      }
    } else {
      app.update(dt, shellInput);
      // §1: INTRO→MENU at t>=INTRO_DUR — same skip() path as a user keypress,
      // so the 0.25s MENU-entry fade fires identically
      if (app.screen === SCREEN.INTRO && app.subT >= INTRO_DUR) app.skip();
      acc = 0;
    }
    // ATTRACT: re-read the screen AFTER app.update — the machine may have
    // entered/exited mid-frame; create/step or discard the demo accordingly
    const attract = app.screen === SCREEN.ATTRACT;
    if (attract) {
      if (!demo) demo = createDemo();
      stepDemo(demo, dt);
    } else if (demo) demo = null;
    // render: INTRO flyover transform wraps the ARENA draw only (zoom>=1 so
    // no edge gaps); camX/camY are canvas fractions. ATTRACT renders the DEMO
    // world with HUD suppressed; every other screen renders the frozen live
    // world exactly as before. real3d S3: in kind "3d" INTRO rides o.intro —
    // the wrapper's flythrough owns the WebGL camera instead.
    const c = renderer.ctx || {
      save() {},
      restore() {},
      translate() {},
      scale() {},
    };
    c.save();
    // real3d §7: INTRO flyover + user camTransform ride ONLY non-3d kinds —
    // in "3d" the orbit rig/flythrough own the WebGL camera (S3).
    if (curKind !== "3d" && app.screen === SCREEN.INTRO) {
      const ph = introPhase(app.subT);
      const { cw, ch } = dims(canvas, curKind);
      c.translate(cw / 2, ch / 2);
      c.scale(ph.zoom, ph.zoom);
      c.translate(-ph.camX * cw, -ph.camY * ch);
    }
    // §1: user camera rides ONLY the GAME branch (same outer-transform
    // pattern as the flyover, but persistent + user-driven); menu/intro/
    // attract keep their authored framing untouched.
    if (curKind !== "3d" && app.screen === SCREEN.GAME) {
      const { cw, ch } = dims(canvas, curKind);
      camTransform(c, cw, ch, cam);
    }
    renderer.render(
      attract && demo ? demo.world : world,
      dt,
      attract
        ? { hud: false }
        : app.screen === SCREEN.INTRO && curKind === "3d"
          ? { intro: app.subT }
          : app.screen === SCREEN.GAME
            ? { hud: true } // S4 overlay HUD chips
            : undefined,
    );
    c.restore();
    drawShell(c, app, world, canvas, curKind, loadScores);
    if (running && typeof requestAnimationFrame !== "undefined")
      requestAnimationFrame(loop);
  }

  // UI buttons (src/app/toolbar.js owns the DOM, main owns every decision)
  mountToolbar({
    inGame: () => app.screen === SCREEN.GAME,
    onPause,
    onSound: () => {
      const on = opts.audio && opts.audio.toggle && opts.audio.toggle();
      app.sound = !!on;
      if (audio) audio.play("uiTog"); // §5 tog cue on the button toggle too
      return on;
    },
    onRestart: () => {
      loadLevel(world, 1, false);
      world.state = "PLAY";
      setBtn("btnPause", "Pause");
      prevSt = "PLAY";
    },
    // quit-to-menu riding KeyM's exact record path (persist-if->0, machine
    // M-quit, PAUSE-overlay drop, label reset)
    onMenu: () => {
      persistScore();
      app.quitToMenu("PAUSE");
      if (world.state === "PAUSE") world.state = "PLAY";
      setBtn("btnPause", "Pause");
      prevSt = null;
    },
  });

  // debug/test hook (browser only; opt-in via opts.debug or ?debug=1)
  if (flags.debug)
    mountDebugHook({
      world,
      input,
      app,
      audio,
      net,
      cam,
      canvas,
      onPause,
      renderer: () => renderer,
      demo: () => demo,
    });

  // boot
  if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(loop);
  return {
    world,
    input,
    get renderer() {
      return renderer;
    }, // live ref: RENDER toggle swaps it
    app,
    net,
    loop,
    get cam() {
      return cam;
    }, // read-only ref for tests (spec §4.3)
    get rig() {
      return rig;
    }, // read-only 3D rig ref for tests
    get demo() {
      return demo;
    }, // read-only for tests (spec §5.4)
    stop() {
      running = false;
    },
    start() {
      running = true;
      if (typeof requestAnimationFrame !== "undefined")
        requestAnimationFrame(loop);
    },
    setBtn,
  };
}
