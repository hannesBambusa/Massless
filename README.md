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

Finished systems and the rule for touching them: see `MANIFEST.md`.


| File | Owns |
|---|---|
| `src/main.js` | renderer, bloom, orbit camera, click handling, frame loop |
| `src/ships/` | ship designs, one module each, registry in `index.js`. Pick in the top bar, choice saved in localStorage |
| `src/ship.js` | ship model, command autopilot (approach / orbit / keep / goto / direct), shield and hull |
| `src/shield.js` | fresnel shield bubble shader (not mounted for now; the shield look is still to be designed) |
| `src/selection.js` | selected target bracket |
| `src/ui.js` | HUD, command bar, throttle, the Attunement (the sensor list, 100 km reach), HUD states |
| `src/hudfx.js` | living HUD layer: a canvas drawing petal strands, motes, edge strands and the overview thread every frame |
| `src/marker.js` | destination marker |
| `src/starfield.js` | parallax star shells and nebulas |
| `src/sites.js` | named sites across the system, typed `harvest` or `combat`. Harvest sites have streams with condensates grown on them by arcing tethers; combat sites have a rift |
| `src/rift.js` | rifts: a torn core with crawling cracks, orbiting shards and bleeding sparks. Wisps swarm here. Kill the last one and the rift collapses, the site is marked cleared, and a new combat site opens somewhere else in the system |
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

## Haven

You start inside your Haven (`src/haven.js`): a private pocket in Alpha Reach wrapped in a large translucent bubble, with a hearth at its centre, drifting rings, a hexagonal lattice floor and motes rising through it. It's listed as a site tagged HOME, only you can warp to it, and it's where you re-form after being unbound.

## Systems

Three star systems (`src/systems.js`), each with its own sites, star colour and sky. Only the current one is loaded; the overview lists the others with distances in light-years. Each system row has a fold button, each site row a warp button. Press it (or pick a system and press J): the ship comes to rest and spools the fold (rings gather onto it while space starts to bend), then folds. The tunnel turns violet-white and stretches, the camera pushes in and shakes, the screen bleaches at the peak, and the world is swapped underneath. Every system has a gate, a small dark hole listed as a site; a fold drops you in at a random spot 1 to 5 km around the gate of the system you arrive in (`src/gate.js`).

## Energy

Condensates come in kinds, each a colour and a name: Glacis (ice), Sol (gold), Cerule (blue), Ember (amber) and the rare Lumen (white). Wisps leave Ash. Unbinding one releases motes of that energy which fly to the ship; the Hold panel bottom-left counts what you carry by kind. Defined in `ENERGY` in `src/config.js`.

## Hostiles

Four kinds (`src/mobtypes.js`, designs and behaviour in `src/mobs.js`): **Wisps** hunt and bite; **Shades** hang back at 90 m and throw bolts at your shield, resist the lance and hate fractures; **Maws** are slow and heavy, bite hard and shrug off pulses; **Shoals** come in packs of five, fast and fragile, and pulses shred them. Combat sites spawn a mix. Each drops its own energy plus a little Ash. If your hull reaches zero you are unbound and re-form at the system's home site.

## Weapons

Everything here is bound energy, so a weapon unbinds. The **Resonance lance** (F) is a sustained beam on the selected target. Against a condensate it is called the **Siphon** and takes the cloud's colour: lock builds over a second while the target stays within 120 m, damage scales with lock, the rock shivers and its lattice flickers. At zero it bursts into motes that fly to the ship and become scrap. Fire it out of range and the ship closes in by itself: an orbit inside lance range for a wisp, an approach for a condensate. The other weapons run on cooldowns (`WEAPONS` in config, `src/weapons/arsenal.js`): **Unbinding pulse** (G) throws rings off the ship, hurting and shoving everything within 45 m; **Filament** (T) throws a strand that wraps the target, drains it for 8 s and knits your shield with what it takes; **Fracture** (R) fires a shard of your own lattice for burst damage at the cost of a sliver of hull. Every hostile resists some weapons and is weak to others. **Auto harvest** (A) siphons the nearest condensate, then the next nearest, until none are left within 1.6 km; Stop or Warp switches it off. The command set follows the target: a condensate shows only Warp, Harvest and Stop; a wisp gets the full suite.

## Controls

Two flight modes, V or the top-right button switches.

**Command mode (default, EVE style).** Click an object or an overview row to select it (right-click selects and carries the running orbit / approach / keep-range over to the new target), then Approach (Q), Orbit (W) or Keep at range (E) at the chosen range. Double-click empty space to fly that way. Distances read in m below 1 km, km below 10 km, and AU beyond (`WORLD.auUnits` world units per AU). Warp (S) to a selected site or anything over 150 m away: the camera swings in behind the ship to look down the warp line, the ship aligns to 75% speed, stretches into warp, streaks across the system and drops out beside the target. Space stops (not mid-warp). Track (C) swings the camera so the target stays in view, any drag releases it. The target's name and distance follow it on screen, pinned to the edge with an arrow when it is out of view. Throttle slider caps speed. Drag orbits the camera, wheel zooms.

**Direct mode.** Chase camera. W/S thrust, A/D strafe, R/F up and down. The ship stays level. Space stops.

Both modes share one physics model: velocity closes on the wanted velocity with a time constant (`SHIP.tau`), the nose swings at `SHIP.turn`.
