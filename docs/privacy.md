# Privacy

> **What the game sends, and how to switch it off.**

Fusegrid has no accounts and no server. Your scores, bests, stats and settings
stay in your own browser's local storage.

## Play stats (Google Analytics), only if you allow it

The first time you reach the main menu, the game asks whether you want to share
play stats. Until you press **ALLOW**, nothing is sent. The game loads
no Google script and sets no cookie.

If you allow it, the game uses Google Analytics 4 to count:

- **opens**: a page view each time you open the game;
- **runs**: when a run starts (normal, daily or challenge code; room, Heat, Pact
  and pace), and how it ends (win, game over or quit, the room reached, the
  score, the run's length in seconds);
- **how often you come back**: a rough bucket of how many days you've played
  (0, 1, 2–3, 4–7, 8–14 or 15+), and which look you play in (CLASSIC 2D, PIXEL or
  REAL 3D).

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

**OPTIONS → ANALYTICS** switches it on or off at any time, including mid-run
from PAUSE. Switching it off stops sending at once and deletes the game's
Google Analytics cookies. **RESET DEFAULTS** and the STATS reset keep your
choice; clearing the site's data in your browser forgets it, and the game will
ask again.
