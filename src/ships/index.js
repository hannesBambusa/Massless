// Ship designs. Each module exports { id, name, description, build() } where build returns { group, engines, update(dt, state) }.
// state: { thrust 0..1, speedFrac 0..1, orbiting bool }
import * as bloom from './bloom.js';
import * as prism from './prism.js';

export const DESIGNS = [bloom, prism];
export const byId = (id) => DESIGNS.find((d) => d.id === id) || DESIGNS[0];
