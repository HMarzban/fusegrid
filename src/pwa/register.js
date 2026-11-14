export function isEmbedded(env) {
  const envTop =
    env && Object.prototype.hasOwnProperty.call(env, "top")
      ? env.top
      : typeof globalThis.top !== "undefined"
        ? globalThis.top
        : undefined;
  const envSelf =
    env && Object.prototype.hasOwnProperty.call(env, "self")
      ? env.self
      : typeof globalThis.self !== "undefined"
        ? globalThis.self
        : undefined;
  if (envTop !== envSelf) return true;
  const href =
    env && env.href
      ? env.href
      : typeof location !== "undefined" && location.href
        ? location.href
        : "";
  return /[?&]embed=1(?:[&#]|$)/.test(href);
}

export function registerSW(env) {
  if (isEmbedded(env)) return false;
  const nav =
    env && Object.prototype.hasOwnProperty.call(env, "navigator")
      ? env.navigator
      : typeof navigator !== "undefined"
        ? navigator
        : undefined;
  if (
    !nav ||
    !nav.serviceWorker ||
    typeof nav.serviceWorker.register !== "function"
  )
    return false;
  const href =
    env && env.href
      ? env.href
      : typeof location !== "undefined" && location.href
        ? location.href
        : "";
  if (!href) return false;
  const loc =
    env && Object.prototype.hasOwnProperty.call(env, "location")
      ? env.location
      : typeof location !== "undefined"
        ? location
        : undefined;
  try {
    const url = new URL("./sw.js", href).href;
    const sw = nav.serviceWorker;
    if (typeof sw.addEventListener === "function") {
      let had = !!sw.controller,
        refreshing = false;
      sw.addEventListener("controllerchange", () => {
        if (!had) {
          had = true;
          return;
        }
        if (refreshing) return;
        refreshing = true;
        if (loc && typeof loc.reload === "function") loc.reload();
      });
    }
    /* NEW VERSION READY: a worker that installed while a controller already
       runs this page WAITS (sw.js); env.onUpdate(reg) shows the prompt. A
       plain reload never activates a waiting worker, so the prompt survives
       reloads until the player takes it. updateViaCache "none": the update
       check never reads sw.js or its imports from the HTTP cache. */
    const onUpdate = env && typeof env.onUpdate === "function" ? env.onUpdate : null;
    const waiting = (reg) => {
      if (onUpdate && reg && reg.waiting && sw.controller) onUpdate(reg);
    };
    /* The worker's idle stage (sw.js) runs inside this message's waitUntil:
       ask the active worker once it is ready, and again on a later visible
       check; a pass resumes from what is missing, so a repeat costs lookups. */
    const fill = () => {
      const r = sw.ready;
      if (r && typeof r.then === "function")
        r.then((g) => { const a = g && g.active; if (a && typeof a.postMessage === "function") a.postMessage({ type: "FILL" }); }).catch(() => {});
    };
    sw
      .register(url, { type: "module", scope: "./", updateViaCache: "none" })
      .then((reg) => {
        if (!reg) return;
        fill();
        waiting(reg);
        if (typeof reg.addEventListener === "function")
          reg.addEventListener("updatefound", () => {
            const w = reg.installing;
            if (w && typeof w.addEventListener === "function")
              w.addEventListener("statechange", () => { if (w.state === "installed") waiting(reg); });
          });
        /* new builds are found fast (owner 2026-11-14): every 5 min while the page is visible, and on a return to the tab once a
           minute has passed since the last check; a hidden page never checks */
        const doc = env && env.document !== undefined ? env.document : typeof document !== "undefined" ? document : null;
        const now = env && typeof env.now === "function" ? env.now : () => Date.now();
        const every = env && typeof env.setInterval === "function" ? env.setInterval : typeof setInterval === "function" ? setInterval : null;
        let last = 0;
        const check = (gap) => {
          const t = now();
          if (t - last < gap || typeof reg.update !== "function") return;
          if (doc && doc.visibilityState === "hidden") return;
          last = t;
          fill();
          Promise.resolve(reg.update()).catch(() => {});
        };
        if (doc && typeof doc.addEventListener === "function")
          doc.addEventListener("visibilitychange", () => { if (doc.visibilityState === "visible") check(60000); });
        if (every) { const h = every(() => check(290000), 300000); if (h && typeof h.unref === "function") h.unref(); }
        if (typeof reg.update === "function") { last = now(); return reg.update(); }
      })
      .catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/* The player pressed RELOAD: the waiting worker takes over and registerSW's
   one controllerchange listener reloads the page once. */
export function applyUpdate(reg) {
  const w = reg && reg.waiting;
  if (!w || typeof w.postMessage !== "function") return false;
  w.postMessage({ type: "SKIP_WAITING" });
  return true;
}

/* Registration is off the boot path: run fn in the first idle after the title
   has painted (env.idle overrides; requestIdleCallback, else a timeout). */
export function deferRegister(fn, env) {
  if (env && typeof env.idle === "function") return env.idle(fn), true;
  const g = globalThis;
  if (typeof g.requestIdleCallback === "function") g.requestIdleCallback(fn, { timeout: 4000 });
  else { const t = setTimeout(fn, 1200); if (t && typeof t.unref === "function") t.unref(); }
  return true;
}
