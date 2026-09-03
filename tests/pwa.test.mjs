import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CACHE_NAME,
  PRECACHE,
  fetchPolicy,
} from "../src/pwa/shell.js";
import { registerSW } from "../src/pwa/register.js";

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

function walkJs(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkJs(p, acc);
    else if (name.endsWith(".js")) acc.push(p);
  }
  return acc;
}

function pngWH(p) {
  const b = readFileSync(p);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const manifestPath = join(ROOT, "manifest.webmanifest");
check("manifest.webmanifest exists", existsSync(manifestPath));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
check("manifest name is Fusegrid", manifest.name === "Fusegrid", manifest.name);
check(
  "manifest short_name is FUSE/GRID",
  manifest.short_name === "FUSE/GRID",
  manifest.short_name,
);
check("manifest display is standalone", manifest.display === "standalone");
check("manifest start_url is ./", manifest.start_url === "./");
check("manifest scope is ./", manifest.scope === "./");
check(
  "manifest theme matches cabinet",
  manifest.theme_color === "#070a12" && manifest.background_color === "#070a12",
);
check(
  "manifest copy has no Bomberman",
  !JSON.stringify(manifest).toLowerCase().includes("bomberman"),
);

const icon192 = (manifest.icons || []).find((i) => i.sizes === "192x192");
const icon512 = (manifest.icons || []).find((i) => i.sizes === "512x512");
check("manifest lists 192 icon", !!icon192 && existsSync(join(ROOT, icon192.src.replace(/^\.\//, ""))));
check("manifest lists 512 icon", !!icon512 && existsSync(join(ROOT, icon512.src.replace(/^\.\//, ""))));
if (icon192) {
  const s = pngWH(join(ROOT, icon192.src.replace(/^\.\//, "")));
  check("192 icon pixels", s.w === 192 && s.h === 192, s.w + "x" + s.h);
}
if (icon512) {
  const s = pngWH(join(ROOT, icon512.src.replace(/^\.\//, "")));
  check("512 icon pixels", s.w === 512 && s.h === 512, s.w + "x" + s.h);
}

check(
  "CACHE_NAME is versioned fusegrid-shell",
  /^fusegrid-shell-v\d+$/.test(CACHE_NAME),
  CACHE_NAME,
);
check("PRECACHE is frozen", Object.isFrozen(PRECACHE));
check(
  "PRECACHE includes index.html",
  PRECACHE.includes("./index.html"),
);
check(
  "PRECACHE includes vendor/three.module.js",
  PRECACHE.includes("./vendor/three.module.js"),
);
check("PRECACHE includes ./", PRECACHE.includes("./"));
check(
  "PRECACHE excludes og.png",
  !PRECACHE.some((p) => p.includes("og.png")),
);

const srcJs = walkJs(join(ROOT, "src")).map(
  (p) => "./" + relative(ROOT, p).split("\\").join("/"),
);
for (const rel of srcJs) {
  check("PRECACHE has " + rel, PRECACHE.includes(rel));
}
for (const rel of PRECACHE) {
  if (rel === "./") continue;
  const fp = join(ROOT, rel.replace(/^\.\//, ""));
  check("PRECACHE file exists " + rel, existsSync(fp));
}

check(
  "og.png is network bypass",
  fetchPolicy("http://127.0.0.1:8080/og.png", {
    swOrigin: "http://127.0.0.1:8080",
  }) === "bypass",
);
check(
  "Pages og.png is network bypass",
  fetchPolicy("https://hmarzban.github.io/fusegrid/og.png", {
    swOrigin: "https://hmarzban.github.io",
  }) === "bypass",
);
check(
  "shell module is cache-first",
  fetchPolicy("http://127.0.0.1:8080/src/main.js", {
    swOrigin: "http://127.0.0.1:8080",
  }) === "cache-first",
);
check(
  "navigate is cache-first-navigate",
  fetchPolicy("http://127.0.0.1:8080/", {
    swOrigin: "http://127.0.0.1:8080",
    mode: "navigate",
  }) === "cache-first-navigate",
);
check(
  "cross-origin is bypass",
  fetchPolicy("https://example.com/x", {
    swOrigin: "http://127.0.0.1:8080",
  }) === "bypass",
);

check("registerSW no-op in Node", registerSW() === false);
{
  const calls = [];
  const nav = {
    serviceWorker: {
      register(url, opts) {
        calls.push({ url, opts });
        return Promise.resolve();
      },
    },
  };
  check(
    "registerSW on Pages uses /fusegrid/sw.js",
    registerSW({
      navigator: nav,
      href: "https://hmarzban.github.io/fusegrid/",
    }) === true &&
      calls[0].url === "https://hmarzban.github.io/fusegrid/sw.js" &&
      calls[0].opts.type === "module" &&
      calls[0].opts.scope === "./",
    calls[0] && calls[0].url,
  );
  check(
    "registerSW on loopback uses /sw.js",
    registerSW({
      navigator: nav,
      href: "http://127.0.0.1:8080/index.html",
    }) === true && calls[1].url === "http://127.0.0.1:8080/sw.js",
    calls[1] && calls[1].url,
  );
}

const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
check("sw.js imports shell", /from\s+["']\.\/src\/pwa\/shell\.js["']/.test(sw));
check("sw.js skipWaiting", sw.includes("skipWaiting"));
check("sw.js clients.claim", sw.includes("clients.claim"));
check("sw.js has fetch handler", /addEventListener\(\s*["']fetch["']/.test(sw));
const rev = (sw.match(/fusegrid-shell-v\d+/) || [])[0];
check("sw.js REV matches CACHE_NAME", rev === CACHE_NAME, rev);

const html = readFileSync(join(ROOT, "index.html"), "utf8");
check(
  "index.html links relative manifest",
  /rel=["']manifest["']/.test(html) &&
    /href=["']\.\/manifest\.webmanifest["']/.test(html),
);
check(
  "index.html keeps absolute Pages og:image",
  /og:image["']\s+content=["']https:\/\/hmarzban\.github\.io\/fusegrid\/og\.png["']/.test(
    html,
  ),
);
check("index.html has no Bomberman", !html.toLowerCase().includes("bomberman"));
check("index.html has no root-absolute hrefs", !/href=["']\//.test(html));

const main = readFileSync(join(ROOT, "src/main.js"), "utf8");
check(
  "main.js registers SW",
  /from\s+["']\.\/pwa\/register\.js["']/.test(main) &&
    /registerSW\s*\(/.test(main),
);

for (const f of walkJs(join(ROOT, "src/core"))) {
  const t = readFileSync(f, "utf8");
  check(
    relative(ROOT, f) + " does not import pwa",
    !/pwa\//.test(t) && !/serviceWorker/.test(t),
  );
}

const serve = readFileSync(join(ROOT, "serve.js"), "utf8");
check(
  "serve.js MIME for webmanifest",
  serve.includes(".webmanifest") && serve.includes("application/manifest+json"),
);
check("serve.js still binds 127.0.0.1", serve.includes('"127.0.0.1"'));

const pages = readFileSync(join(ROOT, ".github/workflows/pages.yml"), "utf8");
check(
  "Pages stages manifest + sw + icons",
  /manifest\.webmanifest/.test(pages) &&
    /\bsw\.js\b/.test(pages) &&
    /icon-192\.png/.test(pages) &&
    /icon-512\.png/.test(pages),
);

console.log(fail ? "PWA FAIL" : "PWA OK");
process.exit(fail ? 1 : 0);
