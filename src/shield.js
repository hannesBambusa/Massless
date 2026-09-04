// Shield bubble: a smooth sphere whose surface is only visible at grazing angles (fresnel), with faint ripples moving over it.
// `hit` (0..1) flares the whole surface. Additive, so it reads as a thin film of energy, not a solid ball.
import * as THREE from 'three';
import { COLORS } from './config.js';

const vert = /* glsl */`
  varying vec3 vNormal; varying vec3 vView; varying vec3 vPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    vPos = position;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;
const frag = /* glsl */`
  uniform vec3 color; uniform vec3 hot; uniform float time; uniform float hit; uniform float base;
  varying vec3 vNormal; varying vec3 vView; varying vec3 vPos;
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 4.5);
    // ripples: two slow bands over the sphere plus a fine shimmer
    float band = 0.5 + 0.5 * sin(vPos.y * 2.4 + time * 1.6) * sin(vPos.x * 1.7 - time * 1.1);
    float shimmer = 0.5 + 0.5 * sin((vPos.x + vPos.z) * 9.0 + time * 4.0);
    float a = fres * (base + band * 0.08) + shimmer * 0.004;
    a += hit * (0.06 + fres * 0.35);
    vec3 c = mix(color, hot, hit);
    gl_FragColor = vec4(c * (0.8 + hit * 0.5), a);
  }`;

export class Shield {
  constructor(radius = 5.2) {
    this.uniforms = { color: { value: new THREE.Color(COLORS.cyan) }, hot: { value: new THREE.Color(COLORS.white) }, time: { value: 0 }, hit: { value: 0 }, base: { value: 0.16 } };
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    }));
  }
  update(dt, hit, shieldFrac) {
    this.uniforms.time.value += dt;
    this.uniforms.hit.value = hit;
    this.uniforms.base.value = 0.05 + 0.14 * shieldFrac;   // a drained shield fades out
  }
}
