// Shared palette and tuning. Every number worth tweaking lives here. Units: 1 = one metre-ish, ship is ~4 long.
export const COLORS = {
  cyan: 0x4ff2ff, blue: 0x3b82f6, white: 0xffffff,
  magenta: 0xff3df2, red: 0xff4d6d, orange: 0xff9f43,
  gold: 0xffd166, violet: 0xc084fc, green: 0x5eead4,
  ice: 0x9be7ff, sky: 0x60a5fa, bg: 0x050a1c, hull: 0x0b1030,
  amber: 0xffb347, deep: 0x0b1f5c, nebula: 0x1e4fd8,
};

export const SHIP = {
  scale: 1.35,         // visual size of the vessel
  maxSpeed: 60,
  tau: 1.6,            // seconds for velocity to close ~63% of the gap to the wanted velocity (EVE: mass x inertia)
  turn: 1.6,           // rad/s the ship can swing its nose
  bank: 0.5,           // visual roll at full turn rate (rad)
  orbitBank: 0.35,     // extra lean toward the target while orbiting (rad)
  arrive: 3,           // "there" within this distance
  slowRadius: 40,      // start slowing this far from a point
  approachGap: 12,     // approach stops this far outside an object's radius
  orbitLead: 0.55,     // radians ahead on the orbit circle the ship aims for
  orbitSpin: 1.2,      // rad/s corkscrew roll about the centreline while orbiting
  ranges: [15, 30, 60, 120],   // orbit / keep-at-range choices
  defaultRange: 30,
  hull: 100, shield: 60, shieldRegen: 6,
  glowNear: 35,        // camera distance at which the glow sprites are at full strength
  glowMin: 0.05,       // floor for the far fade of glow sprites
  lineMin: 0.3,        // floor for the far fade of strands and motes
};

export const WARP = {
  speed: 14000,        // units/s in full warp (~5.6 AU/s)
  minDist: 150,        // targets closer than this cannot be warped to
  alignSpeed: 0.75,    // fraction of max speed needed to enter warp (EVE)
  alignAngle: 0.08,    // radians off the target still counted as aligned
  accel: 1.3,          // per-second rate the warp speed closes on its target
  brake: 1.5,          // per-second rate while slowing down
  stopAt: 70,          // drop out this far from the target (outside its radius)
  exitSpeed: 0.5,      // fraction of max speed the ship keeps on drop-out
  fov: 26,             // extra camera fov at full warp
  stretch: 4,          // how far the vessel stretches along its axis at full warp
};

export const DIRECT = {
  climb: 0.6,          // R/F vertical speed as a fraction of maxSpeed
};

export const WORLD = {
  size: 1600,          // asteroids spawn in a cube this wide around the origin
  asteroids: 40,       // rocks per site cluster
  clusterRadius: 700,
  stars: [3000, 1800, 900],   // stars per parallax layer, far to near
  starRadius: [900, 500, 250],
  streams: 7,          // helical energy streams through the sector
  overviewRange: 400,  // rocks listed in the overview (sites are always listed)
  auUnits: 2500,       // world units per AU for the HUD (local distances stay in m)
};

export const CAMERA = {
  dist: 30,            // orbit distance at zoom 1
  zoom: [0.4, 40],     // wheel zoom range (40 = 1200 units out)
  pitch0: 0.42,        // starting elevation (rad above the horizon)
  pitchRange: [-1.2, 1.45],
  orbitSpeed: 0.006,   // rad per dragged pixel
  lerp: 6.0,           // per-second follow tightness of the pivot
  chase: { back: 22, up: 8, lerp: 4 },   // direct mode: behind and above the ship
  trackLerp: 2.5,      // how fast the tracking camera swings onto the target
  trackPitch: 0.3,     // elevation while tracking
  warpLerp: 1.6,       // how fast the camera swings in behind the ship for a warp
  warpPitch: 0.10,     // elevation while looking down the warp line
  fov: 60,
};

export const LANCE = {
  range: 120,          // m from the target's surface
  harvestGap: 60,      // siphon auto-close keeps this range from the cloud's surface
  lockTime: 1.2,       // seconds to full lock
  lockDecay: 0.6,      // seconds to lose it once out of range or off
  dps: 22,             // at full lock
};

export const ROCK = {             // energy condensates: the harvestable things
  hpPerRadius: 9,      // hp = radius * this
  scrapPerRadius: 4,   // scrap on unbinding
  motesPerRadius: 5,
};

export const MOB = {              // wisps
  perSite: 3,
  hp: 70,
  speed: 34,
  aggroRange: 180,     // starts hunting when the ship is this close
  leashRange: 700,     // gives up beyond this
  holdRange: 22,       // hunts to this distance, then circles
  biteRange: 30,       // bleeds the shield within this
  dps: 4,
  scrap: 30,
};

export const BLOOM = { strength: 0.9, radius: 0.7, threshold: 0.2 };
