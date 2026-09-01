/* Parse-budget seam: wrapper.js pulls vendor/three.module.js. Callers that
   only need classic 2D must not statically import wrapper. The dynamic import
   lives here so main.js stays free of inline import(). */
export function loadRenderer3D(){
  return import("./wrapper.js");
}
