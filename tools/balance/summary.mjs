/* Markdown summary of a tilesweep row set (#25). Pure: rows in, text out,
   so `node tools/balance/summary.mjs out/pilot.jsonl` rebuilds it offline.
   Player-facing tile names (BOOSTER / ICE PATCH / CONVEYOR / TRAP). Every
   delta is paired by seed against A0 of the same cell; "ITT" = over all
   seeds, "tile-only" = only seeds whose gen-3 room really carries rule tiles
   (a placement fallback ships the plain gen-2 board). */
import { readFileSync } from "node:fs";
import { pairedCI, medianRatio, discordant, nNeed, median } from "./stats.mjs";

const HEAT = ["CORE", "PLUS", "MAX"], PACE = { "-1": "EASY", 0: "NORM", 1: "HARD" };
const TILE_OF = { 1: "BOOSTER", 2: "ICE PATCH", 3: "CONVEYOR", 5: "TRAP" };
const f1 = (x) => (x === x ? x.toFixed(1) : "–"), f2 = (x) => (x === x ? x.toFixed(2) : "–");
const pp = (c) => `${c.mean >= 0 ? "+" : ""}${f1(100 * c.mean)} [${f1(100 * c.lo)}, ${f1(100 * c.hi)}]`;
const sum = (rs, k) => rs.reduce((a, r) => a + (r[k] || 0), 0);
const per = (rs, k) => (rs.length ? sum(rs, k) / rs.length : NaN);
const rate = (rs, f) => (rs.length ? rs.filter(f).length / rs.length : NaN);
const lose = (r) => (r.st === "LOSE" ? 1 : 0);

function pairs(A, Bm) {
  const m = new Map(A.map((r) => [r.s, r])), a = [], b = [];
  for (const r of Bm) if (m.has(r.s)) { a.push(m.get(r.s)); b.push(r); }
  return [a, b];
}
function cellKey(r) { return `${r.room}|${r.heat}|${r.pace}|${r.prof || ""}`; }

export function armStats(rs) {
  return { n: rs.length, rules: sum(rs, "rules"), lose: rate(rs, (r) => r.st === "LOSE"), win: rate(rs, (r) => r.st === "WIN"), to: rate(rs, (r) => r.st === "TIMEOUT"),
    clear: median(rs.filter((r) => r.st === "WIN").map((r) => r.t)), wins: rs.filter((r) => r.st === "WIN").length,
    hit5: sum(rs, "hit5"), hit15: sum(rs, "hit15"), hits: per(rs, "hits"), nm: per(rs, "nearMiss"), tileHitPct: sum(rs, "hits") ? sum(rs, "hTile") / sum(rs, "hits") : 0,
    tileKills: per(rs, "tileKills"), deliveries: per(rs, "deliveries"), relayKills: per(rs, "relayKills"), trapKills: per(rs, "trapKills"), selfClears: per(rs, "selfClears"),
    ownRelay: sum(rs, "ownRelay"), chainEarly: sum(rs, "chainEarly"), noEsc: sum(rs, "noEsc"), noEscRuns: rs.filter((r) => r.noEsc > 0).length, noEscHit: sum(rs, "noEscHit"),
    noEscEx: sum(rs, "noEscEx"), noEscRide: sum(rs, "noEscRide"), noEscIce: sum(rs, "noEscIce"), absorbs: sum(rs, "absorbs") };
}
export function compare(a, b) {
  const la = a.map(lose), lb = b.map(lose);
  const c = pairedCI(la, lb), d = discordant(la, lb);
  const sub = a.map((r, i) => (b[i].rules ? i : -1)).filter((i) => i >= 0);
  const cs = pairedCI(sub.map((i) => la[i]), sub.map((i) => lb[i]));
  const ct = medianRatio(a.map((r) => (r.st === "WIN" ? r.t : NaN)), b.map((r) => (r.st === "WIN" ? r.t : NaN)));
  const nmc = pairedCI(a.map((r) => r.nearMiss), b.map((r) => r.nearMiss));
  return { dLose: c, dLoseTile: cs, nTile: sub.length, d, n2: nNeed(d, 0.02), n3: nNeed(d, 0.03), clear: ct, dNear: nmc };
}

