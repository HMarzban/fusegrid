# R8 — Challenge code: a board, never a claim — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `B` on a WIN or LOSE copies
`https://hmarzban.github.io/fusegrid/?code=F1021I3V93H8` — twelve characters
carrying seed, heat, pact and pace, and **nothing else**. Pasting that link into
an address bar starts the identical board. No score travels, no rank travels,
and the refused ranking word never reaches `src/` or `tests/` — which this plan
turns into an executable gate rather than a promise.

**Architecture:** One new module (`src/app/code.js`), pure and store-free: a
base36 codec with a version prefix, a 7-character seed field, a 2-character
config field and a 1-character checksum, so a wrong keystroke in a pasted link is
**refused** rather than played as a different board — measured at 98.0–99.1% of
single-character typos, disclosed below rather than claimed as perfect. Entry is `?code=` through
`readFlags` — refused a `window.prompt` because `src/app/` is DOM-free by
construction, `main.js`'s seams must stay out of `main.js`, and a modal prompt is
a blocking DOM call inside an RAF loop. The URL is also the **better product**:
the thing the sender copies *is* a link, so "paste it in the address bar" is the
entire interaction, and `readFlags` makes the whole path drivable from Node with
no `location`. `B` is for **board** — the honest word for what the code carries,
and the framing lands in the key legend itself.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`. Zero npm
runtime deps. `src/app/` is DOM-free; `src/core` is untouched.

**Spec:** `docs/superpowers/specs/2026-09-07-retention-wave2-design.md` §5

**Index:** `docs/superpowers/plans/2026-09-07-retention-wave2.md` — its
**Shared interfaces** block is authoritative for every signature below.

**Depends on:** R3 (`2026-09-07-daily-seed.md`). R8 reuses `args.seed`,
`_playCore` and `copyText` verbatim — R3's seed plumbing must exist first.
**Consequence: every `main.js` and `menuapp.js` line number cited in the spec is
stale by the time this plan runs — locate every edit by string.**

## Global Constraints

- **No score field and no level field.** The score is refused because it is
  unverifiable without a server; the level is refused because the tuple is the
  full 5-tuple **minus level** — a challenge is a board, and a board is a seed
  plus the knobs that change what generates on it.
- **The word `leaderboard` never reaches `src/` or `tests/`.** This plan adds the
  gate: a case-insensitive assertion inside `tests/banned-name.test.mjs`'s
  existing `git ls-files` walk, **scoped to those two trees**. `docs/` is
  deliberately exempt — the retention report and the wave-2 spec name the term in
  order to refuse it, and a tree-wide gate would make refusing it impossible to
  write down.
- **A bad code is refused, never guessed.** `decodeChallenge` re-computes the
  checksum and range-checks both fields, returning `null` on any failure. An
  undecodable `?code=` falls through to the normal boot — a bad link lands you in
  the game, never on an error screen. **Disclosed, and measured rather than
  assumed:** a one-character base36 checksum catches **98.0–99.1%** of
  single-character typos across the four pinned codes, not 100% — a mutation
  whose character-code delta is exactly ±36 (`"0"` → `"L"`) leaves the sum
  unchanged. Task 1's pin measures the real rate; widening the checksum is a
  wave-3 question and is not pre-decided here.
- **`?code=` wins over `?play=1`** when both are present: it is the more specific
  instruction.
- **`KeyB` is unbound today** in `input.js` (which binds `W A S D Q K P` plus
  `Space`/`J`/`X` as fire) and in `main.js` (`R`, `C`, `M`) and in
  `menuapp.key()` (Enter, Escape, Backspace, `M`, arrows/WASD, `Digit1..5`,
  `[`, `]`). `KeyX` — the obvious letter — is a **fire** key
  (`input.js:36,44,58`), which is why the whole bound set was enumerated before
  `KeyB` was picked.
- **Two asymmetries are disclosed rather than fixed.** (1) A challenge run
  honours the decoded pact bits **even when `pactUnlocked` is false**, and never
  writes `nb.pact.v1`: that gate governs what a player may *choose for
  themselves*; it cannot govern what a shared board *contains*, because pact
  changes the board (`applyPact`'s `buriedAdd` → item count → rng draw order), so
  stripping it would hand the recipient a different board under the same code —
  the one thing this feature exists to prevent. (2) A locked recipient still
  stops at room 5: `roomCap(pactUnlocked)` (`config.js:28-31`) is a progression
  cap, not a board property. Same boards, shorter run.
- **`overlayCue` is not touched.** R8 changes only `drawOverlay`'s
  concatenation, through R1's `COPY_HINT` constant, so
  `tests/heat.test.mjs:49-69`'s four exact-string pins are unmoved.
- **`main.js`'s line pin rises to 798 exactly once**, in **Task 2** — this plan's
  first `main.js`-touching task. Additions total **+9** over R3's 788.
- **`src/pwa/shell.js`'s `SRC` entry for `src/app/code.js` is mandatory.**
- PWA: bump `CACHE_NAME` + `sw.js:3` `REV` **together**, `current vN → vN+1`, in
  **every** commit here. **Read the current value first.**
- Comments only where the file already uses them.
- Never write the private reference game's name into any committed file.

---

### Task 1: `src/app/code.js` — the codec, and the refusal gate

**Files:**
- Create: `src/app/code.js`
- Create: `tests/code.test.mjs`
- Modify: `tests/banned-name.test.mjs` — the `leaderboard` assertion over `src/`
  and `tests/`
- Modify: `src/pwa/shell.js` — `SRC` gains `"src/app/code.js"` (after
  `"src/app/cabinetseen.js"`), and `:1` `CACHE_NAME`
- Modify: `sw.js:3`

**Interfaces:**
- Consumes: nothing — the module is pure and importless beyond its own maths
- Produces: `CODE_V`, `encodeChallenge`, `decodeChallenge`

- [ ] **Step 1: Write the failing tests** — create `tests/code.test.mjs`

```js
import { CODE_V, encodeChallenge, decodeChallenge } from "../src/app/code.js";
import { createRng } from "../src/core/rng.js";

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

