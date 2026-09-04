// The player's ship: procedural neon dart, EVE-style command autopilot, direct-flight input, shield and hull.
// Forward is -Z in local space (three.js convention). The ship keeps world Y as up in every mode.
import * as THREE from 'three';
import { COLORS, SHIP, WARP } from './config.js';
import { WarpFx } from './warpfx.js';
import { Trail } from './trail.js';
import { byId } from './ships/index.js';
import { clamp, damp } from './utils.js';

const UP = new THREE.Vector3(0, 1, 0);
const _local = new THREE.Vector3(), _dir = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _r = new THREE.Vector3(), _want = new THREE.Vector3(), _fwd = new THREE.Vector3(), _tan = new THREE.Vector3();

export class Ship {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();          // position + heading
    this.body = new THREE.Group();           // visual bank only
    this.group.add(this.body);

    this.setDesign(localStorage.getItem('massless-ship') || 'bloom');

    this.vel = new THREE.Vector3();
    this.cmd = { kind: 'stop' };   // stop | goto {point} | direction {dir} | approach {obj} | orbit {obj, range} | keep {obj, range} | direct {input}
    this.throttle = 1;             // 0..1
    this.range = SHIP.defaultRange;
    this.thrustLevel = 0; this.bank = 0; this.yawRate = 0; this.bendW = 0; this.spin = 0; this.spinRate = 0;
    this.warpW = 0; this.warpV = 0;   // visual warp weight and current warp speed
    this.trail = new Trail();
    this._inv = new THREE.Matrix4(); this._invQ = new THREE.Quaternion();
    this.warpFx = new WarpFx(this.group);
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
    if (this.trail) this.trail.reset(this.group.position, this.forward(new THREE.Vector3()));
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
  stop() { if (this.cmd.kind === 'warp' && this.cmd.phase !== 'align') return; this.cmd = { kind: 'stop' }; }   // no stopping mid-warp
  /** warp: align first (nose on target, 75% speed), then the warp phases run outside normal physics */
  warpTo(obj) {
    if (obj.position.distanceTo(this.group.position) < WARP.minDist) return false;
    this.cmd = { kind: 'warp', obj, phase: 'align', t: 0 };
    return true;
  }
  get warping() { return this.cmd.kind === 'warp' && this.cmd.phase !== 'align'; }
  /** direct mode: input is a world-space vector, length 0..1 */
  direct(input) { if (this.cmd.kind !== 'direct') this.cmd = { kind: 'direct', input: new THREE.Vector3() }; this.cmd.input.copy(input); }
  /** the point the ship is steering for, if any (for the marker) */
  get destination() { const c = this.cmd; return c.kind === 'goto' ? c.point : null; }
  get target() { return this.cmd.obj || null; }
  describe() {
    const c = this.cmd, n = c.obj ? c.obj.name : '';
    return { stop: 'Stopped', goto: 'Flying to point', direction: 'Flying', approach: `Approaching ${n}`, orbit: `Orbiting ${n} at ${c.range}`, keep: `Keeping ${n} at ${c.range}`, direct: 'Manual', warp: c.phase === 'align' ? `Aligning to ${n}` : `Warping to ${n}` }[c.kind];
  }

