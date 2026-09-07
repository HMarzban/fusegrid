import { CODE_V, encodeChallenge, decodeChallenge } from "../src/app/code.js";
import { createRng } from "../src/core/rng.js";
import { readFileSync } from "node:fs";

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

// ---- 2. a bad code is REFUSED, never guessed ----
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
  /* Nit (deviation from the plan's literal test): the plan's regex ran over the
     raw source, but code.js's own header comment legitimately says "score" and
     "level" (naming the two fields the code REFUSES to carry) — the comment is
     the spec-mandated rationale, so the CODE is what must stay clean, not the
     prose about it. Block comments are stripped before the scan. */
  const rawSrc = readFileSync("src/app/code.js", "utf8");
  const src = rawSrc.replace(/\/\*[\s\S]*?\*\//g, "");
  check(
    "code.js carries no score field, no level field, and no Date/DOM/Math.random",
    !/score|level|Math\.random|\bDate\b|document|window/.test(src),
    (src.match(/score|level|Math\.random|Date|document|window/g) || []).join(","),
  );
}

console.log("\n  CODE RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
