export const PACT=Object.freeze({LAST:1,BARE:2,THIN:4,SHRINK:8});
export const PACT_NAME=Object.freeze(["LAST","BARE","THIN","SHRINK"]);
export const PACT_COL=Object.freeze(["#ff5d73","#7385ad","#37f0d0","#ffd447"]);

export function clampPact(p){ return (p|0)&15; }
export function hasPact(p,bit){ return (clampPact(p)&(bit|0))!==0; }
export function togglePact(p,bit){ return clampPact(p)^(bit|0); }

export function applyPact(profile,pact){
  const p=Object.assign({},profile);
  if(hasPact(pact,PACT.LAST))p.lives=1;
  if(hasPact(pact,PACT.THIN))p.buriedAdd=(p.buriedAdd|0)-1;
  if(hasPact(pact,PACT.BARE))p.bare=true;
  p.shrinkT=hasPact(pact,PACT.SHRINK)?25:0;
  return p;
}
