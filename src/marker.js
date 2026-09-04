// Destination marker: a ring at the target and a thin line down to the ship's altitude plane, so height reads in 3D.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { edgeMat, faintEdgeMat, glowSprite } from './materials.js';

export class Marker {
  constructor(scene) {
    this.group = new THREE.Group();
    this.ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, 3, 0, Math.PI * 2, false).getPoints(32).map((p) => new THREE.Vector3(p.x, 0, p.y))), edgeMat(COLORS.gold, 1.4));
    this.dot = glowSprite(COLORS.gold, 2, 0.8);
    this.drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), faintEdgeMat(COLORS.gold, 0.4));
    this.group.add(this.ring, this.dot, this.drop);
    // orbit ring: horizontal circle at orbit range around the target
    this.orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, 1, 0, Math.PI * 2, false).getPoints(96).map((p) => new THREE.Vector3(p.x, 0, p.y))), faintEdgeMat(COLORS.gold, 0.45));
    this.orbit.visible = false;
    scene.add(this.orbit);
    this.group.visible = false;
    this.t = 0;
    scene.add(this.group);
  }

  /** show the orbit circle for an orbit command, or hide it */
  updateOrbit(cmd) {
    const on = cmd && cmd.kind === 'orbit';
    this.orbit.visible = on;
    if (!on) return;
    this.orbit.position.copy(cmd.obj.position);
    this.orbit.scale.setScalar(cmd.obj.radius + cmd.range);
  }

  update(dt, dest, shipY) {
    this.group.visible = !!dest;
    if (!dest) return;
    this.t += dt;
    this.group.position.copy(dest);
    this.ring.rotation.y = this.t * 0.8;
    const pulse = 1 + 0.12 * Math.sin(this.t * 4);
    this.ring.scale.setScalar(pulse);
    const pos = this.drop.geometry.attributes.position;
    pos.setXYZ(1, 0, shipY - dest.y, 0); pos.needsUpdate = true;
  }
}
