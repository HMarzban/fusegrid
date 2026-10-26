#!/usr/bin/env node
/* #28 TRAP lane judge: one line per heat from tilesweep .jsonl files, every
   gate of #28 / #30 for room 5 scored the same way. Offline, never in src/.
     node tools/balance/trapjudge.mjs out/a.jsonl [out/b.jsonl ...]
   Gates: CORE Δ lose CI hi <= +2; PLUS Δ in [-2, +5]; MAX Δ in [+3, +10]
   (CI lo >= 3 for a pass, mean in band = "mean ok"); self-clears (kill)
   <= 1 / room; no-escape = 0; hit < 15 s A1 <= A0 + 5 pp (MAX); tile-hit
   share <= 5 / 15 / 30 %; order CORE < PLUS < MAX (A1 lose) and, with
   A2 / A3 rows, A2 <= A1 <= A3. */
import { readFileSync } from "node:fs";
import { pairedCI } from "./stats.mjs";

const H = ["CORE", "PLUS", "MAX"], TH = [0.05, 0.15, 0.30];
const f1 = (x) => (100 * x).toFixed(1);
const lose = (r) => (r.st === "LOSE" ? 1 : 0);
for (const file of process.argv.slice(2)) {
  const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.room === 5);
  const by = (h, a) => rows.filter((r) => r.heat === h && r.arm === a).sort((x, y) => x.s - y.s);
  console.log("## " + file.replace(/^.*\//, ""));
  const l1 = [];
  for (let h = 0; h < 3; h++) {
    const a = by(h, "A0"), b = by(h, "A1");
    if (!a.length || !b.length) continue;
    const c = pairedCI(a.map(lose), b.map(lose)), n = b.length, sum = (rs, k) => rs.reduce((q, r) => q + (r[k] || 0), 0);
    const sc = sum(b, "selfClears") / n, ne = sum(b, "noEsc"), h15a = sum(a, "hit15") / n, h15b = sum(b, "hit15") / n, th = sum(b, "hits") ? sum(b, "hTile") / sum(b, "hits") : 0;
    const la = a.reduce((q, r) => q + lose(r), 0) / n, lb = b.reduce((q, r) => q + lose(r), 0) / n;
    l1[h] = lb;
    const band = h === 0 ? c.hi <= 0.02 : h === 1 ? c.lo >= -0.02 && c.hi <= 0.05 : c.lo >= 0.03 && c.hi <= 0.10;
    const mean = h === 0 ? c.mean <= 0.02 : h === 1 ? c.mean >= -0.02 && c.mean <= 0.05 : c.mean >= 0.03 && c.mean <= 0.10;
    let ord = "";
    const a2 = by(h, "A2"), a3 = by(h, "A3");
    if (a2.length && a3.length) { const L = (rs) => rs.reduce((q, r) => q + lose(r), 0) / rs.length; ord = ` | A2/A1/A3 ${f1(L(a2))}/${f1(lb)}/${f1(L(a3))} ${L(a2) <= lb && lb <= L(a3) ? "ok" : "NO"}`; }
    console.log(`${H[h]} n ${n}: lose ${f1(la)} -> ${f1(lb)} Δ ${c.mean >= 0 ? "+" : ""}${f1(c.mean)} [${f1(c.lo)}, ${f1(c.hi)}] ${band ? "PASS" : mean ? "mean-ok" : "FAIL"} | selfclr ${sc.toFixed(2)} ${sc <= 1 ? "ok" : "NO"} | trapKills ${(sum(b, "trapKills") / n).toFixed(2)} | noEsc ${ne} (at-arm ${sum(b, "noEscArm")}, hit ${sum(b, "noEscHit")}) ${ne ? "NO" : "ok"} | hit15 ${f1(h15a)} -> ${f1(h15b)}${h === 2 ? (h15b <= h15a + 0.05 ? " ok" : " NO") : ""} | tileHit ${f1(th)}% ${th <= TH[h] ? "ok" : "NO"} | chainEarly ${sum(b, "chainEarly")} | win ${f1(sum(b, "st") ? b.filter((r) => r.st === "WIN").length / n : 0)}${ord}`);
  }
  if (l1.length === 3) console.log(`order CORE < PLUS < MAX: ${f1(l1[0])} / ${f1(l1[1])} / ${f1(l1[2])} ${l1[0] < l1[1] && l1[1] < l1[2] ? "ok" : "NO"}`);
}
