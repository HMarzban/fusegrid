# The promotion kit

> **NOW BOARDING: PLAYER 2.** Everything you need to tell the world Fusegrid
> exists: what to say, where to say it, and the order to say it in.

This page owns Fusegrid's **pitch copy, platform tags, launch checklist and
the GitHub About text**. Listing art, the itch blurb and the upload zip
recipe stay in [media/README.md](../../media/README.md). The page's own
meta tags and JSON-LD live in `index.html`. Everything else lives in the
[docs map](../README.md).

**You prepare, the owner publishes.** Nothing on this page has been posted,
submitted or changed anywhere outside this repository. Every external step
below is a to-do for the owner, done by hand, one at a time.

---

## 🎯 Positioning

**One-liner (use it everywhere):**

> Fusegrid is a free bomb-grid arcade you play in the browser. Flip REAL 3D ⇄
> CLASSIC 2D mid-run, dial the Heat, and blast through eight rooms of chiptune.

**Who it's for:** anyone with five minutes and a keyboard or a phone who
likes a tight arcade loop: plant, run, boom, clear the room.

**The three hooks, in this order:**

1. **Play in the browser.** One link, no install, no account, no ads. It's
   also a PWA that plays offline after the first visit.
2. **REAL 3D ⇄ CLASSIC 2D (plus PIXEL).** Three looks over one board, switched
   live from OPTIONS. Same game, same run, different eyes.
3. **Heat.** CORE, PLUS or MAX on LEVEL SELECT, then four MODES (IRON, BARE,
   THIN, SHRINK) and TIME after your first clear.

**The developer hook (developer channels only, always second):** MIT open
source, plain ES modules, zero npm dependencies, no build step, vendored
Three.js for REAL 3D only, and a deterministic simulation that runs the same
under Node tests and in the browser.

### Words we use, words we don't

| Say | Don't say | Why |
|---|---|---|
| bomb-grid arcade | the name of the classic franchise, or "-like"/"clone" tags built on it | House rule; a test fails on it |
| play in the browser, no install | "download" | It's a web page |
| you against your own best | beat your friends, global board, streak, climb the ranks | Fusegrid ranks you against your past runs only |
| MODES, IRON | Pact, LAST | The game says MODES since shell v180 |
| MAKO, the reef critter | any other hero | MAKO is the live hero; nothing else is built |
| REAL 3D ⇄ CLASSIC 2D | "deterministic" in a player headline | That's a contributor word |

Only describe what's live today. Story mode, new worlds, bosses and the next
hero are design work, not features. They stay out of every listing.

---

## ✍️ Copy blocks

Copy-paste ready. Character counts include spaces.

### Tagline (≤ 60)

```
Bomb-grid arcade in your browser. REAL 3D ⇄ CLASSIC 2D.
```

### Short description (≤ 140)

```
Free bomb-grid arcade in the browser. Flip REAL 3D ⇄ CLASSIC 2D or PIXEL, dial the Heat, clear eight rooms. No install.
```

### Medium description (store "summary" fields, ~300)

```
Light the fuse, clear the room, don't stand in the blast. Fusegrid is a
single-player bomb-grid arcade you play right in your browser. Flip REAL 3D,
CLASSIC 2D or hand-pixelled PIXEL whenever you like, dial the Heat to CORE,
PLUS or MAX, and blow through eight rooms of bricks, foes and chiptune.
```

### Long description (itch / Game Jolt / Newgrounds body)

