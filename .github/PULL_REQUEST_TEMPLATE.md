## What this changes
<!-- One or two sentences, written for a player if it's player-facing. -->

## Play-tested in
- [ ] CLASSIC 2D
- [ ] PIXEL
- [ ] REAL 3D
- [ ] Phone or touch layout
- [ ] Not visual (sim, tests, docs or tooling only)

## Checklist
- [ ] `npm test` passes
- [ ] No new npm dependencies and no build step
- [ ] Sim changes stay deterministic (no time, DOM or `Math.random` in `src/core/`)
- [ ] The doc that owns this fact is updated ([docs map](https://github.com/HMarzban/fusegrid/blob/main/docs/README.md#-who-owns-what))
- [ ] Player-facing? A line is added to `CHANGELOG.md`
- [ ] Shipped files changed? `CACHE_NAME` (`src/pwa/shell.js`) and `REV` (`sw.js`) are bumped together

<!-- See CONTRIBUTING.md for the house rules. -->
