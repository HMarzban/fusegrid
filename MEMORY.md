# MEMORY.md

Episodic log — dated, append-only notes of what a session/agent did, decided,
or left for the next person. Newest first. One or two lines per entry.

This file is auto-loaded by opencode (see `instructions` in `opencode.json`)
and is a standing instruction target: `AGENTS.md` requires every session to
append an entry when it makes a non-trivial change.

## Format

```
## YYYY-MM-DD — <one-line subject>
- what changed / decided, and why (or: what was left open for later).
```

## Log

## 2026-08-16 — Initialized opencode for rollblock
- Added `opencode.json` (schema + `instructions` + `permission`) and `AGENTS.md`
  (architecture, commands, conventions).
- Established this episodic-memory convention; agents must append here after
  any non-trivial change.
