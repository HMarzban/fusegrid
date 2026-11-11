/* Parse-budget seam: wrapper.js pulls vendor/three.module.js. Callers that
   only need classic 2D must not statically import wrapper. The dynamic import
   lives here so main.js stays free of inline import(). The REAL 3D logo
   (logo/draw3d.js, three-free) comes with the look; wrapper.js never imports
   logo/, and a failed logo fetch never fails the look (the title keeps the
   CLASSIC build). */
export function loadRenderer3D(){
  return Promise.all([import("./wrapper.js"), import("../logo/draw3d.js").catch(() => null)]).then(([m]) => m);
}
