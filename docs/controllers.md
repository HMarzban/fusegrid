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

## What happens by itself, and what needs a click

A browser keeps three rules the game cannot get round:

1. It shows a controller to a page only after that controller's first button press.
2. It shows a page no USB device the player has not allowed, and fires no event when one is plugged in.
3. It opens its "pick a device" chooser only inside a click, key or tap.

So a standard controller (Xbox, PlayStation and most others) needs no setup: plug it in and press a button, and the menu
says which one it found. A Switch 2 Pro Controller needs one click per browser, on CONNECT SWITCH 2 on the menu's help card
or CONNECT on SETTINGS › CONTROLS; after that the game wakes it on every visit and every plug-in. The help card (shell v220)
is shown up front because rule 2 means the game can never see an un-allowed controller arrive.

## How to add a cell

Open `tools/pads/probe.html` from a local `PORT=0 node serve.js` (or the file
itself), connect one pad, press a button, and walk the list. It stores and
sends nothing. It prints the pad's id, engine, button and axis counts, the
resting axes and a ready `KNOWN` row. A pad that is not `standard` becomes a
`KNOWN` row in its own commit, with its test; the cell then reads `known`.
