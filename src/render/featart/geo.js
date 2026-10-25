/* geometry the REAL 3D shader (fragSource) reads, in units of a 40x40 tile; built.js and living.js read the entries they share (BELT, PORTAL.tick, GATE, PLATE, STREAM, QUICK.radii) */
export const GEO = {
  PORTAL: {tick: {w: 2.2, g: 1.8, y: 32.7, h: 2.6}, core: {c: [20, 18.4], half: [3.8, 2.8, 2.6]}},
  GATE: {n: [3, 4, 5], bw: 3.4, x0: 8.6, x1: 31.4, y0: 7.6, y1: 28.6},
  BELT: {R: 6.5, cap: 3.4},
  STREAM: {half: [12.5, 11.5, 9.5], bank: [4.5, 4.2, 3.6], rowsInset: 5.5, scrollInset: 4},
  QUICK: {radii: [[17.8, 11.5], [17.8, 13.6, 9.6], [17.8, 14.6, 11.6, 8.6]], c: [[20.6, 20.9], [21.2, 21.8], [21.8, 22.7]], rIn: [5.2, 5.6, 6.2]},
  BLOOM: {c: [21, 20], r: 15},
  PLATE: {well: [3, 3, 34, 34], lip: [2.6, 3.4, 4.4]},
};
