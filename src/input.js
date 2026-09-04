// Keyboard state plus canvas pointer events. Steering commands are resolved in main.js where the camera lives.
const down = new Set();
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener('keydown', (e) => { if (!e.repeat) down.add(e.code); if (GAME_KEYS.has(e.code) && e.target === document.body) e.preventDefault(); });
window.addEventListener('keyup', (e) => down.delete(e.code));
window.addEventListener('blur', () => down.clear());

export const keys = {
  down: (code) => down.has(code),
  axis: (neg, pos) => (down.has(pos) ? 1 : 0) - (down.has(neg) ? 1 : 0),
};

/** wire canvas pointer: onClick(ndc, shift), onRightClick(ndc), onDouble(ndc), onWheel(deltaY, shift), onDrag(dx, dy). A press that moves becomes a drag, not a click. */
export function bindPointer(host, { onClick, onRightClick, onDouble, onWheel, onDrag }) {
  let downAt = null, lastAt = null, dragging = false;
  const ndc = (e) => [(e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1];
  host.addEventListener('mousedown', (e) => { downAt = lastAt = [e.clientX, e.clientY]; dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!downAt) return;
    if (!dragging && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) { dragging = true; document.body.classList.add('dragging'); }
    if (dragging) { onDrag(e.clientX - lastAt[0], e.clientY - lastAt[1]); lastAt = [e.clientX, e.clientY]; }
  });
  window.addEventListener('mouseup', (e) => {
    if (!downAt) return;
    const wasDrag = dragging; downAt = null; dragging = false; document.body.classList.remove('dragging');
    if (wasDrag || e.target !== host.firstChild) return;
    if (e.button === 0) onClick(ndc(e), e.shiftKey);
    if (e.button === 2) onRightClick(ndc(e));
  });
  host.addEventListener('dblclick', (e) => onDouble(ndc(e)));
  host.addEventListener('wheel', (e) => { e.preventDefault(); onWheel(e.deltaY, e.shiftKey); }, { passive: false });
  host.addEventListener('contextmenu', (e) => e.preventDefault());
}
