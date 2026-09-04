// Massless: EVE-style command flight with an optional direct-flight mode. Renderer, cameras, bloom, input routing and the frame loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FoldPass } from './foldpass.js';
import { COLORS, CAMERA, BLOOM, DIRECT, WARP, ROCK, MOB, LANCE, JUMP } from './config.js';
import { Ship } from './ship.js';
import { Starfield } from './starfield.js';
import { Asteroids } from './asteroids.js';
import { Streams } from './streams.js';
import { Sites } from './sites.js';
import { Rifts } from './rift.js';
import { SYSTEMS, systemById, lyBetween } from './systems.js';
import { Lance } from './weapons/lance.js';
import { Loot } from './loot.js';
import { Mobs } from './mobs.js';
import { Marker } from './marker.js';
import { Selection } from './selection.js';
import { UI } from './ui.js';
import { keys, bindPointer } from './input.js';
import { clamp, damp } from './utils.js';
import { loadProgress, ProgressSaver } from './save.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));   // retina at 2x doubles the bloom cost for little gain
renderer.setSize(innerWidth, innerHeight);
const host = document.getElementById('game');
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);
scene.fog = new THREE.FogExp2(COLORS.bg, 0.0005);
const camera = new THREE.PerspectiveCamera(CAMERA.fov, innerWidth / innerHeight, 0.1, 6000);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), BLOOM.strength, BLOOM.radius, BLOOM.threshold);   // bloom at half res is invisible to the eye and half the cost
composer.addPass(bloomPass);
const foldPass = new FoldPass(); foldPass.enabled = false; composer.addPass(foldPass);
composer.addPass(new OutputPass());

