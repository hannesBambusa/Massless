// The player's ship: procedural neon dart, EVE-style command autopilot, direct-flight input, shield and hull.
// Forward is -Z in local space (three.js convention). The ship keeps world Y as up in every mode.
import * as THREE from 'three';
import { COLORS, SHIP } from './config.js';
import { Shield } from './shield.js';
import { byId } from './ships/index.js';
import { clamp, damp } from './utils.js';

const UP = new THREE.Vector3(0, 1, 0);
const _local = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _r = new THREE.Vector3(), _want = new THREE.Vector3(), _fwd = new THREE.Vector3(), _tan = new THREE.Vector3();

export class Ship {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();          // position + heading
    this.body = new THREE.Group();           // visual bank only
    this.group.add(this.body);

    this.setDesign(localStorage.getItem('massless-ship') || 'bloom');
    this.shieldFx = new Shield(5.2 * SHIP.scale);
    this.group.add(this.shieldFx.mesh);

    this.vel = new THREE.Vector3();
    this.cmd = { kind: 'stop' };   // stop | goto {point} | direction {dir} | approach {obj} | orbit {obj, range} | keep {obj, range} | direct {input}
    this.throttle = 1;             // 0..1
    this.range = SHIP.defaultRange;
    this.thrustLevel = 0; this.bank = 0; this.yawRate = 0; this.bendW = 0; this.spin = 0; this.spinRate = 0;
    this.hull = SHIP.hull; this.hullMax = SHIP.hull;
    this.shield = SHIP.shield; this.shieldMax = SHIP.shield; this.shieldHit = 0;
    this.speed = 0;
    scene.add(this.group);
  }

  /** swap the visual design; flight state is untouched */
  setDesign(id) {
    const d = byId(id);
    if (this.model) this.body.remove(this.model.group);
    this.model = d.build();
    this.model.group.scale.setScalar(SHIP.scale);
    this.body.add(this.model.group);
    this.engines = this.model.engines;
    this.design = d.id;
    try { localStorage.setItem('massless-ship', d.id); } catch (e) { /* private mode */ }
  }

  get position() { return this.group.position; }
  forward(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.group.quaternion); }

  // ---- commands (EVE) ----
  goTo(p) { this.cmd = { kind: 'goto', point: p.clone() }; }
  flyToward(dir) { this.cmd = { kind: 'direction', dir: dir.clone().normalize() }; }
  approach(obj) { this.cmd = { kind: 'approach', obj }; }
  orbit(obj, range = this.range) { this.cmd = { kind: 'orbit', obj, range }; }
  keepAtRange(obj, range = this.range) { this.cmd = { kind: 'keep', obj, range }; }
  stop() { this.cmd = { kind: 'stop' }; }
  /** direct mode: input is a world-space vector, length 0..1 */
  direct(input) { if (this.cmd.kind !== 'direct') this.cmd = { kind: 'direct', input: new THREE.Vector3() }; this.cmd.input.copy(input); }
  /** the point the ship is steering for, if any (for the marker) */
  get destination() { const c = this.cmd; return c.kind === 'goto' ? c.point : null; }
  get target() { return this.cmd.obj || null; }
  describe() {
    const c = this.cmd, n = c.obj ? c.obj.name : '';
    return { stop: 'Stopped', goto: 'Flying to point', direction: 'Flying', approach: `Approaching ${n}`, orbit: `Orbiting ${n} at ${c.range}`, keep: `Keeping ${n} at ${c.range}`, direct: 'Manual' }[c.kind];
  }

  /** wanted velocity for the current command, written into out; returns out */
  wanted(out) {
    const c = this.cmd, p = this.group.position, max = SHIP.maxSpeed * this.throttle;
    out.set(0, 0, 0);
    if (c.kind === 'direction') return out.copy(c.dir).multiplyScalar(max);
    if (c.kind === 'direct') return out.copy(c.input).multiplyScalar(max);
    if (c.kind === 'goto' || c.kind === 'approach' || c.kind === 'keep') {
      let goal = c.point, stopAt = SHIP.arrive;
      if (c.kind === 'approach') { goal = c.obj.position; stopAt = c.obj.radius + SHIP.approachGap; }
      if (c.kind === 'keep') { goal = c.obj.position; stopAt = c.obj.radius + c.range; }
      _r.copy(goal).sub(p); const d = _r.length();
      if (d <= stopAt + SHIP.arrive) { if (c.kind === 'goto') this.cmd = { kind: 'stop' }; return out; }
      const speed = Math.min(max, SHIP.maxSpeed * clamp((d - stopAt) / SHIP.slowRadius, 0.12, 1));
      return out.copy(_r).multiplyScalar(speed / d);
    }
    if (c.kind === 'orbit') {
      // chase a point a little ahead on the orbit circle (counter-clockwise from above); speed capped so the nose can keep up
      _r.copy(p).sub(c.obj.position); _r.y = 0;
      const R = c.obj.radius + c.range;
      if (_r.lengthSq() < 0.01) _r.set(1, 0, 0);
      _r.normalize();
      const far = clamp((p.distanceTo(c.obj.position) - R) / R, -1, 1);   // >0 outside the circle
      const ahead = SHIP.orbitLead * (1 - Math.abs(far) * 0.6);
      _tan.set(_r.x * Math.cos(ahead) - _r.z * Math.sin(ahead), 0, _r.x * Math.sin(ahead) + _r.z * Math.cos(ahead));  // rotate _r by +ahead around Y
      const err = p.distanceTo(c.obj.position) - R;                     // steady-state drift outward from chasing a chord: aim inside by the error
      _tan.multiplyScalar(Math.max(R * 0.4, R - err * 1.6)).add(c.obj.position); _tan.y = c.obj.position.y;
      out.copy(_tan).sub(p);
      const d = out.length();
      const vmax = Math.min(max, R * SHIP.turn * 0.75);
      return out.multiplyScalar(Math.min(vmax, SHIP.maxSpeed * clamp(d / SHIP.slowRadius, 0.2, 1)) / Math.max(d, 1e-3));
    }
    return out;
  }

  update(dt) {
    const g = this.group;
    this.wanted(_want);
    if (this.cmd.kind === 'stop' && this.cmd.obj) this.cmd = { kind: 'stop' };

    // EVE inertia: velocity closes on the wanted velocity exponentially
    this.vel.lerp(_want, damp(1 / SHIP.tau, dt));
    if (this.vel.lengthSq() < 0.01 && _want.lengthSq() === 0) this.vel.set(0, 0, 0);
    this.speed = this.vel.length();
    g.position.addScaledVector(this.vel, dt);

    // nose follows the wanted direction (or the velocity when coasting), level with the world
    // orbiting: the nose follows the velocity, which runs along the ring; otherwise it leads with the steering vector
    const aim = (this.cmd.kind === 'orbit' && this.vel.lengthSq() > 4) ? this.vel : (_want.lengthSq() > 1 ? _want : this.vel);
    if (aim.lengthSq() > 1) {
      _m.lookAt(g.position, _r.copy(g.position).add(aim), UP);
      _q.setFromRotationMatrix(_m);
      const before = g.quaternion.clone();
      g.quaternion.rotateTowards(_q, SHIP.turn * dt);
      const turned = 2 * Math.acos(clamp(Math.abs(before.dot(g.quaternion)), -1, 1));
      const side = Math.sign(this.forward(_fwd).cross(aim).y || 1);
      this.yawRate = turned / Math.max(dt, 1e-4) * side;
    } else this.yawRate = 0;

    // visuals
    const wantSpeed = _want.length() / SHIP.maxSpeed;
    this.thrustLevel += (clamp(wantSpeed, 0, 1) - this.thrustLevel) * damp(8, dt);
    // roll into turns (left wing dips when turning left), plus a lean toward the target while orbiting
    let wantBank = clamp(this.yawRate / SHIP.turn, -1, 1) * SHIP.bank;
    if (this.cmd.kind === 'orbit') {
      const side = Math.sign(this.forward(_fwd).cross(_r.copy(this.cmd.obj.position).sub(g.position)).y || 1);   // +1: target on the left
      wantBank += side * SHIP.orbitBank;
    }
    this.bank += (wantBank - this.bank) * damp(5, dt);
    // while bent onto the orbit ring: no roll (it would tilt the bent body out of the ring plane) and yaw the body
    // from the autopilot's chord heading onto the true tangent, so nose, core and tail all lie on the circle
    let tangentYaw = 0;
    if (this.cmd.kind === 'orbit' && this.bendW > 0.01) {
      _r.copy(g.position).sub(this.cmd.obj.position); _r.y = 0;
      _tan.crossVectors(_r, UP).normalize();                     // travel direction on the ring, same sense as wanted() (r rotated by +ahead about Y)
      this.forward(_fwd); _fwd.y = 0; _fwd.normalize();
      tangentYaw = Math.atan2(_fwd.x * _tan.z - _fwd.z * _tan.x, _fwd.x * _tan.x + _fwd.z * _tan.z);   // signed angle fwd -> tangent about Y
    }
    this.bodyYaw = (this.bodyYaw || 0) + ((-tangentYaw * Math.min(1, this.bendW * 1.5)) - (this.bodyYaw || 0)) * damp(6, dt);
    this.body.rotation.y = this.bodyYaw;
    this.body.rotation.z = this.bank * (1 - this.bendW);
    this.shield = clamp(this.shield + SHIP.shieldRegen * dt, 0, this.shieldMax);
    this.shieldHit = Math.max(0, this.shieldHit - dt * 3);
    this.shieldFx.update(dt, this.shieldHit, this.shield / this.shieldMax);
    for (const e of this.engines) { const s = 0.9 + this.thrustLevel * 1.1; e.scale.setScalar(s); e.material.opacity = 0.3 + this.thrustLevel * 0.4; }
    // orbit bend: fade in as the ship settles on the ring; radius in the model's local units, centre on the target's side
    const orbiting = this.cmd.kind === 'orbit';
    let bendR = 0, bendSide = 1;
    if (orbiting) {
      const R = this.cmd.obj.radius + this.cmd.range, d = g.position.distanceTo(this.cmd.obj.position);
      const onRing = clamp(1 - Math.abs(d - R) / (R * 0.5), 0, 1);
      this.bendW += (onRing - this.bendW) * damp(2, dt);
      bendR = R / SHIP.scale;
      _local.copy(this.cmd.obj.position); g.worldToLocal(_local); bendSide = _local.x >= 0 ? 1 : -1;
    } else this.bendW += (0 - this.bendW) * damp(3, dt);
    // corkscrew: roll about the centreline while orbiting, eased in and out
    this.spinRate += ((orbiting ? SHIP.orbitSpin * this.bendW : 0) - this.spinRate) * damp(2, dt);
    this.spin = (this.spin + this.spinRate * dt) % (Math.PI * 2);
    if (!orbiting && this.spinRate < 0.05) this.spin += (0 - this.spin) * damp(1.5, dt);   // settle upright once the spin dies
    this.model.update(dt, { thrust: this.thrustLevel, speedFrac: this.speed / SHIP.maxSpeed, orbiting, bend: { R: bendR, side: bendSide, w: this.bendW, spin: this.spin } });
  }

  damage(n) {
    const toShield = Math.min(this.shield, n);
    this.shield -= toShield; this.hull = Math.max(0, this.hull - (n - toShield));
    this.shieldHit = 1;
  }
}