// ---- 1. the four measured round-trips, both directions ----
{
  check("CODE_V is F1", CODE_V === "F1", CODE_V);
  const want = [
    [{ seed: 4119412512, heat: 0, pact: 0, pace: 0 }, "F11W4LB1C01E"],
    [{ seed: 123456789, heat: 2, pact: 9, pace: 1 }, "F1021I3V93H8"],
    [{ seed: 0, heat: 0, pact: 0, pace: -1 }, "F1000000000B"],
    [{ seed: 4294967295, heat: 2, pact: 15, pace: 1 }, "F11Z141Z33Z6"],
  ];
  const badEnc = want.filter(([t, s]) => encodeChallenge(t) !== s);
  check(
    "encodeChallenge matches the four measured codes exactly",
    !badEnc.length,
    JSON.stringify(badEnc.map(([t]) => [t, encodeChallenge(t)])),
  );
  const badDec = want.filter(([t, s]) => {
    const d = decodeChallenge(s);
    return !d || d.seed !== t.seed || d.heat !== t.heat || d.pact !== t.pact || d.pace !== t.pace;
  });
  check(
    "decodeChallenge recovers each tuple exactly",
    !badDec.length,
    JSON.stringify(badDec.map(([, s]) => [s, decodeChallenge(s)])),
  );
  check(
    "every code is 12 uppercase chars matching /^F1[0-9A-Z]{10}$/",
    want.every(([, s]) => s.length === 12 && /^F1[0-9A-Z]{10}$/.test(s)),
  );
  /* b36(2^32-1) is seven chars and b36(143) is two, so neither field can
     overflow its padded width — the reason the widths are 7 and 2. */
  check(
    "the field widths are exactly what the maxima need",
    (4294967295).toString(36).toUpperCase() === "1Z141Z3" &&
      (143).toString(36).toUpperCase() === "3Z",
  );
}

