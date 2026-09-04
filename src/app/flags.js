/* URL + opts flags for the browser entry (src/main.js), read ONCE at boot.
   Pure over a search string so every branch is drivable from Node with no
   location: main.js passes locationSearch(), tests pass a literal. */
export function readFlags(search, opts = {}) {
  const s = String(search || "");
  const rm = s.match(/[?&]render=(3d|iso)\b/);
  return {
    urlKind: rm ? rm[1] : null,
    autoplay: /[?&]play=1/.test(s) || opts.autoplay === true,
    netLocal: /[?&]net=local/.test(s) || opts.netLocal === true,
    orbit: opts.orbit ?? /[?&]orbit=1/.test(s),
    debug: opts.debug === true || /[?&]debug=1/.test(s),
  };
}

export function locationSearch() {
  return typeof location !== "undefined" ? location.search || "" : "";
}
