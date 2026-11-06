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

Step-1 remaining sub-plan (docs/plans/refactor-step1-remaining.md, 2026-11-06):
- System files export methods ONLY (mix copies every own property). Module constants shared by 2+ systems go to `server/consts.js` (no shared.js require): CAVE ('@cave' string, not S.CAVE), HFAST, ADMIN_NAME, PARTY, NPC_DEFS. Shared aliases (SELLABLE, rodOf, TS…) may be redeclared per file.
- Proof of "moved not rewritten": `tools/check-moved.js` compares `World.prototype[name].toString()` before/after (class vs object-literal methods give identical text at same indent). `tools/move-methods.js` cuts by method name and reports free module-level names (main runtime risk = missing require → ReferenceError only on that path).
- After step 1, class World keeps only orchestrators for step 2: constructor loadTown loadProjects join leave handle act tick save. Core services go last to `server/systems/core.js` (inside systems/ so check-structure dup check covers it). Arcade lives in `server/systems/arcade/{uno,party,duel,core}.js`.
- Order chosen: leaf/small systems first, arcade middle, mining/fishing/house/market late, core last.

Step 2–3 sub-plan (docs/plans/refactor-step2-3.md, 2026-11-06, base 3ef413e; D5/D7/D8 await owner confirmation):
- D5: message dispatch = methods named `msg_<t>(p, m)` in the owning system file (not a dispatch.js table); mix() duplicate check = ownership check. handle() keeps HOUSE_MSG + cave guards then `this['msg_' + m.t]`. handle had 43 cases at 3ef413e (not 84).
- D6: act() keeps its priority chain + guards; only branch bodies move (toolHoe/…/toolFeed, actSit/actProd/actHarvest) with a context object `c` destructured on the first line.
- D7: event "bus" = explicit ordered calls in event(); no dynamic subscription (order of toast/xp/coin/achCheck is golden-visible).
- D8: client split uses classic scripts in shared global lexical scope (unwrap game.js IIFE), NOT ES modules; client/systems/* contain only function declarations and load before main.js.
- D9: shared split = UMD "parts" `(out, int) => {}` run in original text order by shared/index.js PARTS; public api rebuilt from original export list; loadSharedWith must clear the shared/index.js cache (shim path would silently return the cached object).
- save() untouched until step 4; method names must not collide with instance fields (hunTick sitTick treeTimer…) — mix() can't catch that.

**How to apply:** future refactor plans (steps 2–4, client split) must stay consistent with these; if the user overrides D1 or weekKey, update this memory. Related: [[refactor-plan-status]]
