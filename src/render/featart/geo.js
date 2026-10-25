/* geometry the painters AND the REAL 3D shader both read (units in a 40x40 tile); round-3 values until Tasks 3-4 fix the D art */
export const GEO = {
  PORTAL: {pips: [[6.9, 6.9, 2.8, 2.8], [10.7, 6.9, 2.8, 2.8], [6.9, 10.7, 2.8, 2.8]], core: [20, 20, 9.6]},
  GATE: {kerb: [[10, 7.1, 20, 1.3], [31.6, 10, 1.3, 20], [10, 31.6, 20, 1.3], [7.1, 10, 1.3, 20]]},
  BELT: {band: [[12, 28], [6, 34], [6, 34]]},
  STREAM: {half: 15},
  QUICK: {c: [20, 20], rIn: 3.6, rOut: 14},
  BLOOM: {c: [20, 20], r: 14},
  PLATE: {well: [0, 0, 40, 40]},
};