export function summary(rows, meta = {}) {
  const L = [];
  const room = rows.filter((r) => r.room != null && !r.pin), runs = rows.filter((r) => r.run), pins = rows.filter((r) => r.pin);
  L.push(`# Tile balance sweep: ${meta.plan || ""}${meta.profName ? " · " + meta.profName : ""}`, "");
  L.push(`n ${meta.n} seeds per cell (s ${meta.from}..${meta.from + meta.n - 1}), ${meta.runs} rows, ${meta.workers} workers, wall ${meta.wallS} s, CPU ${meta.cpuMin} min.${meta.prof ? " Knobs: `" + JSON.stringify(meta.prof) + "`." : ""}`, "");
  L.push("Arms on the same gen-3 world: A0 tiles off, A1 the dial, A2 CORE knobs at every heat, A3 MAX knobs at every heat. Δ = arm − A0, paired by seed, 95% bootstrap CI, pp. Judge: the tile-aware demobot fork; 120 s cap.", "");
  const groups = new Map();
  for (const r of room) { const k = cellKey(r); if (!groups.has(k)) groups.set(k, {}); (groups.get(k)[r.arm] ||= []).push(r); }
  const keys = [...groups.keys()].sort((x, y) => { const a = x.split("|"), b = y.split("|"); return (+a[2]) - (+b[2]) || (+a[0]) - (+b[0]) || (+a[1]) - (+b[1]); });
  const tileK = keys.filter((k) => TILE_OF[k.split("|")[0]]), ctrlK = keys.filter((k) => !TILE_OF[k.split("|")[0]]);
  if (tileK.length) {
    L.push("## A0 vs A1 (the dial)", "");
    L.push("| room · tile | heat · pace | n (tile rooms) | lose % A0 → A1 | Δ lose ITT | Δ lose tile-only | d | n @2pp / @3pp | win % A0/A1 | timeout % A1 | clear med s A0 → A1 (Δ%, CI) | hit<5 s runs A0/A1 | hit<15 s A0/A1 | hits/run A0/A1 | near miss/run A0/A1 (Δ CI) | tile hits % | tile kills/run | deliveries/run | relay kills/run | trap kills / self-clears per room | own-relay / chain-early hits | no-escape ep raw (runs) [→hit ≤3 s] | no-escape exempt-CORE-CONVEYOR | on CONVEYOR / ICE |");
    L.push("|" + "---|".repeat(24));
    const pooled = {};
    for (const k of tileK) {
      const g = groups.get(k), [rm, h, pc] = k.split("|").map(Number);
      if (!g.A0 || !g.A1) continue;
      const [a, b] = pairs(g.A0, g.A1), sa = armStats(a), sb = armStats(b), c = compare(a, b);
      const pk = `${h}|${pc}`;
      (pooled[pk] ||= [0, 0, 0])[0] += sa.hit5; pooled[pk][1] += sb.hit5; pooled[pk][2]++;
      const ct = c.clear;
      L.push(`| ${rm} · ${TILE_OF[rm]} | ${HEAT[h]} · ${PACE[pc]} | ${a.length} (${sb.rules}) | ${f1(100 * sa.lose)} → ${f1(100 * sb.lose)} | ${pp(c.dLose)} | ${pp(c.dLoseTile)} | ${f2(c.d)} | ${c.n2} / ${c.n3} | ${f1(100 * sa.win)} / ${f1(100 * sb.win)} | ${f1(100 * sb.to)} | ${f1(ct.a)} → ${f1(ct.b)} (${ct.ratio === ct.ratio ? (ct.ratio >= 0 ? "+" : "") + f1(100 * ct.ratio) + "%" : "–"}${ct.lo === ct.lo ? ` [${f1(100 * ct.lo)}, ${f1(100 * ct.hi)}]` : ""}; ${ct.winsA}/${ct.winsB} wins; ${ct.status}) | ${sa.hit5} / ${sb.hit5} | ${sa.hit15} / ${sb.hit15} | ${f2(sa.hits)} / ${f2(sb.hits)} | ${f2(sa.nm)} / ${f2(sb.nm)} (${f2(c.dNear.mean)} [${f2(c.dNear.lo)}, ${f2(c.dNear.hi)}]) | ${f1(100 * sb.tileHitPct)} | ${f2(sb.tileKills)} | ${f2(sb.deliveries)} | ${f2(sb.relayKills)} | ${f2(sb.trapKills)} / ${f2(sb.selfClears)} | ${sb.ownRelay} / ${sb.chainEarly} | ${sb.noEsc} (${sb.noEscRuns}) [${sb.noEscHit}] | ${sb.noEscEx} | ${sb.noEscRide} / ${sb.noEscIce} |`);
    }
    L.push("", "First-5 s hits pooled over the tile rooms (runs hit < 5 s; #30's rule is A1 ≤ A0 + 2√A0):", "");
    L.push("| heat · pace | rooms | A0 | A1 | ceiling A0 + 2√A0 | ok |", "|---|---|---|---|---|---|");
    for (const [pk, [x, y, nr]] of Object.entries(pooled)) { const [h, pc] = pk.split("|"); const cap = x + 2 * Math.sqrt(x); L.push(`| ${HEAT[h]} · ${PACE[pc]} | ${nr} | ${x} | ${y} | ${f1(cap)} | ${y <= cap ? "yes" : "NO"} |`); }
    const a23 = tileK.filter((k) => groups.get(k).A2 || groups.get(k).A3);
    if (a23.length) {
      L.push("", "## A2 / A3 (the knobs alone, at a fixed heat)", "");
      L.push("| room · tile | heat · pace | n | lose % A0 / A1 / A2 / A3 | Δ A1 | Δ A2 (CORE knobs) | Δ A3 (MAX knobs) | A3 − A2 | d A3 vs A2 | n @3pp | no-escape A2 / A3 | win % A2 / A3 |");
      L.push("|" + "---|".repeat(12));
      for (const k of a23) {
        const g = groups.get(k), [rm, h, pc] = k.split("|").map(Number);
        if (!g.A0 || !g.A2 || !g.A3) continue;
        const [a0, a1] = pairs(g.A0, g.A1 || []), [b0, a2] = pairs(g.A0, g.A2), [c0, a3] = pairs(g.A0, g.A3), [x2, x3] = pairs(g.A2, g.A3);
        const s0 = armStats(b0), s2 = armStats(a2), s3 = armStats(a3), s1 = armStats(a1);
        const d1 = pairedCI(a0.map(lose), a1.map(lose)), d2 = pairedCI(b0.map(lose), a2.map(lose)), d3 = pairedCI(c0.map(lose), a3.map(lose)), d32 = pairedCI(x2.map(lose), x3.map(lose)), dd = discordant(x2.map(lose), x3.map(lose));
        L.push(`| ${rm} · ${TILE_OF[rm]} | ${HEAT[h]} · ${PACE[pc]} | ${b0.length} | ${f1(100 * s0.lose)} / ${f1(100 * s1.lose)} / ${f1(100 * s2.lose)} / ${f1(100 * s3.lose)} | ${pp(d1)} | ${pp(d2)} | ${pp(d3)} | ${pp(d32)} | ${f2(dd)} | ${nNeed(dd, 0.03)} | ${s2.noEsc} / ${s3.noEsc} | ${f1(100 * s2.win)} / ${f1(100 * s3.win)} |`);
      }
    }
  }
  if (ctrlK.length) {
    L.push("", "## Controls (no rule tile; art-only codes 8..14 in gen 3)", "");
    L.push("| room | heat · pace | n | rows A0 == A1 (bar the arm field) | lose % | win % |", "|---|---|---|---|---|---|");
    for (const k of ctrlK) {
      const g = groups.get(k), [rm, h, pc] = k.split("|").map(Number);
      if (!g.A0 || !g.A1) continue;
      const [a, b] = pairs(g.A0, g.A1), same = a.filter((r, i) => JSON.stringify({ ...r, arm: "" }) === JSON.stringify({ ...b[i], arm: "" })).length;
      L.push(`| ${rm} | ${HEAT[h]} · ${PACE[pc]} | ${a.length} | ${same} / ${a.length} | ${f1(100 * rate(a, (r) => r.st === "LOSE"))} | ${f1(100 * rate(a, (r) => r.st === "WIN"))} |`);
    }
  }
  if (runs.length) {
    L.push("", "## Run level (rooms 1 → 5, progress kept, 120 s per room)", "");
    L.push("| heat | n | lose % A0 → A1 | Δ lose | CLEAR % A0 / A1 | mean rooms won A0 / A1 | timeout % A0 / A1 |", "|---|---|---|---|---|---|---|");
    for (const h of [0, 1, 2]) {
      const A = runs.filter((r) => r.heat === h && r.arm === "A0"), Bm = runs.filter((r) => r.heat === h && r.arm === "A1");
      if (!A.length || !Bm.length) continue;
      const [a, b] = pairs(A, Bm), c = pairedCI(a.map(lose), b.map(lose));
      L.push(`| ${HEAT[h]} | ${a.length} | ${f1(100 * rate(a, (r) => r.st === "LOSE"))} → ${f1(100 * rate(b, (r) => r.st === "LOSE"))} | ${pp(c)} | ${f1(100 * rate(a, (r) => r.st === "CLEAR"))} / ${f1(100 * rate(b, (r) => r.st === "CLEAR"))} | ${f2(per(a, "won"))} / ${f2(per(b, "won"))} | ${f1(100 * rate(a, (r) => r.st === "TIMEOUT"))} / ${f1(100 * rate(b, (r) => r.st === "TIMEOUT"))} |`);
    }
  }
  if (pins.length) {
    const bad = pins.filter((r) => r.bad >= 0), ticks = sum(pins, "ticks");
    L.push("", "## Parity pin (fork vs stock, tick by tick)", "", `${pins.length} runs (gen-3 A0 and gen 1, rooms 1-8 x 3 heats), ${ticks} ticks, ${bad.length} divergent${bad.length ? ": " + bad.slice(0, 5).map((r) => `g${r.gen} r${r.room} h${r.heat} s${r.s} @${r.bad}`).join(", ") : ""}.`);
  }
  L.push("", "Definitions: lose = the room ended in LOSE inside 120 s; hit = a lives decrement (SHIELD absorbs are not hits); near miss = in a bomb's plain footprint with ≤ 0.5 s left, out of iFrames, and not hit when it blew; tile hit = hurt on a rule tile, by a relay / trap / ridden / chain-early blade, or within 0.5 s of a CONVEYOR push; delivery = a ridden bomb's blast that broke a brick or killed; self-clear = a TRAP kill whose trap armed with the player > 4 tiles away; no-escape = a rising-edge episode where the plain timed-escape search finds a way out and the tile model does not (`escape.mjs`); exempt-CORE-CONVEYOR = the same count with CORE CONVEYOR (no actor rides) excluded, as 02 §4.4 did. Clear time is UNRESOLVED below 50 wins per arm or when its CI straddles −10%.", "");
  return L.join("\n");
}

if (process.argv[1] && process.argv[1].endsWith("summary.mjs") && process.argv[2]) {
  const rows = readFileSync(process.argv[2], "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  let meta = {};
  try { meta = JSON.parse(readFileSync(process.argv[2].replace(/\.jsonl$/, ".cpu.json"), "utf8")); } catch {}
  console.log(summary(rows, meta));
}
