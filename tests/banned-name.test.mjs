import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* Tree-wide gate: the private reference game's name must never land in a
   committed file. Built by concatenation, never as a literal, so this file
   itself cannot be a survivor of its own scan. */
const bannedName = "bomber" + "man";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

/* Skip known-binary kinds outright; anything else is sniffed for a NUL byte
   in its first 8 KB, which every text encoding this repo uses (utf8) never
   contains. */
const BINARY_EXT = new Set([
  ".png",
  ".gif",
  ".jpg",
  ".jpeg",
  ".ico",
  ".wav",
  ".mp3",
  ".woff",
  ".woff2",
]);

function looksBinary(buf) {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

const tracked = execFileSync("git", ["ls-files"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

check("git ls-files returned a non-empty tree", tracked.length > 0, tracked.length);

const survivors = [];
for (const rel of tracked) {
  if (BINARY_EXT.has(extname(rel).toLowerCase())) continue;
  let buf;
  try {
    buf = readFileSync(join(ROOT, rel));
  } catch {
    continue; // gitlink or otherwise unreadable — nothing to scan
  }
  if (looksBinary(buf)) continue;
  if (buf.toString("utf8").toLowerCase().includes(bannedName)) {
    survivors.push(rel);
  }
}

check(
  "no tracked file contains the banned reference-game name",
  survivors.length === 0,
  survivors.join(", "),
);

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

console.log(fail ? "BANNED-NAME FAIL" : "BANNED-NAME OK");
process.exit(fail ? 1 : 0);