```
LIGHT THE FUSE. CLEAR THE ROOM. DON'T STAND IN THE BLAST.

Fusegrid is a single-player bomb-grid arcade. Plant bombs, break bricks,
grab pickups and clear every foe to open the next room.

THREE LOOKS, ONE GAME
Flip between REAL 3D, CLASSIC 2D and hand-pixelled PIXEL from OPTIONS, live,
mid-run. Same board, same rules, different eyes.

TURN UP THE HEAT
Pick CORE, PLUS or MAX on LEVEL SELECT. Clear room 5 once and three more
rooms open, plus four MODES (IRON, BARE, THIN, SHRINK) and a TIME stopwatch.

EIGHT ROOMS, EIGHT TUNES
JUNGLE, ICE, FACTORY, WATER, ARENA, then SAND, VOID and CROWN. Every room has
its own chiptune theme and its own blast tint, and the last three bring
foes you won't meet anywhere else.

YOU AGAINST YOU
A DAILY board seeded from the date. A ghost of your fastest clear to race.
Board codes you can share. Medals for finale clears. Everything stays on your
device: no account, no server, no ads.

CONTROLS
WASD / arrows move · Space bomb · P pause
Shift+Space throw · Q remote · walk into a bomb to kick (need pickups)
Phones and tablets get a touch D-pad and bomb button.

Free and open source (MIT): https://github.com/HMarzban/fusegrid
Play the latest build: https://hmarzban.github.io/fusegrid/
```

### Developer pitch (Show HN, r/javascript, r/threejs, Lobsters)

```
Fusegrid: a bomb-grid arcade in plain ES modules, zero npm deps, no build step.
The sim is deterministic and framework-free, so the same code runs under
node --test and in the browser. Three looks share one board: Canvas 2D,
a hand-pixelled sprite renderer, and REAL 3D on a vendored Three.js r160 that
only loads when you pick it. It's a PWA that plays offline. MIT.
```

---

## 🔗 Links to share

Always keep the trailing slash. The no-slash redirect drops the Open Graph
tags, so chat apps show no preview card.

| Link | Opens |
|---|---|
| `https://hmarzban.github.io/fusegrid/` | The game (title, then MENU) |
| `https://hmarzban.github.io/fusegrid/?render=3d` | Boots in REAL 3D |
| `https://hmarzban.github.io/fusegrid/?render=px` | Boots in PIXEL |
| `https://hmarzban.github.io/fusegrid/?code=XXXXXXXXXXXX` | One exact board (copy a code with `B` on the end screen) |
| `https://github.com/HMarzban/fusegrid` | The source |

A board code carries the board, never a score. Share it as "try this board",
not "beat my score".

There is no analytics, by design. Don't add tracking tags or UTM-tagged links
to measure a launch. Watch the GitHub stars, the platform dashboards and the
replies instead.

---

## 🕹️ Platform listings

Researched **2026-10-19**. Portals change their rules, so re-read each one's
docs on the day you submit. Fusegrid's stance decides most of this table: **no
ads, no ad SDK, no exclusivity, no scoreboards.** A portal that needs any of
those is an owner decision, not a checklist step.

