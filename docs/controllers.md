# Controllers

> **YOU ARE HERE.** Which pads and browsers Fusegrid has been measured on, and
> what each pair does. One table, filled only from real captures.

Cell words:

| Word | Means |
|---|---|
| `standard` | The browser reports the standard layout; nothing extra needed. |
| `known` | A `KNOWN` row in `src/app/gamepad.js` puts the pad in the standard order. |
| `hat` | The D-PAD arrives as an axis and is read as one. |
| `needs CONNECT` | The page's CONNECT row has to wake the pad first (WebUSB). |
| `rebind` | Plays, but only after the player rebinds on CONTROLS. |
| `not seen` | The browser never lists the pad. |
| `not measured` | Nobody has tried this pair. |

Columns are Chrome / Edge, Safari and Firefox on each system. iOS is one
WebKit column.

| Controller | Browser | macOS | Windows | Linux | Android | iOS |
|---|---|---|---|---|---|---|
| Switch 2 Pro Controller, USB | Chrome / Edge | `needs CONNECT` + `known` | not measured | not measured | not measured | n/a |
| | Safari | not measured | n/a | n/a | n/a | not measured |
| | Firefox | not measured | not measured | not measured | not measured | n/a |
| Switch 2 Pro Controller, Bluetooth | Chrome / Edge | `not seen` | not measured | not measured | not measured | n/a |
| | Safari | not measured | n/a | n/a | n/a | not measured |
| | Firefox | not measured | not measured | not measured | not measured | n/a |
| "XBOX 360 For Windows" pad | Chrome / Edge | `standard` (17 buttons, 4 axes, vibration actuator present) | not measured | not measured | not measured | n/a |
| | Safari | not measured | n/a | n/a | n/a | not measured |
| | Firefox | not measured | not measured | not measured | not measured | n/a |

## How to add a cell

Open `tools/pads/probe.html` from a local `PORT=0 node serve.js` (or the file
itself), connect one pad, press a button, and walk the list. It stores and
sends nothing. It prints the pad's id, engine, button and axis counts, the
resting axes and a ready `KNOWN` row. A pad that is not `standard` becomes a
`KNOWN` row in its own commit, with its test; the cell then reads `known`.