// ---- 2. a bad code is REFUSED, never played as a different board ----
{
  const bad = [
    ["F1AAAAAAAAAA", "a wrong checksum"],
    ["F21W4LB1C01E", "a wrong version prefix"],
    ["F11W4LB1C01", "eleven characters"],
    ["F11W4LB1C01EX", "thirteen characters"],
    ["f11w4lb1c01x", "lowercase with a broken checksum"],
    ["F1000000003Z", "cfg above 143"],
    ["F1ZZZZZZZ01E", "a seed above 2^32-1"],
    [null, "null"],
    [undefined, "undefined"],
    [{}, "an object"],
    ["", "an empty string"],
  ];
  const wrong = bad.filter(([s]) => decodeChallenge(s) !== null);
  check(
    "every malformed input returns null rather than a guessed board",
    !wrong.length,
    JSON.stringify(wrong.map(([s]) => [s, decodeChallenge(s)])),
  );
  /* One wrong keystroke in a pasted link should be refused, not silently
     played: a recipient who thinks they are on the sender's board and is not is
     the worst outcome this feature can produce. A one-character base36 checksum
     is not a proof — a mutation whose char-code delta is exactly +/-36 (e.g.
     "0" -> "L") leaves the sum unchanged — so this measures the real rate
     rather than claiming perfection. Measured over all four pinned codes:
     98.0%-99.1%. The floor is set below the worst of them, with room to move. */
  const A36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const rates = ["F1021I3V93H8", "F11W4LB1C01E", "F1000000000B", "F11Z141Z33Z6"].map(
    (good) => {
      let refused = 0,
        total = 0;
      for (let i = 2; i < good.length; i++)
        for (const ch of A36) {
          if (ch === good[i]) continue;
          total++;
          if (decodeChallenge(good.slice(0, i) + ch + good.slice(i + 1)) === null) refused++;
        }
      return refused / total;
    },
  );
  check(
    "at least 97% of single-character typos are refused outright",
    rates.every((r) => r >= 0.97),
    rates.map((r) => (100 * r).toFixed(1) + "%").join(" "),
  );
  check(
    "a mutated version prefix is always refused, whatever the checksum says",
    decodeChallenge("F2021I3V93H8") === null && decodeChallenge("G1021I3V93H8") === null,
  );
}

// ---- 3. case and whitespace tolerance on the reader side ----
{
  check(
    "lowercase input with a valid checksum decodes — the reader uppercases first",
    JSON.stringify(decodeChallenge("f1021i3v93h8")) ===
      JSON.stringify(decodeChallenge("F1021I3V93H8")),
    JSON.stringify(decodeChallenge("f1021i3v93h8")),
  );
  check(
    "surrounding whitespace from a sloppy paste is trimmed",
    JSON.stringify(decodeChallenge("  F1021I3V93H8 \n")) ===
      JSON.stringify(decodeChallenge("F1021I3V93H8")),
  );
}

// ---- 4. fuzz: 10 000 tuples round-trip, no Math.random anywhere ----
{
  const rng = createRng(20260907);
  let bad = 0,
    shape = 0;
  for (let i = 0; i < 10000; i++) {
    const t = {
      seed: rng.int(0, 4294967295) >>> 0,
      heat: rng.int(0, 2),
      pact: rng.int(0, 15),
      pace: rng.int(-1, 1),
    };
    const code = encodeChallenge(t);
    if (code.length !== 12 || !/^F1[0-9A-Z]{10}$/.test(code)) shape++;
    const d = decodeChallenge(code);
    if (!d || d.seed !== t.seed || d.heat !== t.heat || d.pact !== t.pact || d.pace !== t.pace)
      bad++;
  }
  check("10 000 pseudo-random tuples round-trip exactly", bad === 0, String(bad));
  check("and every one of them is a well-formed 12-char code", shape === 0, String(shape));
  const src = readFileSync("src/app/code.js", "utf8");
  check(
    "code.js carries no score field, no level field, and no Date/DOM/Math.random",
    !/score|level|Math\.random|\bDate\b|document|window/.test(src),
    (src.match(/score|level|Math\.random|Date|document|window/g) || []).join(","),
  );
}

