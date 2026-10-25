/* geometry the painters AND the REAL 3D shader both read (units in a 40x40 tile); round-3 values until Tasks 3-4 fix the D art */
export const GEO = {
  PORTAL: {tick: {w: 2.2, g: 1.8, y: 32.7, h: 2.6}, core: {c: [20, 18.4], half: [3.8, 2.8, 2.6]}},
  GATE: {kerb: [[10, 7.1, 20, 1.3], [31.6, 10, 1.3, 20], [10, 31.6, 20, 1.3], [7.1, 10, 1.3, 20]]},
  BELT: {R: 6.5, band: [6.5, 33.5]},
  STREAM: {half: [12.5, 11.5, 9.5], bank: [4.5, 4.2, 3.6]},
  QUICK: {radii: [[17.8, 11.5], [17.8, 13.6, 9.6], [17.8, 14.6, 11.6, 8.6]], c: [[20.6, 20.9], [21.2, 21.8], [21.8, 22.7]], rIn: [5.2, 5.6, 6.2]},
  BLOOM: {c: [21, 20], r: 15},
  PLATE: {well: [3, 3, 34, 34]},
};
