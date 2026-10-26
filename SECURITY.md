# Security Policy

> **Found a glitch that's more than a glitch? Tell us quietly first.**

Fusegrid is a static browser game. It has no accounts, no server and no
backend. It's served by GitHub Pages, and everything it remembers stays in your
own browser's local storage. That keeps the attack surface small, but not zero.
The parts worth a look are:

- the **service worker** (`sw.js`) and its app-shell cache,
- the **URL flags** that boot a board, especially `?code=`,
- the **local dev server** (`serve.js`, loopback only),
- the **clipboard** copy on STATS and the end screen,
- the **opt-in Google Analytics** loader (`src/app/analytics.js`): nothing loads
  before ALLOW, and only on the Pages site ([privacy](docs/privacy.md)).

## 🎯 Supported version

Only the live build at
[hmarzban.github.io/fusegrid/](https://hmarzban.github.io/fusegrid/) and the
`main` branch get fixes. There are no older release lines to patch.

## 🔒 Reporting a vulnerability

**Please don't open a public issue.** Instead:

1. Go to the repository's **Security** tab and use **Report a vulnerability**
   (GitHub private vulnerability reporting).
2. If that button isn't there, open an issue titled
   **"Security contact request"** with **no details** in it, and the
   maintainer will set up a private channel with you.

Helpful things to include: what you found, the steps to reproduce it (a URL,
flags, browser and OS), and what an attacker could do with it.

Every report is read. Once a fix ships, it's noted in
[CHANGELOG.md](CHANGELOG.md), and you're credited if you'd like to be.

## 🙅 Not a security issue

These are better as an ordinary [bug report](https://github.com/HMarzban/fusegrid/issues):

- editing your own `localStorage` to change your own scores or unlocks
  (records are local, honour-system, and compete with no one),
- a challenge code that boots the board it encodes, which is its job,
- gameplay bugs, visual glitches or performance problems.
