# Arcade loop — design (2026-09-04)

Steal the player feelings itch / Newgrounds / Game Jolt / CrazyGames / Poki
train: **in a room in one gesture**, **a number you can quote**, **one more run**.
Do not steal their SDKs, ads, login boards, or forced fullscreen.

Cabinet INTRO → MENU stays for returning players. No new `SCREEN`. `step()`
stays deterministic. Attract stays CORE / pact=0. Public copy never names
the other grid-bomb franchise.

## Locked decisions

### 1. Attract starts a CORE run (not MENU)

| Input | Today | After |
|---|---|---|
| Enter / Space / pointer / most keys | `exitAttract()` → MENU | `playFromAttract()` → GAME |
| Escape | MENU | MENU (unchanged — keeps the skip-fade) |
| Held axes | ignored | ignored |

`playFromAttract()` must **not** clobber `app.level` / `app.heat` / `app.pact`.
It calls `onStart({level:1,heat:0,pact:0,pace:app.pace})` so LEVEL SELECT
still shows the player's last picks after they die. Pace is theirs.

Hint copy: `DEMO — TAP TO PLAY` (Escape still implied by cabinet habit).

### 2. First-GAME ghost coach

Render overlay only, first unseen run, CORE language: faded WASD + SPACE for
`COACH_DUR = 3` seconds. Dismiss on first plant (`world.events` `bomb`) or
when `world.time >= 3`. Persist `nb.coach.v1 = "1"`. Never a `SCREEN`.
`?play=1` still skips INTRO but **does** show the coach if unseen.

### 3. Honest end screen

Sim WIN/LOSE/FIRE edges stay. LOSE `startGame` still reloads **room 1,
score 0** (credit arcade, not continue). Copy stops lying:

| State | Cue |
|---|---|
| WIN mid | `SPACE / TAP · next room` |
| WIN finale | `SPACE / TAP · menu` |
| LOSE | `SPACE / TAP · new run` |
| PAUSE | `P · resume · M / MENU · quit` |

Stamp (raw HUD score, not persist × heat): `L3 FACTORY · PLUS · 1840`.
Optional `C` copies that line + ` https://hmarzban.github.io/fusegrid/`.
App-layer clipboard only.

### 4. HIGH SCORES by Heat

One persist list (`nb.highscores.v1`). Display tabs CORE / PLUS / MAX.
`←/→` on SCORES cycles `app.scoreHeat` (`clampHeat`). CORE tab shows
rows with `t` missing or 0 (legacy defaults). Empty tab: `NO PLUS RUNS YET`.
Foot: `← → HEAT · ESC BACK`.

### 5. Local plaques (after 4)

Bitmask persist `nb.plaques.v1`. Unlock on existing score/pact edges, never
inside `step()`. Bits: CLEAR (first finale), PLUS, MAX, CROWN (L8).
Painted on the SCORES plate. No login API.

### 6. Listing pack (assets + embed)

`media/` stills + 630×500 cover + short GIF. itch/Newgrounds zip omits
`tests/`, `docs/`, `.git`. Skip `registerSW` when `window !== top` or
`?embed=1`.

### 7. First-visit Play Now (later)

Only after 1 ships. Persist `nb.cabinet.v1`. Unseen: first INTRO gesture
calls the same CORE `onStart` as attract. Seen: today's skip → MENU.
Veterans with scores or pact-unlock count as seen.

## Refuse

Portal SDKs, ads, mid-run interstitials, Newgrounds.io / Game Jolt login
boards, forced-fullscreen embed, new `SCREEN` values, mid-run heat.

## Ship order

1 attract → 2 end-screen → 3 scores-by-heat → 4 ghost-coach → 5 plaques
→ 6 listing-pack. 7 first-visit last (reuses 1's CORE handoff).
2, 3, and 6 can overlap 1. 4 needs the persist pattern. 5 needs 3's
SCORES plate. 7 needs 1.

## Tests

Node `--test` only for logic. Headed play-verify after 1, 2, 4.
PWA `CACHE_NAME` / `REV` bump together when `index.html` or any
precache file changes.
