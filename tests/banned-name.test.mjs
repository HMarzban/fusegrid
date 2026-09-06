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

console.log(fail ? "BANNED-NAME FAIL" : "BANNED-NAME OK");
process.exit(fail ? 1 : 0);
