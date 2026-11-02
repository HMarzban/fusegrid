# Floor tiles for everyone (shell v198)

Date: 2026-11-02. Status: live since 2026-11-02 on the owner's word.

**The ruling.** Owner, 2026-11-02: remove the gen flag so the latest version is available to
everyone, then, offered a playtest first: "Ship without a playtest". This waives the human
playtest and go / no-go in issue #30 for the release. It's the owner's call, and it stands as
the record of why tiles went default with no human play.

## What changed

- **Ordinary runs and the DAILY deal gen 3** (the bold mazes plus the floor tiles). `?gen=3` is
  gone; an old `?gen=3` link boots like any page.
- **F3 challenge links.** B on a run's end copies an F3 link. F1 and F2 links keep opening their
  own boards. A client older than v198 refuses F3 and boots normally.
- **The DAILY** is stamped `g: 3`. A try made earlier today on the gen-2 daily reads as absent,
  so that day's counter restarts once.
- **The tile code is in the boot graph.** `src/main.js` imports `core/board3.js`, and
  `src/app/gen3load.js` is gone. That hands back v197's saving: about 75 KB raw, about 23 KB
  gzip per file. The bare sim still imports without it, through board2's seam.
- **The FLOOR page** no longer says PREVIEW or NOT IN PLAY YET.

## What stays

- Gen 1 for F1 links, past dailies, ATTRACT and the intro show. Lead call: the attract demo stays
  tile-free, since its bot can't play the tiles.
- Gen 2 for F2 links.
- Bests and times stay keyed by difficulty and room (owner ruling 6), so tiles shift how hard old
  records are to beat.

## Checked

Headless Chrome (SwiftShader) over loopback: all eight rooms in CLASSIC 2D, PIXEL and REAL 3D
show tiles with no script error; `?play=1`, an old `?gen=3` link, F1 / F2 / F3 links and the
DAILY each load the right generation; the title world stays gen 1. All tests pass.

Time to build a board, 40 seeds per room, in ms:

| Room | Normal p50 / p95 / max | 6x slowed CPU p50 / p95 / max |
|---|---|---|
| 1 JUNGLE | 15 / 24 / 31 | 93 / 138 / 166 |
| 2 ICE | 0.4 / 0.7 / 0.8 | 2 / 3 / 4 |
| 3 FACTORY | 0.5 / 0.8 / 0.9 | 2 / 4 / 4 |
| 4 WATER | 21 / 38 / 116 | 139 / 225 / 746 |
| 5 ARENA | 0.4 / 1 / 1.4 | 2 / 5 / 7 |
| 6 SAND | 1.1 / 1.6 / 2.8 | 7 / 9 / 10 |
| 7 VOID | 17 / 44 / 58 | 117 / 296 / 382 |
| 8 CROWN | 7 / 10 / 12 | 43 / 62 / 66 |

## Known and accepted by shipping

- **No human play.** Nobody has played the tiles on any device, and there's no real-GPU run of them.
- **Room-start stall.** Rooms 1, 4 and 7 block the page while the board builds, so a slow phone
  may see a pause of a few hundred ms on entering them, rarely more. The frame clamp limits what
  the sim catches up on afterwards to 0.25 s, and foes start at least 10 walking tiles away.
- **MAX may not feel harder.** STREAM, QUICKSAND, GATE and PORTAL all miss the MAX lose-rate
  target for the bot, which can't use gates or play around mounds.
- **Forced moments.** A foe can still close the only escape lane, and TRAP's wind-up shows on its
  own tile only.
- **Weak reads.** REAL 3D gate posts and portal ticks on a phone, and PIXEL MAX sand arcs at
  phone size, are unconfirmed.

## F3 is a contract

Shared F3 links and dailies now carry tile placement. If the tiles move after real play, either
those links change or the change needs a gen 4. A rule change keeps the board but changes how an
old link plays.