  /** wanted velocity for the current command, written into out; returns out */
  wanted(out) {
    const c = this.cmd, p = this.group.position, max = SHIP.maxSpeed * this.throttle;
    out.set(0, 0, 0);
    if (c.kind === 'direction') return out.copy(c.dir).multiplyScalar(max);
    if (c.kind === 'warp') return c.phase === 'align' ? out.copy(c.obj.position).sub(p).normalize().multiplyScalar(SHIP.maxSpeed) : out;
    if (c.kind === 'direct') return out.copy(c.input).multiplyScalar(max);
    if (c.kind === 'goto' || c.kind === 'approach' || c.kind === 'keep') {
      let goal = c.point, stopAt = SHIP.arrive;
      if (c.kind === 'approach') { goal = c.obj.position; stopAt = c.obj.radius + SHIP.approachGap; }
      if (c.kind === 'keep') { goal = c.obj.position; stopAt = c.obj.radius + c.range; }
      _r.copy(goal).sub(p); const d = _r.length();
      if (c.kind !== 'keep') {
        // goto / approach: arriving ends the command, so the ship coasts to rest instead of hunting the arrival band
        if (d <= stopAt + SHIP.arrive) { this.cmd = { kind: 'stop' }; return out; }
        const speed = Math.min(max, SHIP.maxSpeed * clamp((d - stopAt) / SHIP.slowRadius, 0.12, 1));
        return out.copy(_r).multiplyScalar(speed / d);
      }
      // keep at range: hold the distance with a dead band and speed proportional to the error (no floor, so no chatter)
      const err = d - stopAt;
      if (Math.abs(err) <= SHIP.arrive) return out;
      const speed = Math.min(max, SHIP.maxSpeed * clamp((Math.abs(err) - SHIP.arrive) / SHIP.slowRadius, 0, 1));
      return out.copy(_r).multiplyScalar(Math.sign(err) * speed / d);
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

  /** warp phases: accel -> cruise -> brake -> exit. Position is driven directly; returns true while it owns the ship */
  updateWarp(dt) {
    const c = this.cmd, g = this.group;
    if (c.kind !== 'warp') { this.warpW += (0 - this.warpW) * damp(3, dt); return false; }
    _dir.copy(c.obj.position).sub(g.position); const dist = _dir.length(); _dir.normalize();
    const stopAt = c.obj.radius + WARP.stopAt;
    this.yawRate = 0;
    if (c.phase === 'align') {
      this.forward(_fwd);
      const aligned = _fwd.angleTo(_dir) < WARP.alignAngle && this.speed >= SHIP.maxSpeed * WARP.alignSpeed * this.throttle;
      if (aligned || (c.t += dt) > 8) { c.phase = 'accel'; this.warpV = this.speed; }
      this.warpW += (0 - this.warpW) * damp(3, dt);
      return false;
    }
    // speed target: full warp, or a braking ramp so the ship arrives at stopAt with exit speed
    const remaining = Math.max(0, dist - stopAt);
    const brakeV = remaining * WARP.brake + SHIP.maxSpeed * WARP.exitSpeed;
    const wantV = Math.min(WARP.speed, brakeV);
    c.phase = wantV < WARP.speed ? 'brake' : (this.warpV > WARP.speed * 0.9 ? 'cruise' : 'accel');
    this.warpV += (wantV - this.warpV) * damp(c.phase === 'brake' ? WARP.brake : WARP.accel, dt);
    if (c.phase !== 'brake' && this.warpV < wantV) this.warpV += SHIP.maxSpeed * 0.8 * dt;   // kick off the exponential from low speed
    const step = Math.min(this.warpV * dt, remaining);
    g.position.addScaledVector(_dir, step);
    this.vel.copy(_dir).multiplyScalar(this.warpV);
    this.speed = this.warpV;
    // nose locked on the target
    _m.lookAt(g.position, c.obj.position, UP); _q.setFromRotationMatrix(_m); g.quaternion.slerp(_q, damp(6, dt));
    this.warpW += (clamp(this.warpV / WARP.speed * 1.4, 0, 1) - this.warpW) * damp(2.5, dt);
    if (remaining <= 0.5) { this.cmd = { kind: 'stop' }; this.vel.copy(_dir).multiplyScalar(SHIP.maxSpeed * WARP.exitSpeed); this.speed = this.vel.length(); }
    return true;
  }

  update(dt) {
    const g = this.group;
    if (this.updateWarp(dt)) { this.updateVisuals(dt, 1); return; }
    this.wanted(_want);
    if (this.cmd.kind === 'stop' && this.cmd.obj) this.cmd = { kind: 'stop' };

    // EVE inertia: velocity closes on the wanted velocity exponentially
    this.vel.lerp(_want, damp((_want.lengthSq() > 0 ? 1 : 2.6) / SHIP.tau, dt));   // coasting to rest bleeds speed faster than it builds
    if (this.vel.lengthSq() < 0.25 && _want.lengthSq() === 0) this.vel.set(0, 0, 0);
    this.speed = this.vel.length();
    g.position.addScaledVector(this.vel, dt);

    // nose follows the wanted direction (or the velocity when coasting), level with the world
    // orbiting: the nose follows the velocity, which runs along the ring; otherwise it leads with the steering vector
    const aim = (this.cmd.kind === 'orbit' && this.vel.lengthSq() > 4) ? this.vel : (_want.lengthSq() > 1 ? _want : this.vel);
    // coasting to rest: once slow, hold the heading instead of chasing a shrinking velocity vector
    if (aim.lengthSq() > 1 && !(_want.lengthSq() <= 1 && this.speed < 4)) {
      _m.lookAt(g.position, _r.copy(g.position).add(aim), UP);
      _q.setFromRotationMatrix(_m);
      const before = g.quaternion.clone();
      g.quaternion.rotateTowards(_q, SHIP.turn * dt);
      const turned = 2 * Math.acos(clamp(Math.abs(before.dot(g.quaternion)), -1, 1));
      const side = Math.sign(this.forward(_fwd).cross(aim).y || 1);
      this.yawRate = turned / Math.max(dt, 1e-4) * side;
    } else this.yawRate = 0;

    const wantSpeed = _want.length() / SHIP.maxSpeed;
    this.thrustLevel += (clamp(wantSpeed, 0, 1) - this.thrustLevel) * damp(8, dt);
    this.updateVisuals(dt, this.thrustLevel);
  }

  /** bank, orbit bend, corkscrew, warp stretch, shield, and the design's own animation */
  updateVisuals(dt, thrust) {
    const g = this.group;
    // roll into turns (left wing dips when turning left), plus a lean toward the target while orbiting
    let wantBank = clamp(this.yawRate / SHIP.turn, -1, 1) * SHIP.bank;
    const orbiting = this.cmd.kind === 'orbit';
    if (orbiting) {
      const side = Math.sign(this.forward(_fwd).cross(_r.copy(this.cmd.obj.position).sub(g.position)).y || 1);   // +1: target on the left
      wantBank += side * SHIP.orbitBank;
    }
    this.bank += (wantBank - this.bank) * damp(5, dt);
    this.shield = clamp(this.shield + SHIP.shieldRegen * dt, 0, this.shieldMax);
    this.shieldHit = Math.max(0, this.shieldHit - dt * 3);
    for (const e of this.engines) { const s = 0.9 + thrust * 1.1; e.scale.setScalar(s); e.material.opacity = 0.3 + thrust * 0.4; }
    // corkscrew: roll about the centreline while orbiting, eased in and out
    this.spinRate += ((orbiting ? SHIP.orbitSpin : 0) - this.spinRate) * damp(2, dt);
    this.spin = (this.spin + this.spinRate * dt) % (Math.PI * 2);
    if (!orbiting && this.spinRate < 0.05) { this.spin += (0 - this.spin) * damp(1.5, dt); if (Math.abs(this.spin) < 0.002) this.spin = 0; }
    // snake: the body is laid along the path the nose has travelled. Roll (bank + corkscrew) happens about that centreline,
    // so the body carries no rotation of its own.
    const ws = this.warpW;   // warp: stretch the vessel along its axis (the trail lay-out reads this scale)
    this.model.group.scale.set(SHIP.scale * (1 - ws * 0.35), SHIP.scale * (1 - ws * 0.35), SHIP.scale * (1 + ws * WARP.stretch));
    this.trail.push(g.position, this.forward(_fwd));
    this.body.rotation.set(0, 0, 0);
    g.updateMatrixWorld(true);
    this._inv.copy(this.body.matrixWorld).invert();                   // world -> body local (model group sits at the body origin, only scaled)
    this._invQ.setFromRotationMatrix(this._inv).normalize();
    this.model.update(dt, { thrust: Math.max(thrust, this.warpW), speedFrac: clamp(this.speed / SHIP.maxSpeed, 0, 1), warp: this.warpW, orbiting, bend: { trail: this.trail, scale: this.model.group.getWorldScale(new THREE.Vector3()), inv: this._inv, invQ: this._invQ, spin: this.spin + this.bank } });
    this.warpFx.update(dt, this.warpW, this.warpV);

  }

  damage(n) {
    const toShield = Math.min(this.shield, n);
    this.shield -= toShield; this.hull = Math.max(0, this.hull - (n - toShield));
    this.shieldHit = 1;
  }
}
