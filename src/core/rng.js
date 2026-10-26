// mulberry32 seeded RNG. Deterministic, state-serializable.
export function createRng(seed){
  let a=seed>>>0;
  return {
    next(){ a|=0; a=(a+0x6D2B79F5)|0;
      let t=Math.imul(a^a>>>15, 1|a);
      t=(t+Math.imul(t^t>>>7, 61|t))^t;
      return ((t^t>>>14)>>>0)/4294967296;
    },
    int(a,b){ return a + (Math.floor(this.next()*(b-a+1))); },
    get state(){ return a; },
    set state(v){ a=v>>>0; },
  };
}

// Board seed of a page load's i-th ordinary run: run 0 is bootSeed, later runs a fmix32 avalanche of bootSeed ^ i*golden.
export function runSeed(bootSeed, i){
  const b=bootSeed>>>0, n=i>>>0;
  if(!n) return b;
  let h=(b^Math.imul(n,0x9E3779B9))>>>0;
  h^=h>>>16; h=Math.imul(h,0x85EBCA6B); h^=h>>>13; h=Math.imul(h,0xC2B2AE35); h^=h>>>16;
  return h>>>0;
}
