/* RENDER kind precedence (panel ruling R5), pure: no DOM, no src/render.
   The RENDER row value is 0 CLASSIC 2D, 1 PIXEL, 2 REAL 3D. Boot seeding:
   ?render=3d|px wins, otherwise the persisted r3d bit wins over px. ?render=iso
   is pinned live for the session. Staging until the settings px bit lands:
   kindOf also pins ?render=px from the URL alone (no app field, no settings
   write), so a REAL 3D player's r3d can never be overwritten by a probe. */
export const RENDER_KINDS = Object.freeze(["2d", "px", "3d"]);
export const renderVal = (app) => (app && app.render3d ? 2 : app && app.pixel ? 1 : 0);
export function renderBits(v) {
  const n = Math.max(0, Math.min(2, v | 0));
  return { r3d: n === 2 ? 1 : 0, px: n === 1 ? 1 : 0 };
}
export function bootRender(urlKind, opts = {}, settings = {}) {
  if (urlKind === "3d") return { render3d: true, pixel: false };
  if (urlKind === "px") return { render3d: false, pixel: true };
  const render3d = opts.render3d === true || settings.r3d === 1;
  return { render3d, pixel: !render3d && settings.px === 1 };
}
export function kindOf(urlKind, app) {
  if (urlKind === "iso" || urlKind === "px") return urlKind;
  return app && app.render3d ? "3d" : app && app.pixel ? "px" : "2d";
}
