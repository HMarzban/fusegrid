export const PACE = Object.freeze({ EASY: -1, NORM: 0, HARD: 1 });
export const PACE_NAME = Object.freeze(["EASY", "NORM", "HARD"]);
export const PACE_MUL = Object.freeze([0.85, 1, 1.15]);

export function clampPace(p) {
  const n = p | 0;
  return n < -1 ? -1 : n > 1 ? 1 : n;
}

export function paceMul(p) {
  return PACE_MUL[clampPace(p) + 1];
}

export function paceToken(p) {
  return PACE_NAME[clampPace(p) + 1];
}
