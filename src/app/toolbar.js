/* Toolbar buttons (#btnPause/#btnSound/#btnRestart/#btnMenu) — DOM wiring
   only; every decision stays in main.js behind the handler bag. F3 GAME-gate:
   Pause/Restart/Menu are inert outside GAME (the demo world is live there),
   Sound stays live everywhere. Blur after each click so Space never
   re-triggers the focused button. No document = silent no-op, which is what
   keeps main.js importable headless under Node. */
export function setBtn(id, txt) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

export function mountToolbar(h) {
  if (typeof document === "undefined" || !document.getElementById) return;
  const blur = (e) => {
    e && e.currentTarget && e.currentTarget.blur();
  };
  const bp = document.getElementById("btnPause");
  if (bp)
    bp.onclick = (e) => {
      if (!h.inGame()) return;
      h.onPause();
      blur(e);
    };
  const bs = document.getElementById("btnSound");
  if (bs)
    bs.onclick = (e) => {
      bs.textContent = "Sound: " + (h.onSound() ? "On" : "Off");
      blur(e);
    };
  const br = document.getElementById("btnRestart");
  if (br)
    br.onclick = (e) => {
      if (!h.inGame()) return;
      h.onRestart();
      blur(e);
    };
  const bm = document.getElementById("btnMenu");
  if (bm)
    bm.onclick = (e) => {
      if (!h.inGame()) return;
      h.onMenu();
      blur(e);
    };
}
