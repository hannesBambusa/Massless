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
};

export const DIRECT = {
  climb: 0.6,          // R/F vertical speed as a fraction of maxSpeed
};

export const WORLD = {
  size: 1600,          // asteroids spawn in a cube this wide around the origin
  asteroids: 220,
  stars: [3000, 1800, 900],   // stars per parallax layer, far to near
  starRadius: [900, 500, 250],
  streams: 7,          // helical energy streams through the sector
  overviewRange: 400,  // objects listed in the overview
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
  fov: 60,
};

export const BLOOM = { strength: 0.9, radius: 0.7, threshold: 0.2 };