**The build:** use the zip recipe in
[media/README.md](../../media/README.md#-rebuilding-the-zip-for-itch--newgrounds--game-jolt).
`index.html` sits at the zip root and every path is relative, which is what
every portal below asks for. Inside a portal's iframe the game never registers
a service worker, so it can't fight the Pages copy.

**Two things to know about portal iframes:**

- **Saves don't travel.** Your runs on a portal live in that portal's
  storage, apart from the Pages copy. On itch, every HTML5 game shares one
  storage domain. Fusegrid wraps every storage call and only ever removes its
  own `nb.*` keys, so it won't wipe anyone else's saves.
- **URL flags don't reach the game.** A board code or `?render=3d` only works
  on `https://hmarzban.github.io/fusegrid/`, so point share links there.

| # | Portal | How you get on | Fit | Notes |
|---|---|---|---|---|
| 1 | **itch.io** | Self-serve upload, publish when ready | ✅ Best first stop | Zip ≤ 1,000 files / 500 MB; set the embed size, turn on itch's fullscreen button, tick **Mobile Friendly**; one genre + up to 10 tags; cover 630×500 (`media/cover-630x500.png`); 3–5 screenshots; revenue share can be 0% |
| 2 | **Newgrounds** | Self-serve upload, then a public vote | ✅ After itch is clean | **Judgment is one shot:** a new game under a 1.0 / 1.5 / 2.0 average at 40 / 50 / 60 votes is deleted. Ship a polished build, a strong thumbnail and the controls up front. Skip the medal/scoreboard API |
| 3 | **Game Jolt** | Self-serve, build type **HTML** | ✅ Same zip | Rejects a zip without a root `index.html`. Skip the score API |
| 4 | **CrazyGames** | Submit; **Basic Launch** (no SDK, no ads) is a 7–21 day test | ⚠️ Owner's call | Full Launch is by selection and makes their SDK and SDK ads mandatory. Covers 1920×1080, 800×1200 and 800×800, plus a 15–20 s silent clip, title the only text. In-game fullscreen buttons are banned, and cross-promotion links are limited (ask about the SOURCE row first). Ask whether a Basic game stays up if it isn't picked |
| — | **Poki** | Curated, SDK mandatory | ❌ Skip | Default 5-year web exclusivity, which clashes with the free MIT build on Pages |
| — | GameDistribution, GameMonetize, Y8, Yandex Games, Playgama | Ad networks | ❌ Skip | Each needs an ad or bridge SDK |
| — | Kongregate | Closed to new games since 2020 | ❌ | |
| — | Armor Games | Email pitch only | Low priority | |

### Tags per platform

Every set starts from the core four in
[media/README.md](../../media/README.md): `arcade`, `singleplayer`, `webgl`,
`chiptune`. Never the classic franchise's name, and never a "-like" tag built
on it.

| Platform | Tags |
|---|---|
| itch.io (genre **Action**, ≤ 10 tags) | `arcade` `singleplayer` `retro` `pixel-art` `3d` `chiptune` `html5` `open-source` `local-highscores` `webgl` |
| Newgrounds | `arcade` `singleplayer` `webgl` `chiptune` `action` `bomb` `retro` `3d` `pixel` |
| Game Jolt | `arcade` `singleplayer` `webgl` `chiptune` `action` `retro` `pixelart` `3d` |
| CrazyGames (if used) | Arcade category; `arcade` `singleplayer` `webgl` `bomb` `retro` `3d` `pixel` |
| Social posts | `#indiedev` `#gamedev` `#webgame` (+ `#threejs` on a REAL 3D clip, `#pixelart` on a PIXEL clip) |

### Art each listing needs

| Need | Have it? |
|---|---|
| itch cover 630×500 | ✅ `media/cover-630x500.png` |
| 3–5 gameplay stills | ✅ `media/still-*.png`: JUNGLE, ICE, CROWN in REAL 3D, FACTORY in PIXEL, and the MENU (recaptured on v181) |
| Short gameplay GIF | ✅ `media/play.gif` |
| A PIXEL still | ✅ `media/still-pixel.png` |
| Silent 15–20 s clip, landscape + portrait | ✅ 18 s each: `media/clip-landscape.mp4` (1920×1080, REAL 3D) and `media/clip-portrait-2x3.mp4` (1080×1620, PIXEL) for CrazyGames, `media/clip-portrait-9x16.mp4` (1080×1920, REAL 3D) for Shorts / TikTok / Reels |
| Install-dialog screenshots | ✅ `screenshots/wide.png` + `screenshots/narrow.png`, in the manifest |
| CrazyGames covers 16:9, 2:3, 1:1 | ❌ Not made yet. The only text a cover may carry is the title, so the HUD has to go: that means REAL 3D or PIXEL with `#c` hidden, never CLASSIC, where `#c` is the board. No borders and no blur, so no upscaling. 1:1 and 2:3 can be cropped from a 1200×1040 (AUTO) or 1800×1560 (RESOLUTION FULL at DPR 3) board capture. 16:9 at 1920×1080 needs a ~1.07× upscale, or the page backdrop around the stage. Adding the title is optional, but a wordmark on the art makes it storefront art like `og.png` (owner) |

CrazyGames also asks that a clip open on the static cover, so the portrait
and landscape clips will get that first frame once the covers exist.

Every asset is a real capture of the live game, never generated key art (see
[media/README.md](../../media/README.md)).

---

## 🏷️ GitHub About and topics

The owner edits the description, website and topics in the ⚙️ dialog next
to **About** on the repo page. Only **Settings → Social preview** (the card
image) has no API. Nothing here has been changed on GitHub.

Prefer the terminal? The owner can run this once, after checking the text:

```bash
gh repo edit HMarzban/fusegrid --homepage "https://hmarzban.github.io/fusegrid/" --description "Play FUSE/GRID free in your browser: a single-player bomb-grid arcade in three looks (CLASSIC 2D, PIXEL, REAL 3D) with Heat CORE / PLUS / MAX. Eight rooms, a chiptune soundtrack, installable as a PWA." --add-topic web-game,html5-game,game,arcade,arcade-game,retro-game,single-player,pixel-art,chiptune,indie-game,offline-first,zero-dependencies,open-source-game
```

> **One text, not two.** The storefront refresh pass owns the About copy and
> `og.png`. The description below is its draft (2026-10-19), still waiting on
> the owner's OK. The topics are its sixteen plus four from this kit. If the
> owner changes either, update this section to match.

Today (read 2026-10-19 with `gh api`, read-only) the description reads
"A browser arcade game with a deterministic simulation, replay tests, and
switchable 2D and 3D renderers." That leads with a contributor word. The
seven current topics are `browser-game canvas deterministic-simulation
javascript pwa threejs webgl`; the list below keeps all seven and adds
thirteen.

**Description (draft, ≤ 350):**

```
Play FUSE/GRID free in your browser: a single-player bomb-grid arcade in three looks (CLASSIC 2D, PIXEL, REAL 3D) with Heat CORE / PLUS / MAX. Eight rooms, a chiptune soundtrack, installable as a PWA.
```

**Website:** `https://hmarzban.github.io/fusegrid/` (trailing slash).

**Topics (20, GitHub's cap):**

```
browser-game web-game html5-game game arcade arcade-game retro-game single-player pixel-art chiptune javascript canvas webgl threejs pwa deterministic-simulation indie-game offline-first zero-dependencies open-source-game
```

Leave out the classic franchise's name and any "-like" topic built on it.

---

## 🔎 Search: what's in the page, what the owner does

**In the repo (done):**

- `index.html` meta description leads with play in the browser, REAL 3D ⇄
  CLASSIC 2D and Heat. Tests pin "3D" and "browser" in it, and pin the
  `<title>` verbatim.
- One JSON-LD block, typed `["VideoGame","WebApplication"]`, free (`price
  "0"`), `playMode` as the schema.org enum, one player, browser requirements,
  MIT license. **No rating or review, ever.** Google only shows an app rich
  result with a real `aggregateRating`, and we don't invent one.
- A short screen-reader-only H1 and paragraph that say what the canvas
  shows. Keep them short and true: hidden text is fine for screen readers,
  and spam only when it's stuffed for crawlers.
- `sitemap.xml` with an accurate `lastmod`. Google ignores `changefreq` and
  `priority`, and only trusts `lastmod` when it's right, so each release sets
  it (see [Shipping a release](../../CONTRIBUTING.md#-shipping-a-release)) and
  a test fails if it falls behind.
- `robots.txt` stays, but know this: crawlers only read
  `hmarzban.github.io/robots.txt` at the host root, so ours does nothing.
  Submit the sitemap by hand instead (below).

**Owner to-do (by hand):**

1. **Google Search Console.** Add a **URL-prefix** property for
   `https://hmarzban.github.io/fusegrid/`. Pick the **HTML tag** method; the
   token goes into `index.html` as `<meta name="google-site-verification">`
   (a verification *file* would also need adding to the `pages.yml` copy
   line). Then submit `sitemap.xml` and request indexing in URL Inspection.
2. **Bing Webmaster Tools.** Use **Import from Google Search Console**, which
   verifies for you. Bing's index also feeds other search engines.
3. **Optional, owner's call:** a root `HMarzban/hmarzban.github.io` site whose
   `robots.txt` lists `https://hmarzban.github.io/fusegrid/sitemap.xml`. It
   makes the root a live site, so only do it on purpose.

**Next search wins (follow-ups, not done here):**

- ~~**Manifest screenshots.**~~ Done 2026-10-19: `screenshots/wide.png`
  (REAL 3D, 1920×1080) and `screenshots/narrow.png` (CLASSIC 2D on a phone,
  1080×1920) are in the manifest and staged by `pages.yml`. The manifest
  itself is precached, so they reach installed players with the first shell
  bump after they merge.
- **A second indexable page.** The whole site is one canvas page. A small
  static `how-to-play.html` built from the in-game GUIDE copy, with real
  screenshots, would give search engines honest text and a second URL.
- **Microsoft Store.** Individual developer accounts have been free since
  2025, and PWABuilder packages a PWA URL for it. That's cheap reach, but
  it's a store listing under the owner's name: the owner decides.

---

## 📣 Community launch

Rules change. Every row was researched on **2026-10-19**, and Reddit's
sidebars could only be read through mirrors and rule trackers. Read the
sidebar the day you post.

### The post that works

1. **Footage first.** A native GIF or a 10–20 s clip of a chain blast. Cut
   between CLASSIC 2D, PIXEL and REAL 3D: the live switch is the hook.
2. **One line, then the link.** "Free bomb-grid arcade, plays in your
   browser, works offline, flip 2D / pixel / 3D live." Then
   `https://hmarzban.github.io/fusegrid/`.
3. **Ask one real question** (pace? is MAX too much?) and answer every reply
   in the first two hours.
4. **Fit the room.** Players get the fun. Developers get how it's built.
   Open-source folks get the license and the architecture.

**Don't:** sound like an ad, crosspost the same text to several subs on one
day, make your first-ever post in a sub about your own game, dress a promo
up as a feedback question, or post a still image with only a link.

**Be upfront about AI help.** Some venues (r/opensource is reported to; Show
HN rejects "quickly generated one-offs") are wary of AI-assisted work. Decide
on an honest one-line disclosure before posting there.

### Where, in what order

| # | Venue | Fit | Rules to respect |
|---|---|---|---|
| 1 | **r/WebGames** | Best fit: no install, no signup | Link post straight to the game; title starts with the game's name. Take part in the sub, don't only post your own work |
| 2 | **r/playmygame** | Good | Free at posting time, written description required, **Web** flair, details in a comment |
| 3 | **r/indiegames** | Good | Must include an image, GIF or video of gameplay; flair required; no promo dressed as Feedback |
| 4 | **Show HN** | Good for the dev angle | Title `Show HN: Fusegrid – bomb-grid arcade in plain ES modules, no build step`. Personal account, plain wording, a first comment with the backstory. Never ask anyone to upvote |
| 5 | **three.js forum Showcase** | Good for REAL 3D | Moderator-approved; active ([discourse.threejs.org/c/showcase](https://discourse.threejs.org/c/showcase/7)) |
| 6 | **r/javascript** | Good for the dev angle | Weekly Showoff Saturday, or a standalone post with the unminified source link or a how-it's-built write-up |
| 7 | **r/IndieGaming** | OK | 30–60 s clip; no repeat posts of the same game |
| 8 | **r/opensource** | OK | **Promotional** flair; LICENSE present (MIT ✓); check the AI-content rule first |
| 9 | **#ScreenshotSaturday** on X / Bluesky / Mastodon | Weekly | 1–3 tags: `#indiedev #gamedev #webgame` (or `#threejs` for a 3D clip) |
| 10 | **TikTok / YouTube Shorts** | Optional | Payoff in the first 1–2 s (the blast), 10–40 s, on-screen captions |
| — | r/gamedev | Not for promo | Only a real postmortem or technical write-up |
| — | Lobsters | Invite-only | New accounts can't use the `show` tag |
| — | Product Hunt | Weak fit | Free browser games there drew few votes; optional |

Spacing: at most one post per sub a month, never several subs the same day,
weekday mornings US Eastern. Keep self-promotion well under a quarter of your
activity in any community.

### Press and curators

| Who | How | Status (2026-10-19) |
|---|---|---|
| Jay Is Games | Submission form: [jayisgames.com/game-submit](https://jayisgames.com/game-submit/) | Active |
| Indie Games Plus | Contact page: [indiegamesplus.com/contact](https://indiegamesplus.com/contact) | Active |
| Free Game Planet | "Suggest a game" via [freegameplanet.com/contact](https://freegameplanet.com/contact) | Activity unconfirmed |

A press note is three lines: what it is (the one-liner), the play link, one
GIF. Attach nothing they have to download.

### Open-source game lists

| List | Rule | Status |
|---|---|---|
| [michelpereira/awesome-open-source-games](https://github.com/michelpereira/awesome-open-source-games) | Repo older than 30 days **and ≥ 40 stars**; `[Game](link) - Description.`, no tagline, not starting with "A/An" | Not eligible yet (stars) |
| [proyecto26/awesome-jsgames](https://github.com/proyecto26/awesome-jsgames) | Arcade section; copy the existing entry format | Eligible |
| [OpenSourceVideoGames/list](https://github.com/OpenSourceVideoGames/list) | Browser-based category; issue or PR | Eligible |
| [bobeff/open-source-games](https://github.com/bobeff/open-source-games) | Maintainer's pick; `**[Title](url)** - Short description. [[source]](repo)` | Long shot |

Entry text for lists:

```
Fusegrid - Single-player bomb-grid arcade that runs in the browser, with live-switchable Canvas 2D, pixel-sprite and Three.js 3D renderers.
```

---

## ✅ Launch checklist

Tick these in order. Every box past "Ready the page" is something the
**owner** does by hand, after saying yes to it. Nothing here posts by itself.

**1. Ready the page**

- [ ] Merge this branch; the next release bumps `CACHE_NAME` / `REV` and sets
      the sitemap `lastmod` ([Shipping a release](../../CONTRIBUTING.md#-shipping-a-release)).
- [ ] Paste the GitHub About description, website and 20 topics (above).
- [ ] Upload `og.png` under **Settings → Social preview** whenever the card
      changes (no API for it).
- [ ] Open `https://hmarzban.github.io/fusegrid/` in a chat app and check the
      preview card shows.

**2. Get found**

- [ ] Search Console URL-prefix property, HTML-tag verification, submit
      `sitemap.xml`, request indexing.
- [ ] Bing Webmaster Tools: import from Search Console.

**3. Fill the art gaps**

- [x] Merge the fresh `media/` recapture.
- [x] Capture a PIXEL still and a 15–20 s silent clip (landscape and
      portrait). Real captures only.
- [x] Recapture `media/still-menu.png` on the current menus (v181).
- [ ] CrazyGames covers 16:9, 2:3, 1:1 (see the art table).

**4. List it (one a week is plenty)**

- [ ] itch.io: zip, embed size, fullscreen button, Mobile Friendly, cover,
      stills, GIF, long description, itch tags. Play it on a phone through
      itch before you publish.
- [ ] Newgrounds, once the itch build plays clean (judgment is one shot).
- [ ] Game Jolt, same zip.
- [ ] CrazyGames Basic Launch, only if the owner accepts the SDK path that
      follows.

**5. Tell people (spread over a few weeks)**

- [ ] r/WebGames → r/playmygame → r/indiegames, a week or so apart.
- [ ] Show HN (dev pitch, personal account, backstory in the first comment).
- [ ] three.js forum Showcase with a REAL 3D clip.
- [ ] r/javascript Showoff Saturday or a how-it's-built post.
- [ ] #ScreenshotSaturday every week with a fresh clip.
- [ ] Jay Is Games form, Indie Games Plus contact.
- [ ] proyecto26/awesome-jsgames and OpenSourceVideoGames/list PRs; the big
      awesome list once the repo passes 40 stars.

**6. After each post**

- [ ] Answer every reply in the first two hours.
- [ ] Note what landed in a dated `MEMORY.md` line, so the next post learns
      from it.

---

**CONTINUE?** Back to the [docs map](../README.md), or grab the art in
[media/README.md](../../media/README.md).
