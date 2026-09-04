# Massless

A universe of pure energy, where nothing has mass and energy takes on forms. Your vessel is bound energy that changes shape with what it does. Seed of a tower-defence MMO: EVE-style command flight, WoW-style progression, combat played as tower defence. Grew out of Coreline (`../tower-defence`), now in 3D.

## Play

Hosted on GitHub Pages from this folder, no build. Locally:

```
python3 serve.py
```

Then open http://localhost:8766/

## Stack

- three.js r169 from CDN via import map, ES modules, no build step.
- All art procedural: dark fills with bloomed neon edges (`src/materials.js`).
- UI is an HTML overlay (`index.html`, `src/ui.js`).

## Layout

| File | Owns |
|---|---|
| `src/main.js` | renderer, bloom, orbit camera, click handling, frame loop |
| `src/ships/` | ship designs, one module each, registry in `index.js`. Pick in the top bar, choice saved in localStorage |
| `src/ship.js` | ship model, command autopilot (approach / orbit / keep / goto / direct), shield and hull |
| `src/shield.js` | fresnel shield bubble shader (not mounted for now; the shield look is still to be designed) |
| `src/selection.js` | selected target bracket |
| `src/ui.js` | HUD, command bar, throttle, overview list, HUD states |
| `src/hudfx.js` | living HUD layer: a canvas drawing petal strands, motes, edge strands and the overview thread every frame |
| `src/marker.js` | destination marker |
| `src/starfield.js` | parallax star shells and nebulas |
| `src/sites.js` | named sites across the system: beacons you can warp between, each with a rock cluster |
| `src/warpfx.js` | warp tunnel streaks |
| `src/asteroids.js` | energy condensates (the harvestable clouds) around each site: hp, shiver under fire, removal |
| `src/mobs.js` | wisps: hostile energy entities that hunt the ship and bleed its shield |
| `src/weapons/lance.js` | Resonance lance: lock-on beam |
| `src/loot.js` | motes released by unbinding, homing to the ship as scrap |
| `src/streams.js` | helical energy streams with lattices and flowing sparks |
| `src/input.js` | keyboard state |
| `src/config.js` | palette and tuning |

## Ships

Every design exports `id`, `name`, `description` and `build()`, which returns `{ group, engines, update(dt, state) }`. `state` carries `thrust`, `speedFrac` and `orbiting`, so a design can morph with what the ship is doing. Add a design by dropping a module in `src/ships/` and importing it in `index.js`.

| Design | At rest | Moving | Orbiting |
|---|---|---|---|
| **Bloom** | strands unfold into petals around the core | strands bundle into a spiral lance with a hot nose | strands wrap into a tilted halo |
| **Prism** | prow retracts, gold lattices tilt open into a mandala, rings drift, tendrils bristle | prow extends, lattices face forward, rings stack, tendrils sweep back, helix wake stretches | same as moving |

## HUD

One HUD with three states it morphs between: **Nav** (teal, movement commands forward), **Harvest** (gold, lance and orbit forward, the gauge reads the rock's remaining yield) and **Combat** (red, lance, keep range and track forward, outer ring pulses). The HUD follows what you are dealing with: select a condensate and it unfolds into Harvest with a yield readout; select a wisp, or get hunted by one, and it snaps into Combat with a threat readout and a scanline. Keys 1 / 2 / 3 or the chips force a state for six seconds. States are CSS on `body[data-hud]` in `style.css`.

## Weapons

Everything here is bound energy, so a weapon unbinds. The **Resonance lance** (F, or the Lance button) is a sustained beam on the selected rock: lock builds over a second while the target stays within 120 m, damage scales with lock, the rock shivers and its lattice flickers. At zero it bursts into motes that fly to the ship and become scrap. Fire it out of range and the ship closes in by itself: an orbit inside lance range for a wisp, an approach for a condensate. The command set follows the target: a condensate shows only Warp, Harvest and Stop; a wisp gets the full suite.

## Controls

Two flight modes, V or the top-right button switches.

**Command mode (default, EVE style).** Click an object or an overview row to select it (right-click selects and carries the running orbit / approach / keep-range over to the new target), then Approach (Q), Orbit (W) or Keep at range (E) at the chosen range. Double-click empty space to fly that way. Distances beyond 1 km show in AU (`WORLD.auUnits` world units per AU). Warp (S) to a selected site or anything over 150 m away: the camera swings in behind the ship to look down the warp line, the ship aligns to 75% speed, stretches into warp, streaks across the system and drops out beside the target. Space stops (not mid-warp). Track (C) swings the camera so the target stays in view, any drag releases it. The target's name and distance follow it on screen, pinned to the edge with an arrow when it is out of view. Throttle slider caps speed. Drag orbits the camera, wheel zooms.

**Direct mode.** Chase camera. W/S thrust, A/D strafe, R/F up and down. The ship stays level. Space stops.

Both modes share one physics model: velocity closes on the wanted velocity with a time constant (`SHIP.tau`), the nose swings at `SHIP.turn`.
