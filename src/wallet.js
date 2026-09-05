// Wallet: fragments live in two places. The hold travels with the ship and is at risk; the bank stays in the haven and
// is safe. Everything you buy is paid from both, bank first. Docking (sitting inside the haven bubble) banks the hold.
export class Wallet {
  constructor(state) { this.state = state; state.hold = state.hold || {}; state.bank = state.bank || {}; }
  get hold() { return this.state.hold; }
  get bank() { return this.state.bank; }
  /** fragments available to spend, hold + bank */
  get(key) { return (this.state.hold[key] || 0) + (this.state.bank[key] || 0); }
  /** a flat view of what can be spent, for functions that read a plain {key: n} */
  totals() { const out = {}; for (const k of new Set([...Object.keys(this.state.hold), ...Object.keys(this.state.bank)])) out[k] = this.get(k); return out; }
  /** pay n of key, bank first; returns false (and pays nothing) when short */
  spend(key, n) {
    if (this.get(key) < n - 1e-9) return false;
    const fromBank = Math.min(this.state.bank[key] || 0, n);
    if (fromBank) this.state.bank[key] -= fromBank;
    if (n - fromBank > 0) this.state.hold[key] -= n - fromBank;
    return true;
  }
  /** move the whole hold into the bank; returns what moved */
  deposit() {
    const moved = {};
    for (const k in this.state.hold) { const n = this.state.hold[k]; if (n > 0) { moved[k] = n; this.state.bank[k] = (this.state.bank[k] || 0) + n; this.state.hold[k] = 0; } }
    return moved;
  }
  /** lose a fraction of the hold; returns what was lost */
  lose(frac) {
    const lost = {};
    for (const k in this.state.hold) { const n = Math.floor(this.state.hold[k] * frac); if (n > 0) { lost[k] = n; this.state.hold[k] -= n; } }
    return lost;
  }
  holdTotal() { return Object.values(this.state.hold).reduce((a, b) => a + b, 0); }
}
