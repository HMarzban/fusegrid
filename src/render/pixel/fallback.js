/* PIXEL placeholders. A manifest cell without authored art becomes ONE generic outlined box in its group's own slots (a solid tile for floors and walls), so
   ?render=px stays a complete, playable board and tests/pixel-art.test.mjs still fails on any silent fallback. The per-entity stand-ins this file once drew
   (MAKO, foes, items, blasts) went when every cell got real art; they were dead weight against the px byte cap. */
const box = (w, h, solid) => Array.from({length: h}, (_, y) => Array.from({length: w}, (_, x) => (solid ? "b" : x >= 5 && x < w - 5 && y >= 5 && y < h - 5 ? (x === 5 || x === w - 6 || y === 5 || y === h - 6 ? "o" : "b") : ".")).join(""));

export function fallbackCell(group, name) {
  const T = group === "tiles" || group === "walls", ring = group === "mako" && /^(shield|passing)/.test(name), w = ring ? 24 : 20, h = T && /Face$/.test(name) ? 10 : w;
  const c = {w, h, rows: box(w, h, T), pal: T ? {o: "tile.wall.outline", b: "tile.wall"} : {o: "body.outline", b: "body"}};
  return ring ? {...c, axis: 12, anchor: [12, 10]} : c;
}
