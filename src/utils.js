export const TAU = Math.PI * 2;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toString();
/** exponential smoothing factor for a per-second rate over a frame of dt seconds */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
/** distance for the HUD: local in metres, anything beyond in AU. auUnits: world units per AU */
export const fmtDist = (d, auUnits = 2500, auDecimals = 2) => d < 1000 ? Math.round(d) + ' m' : (d / auUnits).toFixed(auDecimals) + ' AU';
