export const CACHE_NAME = "fusegrid-shell-v5";

const SRC = Object.freeze([
  "src/ai/enemies.js",
  "src/app/demobot.js",
  "src/app/highscores.js",
  "src/app/intro.js",
  "src/app/menuapp.js",
  "src/app/pactstore.js",
  "src/app/pacestore.js",
  "src/audio.js",
  "src/audio/boom.js",
  "src/audio/item.js",
  "src/audio/tracks.js",
  "src/core/board.js",
  "src/core/config.js",
  "src/core/entities.js",
  "src/core/heat.js",
  "src/core/pact.js",
  "src/core/pace.js",
  "src/core/rng.js",
  "src/core/sim.js",
  "src/core/world.js",
  "src/input.js",
  "src/main.js",
  "src/net/lockstep.js",
  "src/net/protocol.js",
  "src/net/transport.js",
  "src/pwa/register.js",
  "src/pwa/shell.js",
  "src/render/cameraCtl.js",
  "src/render/fx.js",
  "src/render/menudraw.js",
  "src/render/r3d/camera.js",
  "src/render/r3d/scene3d.js",
  "src/render/renderer.js",
  "src/render/scenes.js",
  "src/render/sprites.js",
  "src/render/three/camrig.js",
  "src/render/three/entities.js",
  "src/render/three/flythrough.js",
  "src/render/three/lights.js",
  "src/render/three/load.js",
  "src/render/three/materials.js",
  "src/render/three/particles.js",
  "src/render/three/scene.js",
  "src/render/three/textures.js",
  "src/render/three/wrapper.js",
  "src/touch.js",
]);

export const PRECACHE = Object.freeze([
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./vendor/three.module.js",
  ...SRC.map((p) => "./" + p),
]);

export function isBypassPath(pathname) {
  const p = String(pathname || "");
  return p === "/og.png" || p.endsWith("/og.png");
}

export function fetchPolicy(requestUrl, opts = {}) {
  const base = opts.swOrigin || "http://127.0.0.1:8080";
  let u, origin;
  try {
    origin = new URL(base).origin;
    u = new URL(requestUrl, origin);
  } catch {
    return "bypass";
  }
  if (u.origin !== origin) return "bypass";
  if (isBypassPath(u.pathname)) return "bypass";
  if (opts.mode === "navigate") return "cache-first-navigate";
  return "cache-first";
}
