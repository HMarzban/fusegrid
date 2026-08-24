# rollblock netcode lockstep design (v1)

Branch: `campaigns/touch-render-net` · Date: 2026-08-23 · Status: APPROVED (executed)
Scope ruling (binding, HoE): **v1 = lockstep-ready core, NO internet play.** Zero-dep constraint forbids shipping a WS server (Node has no builtin WS server module). Deliverables: protocol correctness, validation gates, two-player local proof.

## §1 DECISION MEMO — lockstep chosen

**Lockstep over snapshot-sync**, rationale:
1. Determinism thesis proven and enforced by tests: replay/outcome validity begins at `e56eadf`, rng-draw-sequence stability at `e84d3b9` (MEMORY.md). Sim is pure w.r.t. `(world, intent, dt)` — same seed + same input stream ⇒ same world, every field.
2. `tests/determinism.test.mjs` ships a **full-field comparator** (`sameWorld`) — the exact tool needed to assert two-peer equality after N ticks.
3. Snapshot-sync would require de-fabricating `applySnapshot` (it currently invents enemy dynamics — §9), then prediction + reconciliation + interpolation; breaks zero-dep/no-build invariants for no benefit until internet play exists.
4. Cost asymmetry: lockstep core ≈ one module (`src/net/lockstep.js`) + one test file + small wiring. Snapshot path is a v2 project.

**Non-goals (v1):** internet WS server, auth, reconnect/backoff, prediction/reconciliation, interest management, spectate. All v2.

## §2 PROTOCOL COMPLETION (`src/net/protocol.js`)

### §2.1 Message shapes

| type | shape | notes |
|---|---|---|
| JOIN | `{t:"join", name}` | no pid yet |
| WELCOME | `{t:"welcome", pid, seed, tick}` | seed = server-authoritative u32 |
| INPUT | `{t:"input", pid, seq, tick, inputs}` | seq monotonic per-pid from 0 |
| LEAVE | `{t:"leave", pid}` | graceful exit |
| PAUSE / RESUME / RESTART / MENU | `{t:"pause"|"resume"|"restart"|"menu", pid}` | host-gated RPCs |
| ERROR | `{t:"error", code, msg}` | codes: `"bad_seq"`, `"bad_seed"`, `"bad_shape"`, `"unknown_pid"` |

All post-WELCOME messages carry pid. `inputs` = full intent map. `seq`/`tick` integers ≥0. Decoder rejects unknown `t` fail-closed (drop, no throw).

### §2.2 Seed semantics
Host generates seed; distributes only via `WELCOME.seed`. Both peers `loadLevel(seed)` with identical u32 ⇒ identical boards/RNG. Joiner never generates a seed; WELCOME failing validation → hard reject (`ERROR bad_seed` + close).

### §2.3 LEAVE handling
On LEAVE from P: stop accepting P's inputs; mark P's player entity dead via existing sim death path (entity stays on board); append `leave` event to world.events. Later INPUT from left pid → `ERROR unknown_pid`.

### §2.4 Pause/resume/restart/menu
Host-gated RPCs: any peer may request, host applies, stamps its tick; requesters apply when their buffer reaches that tick. RESTART allocates fresh seed + re-handshake.

## §3 SEQ CONSUMPTION + LOCKSTEP BUFFER (`src/net/lockstep.js`)

### §3.1 Fixed 2-frame delay window
Local input scheduled for tick T applied at T+DELAY, DELAY=2. Buffer `pending[pid][tick]→inputs`.
Per simulated tick T:
1. Enqueue own input for T (sampled once, stamped seq++).
2. Any remote pid missing entry for T → **stall**: no step(), no time advance; retry next frame.
3. All present → consume ascending pid order, step merged map, advance.

### §3.2 Seq rule
Accept iff `seq === lastSeq[pid]+1` (init −1). `seq<=lastSeq` → silent drop (dup/replay). `seq>lastSeq+1` → `ERROR bad_seq` + halt (gaps fatal in v1). lastSeq resets on RESTART/MENU.

### §3.3 Stall timeout
Stalled ≥30 consecutive frames → emit `stall` event, keep waiting. No auto-disconnect v1.

## §4 VALIDATION GATES (fail-closed)

### §4.1 validateInput(msg)
Reject unless: `t==="input"`; pid integer [0,MAX_PLAYERS−1] (MAX_PLAYERS=4); seq integer ≥0 ≤lastSeq+1; tick integer within `[now, now+DELAY]`; inputs keys ⊆ intent keys, dx/dy∈{−1,0,1}, booleans strictly boolean, all numbers finite. Failure ⇒ drop.

### §4.2 validateWelcome(msg)
Reject unless pid valid; seed integer [0, 2^31−1]; tick ≥0. Fail ⇒ close transport.

### §4.3 Array caps
Any array-bearing message passes length ≤64 before decode completes.

Validators exported from protocol.js; transport calls them at receive boundary pre-delivery. Invalid ⇒ counted on a `dropped` counter, never thrown.

## §5 TWO-WORLD PROOF TEST (THE deliverable)

`tests/net_lockstep.test.mjs`: mkPair() = two worlds same seed, paired LocalTransports, two createLockstep instances; scripted deterministic intents both sides; N≥600 ticks crossing bomb/explosion/AI branches; assert `sameWorld(la.world, lb.world)` full-field.
Cases: (a) 3-tick artificial lag one direction → stall fires, convergence resumes; (b) duplicate INPUT dropped, equality holds; (c) out-of-order/gap seq → bad_seq + deterministic halt; (d) LEAVE mid-run → both worlds agree post-leave; (e) PAUSE/RESUME round-trip at same tick both sides.

## §6 INTEGRATION (`src/main.js`)
`?net=local` flag constructs the local pair harness; flag-off byte-identical. Loop's step call becomes lockstep.tick() behind the flag. WebSocketTransport gains validation hooks at receive boundary; marked v2, unreconnectable.

## §7 ACCEPTANCE CHECKLIST
1. protocol exports all §2.1 helpers; unknown-type decode drops.
2. Seed flows host→joiner via WELCOME only.
3. LEAVE → dead-entity + event + unknown_pid rejection after.
4. validateInput rejects NaN/Inf, wrong enums, out-of-range pid/tick, coerced booleans, oversized arrays.
5. validateWelcome rejects bad/missing seed; closes transport.
6. Lockstep: DELAY=2; stall on missing peer; no time advance during stall; 30-frame stall event.
7. Two-world proof green across all five cases with sameWorld.
8. ?net=local flag; flag-off unchanged suites.

## §8 NON-GOALS (v2 backlog)
Internet WS server · auth · reconnect · prediction/reconciliation · snapshot-sync (incl. applySnapshot completion) · adaptive jitter · spectate.

## §9 APPLY-SNAPSHOT HONESTY RULING
`applySnapshot` fabricates enemy dynamics. Ruling: mark explicitly lockstep-incompatible (JSDoc @deprecated note); remove from public-facing surface where feasible without breaking imports. Field completion deferred to v2 snapshot-sync track against real spawnEnemy-derived data.