console.log("\n  CODE RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
```

Add `import { readFileSync } from "node:fs";` to the file's imports (block 4
reads `code.js`).

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/code.test.mjs tests/banned-name.test.mjs tests/pwa.test.mjs
```

Expected: FAIL — `Cannot find module '.../src/app/code.js'`.
`banned-name.test.mjs` is still green at this step; it gains its new assertion in
Step 3 below.

- [ ] **Step 3: Implement**

**3a — create `src/app/code.js`:**

```js
export const CODE_V = "F1";
/* A challenge is a BOARD, not a claim: seed plus the three knobs that change
   what generates on it. No score field — unverifiable without a server, and
   this game has none by design. No level field either: the tuple is the
   five-tuple minus level, because the level is where you are, not what the
   board is.
   Twelve chars: "F1" + a 7-char base36 seed (b36(2^32-1) is "1Z141Z3") + a
   2-char base36 config (b36(143) is "3Z") + one base36 checksum. The checksum
   catches 98-99% of one-keystroke typos in a pasted link, so a mistyped code is
   refused rather than played as a different board — a recipient who thinks they
   are on the sender's board and is not is the worst outcome this feature can
   produce. It is not a proof: a delta of exactly +/-36 leaves the sum
   unchanged, and tests/code.test.mjs measures the real rate. */
const B36 = 36;
const b36 = (n) => n.toString(B36).toUpperCase();
const CODE_RE = /^F1[0-9A-Z]{10}$/;
const cl = (v, lo, hi) => {
  const n = v | 0;
  return n < lo ? lo : n > hi ? hi : n;
};
const sumOf = (s) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) n += s.charCodeAt(i);
  return n % B36;
};

export function encodeChallenge(t) {
  const c = t || {};
  const seed = (c.seed >>> 0) || 0;
  const cfg = cl(c.heat, 0, 2) * 48 + cl(c.pact, 0, 15) * 3 + (cl(c.pace, -1, 1) + 1);
  const body = CODE_V + b36(seed).padStart(7, "0") + b36(cfg).padStart(2, "0");
  return body + b36(sumOf(body));
}

export function decodeChallenge(s) {
  if (typeof s !== "string") return null;
  const code = s.trim().toUpperCase();
  if (!CODE_RE.test(code)) return null;
  const body = code.slice(0, 11);
  if (b36(sumOf(body)) !== code[11]) return null;
  const seed = parseInt(code.slice(2, 9), B36);
  const cfg = parseInt(code.slice(9, 11), B36);
  if (!isFinite(seed) || seed > 4294967295 || !isFinite(cfg) || cfg > 143) return null;
  return {
    seed: seed >>> 0,
    heat: Math.floor(cfg / 48),
    pact: Math.floor((cfg % 48) / 3),
    pace: (cfg % 3) - 1,
  };
}
```

**3b — the refusal gate** in `tests/banned-name.test.mjs`, appended after the
existing survivors check and reusing the same `tracked` walk, `BINARY_EXT` set
and `looksBinary` sniffer:

```js
/* R8 framing gate. The report's own instruction is that the refused ranking
   word never ships on this feature; the code carries a board, not a claim.
   Scoped to src/ and tests/ because docs/ names the term in order to refuse it
   — a tree-wide gate would make writing that refusal down impossible. Built by
   concatenation, like the name gate above, so this file cannot be a survivor of
   its own scan. */
const refused = "leader" + "board";
const refusedHits = [];
for (const rel of tracked) {
  if (!/^(src|tests)\//.test(rel)) continue;
  if (BINARY_EXT.has(extname(rel).toLowerCase())) continue;
  let buf;
  try {
    buf = readFileSync(join(ROOT, rel));
  } catch {
    continue;
  }
  if (looksBinary(buf)) continue;
  if (buf.toString("utf8").toLowerCase().includes(refused)) refusedHits.push(rel);
}
check(
  "no file under src/ or tests/ names the refused ranking word",
  refusedHits.length === 0,
  refusedHits.join(", "),
);
```

Then add `"src/app/code.js"` to `SRC` in `src/pwa/shell.js`, immediately after
`"src/app/cabinetseen.js"`.

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/code.test.mjs tests/banned-name.test.mjs tests/pwa.test.mjs
```

Expected: green, including `PRECACHE has ./src/app/code.js` and
`no file under src/ or tests/ names the refused ranking word`.

- [ ] **Step 5: PWA bump + commit**

```bash
git add src/app/code.js tests/code.test.mjs tests/banned-name.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add src/app/code.js: a twelve-character board code with a checksum.

The code carries seed, heat, pact and pace — the five-tuple minus level —
because a challenge is a board and a board is a seed plus the knobs that change
what generates on it. There is no score field: a score is unverifiable without
a server and this game has none by design. The checksum is what makes a
one-keystroke typo in a pasted link a refusal rather than a different board
played under the sender's name, which is the worst outcome the feature could
produce. The framing is also now enforced: a case-insensitive gate over src/
and tests/ fails the suite if the refused ranking word ever lands there, with
docs/ exempt because that is where the term is named in order to be refused.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: entry — `?code=` through `flags.js`, and `playChallenge`

**Files:**
- Modify: `src/app/flags.js` — `readFlags` gains `code`
- Modify: `src/app/menuapp.js` — `playChallenge(t)`, beside `playFromAttract`
- Modify: `src/main.js` — the `code.js` import; the `?code=` boot branch beside
  the existing `if (autoplay)` block (**locate by the string `if (autoplay)`**)
- Modify: `tests/code.test.mjs` — append blocks 5–7
- Modify: `tests/headless.test.mjs` — the `main.js` line pin and its reason
  comment
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `decodeChallenge`, `_playCore`, `clampHeat`/`clampPact`/`clampPace`
  (already imported by `menuapp.js`)
- Produces: `flags.code`, `app.playChallenge(t)`

- [ ] **Step 1: Write the failing tests**

Append to `tests/code.test.mjs`:

```js
import { readFlags } from "../src/app/flags.js";
import { SCREEN, createMenuApp } from "../src/app/menuapp.js";
import { createGame } from "../src/main.js";

// ---- 5. flags: ?code= parses, and nothing else can inject it ----
{
  check(
    "?code= parses a well-formed twelve-char code, uppercased",
    readFlags("?code=F1021I3V93H8").code === "F1021I3V93H8" &&
      readFlags("?code=f1021i3v93h8").code === "F1021I3V93H8",
    readFlags("?code=f1021i3v93h8").code,
  );
  check(
    "eleven or thirteen characters do not parse",
    readFlags("?code=F1021I3V93H").code === null &&
      readFlags("?code=F1021I3V93H8X").code === null,
    readFlags("?code=F1021I3V93H8X").code,
  );
  check(
    "the field defaults to null and rides beside the shipped flags",
    readFlags("").code === null &&
      readFlags("?render=3d&code=F1021I3V93H8").code === "F1021I3V93H8" &&
      readFlags("?render=3d&code=F1021I3V93H8").urlKind === "3d",
    JSON.stringify(readFlags("?render=3d&code=F1021I3V93H8")),
  );
  check(
    "opts cannot inject a code — the URL is the only door",
    readFlags("", { code: "F1021I3V93H8" }).code === null,
    String(readFlags("", { code: "F1021I3V93H8" }).code),
  );
}

// ---- 6. playChallenge honours the decoded pact even when it is locked ----
{
  const got = [];
  const a = createMenuApp({ onStart: (x) => got.push(x) });
  check("pactUnlocked starts false on a fresh cabinet", a.pactUnlocked === false);
  a.playChallenge({ seed: 123456789, heat: 2, pact: 9, pace: 1 });
  check(
    "the decoded pact bits pass THROUGH a locked gate — stripping them would change the board",
    got.length === 1 && got[0].pact === 9 && got[0].heat === 2 &&
      got[0].pace === 1 && got[0].seed === 123456789 && got[0].level === 1,
    JSON.stringify(got[0]),
  );
  check(
    "and playChallenge never grants the unlock as a side effect",
    a.pactUnlocked === false && a.screen === SCREEN.GAME,
    String(a.pactUnlocked),
  );
  check(
    "junk clamps rather than reaching the world raw",
    (() => {
      const b = createMenuApp({ onStart: (x) => got.push(x) });
      b.playChallenge({ seed: -1, heat: 99, pact: 999, pace: 9 });
      const g = got[got.length - 1];
      return g.heat === 2 && g.pact === 15 && g.pace === 1 && g.seed >= 0;
    })(),
    JSON.stringify(got[got.length - 1]),
  );
}

// ---- 7. main.js boot: the link IS the interaction ----
{
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)) };
  globalThis.window = { localStorage: ls, addEventListener() {} };
  try {
    const g = createGame(null, { seed: 7, code: "F1021I3V93H8" });
    /* opts.code is NOT a flags field (block 5 pins that), so this game must
       boot normally — the door is the URL, and readFlags is what reads it. */
    check(
      "opts.code alone does not start a challenge",
      g.world.seed === 7,
      String(g.world.seed),
    );
  } finally {
    delete globalThis.window;
  }
  const src = readFileSync("src/main.js", "utf8");
  check(
    "main.js decodes flags.code at boot and hands it to playChallenge",
    /flags\.code \? decodeChallenge\(flags\.code\) : null/.test(src) &&
      /app\.playChallenge\(chal\)/.test(src),
    (src.match(/const chal[^\n]*/) || [])[0],
  );
  check(
    "?code= wins over ?play=1 when both are present",
    /if \(autoplay && !chal\)/.test(src),
    (src.match(/if \(autoplay[^\n]*/) || [])[0],
  );
  check(
    "a challenge boot marks the cabinet seen, exactly as ?play=1 does",
    /if \(chal\) \{ app\.playChallenge\(chal\); saveCabinetSeen\(\); \}/.test(src),
    (src.match(/if \(chal\)[^\n]*/) || [])[0],
  );
  check(
    "there is no window.prompt anywhere — src/app is DOM-free and main's seams stay out of main",
    !/window\.prompt|\bprompt\(/.test(src) &&
      !/prompt/.test(readFileSync("src/app/code.js", "utf8")),
  );
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/code.test.mjs
```

Expected: FAIL — `?code= parses a well-formed twelve-char code -> undefined`
and `a.playChallenge is not a function`.

- [ ] **Step 3: Implement**

**3a — `src/app/flags.js`.** One matcher and one field, in the existing style:

```js
  const cm = s.match(/[?&]code=([0-9A-Za-z]{12})\b/);
```
```js
    code: cm ? cm[1].toUpperCase() : null,
```

`code` is deliberately **URL-only**: unlike `autoplay`/`netLocal`/`orbit`/`debug`
it takes no `opts` fallback, because the whole product claim is that the link is
the interaction.

**3b — `src/app/menuapp.js`.** Beside `playFromAttract`:

```js
    /* A challenge run honours the DECODED pact bits even when pactUnlocked is
       false, and never writes nb.pact.v1. That gate governs what a player may
       choose FOR THEMSELVES; it cannot govern what a shared board CONTAINS,
       because pact changes the board (applyPact's buriedAdd -> item count ->
       rng draw order) — stripping it would hand the recipient a different board
       under the same code, the one thing this feature exists to prevent. A
       locked recipient still stops at room 5 via roomCap: same boards, shorter
       run. Both disclosed. */
    playChallenge(t) {
      const c = t || {};
      return this._playCore({
        level: 1,
        heat: clampHeat(c.heat),
        pact: clampPact(c.pact),
        pace: clampPace(c.pace),
        seed: c.seed >>> 0,
      });
    },
```

**3c — `src/main.js`.** The import:

```js
import { decodeChallenge, encodeChallenge } from "./app/code.js";
```

and, immediately **above** the existing `if (autoplay)` block:

```js
  const chal = flags.code ? decodeChallenge(flags.code) : null;
  if (chal) { app.playChallenge(chal); saveCabinetSeen(); }
```

with the autoplay guard narrowed so the more specific instruction wins:

```js
  if (autoplay && !chal) {
```

An undecodable code leaves `chal` null and the boot proceeds normally — a bad
link lands you in the game, never on an error screen.

**3d — the line pin.** Append one reason line and raise the number in **both**
the label and the assertion:

```js
  // R8 challenge-code wave: +9 lines (code.js import; the ?code= decode and
  // playChallenge boot branch; the KeyB copy block) — bumped 788->798.
  check("main.js stays a lean browser entry (<=798 lines)",
    L.length<=798,String(L.length));
```

The bump lands here; Task 3's `KeyB` block fits under the same ceiling.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green.

- [ ] **Step 5: PWA bump + commit**

```bash
git add src/app/flags.js src/app/menuapp.js src/main.js tests/code.test.mjs tests/headless.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Open a shared board from ?code=, with no DOM prompt anywhere.

A window.prompt was refused on three grounds: src/app is DOM-free by
construction, main's seams have to stay out of main, and a modal prompt is a
blocking DOM call inside an RAF loop. The URL is also the better product — what
the sender copies already is a link, so pasting it in the address bar is the
whole interaction, and readFlags makes the path drivable from Node with no
location. A challenge run honours the decoded pact bits even when the pact gate
is locked, because that gate governs what a player may choose for themselves
and cannot govern what a shared board contains: pact changes the item count and
therefore the draw order, so stripping it would hand the recipient a different
board under the sender's code. An undecodable code falls through to a normal
boot rather than an error screen.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `KeyB` — copy the board, and say so in the legend

**Files:**
- Modify: `src/main.js` — the `KeyB` branch, beside the existing `KeyC` block
  (**locate by the string `if (code === "KeyC")`**)
- Modify: `src/render/scenes.js` — `COPY_HINT`'s value
- Modify: `tests/code.test.mjs` — append blocks 8–9
- Modify: `MEMORY.md`, `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `encodeChallenge`, `copyText` (R5)
- Produces: `B` on WIN/LOSE copying the `?code=` link; `COPY_HINT` reading
  `" · C copy · B board"`

- [ ] **Step 1: Write the failing tests**

Append to `tests/code.test.mjs`:

```js
import { drawOverlay } from "../src/render/scenes.js";

// ---- 8. the overlay hint says "board", which is the framing ----
{
  const texts = [];
  const noop = () => {};
  const c = {
    save: noop, restore: noop, translate: noop, scale: noop, beginPath: noop,
    closePath: noop, moveTo: noop, lineTo: noop, arc: noop, arcTo: noop,
    bezierCurveTo: noop, quadraticCurveTo: noop, ellipse: noop, fill: noop,
    stroke: noop, fillRect: noop, strokeRect: noop,
    fillText: (s) => texts.push(String(s)), strokeText: (s) => texts.push(String(s)),
  };
  drawOverlay(c, { state: "WIN", level: 3, finale: false, score: 10, heat: 0 },
    600, 520, 300, 260);
  check(
    "the WIN cue line now offers both keys",
    texts.some((s) => s === "SPACE / TAP · next room · C copy · B board"),
    texts.join("|"),
  );
  texts.length = 0;
  drawOverlay(c, { state: "LOSE", level: 3, score: 10, heat: 0 }, 600, 520, 300, 260);
  check(
    "and so does the LOSE cue line",
    texts.some((s) => s === "SPACE / TAP · new run · C copy · B board"),
    texts.join("|"),
  );
  check(
    "the legend says 'board', never the refused ranking word",
    !texts.some((s) => /leaderboard/i.test(s)),
    texts.join("|"),
  );
}

// ---- 9. KeyB: only at a run end, only the bare link ----
{
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)) };
  const wrote = [];
  globalThis.window = { localStorage: ls, addEventListener() {} };
  globalThis.navigator = { clipboard: { writeText: (s) => { wrote.push(s); return Promise.resolve(); } } };
  try {
    const g = createGame(null, { autoplay: true, seed: 123456789 });
    g.loop(1000);
    g.input.onUiKey("KeyB");
    check("B during PLAY copies nothing", wrote.length === 0, JSON.stringify(wrote));
    g.world.state = "WIN";
    g.input.onUiKey("KeyB");
    check(
      "B on a WIN copies the bare ?code= link for THIS board",
      wrote.length === 1 &&
        wrote[0] === "https://hmarzban.github.io/fusegrid/?code=" +
          encodeChallenge({ seed: g.world.seed, heat: g.world.heat,
            pact: g.world.pact, pace: g.world.pace }),
      JSON.stringify(wrote),
    );
    check(
      "the payload carries no score, no room, no date — a challenge, not a claim",
      wrote[0].indexOf(String(g.world.score | 0)) < 0 || (g.world.score | 0) === 0,
      wrote[0],
    );
    check(
      "and the copied link round-trips back to this exact board",
      (() => {
        const d = decodeChallenge(wrote[0].split("?code=")[1]);
        return d && d.seed === (g.world.seed >>> 0) && d.heat === (g.world.heat | 0) &&
          d.pact === (g.world.pact | 0) && d.pace === (g.world.pace | 0);
      })(),
      wrote[0],
    );
    wrote.length = 0;
    g.app.toMenu();
    g.input.onUiKey("KeyB");
    check("B on MENU copies nothing and is not swallowed by the shell",
      wrote.length === 0, JSON.stringify(wrote));
  } finally {
    delete globalThis.window;
    delete globalThis.navigator;
  }
  const src = readFileSync("src/main.js", "utf8");
  check(
    "the KeyB payload is the link and nothing else — no stamp, no score",
    /copyText\("https:\/\/hmarzban\.github\.io\/fusegrid\/\?code=" \+/.test(src) &&
      !/KeyB[\s\S]{0,300}world\.score/.test(src),
    (src.match(/if \(code === "KeyB"[\s\S]{0,200}/) || [""])[0],
  );
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/code.test.mjs
```

Expected: FAIL — the cue line still reads `SPACE / TAP · next room · C copy`,
and `B on a WIN copies the bare ?code= link -> []`.

- [ ] **Step 3: Implement**

**3a — `src/render/scenes.js`.** R1's constant gets its second and final value:

```js
const COPY_HINT = " · C copy · B board";
```

`overlayCue` itself is **not** touched, so its four exact-string pins stay put.
Worst-case cue line is `SPACE / TAP · next room · C copy · B board` — 41 chars
≈ 369 px at the 15 px mono `sub()` face, inside both the 600×520 and 608×352
boxes.

**3b — `src/main.js`.** One new sibling branch, inside the same `input.onUiKey`
shape, directly after the `KeyC` block:

```js
    if (code === "KeyB" && app.screen === SCREEN.GAME &&
        (world.state === "WIN" || world.state === "LOSE")) {
      copyText("https://hmarzban.github.io/fusegrid/?code=" +
        encodeChallenge({ seed: world.seed, heat: world.heat, pact: world.pact, pace: world.pace }));
      return;
    }
```

The payload is the **bare link**: no score, no room, no date, no stamp. `KeyB`
outside that gate falls through to `app.key`, which does not bind it, so it is a
silent no-op everywhere else.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green, `tests/heat.test.mjs`'s four `overlayCue` pins included —
R8 changed the concatenation, not the cue.

- [ ] **Step 5: Headed play-verify**

Unregister the service worker and delete its caches first. Then on
`http://127.0.0.1:8080/index.html`:

1. **Clear a room.** The cue reads `SPACE / TAP · next room · C copy · B board`
   and fits inside the box at **both** 600×520 and `?render=3d` 608×352.
2. **Press `B`.** Paste the clipboard: a bare URL ending in a twelve-character
   code, with no score anywhere in it.
3. **Open that link in a second cold tab** (a fresh profile / private window).
   The run starts immediately at room 1. **Compare the two room-1 boards side by
   side: they must be pixel-identical** — same bricks, same spawns, same buried
   pickups.
4. **A PLUS + pact run.** Copy its code from a locked second profile's point of
   view: the recipient plays the **same** board including the pact bits, and
   still stops at room 5. Both are the disclosed behaviours, not bugs.
5. **Corrupt one character of the code** in the address bar and load it. You land
   in the game on an ordinary boot — never an error screen, and never a
   different board presented as the sender's.
6. **`B` during PLAY, on MENU and on ATTRACT** copies nothing.

- [ ] **Step 6: PWA bump, MEMORY, commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together. Append
to `MEMORY.md` under a new `## 2026-09-07 — R8 challenge code` heading (newest
first, 1–2 lines): that `B` on a WIN or LOSE copies a bare
`?code=<12 chars>` link carrying seed/heat/pact/pace and **no score**, entered
through `readFlags` with no DOM prompt; that a checksum makes a mistyped link a
refusal rather than a different board; and that the refused ranking word is now
gated out of `src/` and `tests/` by `tests/banned-name.test.mjs`.

```bash
git add src/main.js src/render/scenes.js tests/code.test.mjs MEMORY.md src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Copy the board on B, and put the word "board" in the key legend.

KeyX is a fire key and KeyC is taken by the run stamp, so the whole bound set
was enumerated before B was picked — and "board" happens to be the honest word
for what the code carries, which puts the framing in the legend itself rather
than in a comment. The payload is the bare link: no score, no room, no date, no
stamp, because the thing being shared is a challenge and not a claim. The cue
line changes only through the copy-hint constant, so overlayCue and its four
exact-string pins are untouched.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```
