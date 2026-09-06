# Fusegrid — gamification & retention report (2026-09-06)

Decision document. Synthesises three research passes in
`.superpowers/sdd/2026-09-06-taste-revision/`: `research-retention-industry.md`
(evidence), `research-retention-audit.md` (loop map), `research-retention-feasibility.md`
(cost). Every claim traces to one of those or to `file:line`. Recommendations
carry their own `R#` ids; source items are cited as `industry #N` / `feasibility #N`
because the two reports number differently (industry #8 is ghost replay,
feasibility #8 is continue-credit). Public copy never names the other grid-bomb
franchise — "the genre classic" throughout.

---

## 1. Executive summary

Retention is not lost at the door — it is lost at the **first death**. The on-ramp
is already good (`bootFromIntro`, `menuapp.js:340-346`; frozen-easy room 1,
`heat.js:23`; 3s ghost coach, `coach.js:24-26`). What follows is a cliff: LOSE
hard-resets to room 1 / score 0 (`startGame`, `sim.js:107-111`), the entire
meta-progression is **one** unlock event (first CLEAR flips Pact + rooms 6–8
together, `config.js:28-31`), and a room-2–4 death — the modal outcome — leaves
nothing durable behind: no per-room best, no stats screen, and usually no
high-score row either (the CORE tab ships pre-seeded down to 250,
`highscores.js:6-19`).

**Thesis: stop asking players to earn *more content* and start giving them
*durable evidence of their own improvement* — truthfully, locally, on the screen
they already see when they die.** That is where the cheapest work and the biggest
gap coincide.

| # | Recommendation | Effort | Expected effect |
|---|---|---|---|
| R1 | Run summary + per-room/heat bests + truthful delta-to-best on WIN/LOSE | M-L, 2.5–3d | Directly addresses the biggest named churn point; session count |
| R2 | Combo / chain-blast callout + close-call flash | S, 1–1.5d | Session length (playtime), cheapest high-value item on the list |
| R3 | Daily seeded challenge (honest, single-device) | M, ~2d | Only lever that gives a reason to return *tomorrow* — D7 bridge |
| R4 | First-visit Play Now + sub-90s attract handoff | S-M, ~0.5–1d left | D1 / session-1 start rate; gates whether anything else is seen |
| R5 | Opt-in STATS screen over `nb.stats.v1` | M, ~2d after R1 | Small direct lift; **enables all measurement** |

Re-ranked from industry §2 deliberately: PB ghost replay drops out of the top 5
(industry #8 / feasibility #3) because it is L / 4–5d, carries the weakest citation
grade of the five by industry's own admission, and needs `sprites.js` — under
concurrent edit this session. R2 takes its place on effort-to-effect.

---

## 2. How the loop works today

**Session.** `BOOT → INTRO → MENU` (`SCREEN`, `menuapp.js:16-29`). First-timer: any
INTRO gesture boots a real CORE room-1 run (`menuapp.js:340-346`). Returning player
lands on MENU. 10s idle → ATTRACT (`IDLE_T`, `menuapp.js:66,150-151`); any input
during attract starts a real run (`playFromAttract`, `menuapp.js:562-565`).

**Run.** `level 1 → ROOM_LOCK(5)` on a fresh cabinet; `roomCap()` extends to
`ROOM_MAX(8)` after Pact unlock (`config.js:28-31`). Start
`{bombs:1, range:1, speed:3.4, lives:3}` (`config.js:6`). Pickups carry across rooms
on WIN via `loadLevel`'s `carry` snapshot (`world.js:44-61`) — and only when
`keepProgress` is true. Clear pays `LEVEL_BONUS 500 + 100/life` (`config.js:11-12`).

**Room.** 15×13 tiles (`config.js:2`). Roster is level+heat driven (`heatRoster`,
`heat.js:102-113`); CORE room 1 is `walker, walker, stationary` (`heat.js:23`).
Eight biomes cycle by room (`config.js:17-26`), capped at 8, so the wrap never
surfaces.

**Moment.** Bomb → 4-arm blast (`computeBlast`, `sim.js:263-288`) → brick +10 →
item reveal → chain detonation (`sim.js:376-378`). Kills score 100–300 by type
(`sim.js:402-412`). Death: −1 life, −20 score (`entities.js:186-187`).

**Length (estimate from constants, not measured — audit §1):** ≈45–90s/room, so
≈4–8 min to a first finale, ≈7–13 min for the 8-room veteran run.

### The three biggest gaps

| Gap | Evidence | Why it costs retention |
|---|---|---|
| **G1 — LOSE erases everything.** `startGame` calls `loadLevel(world,1,false)`; `carry` is only built when `keepProgress` is true | `sim.js:107-111`, `world.js:44-61` | A room-4 death with FLAME×4/BOMB×3 restarts the same walker/walker/stationary fight. Nothing durable is recorded: furthest-room-reached is tracked nowhere, and `recordScore` appends+sorts+slices to 10 with no floor (`highscores.js:62-78`) against a CORE list pre-seeded down to 250 (`DEFAULT_SCORES`, `highscores.js:6-19`) — so **on CORE**, where most play happens, a sub-250 run records nothing at all. PLUS/MAX tabs start empty (the seeded rows carry no `t`, `scoresForHeat`, `highscores.js:93-97`), so there the first run always lands |
| **G2 — progression is one cliff.** Pact + rooms 6–8 both unlock on the same first-CLEAR gate | `config.js:28-31`, `plaques.js:28-36` | After one finale there is no further gate, badge or goal except a bigger number. Huge early hook, zero mid/long pull |
| **G3 — no feedback surface at all.** WIN/LOSE prints one line (`runStamp`); `fx.js` fires only on discrete events | `scenes.js:48-53`, `fx.js:42-64`, arcade-loop-design.md:46 | Nothing rewards a close dodge, a chain kill or a fast clear; there is no stats screen, no per-room best, no run breakdown. The player cannot see themselves improving |

Owned progress is the whole of: a 10-row score list, a 4-bit plaque mask, and one
unlock boolean (`nb.*` table, audit §2).

---

## 3. Principles

### What we refuse — non-negotiable

| Refused | Source |
|---|---|
| Ads, portal SDKs, mid-run interstitials, login boards, forced fullscreen | arcade-loop-design.md:76-79 |
| Any server, analytics beacon or account | AGENTS.md ("single-player"), `transport.js:49-51`, `localpair.js:1-4`, industry §3F |
| Streak guilt: "streak at risk", streak-freeze purchase, any loss-aversion nag | industry §1.11, §2 ("explicitly not bet on") |
| **Manufactured** near-misses — rigging outcomes to look close | industry #9's own caveat: the slot-machine literature is about engineering near-misses; ours must only *report* a real delta |
| `Date` / DOM / `Math.random` inside `src/core` | AGENTS.md Conventions; `world.js:10`, `sim.js:37-39` |
| Widening `PLAQUE`'s `&15` or `PACT`'s `(p\|0)&15` in place | `plaques.js:5,24`, `pact.js:1,5`; `p` is load-bearing in `highscores.js:33` |

### The SCREEN question — resolved here

The audit says "no new `SCREEN` enum values" is a repeated refusal (audit §5);
feasibility says the real lock is narrower. **Feasibility is right, and this report
adopts its reading.** AGENTS.md:32-33 forbids exactly one thing: "PAUSE/WIN/LOSE are
`world.state`, not shell screens. Do not add them as `SCREEN` values."
`menuapp.js:27-28` shows `SETTINGS` and `GUIDE` already appended, with a comment
explaining the append-only rule. So:

- **Appended `SCREEN` is permitted** (STATS, TROPHIES) — precedent set twice.
- **A WIN/LOSE run-summary is not a `SCREEN`** — it goes inside `drawOverlay`'s
  existing WIN/LOSE branches (`scenes.js:111-118`), next to `runStamp`.

The stricter phrasing in arcade-loop-design.md:7 and end-screen.md:15 was scoped to
those plans' own work. Whether it also stands as standing policy is **Q2 in §7** —
R5 and R6 collapse if the answer is "no new SCREEN, ever."

### The seed contract — do not repeat the loose version

The audit's quotable line — "deterministic sim + explicit seed = free
daily-challenge/replay/ghost infrastructure" (audit §4) — is half wrong, and
feasibility corrects it. Replay validity is pinned to the full
**`(seed, level, heat, pact, pace)` 5-tuple**: `pace` scales player speed inside
`updatePlayer` (`paceMul(w.pace)`, `sim.js:124`) but is **not** folded into rng
seeding, which is `seed ^ level*40503` only (`world.js:15,74`). A ghost or daily
result recorded at one pace silently desyncs at another. Every seed-dependent
recommendation below (R3, R8, R9) states the 5-tuple.

### What we optimise, and the evidence bar

| Target | Lever | Bar each recommendation had to clear |
|---|---|---|
| **D1** | First 90s + honest feedback at the moment of loss | FTUE research: core gameplay <60s, aha <90s (industry #1) |
| **D7** | Seeded daily + mastery goals visible outside a run | Only date-anchored content creates a "come back *tomorrow*" (industry #10) |
| **Session length** | Truthful near-miss + juice | CHI 2024 juicy-feedback study predicts *playtime*, not D1/D7 (industry #12) |

Evidence standard: every recommendation names (a) a mechanism, (b) a citation from
the industry report with its **grade** stated, (c) what it reuses from the audit,
(d) a feasibility cost and invariant risk, (e) a locally-measurable success metric.
Where evidence is design inference rather than study (industry grades #8 and #13
this way), the section says so and the item is ranked lower for it.

Numbers that carry an explicit hedge, and must keep it wherever quoted:

- **~30% higher retry after a near-miss** — industry #9 calls this general
  game-psychology commentary, "directional, not a guaranteed lift."
- **45–90s/room, 4–8 min first finale** — audit §1 estimates from constants; not
  measured. Everything downstream is an order-of-magnitude claim only.
- **Duolingo's ~2x daily retention / 14% D14** — belongs to the streak mechanic we
  are **not** betting on (industry #11, §2). Cited only to explain why we decline it.
- **CrazyGames 10–15% D1 / 10+ min session** — a *platform benchmark* for titles
  listed there, not a Fusegrid measurement (industry §3E).

---

## 4. Recommendations

| id | Recommendation | Source | Effort | Invariant risk | Wave |
|---|---|---|---|---|---|
| R1 | Run summary + per-room/heat bests + truthful delta-to-best | ind #9,#16 / feas #2 | M-L, 2.5–3d | Low (read-only); medium scheduling | 2 |
| R2 | Combo + chain-blast callout, close-call flash | ind #12,#13 / feas #6 | S, 1–1.5d | Very low, zero `step()` edits | 1 |
| R3 | Daily seeded challenge, honest single-device | ind #10 / feas #1 | M, ~2d | Low | 2 |
| R4 | First-visit Play Now + sub-90s handoff | ind #1,#15 / spec item 7 | S-M, 0.5–1d | Low | 1 |
| R5 | Opt-in STATS screen over `nb.stats.v1` | ind #16 / feas #9 | M, ~2d after R1 | Low; needs Q2 | 2 |
| R6 | Expanded medals (`nb.medals.v1`) + trophy page | ind #6 ext / feas #4 | L, ~2d after R1+R5 | Medium (bitmask); needs Q2 | 3 |
| R7 | Time-attack stopwatch + MODES packaging | feas #7 | S, 0.5–1d | Low (scoreboard-only) | 1 |
| R8 | Challenge-code (seed/heat/pact/pace, **no score**) | feas #12 | S-M, ~1.5d | Low | 2 |
| R9 | Personal-best ghost replay | ind #8 / feas #3 | L, 2d (2D) / 4–5d (parity) | Low sim, high scheduling | 3 |
| R10 | Coach v2 contextual tips (kick/throw/remote) | ind #2 ext / feas #10 | S-M, ~1.5d | Low; collides with live edits | 2 |
| R11 | Colourblind audit + pause-anywhere verification | feas #11a | S, 0.5–1d | None | 1 |
| R12 | Passive consecutive-day read inside STATS | ind #11 defanged / feas #5 | S, ~0.5d after R5 | None | 3 |
| **D1** | **LOSE reset vs continue-credit** | feas #8 | S, 0.5–1d either way | Policy, not engineering | **Owner call** |

---

### R1 — Run summary, per-room/heat bests, truthful delta-to-best

**Mechanism.** On WIN and LOSE, print a short breakdown under the existing
`runStamp`: rooms cleared, kills, pickups, time, and a **true** computed delta —
"142 from your CORE best", "furthest room yet". A `NEW BEST` flag when the room+heat
record falls.

**Why it works here.** Industry #9: the near-miss effect is one of the
best-documented drivers of "one more try". Grade: strong mechanism, hedged
magnitude (see §3 — ~30% is directional commentary, and the strongest studies come
from *engineered* gambling near-misses, which is precisely the version we refuse).
Industry #7 adds the complementary finding: ambiguous next-steps at the highest-
friction moment are a silent churn point. This is the direct answer to **G1** —
today the modal outcome produces no durable record at all.

**Reuses.** The single non-destructive `world.events` read that `main.js:563-570`
already performs before `renderer.js:36-40` drains the array — the same splice
point, already precedented, no parallel pipeline. Kill events carry `type`
(`sim.js:412`), power events carry `kind` (`entities.js:178`). Comparison targets
already exist in `nb.highscores.v1` and the plaque thresholds.

**Sketch / effort.** Tally at the existing tap; new `nb.bests.v1` keyed by
level+heat via the standard `load*/save*(store)` template (feasibility Ground
truth); draw extra lines inside `drawOverlay`'s WIN/LOSE branches
(`scenes.js:111-118`) — **not** a new `SCREEN` (§3). **M-L, 2.5–3d**, of which
~0.5–1d is coordination buffer: `scenes.js` and `menudraw.test.mjs` are shared,
actively-edited files this session.

**Invariant risk.** Low. Everything is read-only off `world.events` and world
fields — the same shape as `unlockPlaques` (`plaques.js:28-36`) and `scoreEntry`.
No `step()` change, so replay baseline v6 is untouched.

**Success metric.** Frequency `new-best === true` fires per session (felt-progression
proxy, feasibility #2); measured near-miss base rate before/after (industry §3B) —
a jump in that *measured* rate after a later change is itself the tripwire against
drift into the manufactured version.

**Risk / rollback.** The one real risk is scope drift into fabricated deltas. Hard
rule, not per-PR judgement: **the delta is computed from persisted numbers or it is
not shown.** Rollback is deleting text lines from `drawOverlay`; the persist key can
stay.

---

### R2 — Combo / chain-blast callout + close-call flash

**Mechanism.** Group kills already emitted in the same frame into a combo callout
("CHAIN ×3"); flash when the player survives within N px of a live blade tile
without being hit.

**Why it works here.** Industry #12: the CHI 2024 juicy-feedback study found juicy
feedback drives enjoyment via curiosity/competence/effectance, with curiosity the
strongest predictor of **playtime** — note the study predicts session length, not
D1/D7, so this is a session-length bet, not a retention bet. Industry #13 (combo
scoring) is graded weakest — pure design inference, no direct study — which is why
this ships as *feedback over existing events*, not as a scoring change. Answers **G3**.

**Reuses.** `detonate()`'s recursive chain already pushes several `{t:"kill"}` events
into one `world.events` batch (`sim.js:376-378`, `applyBlastHits` `sim.js:333-351`);
`world.blades` is already public read-only state. `fx.js:42-64` is the existing
shake/flash/particle surface.

**Sketch / effort.** **S, 1–1.5d**: combo grouping at the existing consumption point
~1d; close-call flash ~0.5d as a per-frame distance check. **Zero `sim.js` edits.**
Ship the visual half first — a combo stinger needs `src/audio/*`, mid-edit this
session.

**Invariant risk.** Very low. No `step()` edits, no new sim state, no scoring change,
so no replay-validity exposure. Must respect the 3D draw-call budget (≤500,
fat-world 141, AGENTS.md) and honour REDUCE FLASH (`settings.js:16`).

**Success metric.** Multi-kill events per run, derivable from the existing kill
stream with no new persist. A "best combo" PB can piggyback on R1's store later.

**Risk / rollback.** Over-juicing a game whose flash budget is an accessibility
setting. Gate everything behind REDUCE FLASH and SCREEN SHAKE (`OPT_ROWS`,
`menuapp.js:51`). Rollback is a render-layer revert.

---

### R3 — Daily seeded challenge (honest, single-device)

**Mechanism.** A pure `dailySeed(dateStr)` hash feeds the existing
`createWorld(seed,1)` path. One entry point on LEVEL SELECT. The player races
today's board; their own attempts are compared against each other.

**Why it works here.** Industry #10 documents the exact "seeded run + link is the
payload, no server" pattern as a working no-backend daily-challenge design, shipped
in comparable indie roguelikes. It is the **only** candidate that gives a reason to
return on a *specific day* — Heat, Pact and plaques are all "whenever" content.
This is the D7 bet. Answers **G2** by adding rotating content with zero content
production.

**Reuses.** `createWorld`/`loadLevel` already accept an explicit seed
(`world.js:11-15`); the play seed is currently `(Math.random()*1e9)>>>0` and thrown
away (`main.js:62`). `flags.js`'s "pure over a string" pattern is the template: the
date string is passed in from `main.js`, never read via `Date` inside the function.

**Sketch / effort.** **M, ~2d** — hash + tests 0.5d, `nb.daily.v1 = {date,best,played}`
0.5d, menu wiring + share stamp 1d. Must gate on the full **5-tuple** (§3): a daily
result is only comparable at the same `(seed, level, heat, pact, pace)`. Pin
`pace` for the daily, or stamp it and label mismatched attempts.

**Invariant risk.** Low — no `step()` change; seed flows through the existing path.
Watch `menuapp.test.mjs`'s `ITEMS` assertions if a MENU row is appended.

**Success metric.** `nb.daily.v1.played` per day; best-of-day trend. Single-device
only — no cross-player aggregate is possible without a server.

**Risks / rollback.** Two honesty constraints, both from the sources:

1. **"One attempt per day" is unenforceable — marked infeasible-as-described
   (2 of 2).** `localStorage` is the only
   persistence layer (`store.js:1-7`); a private window or a second device bypasses
   it. Feasibility marks this **infeasible as described**. Ship it as an
   honour-system marker ("you already played today"), and say so in the copy.
2. **Never pitch this as competing with the world.** The source pattern assumed a
   synced leaderboard; ours compares a player against their own attempts. Industry
   #10 flags this as a real drop from the full pattern's promised effect.

---

### R4 — First-visit Play Now + sub-90s attract handoff

**Mechanism.** A cold visitor's first gesture starts the same CORE run attract
would play. Already speced as arcade-loop item 7 (arcade-loop-design.md:70-73),
sequenced after item 1; `bootFromIntro` (`menuapp.js:340-346`) and
`nb.cabinet.v1` are in place.

**Why it works here.** Industry #1/#15, the strongest-graded evidence on the list:
FTUE research converges on core gameplay within 60s and the aha within 90s, and
Poki's review criteria make first-three-minutes comprehension a hard gate. This
gates whether any other mechanic is ever seen. Highest leverage specifically for
the itch/Newgrounds/Game Jolt launch, where audiences arrive with less patience
than a bookmark visitor.

**Reuses.** Everything — this is verification and finish work on shipped code, not
new architecture.

**Sketch / effort.** **S-M, 0.5–1d remaining**: confirm the veteran/`cabinetSeen`
branch, then a headed play-verify with a stopwatch from cold load to first plant.
Do not reorder ahead of item 1 (spec's own sequencing, arcade-loop-design.md:82-83).

**Invariant risk.** Low; attract must stay CORE/pact=0 (arcade-loop-design.md:8).

**Success metric.** Time from load to first `{t:"bomb"}` event, measured by hand in
a headed session; `session_start` → first `room_enter` once R5's ring buffer exists.

**Risk / rollback.** Industry §2's own caveat: if CORE room 1 is *too* easy for a
genre-savvy portal visitor, the aha may not land inside 90s even at zero friction.
That needs a real playtest, not a faster load. Rollback is the existing MENU path.

---

### R5 — Opt-in STATS screen over `nb.stats.v1`

**Mechanism.** An appended `STATS` `SCREEN` showing the player their own lifetime
aggregate — runs, rooms cleared, bests per heat, deaths by room, kills by type,
pickups by kind, average session length — plus a "copy my stats" button.

**Why it works here.** Industry #16 rates the direct retention effect small
(visible mastery as a mild return-driver) — its real value is that **the entire
measurement plan depends on it existing** (§5). It also reinforces the brand: the
local-only data model becomes visible and inspectable to the player rather than
hidden. Chips at **G3**.

**Reuses.** R1's events tap (same splice point); the `nb.*` load/save-with-injected-
store template shared by `pactstore.js`, `plaques.js`, `pacestore.js`,
`cabinetseen.js`, `coach.js`, `settings.js`; the `SETTINGS`/`GUIDE` append precedent
(`menuapp.js:27-28`); the existing clipboard pattern (`copyPayload` + `KeyC`,
`scenes.js:54-56`, `main.js:307-313`).

**Sketch / effort.** **M, ~2d after R1** (mostly UI + persist wiring); **~3d
standalone**. Append `STATS` to `SCREEN`, never insert — inserting shifts every
frozen value after it (`menuapp.js:27`). Timestamps use `Date.now()` at the app
layer only.

**Invariant risk.** Low, identical to R1. **Depends on Q2** (§7): if the stricter
"no new `SCREEN`" reading stands, this becomes a sub-page of GUIDE or SCORES instead
and loses roughly half a day.

**Success metric.** STATS open rate as an engagement proxy; lifetime run-count trend
across sessions. Single device only.

**Risk / rollback.** Industry §2's stated failure mode: under-designed, it reads as
a debug tool and gets zero engagement. It needs a real layout pass, not a JSON dump.
Export must be clipboard/file only — never a network call (industry §3D, §3F).

---

### R6 — Expanded medals + trophy page

**Mechanism.** Grow the collection layer past four badges: no-hit clear, all-Pact-
bits, first KNIGHT kill, speedrun, seen-9/9-foes, seen-12/12-powers.

**Why it works here.** Industry #6: achievement research finds effectiveness is
"highly dependent on design," specifically favouring **high difficulty, low
quantity**, and names achievement as a dominant predictor of anti-churn in logged
player data. Today's four plaques are correctly sparse — the gap is that they are
all gated on the *same* finale condition (`unlockPlaques`, `plaques.js:28-36`),
which is exactly **G2**. Keep the new set sparse and hard; a dense checklist is the
version the research warns against.

**Reuses.** The plaque pattern verbatim (mask in localStorage + one pure unlock
function fed by world state). `FOES` (9 entries, `entities.js:109-173`) and `POWER`
(12 entries, `entities.js:5-105`) already back the GUIDE screens
(`menudraw.js:481,532`) — a "seen" bitmask over the same arrays is one column, not
a content system. Unlock conditions compute naturally from R1's stats tap.

**Sketch / effort.** **L, ~2d if R1+R5 ship first; 3–4d standalone.** New appended
`SCREEN` for the trophy grid.

**Invariant risk.** **Medium — the bitmask.** `PLAQUE` uses all four bits its
loader masks with `&15` (`plaques.js:5,24`), pinned at `mask===15` round-trip by
`tests/plaques.test.mjs:51-56`. Widening it in place would reinterpret existing
players' saved `15` under new bit semantics. Use a **new versioned key**
(`nb.medals.v1`, one int, 31 flags available). Same reasoning forbids new `PACT`
bits: `clampPact`'s `(p|0)&15` is full and load-bearing in `highscores.js:33`'s row
validator and the persisted `p` column.

**Success metric.** Local unlock distribution; trophy-page open rate.

**Risk / rollback.** Badge inflation. Cap the new set at ~8–12 genuinely hard
unlocks. Rollback: the v2 key is additive, so removing the screen leaves
`nb.plaques.v1` untouched.

---

### R7 — Time-attack stopwatch + MODES packaging

**Mechanism.** A passive stopwatch overlay plus per-room best-time persist. Plus a
MODES entry that surfaces the Pact toggles under friendly names.

**Why it works here.** Feasibility #7 corrects the framing: two of the three
commonly-requested "modes" **already ship** as Pact bits — `PACT.LAST` is iron
(lives=1), `PACT.BARE` is pickup-less (`pact.js:22,24`). The real gap is
discoverability for players who never find LEVEL SELECT's `1-4` toggles, plus one
genuinely new mode. Supports industry #3/#4's flow-channel argument: player-selected
difficulty is the determinism-safe substitute for engine-side DDA.

**Reuses.** `world.time`; `PACT_NAME`/`pactLabel` short codes (`pact.js:2,9-18`).

**Sketch / effort.** **S, 0.5–1d** for the scoreboard version.

**Invariant risk.** Low **only if it stays a scoreboard framing.** A
fail-on-timeout rule adds a genuine new LOSE branch to `sim.js` — feasibility prices
that at M, 1.5–2d and it needs a determinism-replay test alongside
`tests/determinism.test.mjs:76-86`. **Recommendation: scoreboard only.**

**Success metric.** Fastest-clear-time distribution; MODES-entry adoption vs raw
Pact-toggle usage (discoverability proxy).

**Risk / rollback.** Pace confusion — a best time is only comparable within the same
`pace` (`sim.js:124`). Stamp pace on every recorded time.

---

### R8 — Challenge-code — the honest substitute for a leaderboard

**Marked infeasible-as-described (1 of 2).** Feasibility's Infeasible list: with no
server, **no party can verify a pasted score came from actually playing that seed**
(`store.js:1-7`, `transport.js:49-51`). "Leaderboard" implies verified ranking; this
codebase cannot provide that. It is not a determinism or zero-deps violation — it
fails specifically on the named "no server" lock.

**Honest substitute.** Encode only `seed,heat,pact,pace` — **drop the score field
entirely.** A player pastes a code and gets that exact run; their own device records
their own attempt in `nb.highscores.v1`. Share a challenge, not a claim.

**Reuses.** `createWorld(seed,...)`; `copyPayload`/`KeyC` (`main.js:307-313`).
A base36 pack of small integers, one pure module.

**Effort.** **S-M, ~1.5d** (codec + round-trip tests + one paste-entry hook).
**Invariant risk.** Low. Must carry the full 5-tuple minus level, or it desyncs (§3).

**Success metric.** Local generate/paste counts only. No cross-player measurement is
possible, by design.

**Risk / rollback.** The risk is **framing**, not code. Never ship the word
"leaderboard" on this feature.

---

### R9 — Personal-best ghost replay

**Mechanism.** A translucent replay of the player's own best clear for that
room+heat, raced against live.

**Why it works here.** Industry #8: ghost-vs-personal-best is a long-standing
time-trial pattern, with the specific guidance that a ghost *just ahead* of the
current PB sustains motivation better than one far ahead. **Grade: industry-practice
evidence, not controlled study — industry's own words, and the weakest of its top
five.** That grade, plus the cost below, is why it is demoted out of this report's
top 5.

**Reuses.** Ghost rendering already exists for the coach and demobot. The high-score
numbers become something visible instead of a row.

**Sketch / effort.** **Position log, not intent replay** (feasibility #3): record
`x,y,face` per tick (downsampled ~10/s is visually indistinguishable). Intent replay
would double per-frame sim cost and its second world's `events` would double-fire
SFX through `consumeEvents`. Both fit `localStorage`, so **CPU and desync risk are
the discriminators** and the position log wins both. **L, 2d 2D-only / 4–5d for
2D+3D parity** plus a required headed play-verify (AGENTS.md: visual 3D feel is not
covered by Node).

**Invariant risk.** None to sim purity if positions are logged read-only and never
fed back into `step()`. **Gate playback on all five tuple fields matching** (§3) —
a ghost recorded at one pace desyncs silently at another. Real **scheduling** risk:
rendering needs the player sprite draw path, and `sprites.js` is mid-edit this
session.

**Success metric.** % of runs where a ghost was raced.

**Risk / rollback.** Storage schema drift across versions; stamp a version field.
Rollback: refuse to load mismatched records — the gate already exists.

---

### R10 — Coach v2: contextual kick / throw / remote tips

**Mechanism.** First-use tips for the three advanced verbs, in the shape v1 already
proved: transient, dismissed on action, never modal.

**Why it works here.** Industry #2 validates the *existing* coach against the
evidence — FTUE research favours opt-in, in-context hints over a scripted
walkthrough. v2 extends the same shape to the mechanics most likely to go
undiscovered.

**Reuses.** `drawCoach`'s panel (`scenes.js:255-294`); the same events tap; the
`{t:"power",kind:...}` stream (`entities.js:178`).

**Sketch / effort.** **S-M, ~1.5d** — `nb.coach.v2` object, three triggers, three
overlay variants, tests mirroring `coach.test.mjs`.

**Invariant risk.** Low on sim/determinism (app+render only, same as v1). **Immediate
scheduling collision: `tests/coach.test.mjs` is dirty right now** — sequence after
that lands.

**Success metric.** Kick/throw/remote usage rate in the first N runs, before vs after.

**Risk / rollback.** Tip fatigue. One tip per verb, once, ever. Rollback: the persist
flag defaults to shown-already.

---

### R11 — Colourblind audit + pause-anywhere verification

**Mechanism.** A CVD simulation pass over the palette; a verification pass that
nothing blocks PAUSE mid-transition.

**Why it works here.** Retention you never lose is cheaper than retention you win
back. REDUCE FLASH already ships (`OPT_ROWS`, `menuapp.js:51`; `flx` bit,
`settings.js:16`), so this closes the remaining cheap gaps.

**Reuses.** Colours are already centralised — `BIOMES` (`config.js:17-26`),
`PACT_COL` (`pact.js:3`), `HEAT_COL` (`heat.js:6`) — which is why this is cheap.

**Effort.** **S, 0.5–1d combined.** Mostly audit; expect to swap 1–2 hex values
where adjacent colours collide. Respect the 2D gate already recorded in AGENTS.md:
no swatch may collapse on value *and* hue at once.

**Invariant risk.** None.

**Success metric.** Design review, not an in-game number. Say so rather than
inventing one.

**Note:** feasibility #11 explicitly warns **not** to lump *resume-on-return* into
this cheap bucket — it needs full-fidelity serialisation of everything
`determinism.test.mjs:25-58` checks including `rng.state`, and `makeSnapshot`
(`protocol.js:112-127`) is **lossy** (rounds positions, drops rng state) so reusing
it would silently reintroduce non-determinism. Rejected — see appendix.

---

### R12 — Passive consecutive-day read (the defanged streak)

**Mechanism.** A consecutive-day count, shown **only** inside the opt-in STATS
screen. No banner, no warning, no "don't lose it", no freeze.

**Why it works here — and why it is not a top-5 bet.** Industry #11 has the best raw
evidence on the whole list (Duolingo: reported ~2x daily retention for streak
holders, a 14% D14 lift in a streak-wager experiment) and the **worst brand fit**:
the documented mechanism *is* loss aversion. Industry §2 explicitly parks it.
Feasibility #5 costs it at S-M and proposes a MENU "welcome back" banner —
**this report declines the banner**, because a surfaced count that greets you is
the first step back toward the pressure the evidence is actually measuring. State
plainly: defanging keeps the record-keeping and discards most of the studied lift.

**Reuses.** Nothing new. Industry §3B: the consecutive-day count is a **derived read**
over `first_seen`/`last_seen` in `nb.stats.v1` — no separate store, no
`src/app/streak.js`.

**Effort.** **S, ~0.5d after R5.** **Invariant risk.** None; `Date` at the app layer only.

**Success metric.** Streak-length distribution vs sessions-per-week, single device.

**Risk / rollback.** The risk is drift. If anyone later proposes a banner, a
notification or a freeze, that is a new design decision, not a follow-up. Rollback:
hide one line.

---

### D1 — Decision: LOSE hard reset vs continue-credit

**Not an engineering question.** `loadLevel(world, level, true)` already exists and
is exactly what WIN's next-room transition uses (`world.js:44`, `sim.js:60`). LOSE's
`startGame` unconditionally calls `loadLevel(world,1,false)` (`sim.js:107-111`).
Swapping it is a small diff. Both options costed:

| | **Option A — keep the reset (status quo)** | **Option B — continue-credit** |
|---|---|---|
| Change | None | `loadLevel(world, world.level, true)` + score/lives penalty |
| Effort | 0 | **S, 0.5–1d** mechanically |
| Precedent | The team already decided this **on purpose**: end-screen.md:5 states the goal as "stop calling a full credit reset 'retry'", and end-screen.md:7 pins "LOSE `startGame` → room 1 score 0". arcade-loop-design.md:36-37 repeats it: "credit arcade, not continue" | **Reverses** a named, recent, deliberate decision — needs product sign-off, not an engineering nod |
| Cost | **G1 stands**: the modal outcome (room 2–4 death) leaves nothing durable | Softens G1 directly, at the price of the arcade identity the genre classic's cabinets established and this project chose |
| Test exposure | None | Touches LOSE semantics pinned by `tests/sim.test.mjs` / `determinism.test.mjs` |
| Measurable? | — | Runs-per-session before/after — but **no telemetry exists today to settle it**; it would need manual observation, or R5 shipping first |

**This report's recommendation: Option A + R1.** The audit's own diagnosis of G1 is
that the loss produces *no durable feedback* — not that the reset itself is wrong.
Per-room bests, furthest-room-reached and a truthful delta fix the diagnosed
problem without reversing a decision the team made three days ago. If R1 ships and
runs-per-session still does not move, revisit Option B with data instead of
argument. **The call is the owner's — Q1 in §7.**

---

## 5. Measurement plan

**Principle (industry §3): measure locally, store locally, share only if the player
chooses to. Nothing here makes a network call.**

**A. `nb.stats.v1` — an append-only, size-capped ring buffer** in the same `nb.*`
family as `nb.highscores.v1` / `nb.plaques.v1` / `nb.coach.v1`. Coarse events:
`session_start`, `room_enter{room,heat,pact,pace}`, `room_clear`, `death`,
`win_finale`, `score_set{heat}`, `plaque_unlock{bit}`, `coach_shown`,
`coach_dismissed{reason}`. Timestamps use `Date.now()` **at the app layer only**,
never inside `step()` (`world.js:10`, `sim.js:37-39`). Written at the one existing
non-destructive events read (`main.js:563-570`), before `renderer.js:36-40` drains.

**B. What "retention improved" means without a server**

| Signal | How | Honest limitation |
|---|---|---|
| Session length | last-event time − `session_start` | Answers "did R2/R1 make people play longer per sitting" |
| Return cadence (private D1/D7 proxy) | `first_seen`/`last_seen`, bucket days-since-last | **Cannot see cross-device returns; will undercount real retention.** Say so wherever it is quoted |
| Depth of engagement | rooms reached, Heat distribution, Pact usage | Tells you whether R7/Heat/Pact are used or ignored |
| Near-miss base rate | how often a loss lands within a threshold of the player's own best | Doubles as the tripwire: a sudden shift in this measured rate after a change is the red flag for drift into manufactured near-misses |
| Consecutive days | derived read over `first_seen`/`last_seen` | No separate mechanism (R12) |

**C. The opt-in STATS screen (R5) is the measurement UI.** The player sees the same
local data the team would reason from — telemetry visible and inspectable rather
than hidden. That is the point, not a side effect.

**D. Voluntary, explicit export.** "Copy my stats" to clipboard, reusing the
existing `copyPayload`/`KeyC` seam. If the team wants research data, the ask is
manual every time ("if you're willing, paste your exported stats"). This is the only
channel by which the team ever sees another player's data.

**E. Platform dashboards — conditional, not planned.** CrazyGames and Poki report D1
and average session time in their own developer dashboards **for titles listed
there** (industry §3E; CrazyGames cites strong titles at 10–15% D1, 10+ min average
session — a platform benchmark, not a Fusegrid number). **No such listing exists or
is currently planned:** the audit's launch targets are itch / Newgrounds / Game Jolt
(arcade-loop-design.md:3), which report page-views and downloads only. Cross-portal
comparison will be uneven; do not assume parity.

**F. Explicit non-goal: no analytics beacon.** It is the single change on this list
that would actually break the "no server" identity everything else is built around.
The honest answer to "how do we know retention improved" is: local proxies +
whatever the hosting portal already measures + what players choose to send.

---

## 6. Roadmap

**One-time tax, priced once (feasibility Ground truth): every new `nb.*` key or new
`src/app/*.js` file costs one line in `src/pwa/shell.js` plus a paired
`CACHE_NAME` + REV bump in `sw.js` (AGENTS.md). ~0.1–0.2d per wave, not per item.**
Wave 1 adds one key (R7's best-time store); wave 2 adds up to four (`nb.bests.v1`,
`nb.stats.v1`, `nb.daily.v1`, `nb.coach.v2`); wave 3 adds two (`nb.medals.v1`,
the ghost store).

### Wave 1 — quick wins, ≤1 day each. **This is the first wave we would ship next.**

Wave 1 is **not** the top 5 of §1 — that ranking is by expected effect, this one is
by what can land next week without colliding with live edits. R1 and R3 are ranked
higher and ship in wave 2; R7 and R11 rank lower but are unblocked today.

| Item | Effort | Why now |
|---|---|---|
| R2 combo/chain callout + close-call flash (**visual half only**) | 1–1.5d | Cheapest high-value; zero `step()` edits. Sound after `src/audio/*` lands |
| R11 colourblind audit + pause-anywhere verification | 0.5–1d | Pure audit, no code collision |
| R7 time-attack stopwatch + MODES packaging | 0.5–1d | Scoreboard-only; surfaces two modes that already ship as Pact bits |
| R4 first-visit Play Now finish + 90s headed verify | 0.5–1d | Gates the portal launch; already speced |

**Chosen because none of it touches the files under live edit.** `sprites.js` and
`src/audio/*` are mid-edit by teammates; `tests/coach.test.mjs`,
`tests/menudraw.test.mjs`, `tests/three.test.mjs` are dirty in git status right now.
Wave 1 stays clear of all of them. Anything landing in `scenes.js` — R1's summary
text, the near-miss delta — carries the 0.5–1d coordination buffer and belongs in
wave 2.

### Wave 2 — mid, ≤3 days each

| Item | Effort | Depends on |
|---|---|---|
| **R1 run summary + per-room bests + delta-to-best** | 2.5–3d | `scenes.js` / `menudraw.test.mjs` edits landing. **Ship first in this wave — R5 and R6 both get cheaper.** |
| R5 STATS screen + `nb.stats.v1` | 2d | R1's stats tap; **Q2** (§7) |
| R3 daily seeded challenge | 2d | None (independent — can run in parallel with R1) |
| R8 challenge-code | 1.5d | Shares R3's seed plumbing — sequence after R3 |
| R10 coach v2 | 1.5d | `tests/coach.test.mjs` landing first |

### Wave 3 — big, >3 days, or dependent

| Item | Effort | Depends on |
|---|---|---|
| R6 expanded medals + trophy page | 2d (after R1+R5) / 3–4d standalone | R1, R5, **Q2** |
| R9 ghost replay | 2d 2D-only / 4–5d parity | `sprites.js` landing; position-log encoding |
| R12 consecutive-day read | 0.5d | R5 |

**Suggested order:** wave 1 as listed → R1 → (R3 ∥ R5) → R8, R10 → R6 → R9 → R12.
**D1 blocks nothing** — but if the owner picks Option B, do it *before* R1, since
R1's per-room bests are the mitigation designed for Option A.

---

## 7. Open questions for the owner

1. **Continue-credit or arcade reset?** (D1) Both costed above; Option B is 0.5–1d
   mechanically but reverses end-screen.md:5's named decision. Our recommendation is
   Option A + R1, revisit with data. Only you can overrule the earlier call.
2. **Does "no new `SCREEN`" stand as standing policy?** AGENTS.md:32-33 forbids only
   PAUSE/WIN/LOSE as `SCREEN` values, and `menuapp.js:27-28` shows two appended
   screens. arcade-loop-design.md:7 and end-screen.md:15 state it more strictly.
   If the strict reading stands, R5 and R6 need to become sub-pages of GUIDE/SCORES.
3. **Is the daily challenge worth shipping in its honest, single-device form?** It
   cannot compare a player against anyone else without a server (industry #10,
   feasibility Infeasible #2). It is still the only date-anchored return hook we have.
4. **How sparse should the new medal set be?** Industry #6's evidence favours high
   difficulty / low quantity; today's four are correctly sparse. Our proposal is
   ~8–12 hard unlocks. Confirm the ceiling before R6 is built.
5. **Does the consecutive-day count ship at all?** It is honest but weak by
   construction, and its strongest documented form is the one this brand refuses.
   Ship as a passive line in STATS, or drop it entirely?

---

## Appendix — full candidate list, with verdicts

| Candidate | Source | Verdict |
|---|---|---|
| Sub-90s time-to-first-play | ind #1 | **Adopt** (R4) — strongest-graded evidence; gates everything else |
| First-GAME ghost coach | ind #2 | **Shipped** — validated: already matches the opt-in/in-context evidence |
| Player-selected Heat tiers | ind #3 | **Shipped** — and the correct determinism-safe substitute for DDA. Say so in any pitch |
| Pact modifiers | ind #4 | **Shipped** — extends content lifespan per dev-hour; surface better via R7 |
| Local high scores by Heat | ind #5 | **Shipped** — evidence is inference from score-chase literature, not a direct study |
| Plaques (4-bit) | ind #6 | **Shipped**, correctly sparse — **extend** via R6 with a new v2 key |
| Honest end screen + copy stamp | ind #7 | **Shipped** — **extend** via R1 |
| PB ghost replay | ind #8 / feas #3 | **Adopt, wave 3** (R9) — weakest citation grade of industry's top 5; L effort; `sprites.js` mid-edit |
| Near-miss / delta-to-best | ind #9 / feas #2 | **Adopt, ranked #1** (R1) — cheap, real numbers only; the manufactured version is a hard refusal |
| Daily seeded challenge | ind #10 / feas #1 | **Adopt** (R3) — honest single-device version only |
| Streak counter | ind #11 / feas #5 | **Adopt defanged, wave 3** (R12) — passive read in STATS. **Reject** the MENU welcome-back banner, notifications, freezes, loss framing |
| Juice pass / near-death feedback | ind #12 / feas #6 | **Adopt** (R2) — predicts playtime, not D1/D7; say which |
| Chain/combo scoring | ind #13 | **Adopt as feedback only** (R2). **Reject** as a scoring change — weakest evidence grade on the list against a `step()`-touching cost |
| Rotating "featured heat" on menu | ind #14 | **Defer** — indirect evidence, thin effect; folds into R7's MODES page for free if that ships |
| First-visit Play Now | ind #15 | **Adopt** (R4) — sequenced after arcade-loop item 1, per the spec's own order |
| Exportable run log / STATS screen | ind #16 / feas #9 | **Adopt** (R5) — pays twice: mild retention plus the whole measurement plan |
| Per-room/per-heat bests + run summary | feas #2 | **Adopt** (R1) |
| Expanded medals + trophy page | feas #4 | **Adopt, wave 3** (R6) — new `nb.medals.v1`, never widen `&15` |
| Challenge modes / time attack | feas #7 | **Adopt scoreboard-only** (R7). **Reject** fail-on-timeout — new LOSE branch in the locked sim for a packaging win |
| Continue-from-room credit | feas #8 | **Owner call** (D1) — recommendation: keep the reset, ship R1 |
| Coach v2 tips | feas #10 | **Adopt** (R10) — after `tests/coach.test.mjs` lands |
| Colourblind + pause audits | feas #11a | **Adopt** (R11) |
| Resume-on-return | feas #11b | **Reject.** Needs full-fidelity serialisation of everything `determinism.test.mjs:25-58` checks incl. `rng.state`; `makeSnapshot` (`protocol.js:112-127`) is lossy and would silently reintroduce non-determinism. Feasibility's own read: "arguably don't do this" |
| Share-code with a score field | feas #12 | **Reject as described** — unverifiable without a server. **Adopt** the score-free challenge-code (R8). Never call it a leaderboard |
| Enforced one-attempt-per-day | feas Infeasible #2 | **Reject as described** — `localStorage` only (`store.js:1-7`); bypassed by a private window. Ship as an honour-system marker inside R3 |
| Server-side analytics beacon | ind §3F | **Reject** — the one item that would break the "no server" identity the rest of this report is built on |
| New `PACT` bits | feas #7 | **Reject** — `(p\|0)&15` is full and load-bearing in `highscores.js:33` and the persisted `p` column |
