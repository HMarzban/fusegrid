# Google Analytics (GA4), opt-in — plan

Owner, 2026-10-26: "we need a tracker in order to see how many people stay in
game or open the game", then "let's work on the Google Analytics". Consent
pick: **ask once, with an OPTIONS switch**. Events: page opens, run start / run
end, and a days-played bucket.

## Rules

- **Nothing reaches Google before a yes.** No `gtag.js` request, no cookie,
  no event until the player allows it. A "no", or no answer yet, sends nothing.
- **Only the public game counts.** Live only on `hmarzban.github.io` with a real
  Measurement ID. Loopback, forks and Node tests never load GA. `?debug=1` on
  any other host runs a DRY mode: the card and the row work, and events go to
  `window.__GAME__.ga` (a log), never the network.
- **Attract and the intro show never count.** Only the player's own world
  sends run events.
- **The choice can be undone.** OPTIONS → `ANALYTICS ON/OFF`. OFF sets
  `ga-disable-<ID>`, sets consent to denied, and deletes the `_ga*` cookies
  the game set.
- **Zero npm deps.** `gtag.js` is a script tag injected after consent, not a
  package. The service worker already lets other origins bypass the cache
  (`fetchPolicy` → `bypass`); offline, the script fails quietly.

## Pieces

1. `src/app/analytics.js` (new)
   - `ANALYTICS_KEY = "nb.analytics.v1"`: `"1"` allowed, `"0"` declined,
     absent = not asked. It joins `KEEP_KEYS` in `reset.js`, because a
     cabinet reset keeps preferences.
   - `GA_ID` (one constant; while it is the placeholder `G-XXXXXXXXXX`,
     nothing runs), `GA_HOST = "hmarzban.github.io"`.
   - Pure: `daysBucket(n)` → `"0" | "1" | "2-3" | "4-7" | "8-14" | "15+"`,
     `cardVisible(screen, S)` (MENU and its pages only, never INTRO, ATTRACT
     or GAME).
   - `mountAnalytics(env)` → `{ event(name, params), consent, set(v),
     pending, log }`. `env` injects `now` (a `Date` maker from `main.js`,
     since `src/app` never calls `Date`), `host`, `store`, `dry`, the
     days count, the look, and `busy()` (the update card is up).
   - The consent card: a DOM card styled like NEW VERSION READY (`#ana` shares
     the `#upd` CSS), with ALLOW (`Y`) and NO THANKS (`N`). A tap on the
     backdrop hides it until the next boot and records nothing. It waits while
     the update card shows.
2. GA setup on a yes: `consent default` (analytics granted, every ad signal
   denied), `set user_properties {days_played, look}`, `config` with
   `cookie_path` = the game's own path (the `github.io` origin is shared with
   other projects). `page_view` = one **open**.
3. `main.js` (pinned at 799 lines or fewer):
   - mount at boot;
   - `run_start` in `startRunState` with `{mode, room, heat, pact, pace}`;
   - `run_end` in `endRun` with `{mode, room, result, heat, pace, score, secs}`,
     where `result` is `win`, `lose` or `quit`;
   - `mode` = `daily` / `code` / `run`.
4. OPTIONS row `ANALYTICS` (ON / OFF), inserted after REDUCE FLASH (OPTIONS
   goes from 10 to 11 rows; GRAPHICS and RESET DEFAULTS move down one). Its
   truth lives in the analytics store, the way SOUND's lives in audio:
   `app.analytics` plus `o.onAnalytics(v)`. RESET DEFAULTS does not touch it.
   The PAUSE OPTIONS view gets the same row.
5. Precache: add `src/app/analytics.js` to `shell.js`. `CACHE_NAME` stays
   v185 (unreleased; folded into it).
6. Tests: `tests/analytics.test.mjs` (bucket, visibility, store
   load/save/clear, dry log, no-ID/no-host inert, gtag queue on yes, OFF
   clears). Renegotiate the OPTIONS index literals in `menuapp`, `keys` and
   `menudraw` tests. `keys.test` covers Y / N as inert with no card (Node).
7. Docs: `docs/privacy.md` (what is sent, how to turn it off), AGENTS.md,
   `docs/architecture.md`, CHANGELOG v185, MEMORY.md.

## Owner steps (not code)

- Create a GA4 property and web stream for `https://hmarzban.github.io/fusegrid/`,
  then paste the `G-…` ID into `GA_ID`.
- In GA → Admin → Custom definitions, register the event parameters `mode`,
  `room`, `result`, `heat`, `pace` and the user properties `days_played`, `look`.
  Until then, the reports don't show them.
- Retention: Reports → Retention, and Explore → Cohort, count only players who
  allowed analytics.
