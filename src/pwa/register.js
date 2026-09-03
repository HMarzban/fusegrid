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
  try {
    const url = new URL("./sw.js", href).href;
    nav.serviceWorker
      .register(url, { type: "module", scope: "./" })
      .catch(() => {});
    return true;
  } catch {
    return false;
  }
}
