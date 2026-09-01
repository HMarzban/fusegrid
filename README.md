# FUSEGRID

Deterministic single-player bomb-grid arcade. ES modules, no bundler, no npm runtime deps.

```bash
npm start          # http://127.0.0.1:8080/index.html  (loopback only)
npm test           # node --test
```

Menu **RENDER** toggles REAL 3D ⇄ CLASSIC 2D. Flags: `?render=3d`, `?render=iso`
(legacy dimetric), `?play=1`, `?orbit=1`, `?net=local` (1P lockstep harness),
`?debug=1`.

`serve.js` binds **127.0.0.1** on purpose. Do not rebind it for a public host.
Internet multiplayer is not shipped — the sim is one player.

`?render=iso` is the legacy dimetric museum path (not the live 3D default).
