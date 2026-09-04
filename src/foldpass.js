// Fold pass: a post-processing shader that bends the rendered frame as if space were folding around the ship.
// amount 0..1 drives a slow twist, a mirror fold that creases the image, colour fringing and darkened edges.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FoldShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0 }, time: { value: 0 }, tint: { value: new THREE.Color(0x9f8cff) } },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float amount; uniform float time; uniform vec3 tint;
    varying vec2 vUv;
    vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
    vec2 fold(vec2 uv, float k) {
      vec2 p = uv - 0.5;
      float r = length(p);
      // twist: stronger toward the centre, breathing slowly
      p = rot(p, k * 1.6 * (1.0 - smoothstep(0.0, 0.9, r)) * sin(time * 0.6));
      // crease: the image mirrors over two slowly turning axes; eases in with k
      float cr = smoothstep(0.35, 0.9, k);
      vec2 ax = rot(p, time * 0.15);
      vec2 folded = abs(ax) - 0.18 * cr;
      folded = rot(folded, -time * 0.15);
      p = mix(p, folded, cr);
      // ripple along the radius, like the fold travelling through
      p += normalize(p + 1e-5) * 0.012 * k * sin(r * 40.0 - time * 5.0);
      return p + 0.5;
    }
    void main() {
      float k = amount;
      vec2 uv = fold(vUv, k);
      vec2 d = (uv - 0.5) * 0.012 * k;   // colour fringing
      vec3 c;
      c.r = texture2D(tDiffuse, uv + d).r;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = texture2D(tDiffuse, uv - d).b;
      float r = length(vUv - 0.5);
      c = mix(c, c * 0.35, k * smoothstep(0.25, 0.75, r));          // edges go dark
      c = mix(c, c * tint * 1.4, k * 0.35);                           // violet cast
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class FoldPass extends ShaderPass {
  constructor() { super(FoldShader); }
  set(amount, time) { this.uniforms.amount.value = amount; this.uniforms.time.value = time; this.enabled = amount > 0.005; }
}
