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
    sw
      .register(url, { type: "module", scope: "./", updateViaCache: "none" })
      .then((reg) => {
        if (!reg) return;
        waiting(reg);
        if (typeof reg.addEventListener === "function")
          reg.addEventListener("updatefound", () => {
            const w = reg.installing;
            if (w && typeof w.addEventListener === "function")
              w.addEventListener("statechange", () => { if (w.state === "installed") waiting(reg); });
          });
        /* a home-screen app that is never reloaded still finds new builds:
           re-check when the page comes back into view, at most every 10 min */
        const doc = env && env.document !== undefined ? env.document : typeof document !== "undefined" ? document : null;
        let last = 0;
        const check = () => {
          const t = Date.now();
          if (t - last < 600000 || typeof reg.update !== "function") return;
          last = t;
          Promise.resolve(reg.update()).catch(() => {});
        };
        if (doc && typeof doc.addEventListener === "function")
          doc.addEventListener("visibilitychange", () => { if (doc.visibilityState === "visible") check(); });
        if (typeof reg.update === "function") { last = Date.now(); return reg.update(); }
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
