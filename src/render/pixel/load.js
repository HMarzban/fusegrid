/* Parse-budget seam (#15): the whole px tree hangs off renderer.js. Only the
   PIXEL path pays for it; main.js and the CLASSIC boot never import it
   statically. The dynamic import lives here so main.js stays free of inline
   import(). */
export function loadRendererPx(){
  return import("./renderer.js");
}
