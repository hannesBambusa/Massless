// Star systems. Only one is loaded at a time; jumping unloads the current one and builds the next around the ship.
// Each has a name, a position in light-years (for the overview), a star colour that tints the sky, and its sites.
import { COLORS } from './config.js';

export const SYSTEMS = [
  {
    id: 'alpha', name: 'Alpha Reach', ly: [0, 0, 0], star: COLORS.cyan, nebula: 0x1e4fd8, gate: { name: 'Reach Gate', pos: [-6000, 200, 4000] },
    sites: [
      { name: 'Ash Reach', pos: [0, 0, 0], color: COLORS.cyan, type: 'harvest', home: true },
      { name: 'Cinder Belt', pos: [12600, 360, -5400], color: COLORS.amber, type: 'harvest' },
      { name: 'Vell Anchor', pos: [-10800, -600, -11700], color: COLORS.sky, type: 'combat' },
      { name: 'The Hollow', pos: [-15600, 900, 7200], color: COLORS.violet, type: 'combat' },
      { name: 'Sable Gate', pos: [7800, -780, 16800], color: COLORS.gold, type: 'combat' },
      { name: 'Quill Drift', pos: [23400, 1200, 6600], color: COLORS.ice, type: 'harvest' },
      { name: 'Far Lantern', pos: [90000, 3000, -110000], color: COLORS.magenta, type: 'harvest' },
    ],
  },
  {
    id: 'kestrel', name: 'Kestrel Verge', ly: [4.2, 0.6, -1.1], star: COLORS.gold, nebula: 0x8a4a12, gate: { name: 'Verge Gate', pos: [5000, -300, 7000] },
    sites: [
      { name: 'Kestrel Roost', pos: [0, 0, 0], color: COLORS.gold, type: 'harvest', home: true },
      { name: 'Tallow Reach', pos: [-9800, 400, 8400], color: COLORS.amber, type: 'harvest' },
      { name: 'Bittern Scar', pos: [14200, -900, 3100], color: COLORS.red, type: 'combat' },
      { name: 'Osprey Tear', pos: [-3600, 1200, -16400], color: COLORS.magenta, type: 'combat' },
      { name: 'Wren Hollow', pos: [21000, 200, -9000], color: COLORS.ice, type: 'harvest' },
    ],
  },
  {
    id: 'umbra', name: 'Umbra Tessellate', ly: [-3.1, -2.2, 5.4], star: COLORS.violet, nebula: 0x4a1a8a, gate: { name: 'Tessel Gate', pos: [-7000, 400, -6000] },
    sites: [
      { name: 'Tessel Prime', pos: [0, 0, 0], color: COLORS.violet, type: 'harvest', home: true },
      { name: 'Lattice Fall', pos: [11000, -300, 11000], color: COLORS.sky, type: 'harvest' },
      { name: 'Null Seam', pos: [-13000, 800, -4000], color: COLORS.red, type: 'combat' },
      { name: 'Deep Fold', pos: [2500, -1500, -19000], color: COLORS.magenta, type: 'combat' },
      { name: 'Shard Ridge', pos: [-18000, 500, 9000], color: COLORS.ice, type: 'combat' },
      { name: 'Quiet Bloom', pos: [26000, 900, 2000], color: COLORS.gold, type: 'harvest' },
    ],
  },
];
export const systemById = (id) => SYSTEMS.find((s) => s.id === id);
/** light-years between two systems */
export const lyBetween = (a, b) => Math.hypot(a.ly[0] - b.ly[0], a.ly[1] - b.ly[1], a.ly[2] - b.ly[2]);
