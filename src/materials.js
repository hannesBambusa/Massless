// The Coreline look in 3D: dark hull fills with bright neon edges. Emissive colours push past 1.0 so bloom picks them up.
import * as THREE from 'three';
import { COLORS } from './config.js';

export const hullMat = (color = COLORS.hull) => new THREE.MeshBasicMaterial({ color });
export const edgeMat = (color, glow = 1.6) => new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(glow), transparent: true, opacity: 1 });
export const faintEdgeMat = (color, opacity = 0.35) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });

/** a mesh plus its glowing edge outline, grouped */
export function neonMesh(geometry, color, { fill = COLORS.hull, glow = 1.6, threshold = 1 } = {}) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, hullMat(fill)));
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, threshold), edgeMat(color, glow)));
  return group;
}

let glowTex = null;
/** radial gradient sprite texture, shared */
export function glowTexture() {
  if (glowTex) return glowTex;
  const size = 64, cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), half = size / 2, grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

export function glowSprite(color, scale = 3, opacity = 0.7) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(scale);
  return s;
}
