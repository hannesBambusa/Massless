# Manifest: what is done and must not change

Systems listed here are finished. Their behaviour is fixed. Do not refactor, retune or "improve" them without the owner
asking for it in plain words. Bug fixes are allowed only when the bug is described and the fix keeps the behaviour below.
Adding a new design, module or system that *uses* these is fine, as long as they stay untouched.

Agents: read this before editing anything in the listed files. If a task seems to need a change here, stop and ask.

## Orbit and the snake body

The vessel is laid along the path its nose has travelled, so it wraps around whatever it orbits like a snake around a ball.

- Steering: `src/ship.js` `steer()` orbit branch. The ship chases a point `SHIP.orbitLead` ahead on the ring, speed capped so the nose keeps up, nose follows velocity while orbiting.
- Body: `src/ship.js` `updateVisuals()`. Bank into turns plus `SHIP.orbitBank` lean, `SHIP.orbitSpin` corkscrew about the centreline, body carries no rotation of its own.
- Path memory: `src/trail.js`. `MIN_STEP`, `MAX_LEN`, `sample()` extrapolation ahead of the head, floating-origin `shift()`.
- Lay-out: `src/ships/bend.js`. Negative z sits ahead of the nose on a straight line, positive z follows the trail. `point()` and `place()` are the only entry points designs use.
- Config: `SHIP.orbitLead`, `orbitSpin`, `orbitBank`, `bank`, `turn`, `tau`, `ranges` in `src/config.js`.

## Warp

- `src/ship.js` `warpTo()` and `updateWarp()`: align phase (speed and angle gates), accel, brake curve landing in finite time, drop-out at `WARP.stopAt`, exit speed.
- Visual weight follows the phase, not raw speed. Tunnel and stretch drop out over the last `WARP.visualEnd`.
- `src/warpfx.js`, `WARP` block in `src/config.js`, the camera behaviour for warps under `WARP.cinematicFrom`.

## Jump (fold to another system)

- `src/ship.js` `jumpTo()` and its phases: spool, fold, arrive. `onSwap` mid-fold swaps the world.
- `src/systems.js`, `src/gate.js`, `src/foldpass.js`, `JUMP` block in `src/config.js`.

## Floating origin

- `game.rebase()` in `src/main.js`, `WORLD.rebaseAt`. Every world-space owner exposes `shift(d)`; the ship shifts its trail and command points.
- Any new object that remembers a world position must implement `shift(d)` and be added to the rebase list. That is an addition, not a change.

## Units

- The world is real metres. `WORLD.auUnits` is metres per AU. `fmtDist` in `src/utils.js` decides m / km / AU.

## Fitting engine

- `src/fitting.js` is pure and covered by `test/fitting.test.js`. Rules: flats sum then percents multiply, Core modules raise capacity before a resource refusal, over-cap modules go dark (Corona, Orbit, then Core) and are never deleted, `relight()` restores them.
- Catalog data in `src/fits.js` may grow. Existing ids keep their meaning because saves reference them.

## Persistence

- `src/save.js` key `progress`: `{ scrap, hold, fits, owned }`, debounced one write per second, flushed on tab hide. Keep old saves loading: new fields get defaults, never rename existing ones.
- Other keys in use: `massless-ship`, `settings`, `panel:overview`.

## Not frozen

Ship designs under `src/ships/` (except `bend.js`), HUD styling, module and set numbers, mob behaviour, harvest tuning.
Move a system here when it is done by adding a section with the files and the behaviour that must hold.
