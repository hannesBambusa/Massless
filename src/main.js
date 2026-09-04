// Massless: EVE-style command flight with an optional direct-flight mode. Renderer, cameras, bloom, input routing and the frame loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COLORS, CAMERA, BLOOM, DIRECT, WARP, ROCK } from './config.js';
import { Ship } from './ship.js';
import { Starfield } from './starfield.js';
import { Asteroids } from './asteroids.js';
import { Streams } from './streams.js';
import { Sites } from './sites.js';
import { Lance } from './weapons/lance.js';
import { Loot } from './loot.js';
import { Marker } from './marker.js';
import { Selection } from './selection.js';
import { UI } from './ui.js';
import { keys, bindPointer } from './input.js';
import { clamp, damp } from './utils.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const host = document.getElementById('game');
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);
scene.fog = new THREE.FogExp2(COLORS.bg, 0.0005);
const camera = new THREE.PerspectiveCamera(CAMERA.fov, innerWidth / innerHeight, 0.1, 6000);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// lighting for the lit ship hull; the rest of the scene uses unlit materials and ignores it. Metal needs something to reflect, so a neutral room env map.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
scene.add(new THREE.HemisphereLight(0x9be7ff, 0x1a0b2e, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-40, 60, 30); scene.add(key);
const rim = new THREE.DirectionalLight(0x4ff2ff, 1.2); rim.position.set(30, -10, -50); scene.add(rim);


const sites = new Sites(scene);
const game = {
  scene, camera, state: { scrap: 0 }, direct: false, sites,
  ship: new Ship(scene), stars: new Starfield(scene), rocks: new Asteroids(scene, sites.list.map((x) => x.position)), streams: new Streams(scene), marker: new Marker(scene),
};
game.selection = new Selection(scene, camera);
game.lance = new Lance(scene, game.ship);
game.loot = new Loot(scene, game.ship, (n) => { game.state.scrap += n; });
const { ship, rocks, selection, marker, stars, streams } = game;

/** run a command against the selected target (or stop) */
game.command = (name) => {
  const t = selection.obj;
  if (name === 'stop') return ship.stop();
  if (!t) return;
  if (name === 'approach') ship.approach(t);
  if (name === 'orbit') ship.orbit(t);
  if (name === 'keep') ship.keepAtRange(t);
  if (name === 'lance') { if (!t.hp) ui.flash('Nothing to unbind there'); else game.lance.toggle(t); }
  if (name === 'warp') { if (!ship.warpTo(t)) ui.flash(`Too close to warp. Targets need to be ${WARP.minDist} m away`); }
};
/** select obj; if the ship is busy with a target command, re-issue it against the new target */
game.retarget = (obj) => {
  if (!obj) return;
  selection.set(obj);
  const k = ship.cmd.kind;
  if (k === 'orbit' || k === 'approach' || k === 'keep') game.command(k);
  if (k === 'warp' && ship.cmd.phase === 'align') game.command('warp');
};
game.toggleMode = () => {
  game.direct = !game.direct;
  ship.stop();
  ui.setMode(game.direct);
};
ship.position.set(0, 0, 160);   // start a little off the home beacon
const ui = new UI(game);
ui.setMode(false);

// pointer: click selects, double-click in space flies that way, drag orbits the camera, wheel zooms
const ray = new THREE.Raycaster();
const dir = new THREE.Vector3();
function pickRock(ndc) {
  ray.setFromCamera(new THREE.Vector2(...ndc), camera);
  const hits = ray.intersectObjects(rocks.group.children, true);
  if (hits.length) return hits[0].object.parent;
  // sites: pick by screen distance to the beacon, since they are sprites far away
  let best = null, bd = 0.05;
  for (const st of sites.list) { const v = st.position.clone().project(camera); if (v.z > 1) continue; const d = Math.hypot(v.x - ndc[0], (v.y - ndc[1]) / camera.aspect); if (d < bd) { bd = d; best = st; } }
  return best;
}
let zoom = 1, camYaw = 0, camPitch = CAMERA.pitch0;
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
  onWheel(dy) { zoom = clamp(zoom * (dy > 0 ? 1.1 : 0.9), CAMERA.zoom[0], CAMERA.zoom[1]); },
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
  // warp: swing in behind the ship and look down the line it will travel; animated over the align phase
  if (ship.cmd.kind === 'warp') {
    ship.forward(tmp);
    const wantYaw = Math.atan2(-tmp.x, -tmp.z);
    let dy = wantYaw - camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    camYaw += dy * damp(CAMERA.warpLerp, dt);
    camPitch += (CAMERA.warpPitch - camPitch) * damp(CAMERA.warpLerp, dt);
  } else if (game.tracking && selection.obj) {
  // tracking: swing the orbit so the camera sits on the far side of the ship from the target and looks across at it
    tmp.copy(selection.obj.position).sub(pivot);
    const wantYaw = Math.atan2(-tmp.x, -tmp.z);
    let dy = wantYaw - camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    camYaw += dy * damp(CAMERA.trackLerp, dt);
    const flat = Math.hypot(tmp.x, tmp.z), wantPitch = clamp(CAMERA.trackPitch - Math.atan2(tmp.y, flat) * 0.5, CAMERA.pitchRange[0], CAMERA.pitchRange[1]);
    camPitch += (wantPitch - camPitch) * damp(CAMERA.trackLerp, dt);
  }
  camera.position.set(Math.sin(camYaw) * Math.cos(camPitch) * d, Math.sin(camPitch) * d, Math.cos(camYaw) * Math.cos(camPitch) * d).add(pivot);
  camera.up.set(0, 1, 0); camera.lookAt(pivot);
}

function updateWarpLook() {
  const w = ship.warpW;
  const fov = CAMERA.fov + WARP.fov * w;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  bloomPass.strength = BLOOM.strength + w * 0.5;
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (game.direct) updateDirect();
  ship.update(dt);
  rocks.update(dt, (rock) => {
    game.loot.burst(rock.position, Math.round(rock.radius * ROCK.motesPerRadius), ROCK.scrapPerRadius * rock.radius / Math.round(rock.radius * ROCK.motesPerRadius));
    if (selection.obj === rock) selection.clear();
    if (ship.cmd.obj === rock) ship.stop();
  });
  game.lance.update(dt);
  game.loot.update(dt);
  streams.update(dt);
  sites.update(dt, camera.position);
  updateWarpLook();
  selection.update(dt);
  marker.update(dt, ship.destination, ship.position.y);
  marker.updateOrbit(ship.cmd);
  updateCamera(dt);
  stars.update(camera.position, ship.position);
  ui.update(dt);
  ui.updateTargetLabel(selection.obj, camera);
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.massless = game;