// lighting for the lit ship hull; the rest of the scene uses unlit materials and ignores it. Metal needs something to reflect, so a neutral room env map.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
scene.add(new THREE.HemisphereLight(0x9be7ff, 0x1a0b2e, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-40, 60, 30); scene.add(key);
const rim = new THREE.DirectionalLight(0x4ff2ff, 1.2); rim.position.set(30, -10, -50); scene.add(rim);


const game = {
  scene, camera, state: { scrap: 0 }, direct: false,
  ship: new Ship(scene), stars: new Starfield(scene), marker: new Marker(scene),
  system: null, sites: null, streams: null, rocks: null, mobs: null, rifts: null,
};
/** build a system around the ship: sites, streams, condensates, wisps, rifts. Unloads whatever was there. */
game.loadSystem = (id) => {
  for (const k of ['rifts', 'mobs', 'rocks', 'streams', 'sites']) if (game[k]) game[k].dispose();
  const sys = systemById(id);
  game.system = sys;
  game.sites = new Sites(scene, sys.sites);
  const harvest = game.sites.list.filter((x) => x.type === 'harvest'), combat = game.sites.list.filter((x) => x.type === 'combat');
  game.streams = new Streams(scene, harvest.map((x) => x.position));
  game.rocks = new Asteroids(scene, game.sites.list, game.streams);
  game.mobs = new Mobs(scene, game.sites.list);
  game.rifts = new Rifts(scene, combat);
  game.stars.setNebula(sys.nebula, sys.star);
  document.getElementById('hud-sector').textContent = sys.name;
};
game.loadSystem('alpha');
game.selection = new Selection(scene, camera);
game.lance = new Lance(scene, game.ship);
game.saver = new ProgressSaver(game.state);
game.loot = new Loot(scene, game.ship, (key, n) => { game.state.hold[key] = (game.state.hold[key] || 0) + n; game.state.scrap += n; game.saver.mark(); });
const { ship, selection, marker, stars } = game;

/** run a command against the selected target (or stop) */
game.command = (name) => {
  const t = selection.obj;
  if (name === 'jump') {
    const sys = game.jumpTarget; if (!sys || sys.id === game.system.id) return ui.flash('Pick another system in the overview');
    if (game.auto) game.toggleAuto(); game.lance.stop(); selection.clear();
    ship.jumpTo(sys, () => {
      // mid-fold: swap the world under the ship; the ship then runs in along its line and stops beside the new home site
      game.loadSystem(sys.id);
      game.jumpTarget = null;
      ui.flash(`Fold complete. ${sys.name}`);
      setTimeout(() => ship.trail.reset(ship.position, ship.forward(new THREE.Vector3())), 50);
      return game.sites.home.position;
    });
    return;
  }
  if (name === 'auto') return game.toggleAuto();
  if (name === 'stop') { if (game.auto) game.toggleAuto(); game.lance.stop(); return ship.stop(); }
  if (!t) return;
  if (name === 'approach') ship.approach(t);
  if (name === 'orbit') ship.orbit(t);
  if (name === 'keep') ship.keepAtRange(t);
  if (name === 'lance') {
    if (!t.hp) return ui.flash('Nothing to unbind there');
    game.lance.toggle(t);
    // out of range: the ship closes in on its own. Wisps get an orbit inside lance range, condensates an approach
    if (game.lance.on && t.position.distanceTo(ship.position) - t.radius > LANCE.range) {
      if (t.kind === 'mob') ship.orbit(t, Math.min(ship.range, LANCE.range * 0.6)); else ship.keepAtRange(t, LANCE.harvestGap);   // siphon: hold 60 m off the cloud
    }
  }
  if (name === 'warp') { if (game.auto) game.toggleAuto(); if (!ship.warpTo(t)) ui.flash(`Too close to warp. Targets need to be ${WARP.minDist} m away`); }
};
/** select obj; if the ship is busy with a target command, re-issue it against the new target */
game.retarget = (obj) => {
  if (!obj) return;
  selection.set(obj);
  const k = ship.cmd.kind;
  if (k === 'orbit' || k === 'approach' || k === 'keep') game.command(k);
  if (k === 'warp' && ship.cmd.phase === 'align') game.command('warp');
};
/** auto harvest: keep siphoning the nearest condensate until none are left in reach */
game.auto = false;
game.toggleAuto = () => {
  game.auto = !game.auto;
  if (game.auto) { game.autoNext(); ui.flash('Auto harvest on'); } else ui.flash('Auto harvest off');
  ui.setAuto(game.auto);
};
game.autoNext = () => {
  const p = ship.position;
  let best = null, bd = Infinity;
  for (const c of game.rocks.list) { const d = c.position.distanceTo(p); if (d < bd && d < ROCK.autoRange) { bd = d; best = c; } }
  if (!best) { game.auto = false; ui.setAuto(false); ui.flash('Nothing left to harvest in reach'); return; }
  selection.set(best);
  game.lance.fire(best);
  if (best.position.distanceTo(p) - best.radius > LANCE.range) ship.keepAtRange(best, LANCE.harvestGap);
};
game.toggleMode = () => {
  game.direct = !game.direct;
  ship.stop();
  ui.setMode(game.direct);
};
ship.position.copy(game.sites.home.position).add(new THREE.Vector3(0, 0, 160));   // start a little off the home beacon
const ui = new UI(game);
ui.setMode(false);

// pointer: click selects, double-click in space flies that way, drag orbits the camera, wheel zooms
const ray = new THREE.Raycaster();
const dir = new THREE.Vector3();
function pickRock(ndc) {
  ray.setFromCamera(new THREE.Vector2(...ndc), camera);
  const hits = ray.intersectObjects([...game.rocks.group.children, ...game.mobs.group.children], true);
  if (hits.length) { let o = hits[0].object; while (o && !o.kind) o = o.parent; if (o) return o; }
  // sites: pick by screen distance to the beacon, since they are sprites far away
  let best = null, bd = 0.05;
  for (const st of game.sites.list) { const v = st.position.clone().project(camera); if (v.z > 1) continue; const d = Math.hypot(v.x - ndc[0], (v.y - ndc[1]) / camera.aspect); if (d < bd) { bd = d; best = st; } }
  return best;
}
let zoom = 1, camYaw = 0, camPitch = CAMERA.pitch0, savedZoom = null;
game.tracking = false;
game.toggleTrack = () => { game.tracking = !game.tracking; ui.setTracking(game.tracking); };
bindPointer(host, {
  onClick(ndc) { selection.set(pickRock(ndc)); },
  onRightClick(ndc) { game.retarget(pickRock(ndc)); },
  onDouble(ndc) {
    const rock = pickRock(ndc);
    if (rock) { selection.set(rock); return ship.approach(rock); }
    if (game.direct) return;
    ray.setFromCamera(new THREE.Vector2(...ndc), camera);
    dir.copy(ray.ray.direction); dir.y = 0;                          // manual piloting stays level
    if (dir.lengthSq() > 0.01) ship.flyToward(dir);
  },
  onDrag(dx, dy) {
    if (game.tracking) { game.tracking = false; ui.setTracking(false); }   // a drag takes the camera back
    camYaw -= dx * CAMERA.orbitSpeed;
    camPitch = clamp(camPitch + dy * CAMERA.orbitSpeed, CAMERA.pitchRange[0], CAMERA.pitchRange[1]);
  },
  onWheel(dy) { if (ship.cmd.kind === 'warp' || ship.cmd.kind === 'jump') return; zoom = clamp(zoom * (dy > 0 ? 1.1 : 0.9), CAMERA.zoom[0], CAMERA.zoom[1]); if (savedZoom !== null) savedZoom = null; },
});
window.addEventListener('keydown', (e) => {
  if (e.target !== document.body) return;
  if (e.code === 'KeyV') game.toggleMode();
  if (e.code === 'KeyC') game.toggleTrack();
  if (e.code === 'Space') ship.stop();
  if (e.code === 'Escape') selection.clear();
  if (!game.direct) {
    if (e.code === 'KeyQ') game.command('approach');
    if (e.code === 'KeyW') game.command('orbit');
    if (e.code === 'KeyE') game.command('keep');
    if (e.code === 'KeyS') game.command('warp');
    if (e.code === 'KeyF') game.command('lance');
    if (e.code === 'KeyA') game.command('auto');
    if (e.code === 'KeyJ') game.command('jump');
  }
});

// direct mode: WASD relative to the ship's heading, R/F climb and dive, A/D swing the nose
const input = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
function updateDirect() {
  const f = keys.axis('KeyS', 'KeyW'), side = keys.axis('KeyA', 'KeyD'), up = keys.axis('KeyF', 'KeyR');
  ship.forward(fwd); fwd.y = 0; fwd.normalize();
  right.crossVectors(fwd, new THREE.Vector3(0, 1, 0));
  input.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, side * 0.6).setY(up * DIRECT.climb);
  if (input.lengthSq() > 1) input.normalize();
  ship.direct(input);
}

