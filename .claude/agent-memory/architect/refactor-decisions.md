---
name: refactor-decisions
description: Lasting architecture decisions for the My World server/shared refactor (shared/ location, core service names, mixin helper, golden-test determinism, weekKey)
metadata:
  type: project
---

Decisions recorded in docs/plans/refactor.md (written 2026-11-06, status: awaiting user confirmation of D1 and weekKey).

- D1: shared code goes to root `shared/` served by a `/shared/` route in server.js, NOT `public/shared/`.
  **Why:** tools/deploy.sh restart regex matches `^shared/` and `^public/shared\.js` but not `public/shared/` → server would not restart on balance changes. Shared files stay UMD classic scripts (no ES modules) because shared.js uses `(function(root){})(this)` and is required by Node.
- D2: core service names = existing method names: `add`/`creditInv` (inv), `addXp`, `toast`, `broadcast`/`sceneBroadcast`/`send`, `event`, plus `toPot` (pot, state owned by lotto), `addLog`, `sfx/sfxTo`, `logEv`. No renames.
- D3: mixin via a `mix()` helper that throws on duplicate names (not plain Object.assign); must run before the `module.exports` early return in server.js.
- D4: golden test stubs global Date class, Math.random (seeded), crypto.randomInt/randomBytes and TZ in the test — World has no clock/rng injection and we don't add one.
- weekKey: keep the ISO version (the one that actually wins today); delete the numeric dead one.

**How to apply:** future refactor plans (steps 2–4, client split) must stay consistent with these; if the user overrides D1 or weekKey, update this memory. Related: [[refactor-plan-status]]
