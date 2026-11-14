# Privacy

> **What the game sends, and how to switch it off.**

Fusegrid has no accounts and no server. Your scores, bests, stats, settings and
controller binds stay in your own browser's local storage.

## Play stats (Google Analytics), only if you allow it

The first time you reach the main menu, a small card in the corner asks whether
you want to share play stats. It doesn't stop the game: play first and answer
whenever you like. Until you press **ALLOW**, nothing is sent. The game loads
no Google script and sets no cookie.

If you allow it, the game uses Google Analytics 4 to count:

- **opens**: a page view each time you open the game;
- **runs**: when a run starts (normal, daily or challenge code; level,
  difficulty, modifiers and game speed), and how it ends (win, game over or
  quit, the level reached, the score, the run's length in seconds);
- **how often you come back**: a rough bucket of how many days you've played
  (0, 1, 2–3, 4–7, 8–14 or 15+), and which art style you play in (CLASSIC 2D,
  PIXEL or REAL 3D).

Google Analytics sets cookies (`_ga`, `_ga_…`) on the game's own path, so it can
tell a returning player from a new one. That makes the stats pseudonymous, not
anonymous: they carry a random ID for your browser, never your name. Google
Analytics also records what any visit to a website reveals: device and browser
type, screen size and an approximate location (country or city) from your
connection. The game doesn't add any of that; it comes with the visit.

Ad features are off: ad storage, ad user data and ad personalisation are all
denied. Google handles the data under
[its own privacy policy](https://policies.google.com/privacy). The game sends no
name, email, account or anything you type.

Only the official site, `hmarzban.github.io/fusegrid/`, sends anything. Copies
running anywhere else (your own server, a game portal, a fork) never load
Google Analytics.

## Changing your mind

**SETTINGS → ANALYTICS** switches it on or off at any time, including mid-run
from PAUSE. Switching it off stops sending at once and deletes the game's
Google Analytics cookies. **RESET DEFAULTS** and the STATS reset keep your
choice; clearing the site's data in your browser forgets it, and the game will
ask again.

## Controller access

Most controllers need nothing: the browser hands the game their buttons, and
that's all. The Switch 2 Pro Controller is the exception. On **SETTINGS ›
CONTROLS**, **CONNECT** asks Chrome to let the page talk to it over USB, and
**ALLOW VIBRATION** asks once more for HID, which is how the game makes it buzz.
Chrome shows its own prompt each time, and nothing happens unless you pick the
controller there. The menu's **PLAYING WITH A CONTROLLER?** card offers the same
prompt as **CONNECT SWITCH 2**; it is the same Chrome prompt, nothing more.

- **Chrome keeps the grant, not the game.** After one yes, the game finds that
  controller on its own whenever you plug it in, with no new prompt.
- **The grant is per site.** It belongs to `hmarzban.github.io`, and that site
  also hosts other pages by the same author, which could use the same
  device without asking you again.
- **Take it back at any time:** open
  `chrome://settings/content/usbDevices` and `chrome://settings/content/hidDevices`
  and remove the site, or click the padlock next to the address bar, open the
  site's settings and reset the USB and HID permissions.

The game stores nothing about your controller beyond the binds you set on
CONTROLS (they stay in your browser, like your settings), and three small flags
for that menu card: whether a controller has been seen, whether you pressed GOT
IT, and how many runs it has been on screen for, so it knows when to stop
showing. Which kind of
controller you hold and what your keyboard prints are read fresh each visit and
never saved. None of it is sent anywhere: the play stats carry no field
about a controller or a keyboard.