// cameras: free orbit around the ship in command mode, chase behind it in direct mode
const pivot = new THREE.Vector3(), camTarget = new THREE.Vector3(), tmp = new THREE.Vector3();
camera.position.set(0, 10, 30);
function updateCamera(dt) {
  pivot.lerp(ship.position, damp(CAMERA.lerp + ship.warpW * 80, dt));   // at warp speed the pivot must stay glued to the ship
  if (game.direct) {
    const c = CAMERA.chase; ship.forward(tmp); tmp.y = 0; tmp.normalize();
    camTarget.copy(ship.position).addScaledVector(tmp, -c.back * zoom); camTarget.y += c.up * zoom;
    camera.position.lerp(camTarget, damp(c.lerp, dt));
    camera.up.set(0, 1, 0); camera.lookAt(pivot.x, pivot.y + 2, pivot.z);
    return;
  }
  const d = CAMERA.dist * zoom;
  // warp: swing in behind the ship and look down the line it will travel; animated over the align phase.
  // Also zoom in close so the tunnel streaks fill the screen, remembering the player's zoom to restore on drop-out.
  if (ship.cmd.kind === 'warp' || ship.cmd.kind === 'jump') {
    if (savedZoom === null) savedZoom = zoom;
    zoom += (CAMERA.warpZoom - zoom) * damp(CAMERA.warpLerp, dt);
    ship.forward(tmp);
    const wantYaw = Math.atan2(-tmp.x, -tmp.z);
    let dy = wantYaw - camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    camYaw += dy * damp(CAMERA.warpLerp, dt);
    camPitch += (CAMERA.warpPitch - camPitch) * damp(CAMERA.warpLerp, dt);
  } else if (savedZoom !== null) {
    zoom += (savedZoom - zoom) * damp(2.2, dt);   // ease back to what the player had
    if (Math.abs(zoom - savedZoom) < 0.01) { zoom = savedZoom; savedZoom = null; }
  }
  if (ship.cmd.kind !== 'warp' && ship.cmd.kind !== 'jump' && game.tracking && selection.obj) {
  // tracking: swing the orbit so the camera sits on the far side of the ship from the target and looks across at it
    tmp.copy(selection.obj.position).sub(pivot);
    const wantYaw = Math.atan2(-tmp.x, -tmp.z);
    let dy = wantYaw - camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    camYaw += dy * damp(CAMERA.trackLerp, dt);
    const flat = Math.hypot(tmp.x, tmp.z), wantPitch = clamp(CAMERA.trackPitch - Math.atan2(tmp.y, flat) * 0.5, CAMERA.pitchRange[0], CAMERA.pitchRange[1]);
    camPitch += (wantPitch - camPitch) * damp(CAMERA.trackLerp, dt);
  }
  camera.position.set(Math.sin(camYaw) * Math.cos(camPitch) * d, Math.sin(camPitch) * d, Math.cos(camYaw) * Math.cos(camPitch) * d).add(pivot);
  const roll = Math.sin(performance.now() / 1000 * 0.35) * 0.6 * ship.jumpW;   // the view rolls slowly through a fold
  camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(pivot);
}

