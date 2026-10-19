# Contributing to FUSE/GRID

> **PLAYER 2 HAS ENTERED THE GAME.** Welcome to the cabinet's back panel.

Fusegrid is a small indie arcade game, built in the open and MIT-licensed. Bug
reports, playtest notes, fixes and ideas are all welcome. This page is the
**one place** that explains how to set up, test and send a change. The
architecture lives in [docs/architecture.md](docs/architecture.md), and the full
rulebook lives in [AGENTS.md](AGENTS.md). This page links to them rather than
repeating them.

- [Quick start](#-quick-start-two-minutes-to-play)
- [House rules](#-house-rules)
- [URL flags](#-url-flags-the-cheat-codes)
- [Tests](#-tests)
- [Sending a change](#-sending-a-change)
- [Shipping a release](#-shipping-a-release)
- [Bugs and ideas](#-bugs-and-ideas)

---

## 🚀 Quick start: two minutes to play

You need **Node.js 26** and nothing else. There's no `npm install`, because
there are no npm dependencies to install.

```bash
git clone https://github.com/HMarzban/fusegrid.git rollblock
```

```bash
npm start
```

Open `http://127.0.0.1:8080/index.html` and press any key.

`serve.js` binds **loopback only**, on purpose. If you run several checkouts
or agents side by side, give each one its own port:

```bash
PORT=0 node serve.js
```

The port it picked is printed on boot. When you're done, stop **your** server
by its PID. Never `pkill -f "node serve.js"`, because that also kills
everyone else's.

---

## 📏 House rules

These are the load-bearing walls. A change that breaks one won't merge, and most
of them are enforced by a test. The full list, with the reasons and dated
rulings, is in [AGENTS.md](AGENTS.md).

1. **Zero npm runtime dependencies, no build step.** Plain ES modules,
   `"type": "module"`. Vendored render libraries (Three.js r160 in `vendor/`)
   are fine.
2. **The sim is deterministic.** `step(world, dt, intents)` in `src/core/` uses
   no time, no DOM and no `Math.random`; randomness comes from
   `src/core/rng.js`. Same seed plus same inputs means same outcome, in Node
   and in the browser.
3. **No DOM in `src/core/`.** Renderers read the world; they never change the
   rules.
4. **`CFG` is frozen.** Tune the `world`, not the config.
5. **Single-player.** The `?net=local` lockstep harness is a two-world proof,
   not internet play. Don't call it multiplayer.
6. **One source for every string.** Pickup names and help text come from the
   game's `POWER` table; never write a second copy.
7. **Fusegrid stands on its own name.** Never write the name of the classic
   grid-bomb franchise this game is compared to into any committed file:
   code, comments, docs, commit messages or alt text. A tree-wide test
   (`tests/banned-name.test.mjs`) enforces it.
8. **Honest numbers, no rivalry.** Fusegrid ranks you against your own past
   runs only. There is no global board, and the word for one is refused in
   `src/` and `tests/`. DAILY is honour-system and single-device. A challenge
   code shares a board, never a score.
9. **Match the style around you.** Compact code, no comments unless the file
   already uses explanatory block comments.

---

## 🎮 URL flags: the cheat codes

Append these to `index.html` (local) or the Pages URL.

| Flag | What it does |
|---|---|
| `?render=3d` | Boot in REAL 3D (seeds the boot only) |
| `?render=px` | Boot in PIXEL (seeds the boot only) |
| `?render=iso` | Legacy dimetric renderer, pinned for the session |
| `?play=1` | Skip the intro, straight into a run |
| `?code=XXXXXXXXXXXX` | Play the board behind a 12-character challenge code |
| `?orbit=1` | Orbit camera (3D) |
| `?net=local` | Local lockstep harness (a 1P proof, not multiplayer) |
| `?debug=1` | Debug overlay, plus `window.__GAME__` for scripted checks |
| `?embed=1` | Never register the service worker (for iframe hosts) |

**Testing Pact without clearing room 5?** In the devtools console run
`localStorage.setItem('nb.pact.v1','1')`, then reload LEVEL SELECT.

---

## 🧪 Tests

```bash
npm test
```

That's `node --test` over `tests/*.test.mjs`, and it's the same gate CI runs on
every pull request and before every GitHub Pages deploy.

- **New key or new screen?** Add it to the key matrix in
  `tests/keys.test.mjs`. It drives every documented key through the real
  keydown/keyup listeners in every state.
- **Contracts are ABI.** Child-index and draw-call pins in
  `tests/three.test.mjs` (budget ≤500 draws, the fat world sits at 141) are
  not to be "flexed" in a drive-by.
- **Node can't see pixels.** After a render change, play it in a browser:
  CLASSIC 2D, PIXEL and REAL 3D. For PIXEL, `tools/pixel/shot.mjs` captures
  laptop and phone views.
- **Stale service worker?** It serves old bytes and looks exactly like a
  change that didn't land. Unregister the SW and clear its caches before you
  trust a screenshot. `localhost` and `127.0.0.1` are separate origins, so
  clean both.
- **Frame-rate or CPU claims** need headed, real-GPU Chrome. Never measure
  them through a rAF shim or a software renderer.

---

## 🔧 Sending a change

1. **Branch off `main`.** Keep each pull request to one idea.
2. **Make it, then run `npm test`.** Everything passes, nothing skipped.
3. **Update the doc that owns the fact you changed, and only that one.** The
   [docs map](docs/README.md#-who-owns-what) says which doc owns which fact.
   Changed a control? That's README's *How to play*. Added a flag? That's this
   page. Changed how a system works? That's `docs/architecture.md`.
4. **Player-facing change?** Add a line under **Unreleased** in
   [CHANGELOG.md](CHANGELOG.md), written for players.
5. **Write the commit like the log does:** one plain sentence that names the
   area and the change, such as `Docs sync: PIXEL, pickup feedback, GRAPHICS
   settings (v178)` or `Close-out review fix: FRAME RATE and BATTERY take
   effect on 180 Hz and 200 Hz panels`.
6. **Open the pull request** and fill in the template. Say what you
   play-tested and in which looks.

Never commit `.cursor/` or `e2e-artifacts/` (both are gitignored).

---

## 📦 Shipping a release

A release is a new **shell revision**. That's what makes an installed copy
update.

1. Bump `CACHE_NAME` in `src/pwa/shell.js` **and** `REV` in `sw.js` together
   (for example `fusegrid-shell-v178` → `v179`). A mismatch throws on purpose.
2. If you added a shipped file (especially anything under
   `src/render/pixel/` or `vendor/`), make sure it's in the precache list in
   `src/pwa/shell.js`, or that look breaks offline.
3. Rename the changelog's **Unreleased** section to `## shell vN · YYYY-MM-DD`
   and start a fresh, empty **Unreleased** above it.
4. Set `<lastmod>` in `sitemap.xml` to the same date. Search engines only
   trust a `lastmod` that's accurate, and a test fails if it's older than the
   newest release.
5. Merging to `main` runs the tests, then deploys GitHub Pages.

---

## 🐛 Bugs and ideas

Use the issue templates: **Bug report** or **Idea**. The best bug reports say
which look (CLASSIC 2D, PIXEL or REAL 3D), which device and browser, which
room and Heat, and what you pressed. A challenge code (`B` on the end screen)
lets anyone replay the exact board.

Found a security problem? Don't open a public issue. Follow
[SECURITY.md](SECURITY.md) instead.

Everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md).

**Thanks for playing, and for building.** 💣
