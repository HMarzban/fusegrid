/* Program pins (#36). three destroys a program the moment its last material is
   disposed, so a room change threw away every program and recompiled it: 25
   links, about 26 ms blocked on getProgramInfoLog, on every rebuild. A pin is one
   extra use on each program the renderer has compiled, so the next room's
   materials find it by cache key. Bound: the distinct keys, which no longer name a
   world (groundfx, brickfx and wellrim take the world's numbers as uniforms); one
   SHADOWS tier's worth, because release() runs on the first rebuild after a tier
   change. Not thread-safe (nothing here is): the render thread only.
     const pins = createPins();
     pins.scan(gl.info.programs);      // after a render, zero allocation once held
     pins.release(gl.info.programs);   // tier change, renderer dispose
     pins.forget();                    // context restored: the list is a new one */
export const PIN_CAP = 96;  // a backstop: today's distinct keys are about 30. Past it a program lives and dies as three decides
export function createPins(cap = PIN_CAP) {
  let held = [];
  return {
    scan(list) {
      for (let i = 0; i < list.length && held.length < cap; i++) {
        const p = list[i];
        if (p._pin) continue;
        p._pin = true; p.usedTimes++; held.push(p);
      }
    },
    /* the tail of three's own releaseProgram, which the renderer does not expose */
    release(list) {
      for (const p of held) {
        p._pin = false;
        if (--p.usedTimes > 0) continue;
        const i = list.indexOf(p);
        if (i >= 0) { list[i] = list[list.length - 1]; list.pop(); }
        p.destroy();
      }
      held = [];
    },
    forget() { held = []; },
    get n() { return held.length; },
  };
}
