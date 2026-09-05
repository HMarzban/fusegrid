import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRECACHE } from "../src/pwa/shell.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = join(ROOT, "media");
const bannedName = "bomber" + "man";

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

// same tiny IHDR reader tests/pwa.test.mjs uses to pin icon pixels
function pngWH(p) {
  const b = readFileSync(p);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const cover = join(MEDIA, "cover-630x500.png");
check("media/cover-630x500.png exists", existsSync(cover));
if (existsSync(cover)) {
  const s = pngWH(cover);
  check("cover is exactly 630x500", s.w === 630 && s.h === 500, s.w + "x" + s.h);
}

for (const name of [
  "still-jungle.png",
  "still-ice.png",
  "still-crown.png",
  "still-menu.png",
]) {
  const p = join(MEDIA, name);
  check("media/" + name + " exists", existsSync(p));
  if (existsSync(p)) {
    const b = readFileSync(p);
    check(
      name + " is a real PNG",
      b.length > 8 &&
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47,
    );
  }
}

const gif = join(MEDIA, "play.gif");
check("media/play.gif exists", existsSync(gif));
if (existsSync(gif)) {
  const b = readFileSync(gif);
  check(
    "play.gif has a GIF signature",
    b.slice(0, 3).toString("ascii") === "GIF",
  );
  const sizeMB = statSync(gif).size / (1024 * 1024);
  check("play.gif is <= 3 MB", sizeMB <= 3, sizeMB.toFixed(2) + "MB");
}

const mediaReadme = join(MEDIA, "README.md");
check("media/README.md exists", existsSync(mediaReadme));
if (existsSync(mediaReadme)) {
  const t = readFileSync(mediaReadme, "utf8");
  check(
    "media/README.md documents the zip recipe",
    /zip/i.test(t) && /index\.html/.test(t),
  );
  const zipBlockMatch = t.match(/```\nzip -r[\s\S]*?```/);
  const zipBlock = zipBlockMatch ? zipBlockMatch[0] : "";
  check("media/README.md has a zip -r code block", zipBlock.length > 0);
  check(
    "zip recipe omits tests/docs/.git/media/og.png",
    zipBlock.length > 0 &&
      !/\btests\//.test(zipBlock) &&
      !/\bdocs\//.test(zipBlock) &&
      !/\.git\b/.test(zipBlock) &&
      !/\bmedia\//.test(zipBlock) &&
      !/\bog\.png\b/.test(zipBlock),
  );
  check(
    "media/README.md play URL has trailing slash",
    t.includes("https://hmarzban.github.io/fusegrid/"),
  );
  check(
    "media/README.md carries the itch blurb",
    /Flip REAL 3D/.test(t) && /Heat CORE \/ PLUS \/ MAX/.test(t),
  );
  check(
    "media/README.md lists the required tags",
    /arcade/.test(t) &&
      /singleplayer/.test(t) &&
      /webgl/.test(t) &&
      /chiptune/.test(t),
  );
  check("media/README.md has no banned franchise name", !t.toLowerCase().includes(bannedName.toLowerCase()));
}

// hard lock: media/ and og.png are listing art, never app-shell bytes
check(
  "PRECACHE excludes media/",
  !PRECACHE.some((p) => p.includes("media/")),
);
check(
  "PRECACHE excludes og.png",
  !PRECACHE.some((p) => p.includes("og.png")),
);

const rootReadme = readFileSync(join(ROOT, "README.md"), "utf8");
check(
  "root README.md points to media/ for listing art",
  /media\//.test(rootReadme),
);
check("root README.md has no banned franchise name", !rootReadme.toLowerCase().includes(bannedName.toLowerCase()));

console.log(fail ? "MEDIA FAIL" : "MEDIA OK");
process.exit(fail ? 1 : 0);
