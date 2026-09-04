export function registerSW(env) {
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
      let refreshing = false;
      sw.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        if (loc && typeof loc.reload === "function") loc.reload();
      });
    }
    sw
      .register(url, { type: "module", scope: "./" })
      .then((reg) => {
        if (reg && typeof reg.update === "function") return reg.update();
      })
      .catch(() => {});
    return true;
  } catch {
    return false;
  }
}