const fold = document.getElementById('fold');
function updateWarpLook() {
  const w = ship.warpW;
  const fov = CAMERA.fov + WARP.fov * w + JUMP.fov * ship.jumpW;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  bloomPass.strength = BLOOM.strength + w * 0.5;
  foldPass.set(ship.jumpW, performance.now() / 1000);
  fold.style.opacity = 0;
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (game.direct) updateDirect();
  ship.camDist = camera.position.distanceTo(ship.position);
  ship.update(dt);
  game.rocks.update(dt, (rock) => {
    if (game.auto && game.lance.target === rock) setTimeout(() => game.auto && game.autoNext(), 400);
    game.loot.burst(rock.position, Math.round(rock.radius * ROCK.motesPerRadius), ROCK.scrapPerRadius * rock.radius / Math.round(rock.radius * ROCK.motesPerRadius), rock.tint, rock.energy.key);
    if (selection.obj === rock) selection.clear();
    if (ship.cmd.obj === rock) ship.stop();
  });
  game.mobs.update(dt, ship, (mob) => {
    game.loot.burst(mob.position, 14, MOB.scrap / 14, 0xff3d7a, 'ash');
    if (selection.obj === mob) selection.clear();
    if (ship.cmd.obj === mob) ship.stop();
    // last wisp of a combat site: the rift collapses and a new tear opens elsewhere in the system
    const st = mob.site;
    if (st && st.type === 'combat' && !game.mobs.list.some((m) => m.site === st)) {
      const rift = game.rifts.list.find((r) => r.site === st);
      if (rift) game.rifts.collapse(rift);
      st.type = 'cleared';
      const fresh = game.sites.spawnCombat();
      game.rifts.add(fresh); game.mobs.populate(fresh); game.rocks.populate(fresh, null);
      ui.flash(`${st.name} rift collapsed. A new tear opens at ${fresh.name}`);
    }
  });
  game.lance.update(dt);
  if (game.auto && (!game.lance.on || !game.lance.target || game.lance.target.dead)) game.autoNext();
  game.loot.update(dt);
  game.streams.update(dt);
  game.rifts.update(dt);
  game.sites.update(dt, camera.position);
  updateWarpLook();
  selection.update(dt);
  marker.update(dt, ship.destination, ship.position.y);
  marker.updateOrbit(ship.cmd);
  updateCamera(dt);
  stars.update(camera.position, ship.position);
  ui.update(dt);
  game.saver.update(dt);
  ui.updateTargetLabel(selection.obj, camera);
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.massless = game;
