import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CACHE_NAME,
  PRECACHE,
  BOOT,
  LOOKS,
  fetchPolicy,
} from "../src/pwa/shell.js";
import { mountUpdate } from "../src/app/update.js";
import { registerSW, isEmbedded } from "../src/pwa/register.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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
  "manifest copy has no banned franchise name",
  !JSON.stringify(manifest).toLowerCase().includes(bannedName.toLowerCase()),
);
check(
  "manifest description names browser and 3D",
  /browser/i.test(manifest.description) && /3D/.test(manifest.description),
  manifest.description,
);

// install-dialog screenshots: real captures, staged for Pages, never precached
{
  const shots = manifest.screenshots || [];
  const stage = readFileSync(join(ROOT, ".github/workflows/pages.yml"), "utf8");
  const staged = (rel) => new RegExp("\\b" + rel.split("/")[0].replace(".", "\\.") + "\\b").test(stage.match(/^\s*cp .*$/gm).join("\n"));
  for (const f of ["wide", "narrow"]) check("manifest has a " + f + " screenshot", shots.some((s) => s.form_factor === f));
  const ratio = {};
  for (const s of shots) {
    const rel = String(s.src).replace(/^\.\//, ""), fp = join(ROOT, rel);
    check("screenshot exists " + rel, existsSync(fp));
    check("screenshot " + rel + " is png with form_factor and label", s.type === "image/png" && /^(wide|narrow)$/.test(s.form_factor) && !!s.label);
    if (!existsSync(fp)) continue;
    const { w, h } = pngWH(fp), lo = Math.min(w, h), hi = Math.max(w, h);
    check("screenshot " + rel + " sizes match pixels", s.sizes === w + "x" + h, s.sizes + " vs " + w + "x" + h);
    check("screenshot " + rel + " sides 320-3840, long <= 2.3x short", lo >= 320 && hi <= 3840 && hi <= 2.3 * lo, w + "x" + h);
    check("screenshot " + rel + " orientation fits " + s.form_factor, s.form_factor === "wide" ? w > h : h > w);
    (ratio[s.form_factor] ||= new Set()).add((w / h).toFixed(4));
    check("Pages stages " + rel, staged(rel));
    check("PRECACHE excludes " + rel, !PRECACHE.some((p) => p.includes(rel)));
  }
  for (const f in ratio) check("one aspect ratio per form factor " + f, ratio[f].size === 1, [...ratio[f]].join(","));
}

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
{
  // Minor-4 (review 2026-09-07): "src/app/debughook.js" preceded
  // "src/app/daily.js", breaking the list's otherwise-alphabetical order at
  // that pair — swapped so daily.js precedes debughook.js again.
  const srcApp = PRECACHE.filter((p) => p.startsWith("./src/app/"));
  const di = srcApp.indexOf("./src/app/daily.js");
  const dh = srcApp.indexOf("./src/app/debughook.js");
  check(
    "daily.js precedes debughook.js (Minor-4)",
    di >= 0 && dh >= 0 && di < dh,
    di + "/" + dh,
  );
  check(
    "daily.js and debughook.js sit immediately adjacent, in that order",
    dh === di + 1,
    JSON.stringify(srcApp),
  );
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

check(
  "registerSW skips iframe",
  registerSW({
    href: "https://hmarzban.github.io/fusegrid/",
    navigator: { serviceWorker: { register() {}, addEventListener() {} } },
    top: { mark: 1 },
    self: { mark: 2 },
  }) === false,
);
check(
  "registerSW skips ?embed=1",
  registerSW({
    href: "https://hmarzban.github.io/fusegrid/?embed=1",
    navigator: { serviceWorker: { register() {}, addEventListener() {} } },
    top: null,
    self: null,
  }) === false,
);
check(
  "isEmbedded true for iframe (top !== self)",
  isEmbedded({ top: { mark: 1 }, self: { mark: 2 }, href: "https://x/" }) ===
    true,
);
check(
  "isEmbedded true for ?embed=1 href",
  isEmbedded({
    top: null,
    self: null,
    href: "https://hmarzban.github.io/fusegrid/?embed=1",
  }) === true,
);
check(
  "isEmbedded true for &embed=1 mid-query",
  isEmbedded({
    top: null,
    self: null,
    href: "https://hmarzban.github.io/fusegrid/?x=1&embed=1",
  }) === true,
);
check(
  "isEmbedded true for ?embed=1 followed by a hash fragment",
  isEmbedded({
    top: null,
    self: null,
    href: "https://hmarzban.github.io/fusegrid/?embed=1#x",
  }) === true,
);
check(
  "isEmbedded false for top===self, no flag",
  isEmbedded({ top: null, self: null, href: "https://hmarzban.github.io/fusegrid/" }) ===
    false,
);
{
  const same = { mark: 1 };
  const calls = [];
  check(
    "registerSW still registers on the normal Pages path (top===self, no embed flag)",
    registerSW({
      href: "https://hmarzban.github.io/fusegrid/",
      navigator: {
        serviceWorker: {
          register(url, opts) {
            calls.push({ url, opts });
            return Promise.resolve();
          },
        },
      },
      top: same,
      self: same,
    }) === true && calls[0].url === "https://hmarzban.github.io/fusegrid/sw.js",
    calls[0] && calls[0].url,
  );
}
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

{
  const updates = [];
  const listeners = {};
  let reloads = 0;
  const nav = {
    serviceWorker: {
      controller: {},
      register() {
        return Promise.resolve({
          update() {
            updates.push(1);
            return Promise.resolve();
          },
        });
      },
      addEventListener(type, fn) {
        (listeners[type] ||= []).push(fn);
      },
    },
  };
  const loc = {
    reload() {
      reloads++;
    },
  };
  check(
    "registerSW wires update + reload env",
    registerSW({
      navigator: nav,
      href: "http://127.0.0.1:8080/",
      location: loc,
    }) === true,
  );
  check(
    "registerSW listens for controllerchange",
    Array.isArray(listeners.controllerchange) &&
      listeners.controllerchange.length === 1,
  );
  if (listeners.controllerchange && listeners.controllerchange[0]) {
    listeners.controllerchange[0]();
    check("returning client reloads on first change", reloads === 1, reloads);
    listeners.controllerchange[0]();
  }
  check(
    "controllerchange reloads once",
    reloads === 1,
    reloads,
  );
  await Promise.resolve();
  await Promise.resolve();
  check(
    "registerSW calls registration.update",
    updates.length === 1,
    updates.length,
  );
}

{
  const listeners = {};
  let reloads = 0;
  const nav = {
    serviceWorker: {
      controller: null,
      register() {
        return Promise.resolve({ update: () => Promise.resolve() });
      },
      addEventListener(type, fn) {
        (listeners[type] ||= []).push(fn);
      },
    },
  };
  registerSW({
    navigator: nav,
    href: "http://127.0.0.1:8080/",
    location: { reload: () => reloads++ },
  });
  listeners.controllerchange[0]();
  check("first install claim does not reload", reloads === 0, reloads);
  listeners.controllerchange[0]();
  check("later update on a first-visit tab reloads once", reloads === 1, reloads);
}

const spec = readFileSync(
  join(ROOT, "docs/superpowers/specs/2026-09-03-pwa-offline-design.md"),
  "utf8",
);
check(
  "spec documents controllerchange reload",
  /controllerchange/.test(spec) && /registration\.update/.test(spec),
);

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
check("index.html has no banned franchise name", !html.toLowerCase().includes(bannedName));
check("index.html has no root-absolute hrefs", !/href=["']\//.test(html));

const main = readFileSync(join(ROOT, "src/main.js"), "utf8");
const updSrc = readFileSync(join(ROOT, "src/app/update.js"), "utf8");
check(
  "main.js registers SW (through src/app/update.js mountUpdate -> registerSW)",
  /from\s+["']\.\/app\/update\.js["']/.test(main) && /mountUpdate\s*\(/.test(main) &&
    /from\s+["']\.\.\/pwa\/register\.js["']/.test(updSrc) && /registerSW\s*\(/.test(updSrc),
);
check(
  "update card names only the RUNNING build, derived from CACHE_NAME (never a guessed next number)",
  /import\s*\{\s*CACHE_NAME\s*\}\s*from\s*["']\.\.\/pwa\/shell\.js["']/.test(updSrc) &&
    /CACHE_NAME\.replace\("fusegrid-shell-",\s*""\)/.test(updSrc) && /You are on ' \+ REV \+ '\./.test(updSrc) && !/v\d{3}/.test(updSrc),
);

// ---- NEW VERSION READY (2026-10-19): wait + prompt instead of a silent skip ----
{
  const { updVisible } = await import("../src/app/update.js");
  const { applyUpdate } = await import("../src/pwa/register.js");
  const { SCREEN } = await import("../src/app/menuapp.js");
  check("update card: never on INTRO / ATTRACT / BOOT",
    !updVisible(SCREEN.INTRO, "PLAY", false, SCREEN) && !updVisible(SCREEN.ATTRACT, "PLAY", false, SCREEN) && !updVisible(SCREEN.BOOT, "PLAY", false, SCREEN));
  check("update card: never in live PLAY or PAUSE, nor a mid-run WIN",
    !updVisible(SCREEN.GAME, "PLAY", false, SCREEN) && !updVisible(SCREEN.GAME, "PAUSE", false, SCREEN) && !updVisible(SCREEN.GAME, "WIN", false, SCREEN));
  check("update card: on MENU, every sub-page and a finished run's WIN / LOSE",
    ["MENU", "LEVEL", "SCORES", "SETTINGS", "GRAPHICS", "GUIDE", "STATS", "TROPHIES", "HOWTO", "ITEMS", "ENEMIES"].every((k) => updVisible(SCREEN[k], "PLAY", false, SCREEN)) &&
      updVisible(SCREEN.GAME, "WIN", true, SCREEN) && updVisible(SCREEN.GAME, "LOSE", true, SCREEN));
  const posted = [];
  check("applyUpdate posts SKIP_WAITING to the waiting worker only",
    applyUpdate({ waiting: { postMessage: (m) => posted.push(m) } }) === true && posted.length === 1 && posted[0].type === "SKIP_WAITING" &&
      applyUpdate({ waiting: null }) === false);
  const seen = [];
  const reg = { waiting: {}, update: () => Promise.resolve(), addEventListener() {} };
  registerSW({ navigator: { serviceWorker: { controller: {}, register: () => Promise.resolve(reg), addEventListener() {} } }, href: "http://127.0.0.1:8080/", onUpdate: (r) => seen.push(r) });
  const fresh = [];
  registerSW({ navigator: { serviceWorker: { controller: null, register: () => Promise.resolve(reg), addEventListener() {} } }, href: "http://127.0.0.1:8080/", onUpdate: (r) => fresh.push(r) });
  await Promise.resolve(); await Promise.resolve();
  check("registerSW reports a waiting worker to onUpdate (returning client)", seen.length === 1 && seen[0] === reg, seen.length);
  check("registerSW never prompts on a first install (no controller)", fresh.length === 0, fresh.length);
  const sw2 = readFileSync(join(ROOT, "sw.js"), "utf8");
  check("sw.js waits for SKIP_WAITING from v179 on (skips only over a pre-prompt shell)",
    /SKIP_WAITING/.test(sw2) && /PROMPT_FROM = 179/.test(sw2) && !/\.then\(\(\) => self\.skipWaiting\(\)\)/.test(sw2));
  check("sw.js activate deletes only this game's old shells (fusegrid-shell- prefix)",
    /k\.startsWith\(PREFIX\) && k !== CACHE_NAME/.test(sw2.slice(sw2.indexOf('"activate"'))));
  check("sw.js precaches with cache: no-cache", /cache: "no-cache"/.test(sw2) && !/cache: "reload"/.test(sw2));
{
  const upd = readFileSync(new URL("../src/app/update.js", import.meta.url), "utf8");
  let ran = 0, later = null;
  const q = [];
  mountUpdate(() => ({}), { idle: (f) => q.push(f), navigator: { serviceWorker: { register() { ran++; return Promise.resolve(); }, addEventListener() {} } }, href: "https://x.test/", top: 1, self: 1 });
  check("registration not called synchronously in mountUpdate", ran === 0 && q.length === 1, ran);
  q[0]();
  check("registration runs when idle fires", ran === 1, ran);
  check("update.js has no direct sync registerSW call", !/^\s*const ok = registerSW/m.test(upd.replace(/deferRegister\([\s\S]*?\}, env\);/, "")));
}
  check("register.js update check bypasses the HTTP cache", /updateViaCache: "none"/.test(readFileSync(join(ROOT, "src/pwa/register.js"), "utf8")));
}

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

{
  const sw3 = readFileSync(join(ROOT, "sw.js"), "utf8");
  const L = LOOKS.flat();
  check("two-stage: BOOT + looks == PRECACHE, disjoint", BOOT.length + L.length === PRECACHE.length && new Set([...BOOT, ...L]).size === PRECACHE.length && [...BOOT, ...L].every((p) => PRECACHE.includes(p)));
  check("two-stage: three and all of pixel/** are in the looks", L.includes("./vendor/three.module.js") && PRECACHE.filter((p) => p.startsWith("./src/render/pixel/") && !p.endsWith("/load.js")).every((p) => L.includes(p)));
  check("two-stage: the off-boot files first, then PIXEL, then REAL 3D with three", LOOKS.length === 3 && LOOKS[0].length === 24 && LOOKS[0].includes("./src/core/board3.js") && LOOKS[1].every((p) => !p.includes("three")) && LOOKS[2].includes("./vendor/three.module.js"));
  check("two-stage: boot keeps shell, loader and the lazy seams", ["./index.html", "./src/main.js", "./src/render/pixel/load.js", "./src/render/three/load.js"].every((p) => BOOT.includes(p)));
  check("install caches BOOT only", /addAll\(BOOT\.map/.test(sw3) && !/addAll\(PRECACHE/.test(sw3));
  check("the fill runs only inside an event's waitUntil: FILL and navigate, never a bare timer", !/setTimeout\(\(\) => fillLooks/.test(sw3) && /"FILL"\) event\.waitUntil\(fillLooks/.test(sw3) && /cache-first-navigate"\) event\.waitUntil/.test(sw3));
  check("a look miss goes through getLook (cached on the way)", /getLook\(req\.url/.test(sw3) && /cache\.put\(url/.test(sw3));
  check("activate deletes only fusegrid-shell-v* keys", /k\.startsWith\(PREFIX\) && k !== CACHE_NAME/.test(sw3));
}

// ---- the idle fill on a fake worker scope (delivery review 6): inside waitUntil, resumes, stops once it is not current ----
{
  const BASE = "https://hmarzban.github.io/fusegrid/", OLD = "fusegrid-shell-v200";
  const store = new Map(), opened = [];
  const key = (u) => new URL(typeof u === "string" ? u : u.url, BASE).href;
  const handle = (m) => ({ // a deleted cache's handle keeps its own map: writes land nowhere reachable
    match: async (u) => (m.has(key(u)) ? m.get(key(u)) : undefined),
    put: async (u, r) => { m.set(key(u), r); },
    addAll: async (qs) => { for (const q of qs) m.set(key(q), { ok: true, clone() { return this; } }); },
  });
  const fake = {
    has: async (n) => store.has(n),
    open: async (n) => { opened.push(n); if (!store.has(n)) store.set(n, new Map()); return handle(store.get(n)); },
    delete: async (n) => store.delete(n),
    keys: async () => [...store.keys()],
    match: async (u) => { for (const m of store.values()) if (m.has(key(u))) return m.get(key(u)); return undefined; },
  };
  let fetched = [], failAfter = Infinity, onFetch = null;
  const H = {}, me = { state: "activated" }, reg = { active: me };
  const saved = { self: globalThis.self, caches: globalThis.caches, fetch: globalThis.fetch, Request: globalThis.Request, setTimeout: globalThis.setTimeout };
  const realST = globalThis.setTimeout;
  globalThis.self = { addEventListener: (t, f) => { H[t] = f; }, location: { href: BASE + "sw.js", origin: "https://hmarzban.github.io" }, registration: reg, serviceWorker: me, skipWaiting: () => {}, clients: { claim: async () => {} } };
  globalThis.caches = fake;
  globalThis.Request = class { constructor(u) { this.url = new URL(u, BASE).href; } };
  globalThis.fetch = async (q) => {
    if (fetched.length >= failAfter) throw new TypeError("offline");
    fetched.push(q.url);
    if (onFetch) onFetch(q.url);
    return { ok: true, clone() { return this; } };
  };
  globalThis.setTimeout = (f) => realST(f, 0); // the pass's 20 ms breath and the navigate delay, at once
  const ev = (data) => { const w = []; return { data, w, waitUntil: (p) => w.push(p) }; };
  const all = LOOKS.flat().map((u) => new URL(u, BASE).href);
  const mine = () => store.get(CACHE_NAME) || new Map();
  const tick = () => new Promise((r) => realST(r, 5));
  try {
    await import("../sw.js?fill");
    store.set(OLD, new Map());
    const inst = ev();
    H.install(inst);
    await Promise.all(inst.w);
    check("sw fill: install caches BOOT, no look file", BOOT.every((u) => mine().has(key(u))) && all.every((u) => !mine().has(u)));
    const act = ev();
    H.activate(act);
    await Promise.all(act.w);
    await tick(); await tick();
    check("sw fill: activate deletes the old shell and starts no fill outside a waitUntil", !store.has(OLD) && act.w.length === 1 && fetched.length === 0, fetched.length);
    const f1 = ev({ type: "FILL" });
    H.message(f1);
    check("sw fill: a FILL message runs the pass inside its own waitUntil", f1.w.length === 1);
    await Promise.all(f1.w);
    check("sw fill: the pass caches every look file, each fetched once", all.every((u) => mine().has(u)) && fetched.length === all.length, fetched.length + "/" + all.length);
    for (const u of all.slice(40)) mine().delete(u);
    fetched = []; failAfter = 10;
    const f2 = ev({ type: "FILL" });
    H.message(f2);
    await Promise.all(f2.w);
    check("sw fill: a failed fetch ends the pass quietly (waitUntil resolves)", fetched.length === 10 && all.slice(40, 50).every((u) => mine().has(u)) && !mine().has(all[50]));
    fetched = []; failAfter = Infinity;
    const nav = { request: { method: "GET", url: BASE, mode: "navigate" }, w: [], r: null, respondWith(p) { this.r = p; }, waitUntil(p) { this.w.push(p); } };
    H.fetch(nav);
    await nav.r;
    check("sw fill: a navigation keeps its trigger, inside the fetch's waitUntil", nav.w.length === 1);
    await Promise.all(nav.w);
    check("sw fill: the next pass resumes from what is missing, nothing cached is fetched again", fetched.length === all.length - 50 && fetched.every((u) => all.indexOf(u) >= 50) && all.every((u) => mine().has(u)), fetched.length);
    for (const u of all.slice(-5)) mine().delete(u);
    fetched = [];
    me.state = "redundant"; // a newer worker took over: the old one is marked before that one's activate runs
    const f3 = ev({ type: "FILL" });
    H.message(f3);
    await Promise.all(f3.w);
    check("sw fill: a redundant worker stops: it fetches and writes nothing", fetched.length === 0 && !mine().has(all[all.length - 1]));
    me.state = "activated";
    globalThis.self.serviceWorker = undefined; // a browser without self.serviceWorker: the cache name is the only signal
    store.delete(CACHE_NAME);
    opened.length = 0;
    const f4 = ev({ type: "FILL" });
    H.message(f4);
    await Promise.all(f4.w);
    check("sw fill: its cache deleted by a newer shell: it stops and never re-creates it", fetched.length === 0 && !store.has(CACHE_NAME) && opened.length === 0, opened.join());
    store.set(CACHE_NAME, new Map());
    onFetch = () => { store.delete(CACHE_NAME); onFetch = null; }; // a newer worker activates while a file is on the wire
    fetched = [];
    const f5 = ev({ type: "FILL" });
    H.message(f5);
    await Promise.all(f5.w);
    check("sw fill: a delete during a fetch: the file is not written and the cache stays gone", fetched.length === 1 && !store.has(CACHE_NAME), fetched.length);
  } catch (e) {
    check("sw fill: the fake worker scope ran", false, e && e.message);
  } finally {
    Object.assign(globalThis, saved);
    if (saved.self === undefined) delete globalThis.self;
    if (saved.caches === undefined) delete globalThis.caches;
  }
}

// ---- the page asks for the fill: register.js posts FILL to the active worker once it is ready ----
{
  const posted = [];
  const sw = { register: () => Promise.resolve({ update: () => Promise.resolve() }), addEventListener() {}, ready: Promise.resolve({ active: { postMessage: (m) => posted.push(m) } }) };
  check("registerSW with a ready worker registers", registerSW({ navigator: { serviceWorker: sw }, href: "https://x.test/", top: 1, self: 1, document: null }) === true);
  for (let i = 0; i < 4; i++) await Promise.resolve();
  check("registerSW posts FILL to the active worker after registering", posted.length === 1 && posted[0].type === "FILL", posted.length);
  const bare = { register: () => Promise.resolve({ update: () => Promise.resolve() }), addEventListener() {} };
  check("registerSW without ready (old browser, fake) still registers, no throw", registerSW({ navigator: { serviceWorker: bare }, href: "https://x.test/", top: 1, self: 1, document: null }) === true);
}

console.log(fail ? "PWA FAIL" : "PWA OK");
process.exit(fail ? 1 : 0);
