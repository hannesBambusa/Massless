// Mob catalogue: what each kind of hostile is, how it fights, what it resists, what it leaves behind.
//   wisp   - the hunter: closes in and bites (existing)
//   shade  - the sniper: hangs back at range and throws bolts at the shield
//   maw    - the brute: slow, heavy, bites hard, shrugs off pulses
//   shoal  - the swarm: packs of small fast things, weak alone, dangerous together
// resist: damage multiplier per weapon (1 = normal, <1 resists, >1 weak). ash: bonus Ash dropped besides the main drop.
export const MOB_TYPES = {
  wisp:  { name: 'Wisp',  hp: 70,  speed: 34, radius: 4, aggro: 180, hold: 22, bite: 30, dps: 4, scrap: 30, drop: 'ash',
           resist: { lance: 1, pulse: 1.2, filament: 1, fracture: 1 }, weight: 4 },
  shade: { name: 'Shade', hp: 55,  speed: 40, radius: 4, aggro: 260, hold: 90, bite: 0,  dps: 0, scrap: 40, drop: 'cerule', ash: 10,
           bolt: { every: 1.6, dmg: 9, speed: 140, color: 0x60a5fa }, resist: { lance: 0.6, pulse: 1, filament: 1.1, fracture: 1.6 }, weight: 3 },
  maw:   { name: 'Maw',   hp: 220, speed: 18, radius: 8, aggro: 160, hold: 14, bite: 22, dps: 11, scrap: 90, drop: 'ember', ash: 10,
           resist: { lance: 1, pulse: 0.35, filament: 0.8, fracture: 1.3 }, weight: 1 },
  shoal: { name: 'Shoal', hp: 18,  speed: 52, radius: 2, aggro: 220, hold: 10, bite: 14, dps: 2.5, scrap: 8, drop: 'glacis', ash: 2,
           resist: { lance: 0.9, pulse: 1.8, filament: 0.7, fracture: 0.8 }, pack: 5, weight: 2 },
};
