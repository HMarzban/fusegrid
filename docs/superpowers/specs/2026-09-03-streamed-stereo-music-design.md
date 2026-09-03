# Streamed / stereo music (2026-09-03)

Reopened parked feature. Fusegrid music stays zero npm runtime deps; attract/menu/GAME
cue routing unchanged.

## Approaches

1. **WebAudio stereo panning on existing oscillator engine (recommended).**
   Add optional `StereoPannerNode` per music note; default L/R offsets per voice
   (bass −0.32, lead +0.32, hat +0.1). No assets, works offline in PWA, Node tests
   stay on fake AudioContext (pan skipped when API missing).

2. **HTMLAudio streamed OGG/MP3 per biome.**
   Richer timbre but needs authored assets, larger precache, gapless loop hard on
   Pages, and a fallback when fetch/cache fails.

3. **Web Audio decoded buffers from bundled base64/ArrayBuffer tracks.**
   Offline-capable but huge shell bytes and a decode step; still hand-authored audio.

**Pick 1** for this pass: minimal vertical slice in `src/audio.js` only.

## Rule

- SFX graph unchanged (direct-to-destination).
- Music graph: osc → noteGain → (optional pan) → musicGain → destination.
- `MUSIC_PATTERN` / `musicCue` pins in `tests/music.test.mjs` updated only when
  deliberately changing scheduling — pan must not alter step timing.

## Tests

- Existing music suite green.
- Optional grep: `createStereoPanner` present; emitStep spreads default pan per voice.
