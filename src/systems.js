// Star systems. Only one is loaded at a time; jumping unloads the current one and builds the next around the ship.
// Each has a name, a position in light-years (for the overview), a star colour that tints the sky, and its sites.
// tier: 1..3. yield multiplies fragments from condensates, threat multiplies wisp hp and damage. entry: what the fold needs,
// a learned skill box or a fitted module (either is enough); null means open.
import { COLORS } from './config.js';

/** one astronomical unit in metres: the world is in real metres now */
export const AU = 1.496e11;
const au = (x, y, z) => [x * AU, y * AU, z * AU];

export const SYSTEMS = [
  {
    id: 'alpha', name: 'Alpha Reach', ly: [0, 0, 0], tier: 1, yield: 1, threat: 1, entry: null, star: COLORS.cyan, nebula: 0x1e4fd8, gate: { name: 'Reach Gate', pos: au(-2.1, 0.05, 1.4) },
    haven: { name: 'Haven', pos: au(0.9, 0.2, 1.3) },   // the player's private home pocket
    sites: [
      { name: 'Ash Reach', pos: [0, 0, 0], color: COLORS.cyan, type: 'harvest' },
      { name: 'Cinder Belt', pos: au(4.2, 0.12, -1.8), color: COLORS.amber, type: 'harvest' },
      { name: 'Vell Anchor', pos: au(-3.6, -0.2, -3.9), color: COLORS.sky, type: 'combat' },
      { name: 'The Hollow', pos: au(-5.2, 0.3, 2.4), color: COLORS.violet, type: 'combat' },
      { name: 'Sable Gate', pos: au(2.6, -0.26, 5.6), color: COLORS.gold, type: 'combat' },
      { name: 'Quill Drift', pos: au(7.8, 0.4, 2.2), color: COLORS.ice, type: 'harvest' },
      { name: 'Far Lantern', pos: au(30, 1, -37), color: COLORS.magenta, type: 'harvest' },
    ],
  },
  {
    id: 'kestrel', name: 'Kestrel Verge', ly: [4.2, 0.6, -1.1], tier: 2, yield: 1.6, threat: 1.7, entry: { box: 'wayfarer.novice' }, star: COLORS.gold, nebula: 0x8a4a12, gate: { name: 'Verge Gate', pos: au(1.7, -0.1, 2.3) },
    sites: [
      { name: 'Kestrel Roost', pos: [0, 0, 0], color: COLORS.gold, type: 'harvest', home: true },
      { name: 'Tallow Reach', pos: au(-3.3, 0.13, 2.8), color: COLORS.amber, type: 'harvest' },
      { name: 'Bittern Scar', pos: au(4.7, -0.3, 1.0), color: COLORS.red, type: 'combat' },
      { name: 'Osprey Tear', pos: au(-1.2, 0.4, -5.5), color: COLORS.magenta, type: 'combat' },
      { name: 'Wren Hollow', pos: au(7.0, 0.07, -3.0), color: COLORS.ice, type: 'harvest' },
    ],
  },
  {
    id: 'umbra', name: 'Umbra Tessellate', ly: [-3.1, -2.2, 5.4], tier: 3, yield: 2.4, threat: 2.6, entry: { box: 'wayfarer.chart.2', module: 'cerule-mind' }, star: COLORS.violet, nebula: 0x4a1a8a, gate: { name: 'Tessel Gate', pos: au(-2.3, 0.13, -2.0) },
    sites: [
      { name: 'Tessel Prime', pos: [0, 0, 0], color: COLORS.violet, type: 'harvest', home: true },
      { name: 'Lattice Fall', pos: au(3.7, -0.1, 3.7), color: COLORS.sky, type: 'harvest' },
      { name: 'Null Seam', pos: au(-4.3, 0.27, -1.3), color: COLORS.red, type: 'combat' },
      { name: 'Deep Fold', pos: au(0.8, -0.5, -6.3), color: COLORS.magenta, type: 'combat' },
      { name: 'Shard Ridge', pos: au(-6.0, 0.17, 3.0), color: COLORS.ice, type: 'combat' },
      { name: 'Quiet Bloom', pos: au(8.7, 0.3, 0.7), color: COLORS.gold, type: 'harvest' },
    ],
  },
];
export const systemById = (id) => SYSTEMS.find((s) => s.id === id);
/** light-years between two systems */
export const lyBetween = (a, b) => Math.hypot(a.ly[0] - b.ly[0], a.ly[1] - b.ly[1], a.ly[2] - b.ly[2]);
