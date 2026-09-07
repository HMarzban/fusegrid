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
