import {CFG} from "../../core/config.js";

/* Fixed dimetric projection — frozen module constants (spec §4.2/§4.4/§4.5).
   No mutable camera state in v1: 3D is a view, never sim state.
   TILE_W = CFG.TILE (diamond width in screen x)
   TILE_H = CFG.TILE/2 (diamond height in screen y)
   canvasW = (COLS+ROWS)*(TILE_W/2) + 2*PAD        = 560+48  = 608
   OFF_X   = PAD + ROWS*(TILE_W/2)                 = 24+260  = 284
   OFF_Y   = PAD + WALL_H                          = 24+24   = 48
   canvasH = (COLS+ROWS)*(TILE_H/2)+OFF_Y+PAD      = 280+48+24 = 352 */
const TILE_W=CFG.TILE, TILE_H=CFG.TILE/2;
const WALL_H=24, BRICK_H=14, PAD=24;
const OFF_X=PAD+CFG.ROWS*(TILE_W/2);
const OFF_Y=PAD+WALL_H;
const canvasW=(CFG.COLS+CFG.ROWS)*(TILE_W/2)+2*PAD;
const canvasH=(CFG.COLS+CFG.ROWS)*(TILE_H/2)+OFF_Y+PAD;

export const PROJ=Object.freeze({
  TILE_W, TILE_H, WALL_H, BRICK_H, PAD, OFF_X, OFF_Y, canvasW, canvasH,
});

/* project(gx,gy) -> {sx,sy}; gx,gy are continuous grid coords
   (entities pass px/TILE so they never snap to tile centers). */
export function project(gx, gy){
  return {
    sx:(gx-gy)*(PROJ.TILE_W/2)+PROJ.OFF_X,
    sy:(gx+gy)*(PROJ.TILE_H/2)+PROJ.OFF_Y,
  };
}
