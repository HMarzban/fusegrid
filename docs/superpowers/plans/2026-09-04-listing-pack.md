# Listing Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** itch / Newgrounds / Game Jolt can be listed with honest art, and an iframe embed does not steal the service worker.

**Architecture:** Committed `media/` stills (not `e2e-artifacts/`). Cover 630×500 cropped from the live `og.png` hero. Short GIF from a headed JUNGLE blast. `registerSW` no-ops in iframes and `?embed=1`. Zip recipe is a doc snippet, not a new npm script.

**Tech Stack:** Existing capture path, `node --test` for SW policy, no npm image libs.

## Global Constraints

- Never generate key art. Hero is a real 3D board (same lock as `og.png`).
- Do not commit `e2e-artifacts/`. Curate into `media/`.
- Do not cache `og.png` or `media/` in the PWA shell.
- Tags: `arcade`, `singleplayer`, `webgl`, `chiptune` — never the other grid-bomb franchise.
- Play URL with trailing slash.

---

### Task 1: Skip SW in embeds

**Files:**
- Modify: `src/pwa/register.js`
- Test: `tests/pwa.test.mjs`

**Interfaces:**
- `isEmbedded(env) → boolean`
- `registerSW(env) → false` when embedded

- [ ] **Step 1: Failing tests**

```js
check(
  "registerSW skips iframe",
  registerSW({
    href: "https://hmarzban.github.io/fusegrid/",
    navigator: { serviceWorker: { register() {}, addEventListener() {} } },
    top: { mark: 1 },
    self: { mark: 2 },
  }) === false,
);
check(
  "registerSW skips ?embed=1",
  registerSW({
    href: "https://hmarzban.github.io/fusegrid/?embed=1",
    navigator: { serviceWorker: { register() {}, addEventListener() {} } },
    top: null,
    self: null,
  }) === false,
);
```

- [ ] **Step 2: FAIL**
- [ ] **Step 3:** `isEmbedded` = `top !== self` OR `/[?&]embed=1(?:&|$)/` on href. Call before `register`.
- [ ] **Step 4:** Pages path (`top===self`, no flag) still registers
- [ ] **Step 5:** PWA bump (`register.js` precached), commit

---

### Task 2: media/ pack

**Files:**
- Create: `media/README.md`, `media/cover-630x500.png`, optional `media/banner-1280x320.png`, `media/thumb-16x9.png`, stills (jungle/ice/crown/menu), `media/play.gif` (3–8s, ≤3 MB)
- Modify: `README.md` — point listing art at `media/`
- Test: `tests/media.test.mjs` — cover IHDR 630×500 via existing `pngWH`

- [ ] **Step 1:** Headed capture on loopback, unregister SW first, `scene.background=null` if compositing
- [ ] **Step 2:** Crop from the live board — do not invent pixels. NG crop: title-safe center on the board
- [ ] **Step 3:** Pin cover 630×500
- [ ] **Step 4:** `media/README.md` zip recipe (omit tests, docs, .git, media, og.png)
- [ ] **Step 5:** MEMORY, commit images (never `e2e-artifacts/`)

itch blurb (paste, not code):

```
Play Fusegrid in the browser — a single-player bomb-grid arcade.
Flip REAL 3D ⇄ CLASSIC 2D. Heat CORE / PLUS / MAX.

WASD / arrows move · Space bomb · P pause
Shift+Space throw · Q remote · K+move kick (need pickups)

https://hmarzban.github.io/fusegrid/
```
