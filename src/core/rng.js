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
