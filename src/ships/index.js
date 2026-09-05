// Ship designs. Each module exports { id, name, description, build() } where build returns { group, engines, update(dt, state) }.
// state: { thrust 0..1, speedFrac 0..1, orbiting bool }
import * as bloom from './bloom.js';
import * as prism from './prism.js';
import * as shoal from './shoal.js';
import * as kite from './kite.js';
import * as gyre from './gyre.js';
import * as ember from './ember.js';
import * as loom from './loom.js';
import * as medusa from './medusa.js';
import * as cairn from './cairn.js';
import * as chord from './chord.js';
import * as nautilus from './nautilus.js';

export const DESIGNS = [bloom, prism, shoal, kite, gyre, ember, loom, medusa, cairn, chord, nautilus];
export const byId = (id) => DESIGNS.find((d) => d.id === id) || DESIGNS[0];
