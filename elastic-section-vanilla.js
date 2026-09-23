/**
 * ElasticSectionVanilla — plain JS / rAF elastic blob divider
 * No dependencies. Works in any HTML page.
 *
 * HTML required:
 *   <div id="elastic-outer" style="position:relative;height:100vh;overflow:visible;">
 *     <svg viewBox="0 0 100 100" preserveAspectRatio="none"
 *          style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;display:block;">
 *       <path id="elastic-top" fill="#171512" d=""/>
 *       <path id="elastic-bot" fill="#171512" d=""/>
 *     </svg>
 *   </div>
 *
 * Usage:
 *   import { ElasticSectionVanilla } from './elastic-section-vanilla.js';
 *   new ElasticSectionVanilla({
 *     section:   document.getElementById('elastic-outer'),
 *     pathTop:   document.getElementById('elastic-top'),
 *     pathBot:   document.getElementById('elastic-bot'),
 *   }).start();
 */

export class ElasticSectionVanilla {
  /**
   * @param {object} opts
   * @param {Element}  opts.section   — the 100vh outer container
   * @param {SVGElement} opts.pathTop — top curve path element
   * @param {SVGElement} opts.pathBot — bottom curve path element
   * @param {number}  [opts.restBulge=50]  — control-point offset at rest (SVG units)
   * @param {number}  [opts.maxStretch=25] — max velocity-stretch (SVG units)
   * @param {object}  [opts.springConfig]  — { stiffness, damping, mass } for base spring
   */
  constructor({
    section,
    pathTop,
    pathBot,
    restBulge   = 50,
    maxStretch  = 25,
    springConfig = { stiffness: 90, damping: 14, mass: 1 },
  }) {
    this._section    = section;
    this._pathTop    = pathTop;
    this._pathBot    = pathBot;
    this._restBulge  = restBulge;
    this._maxStretch = maxStretch;

    // Base spring (stiffness 90, damping 14 — slight overshoot, ~1s settle)
    this._bK = springConfig.stiffness;
    this._bD = springConfig.damping;
    this._bM = springConfig.mass ?? 1;
    this._bVal = 0; this._bVel = 0;

    // Stretch spring (stiffness 400, damping 40 — critically damped, fast decay)
    this._sVal = 0; this._sVel = 0;

    // Scroll velocity tracking
    this._scrollVel  = 0;
    this._lastScrollY = window.scrollY;
    this._lastScrollT = performance.now();

    this._prevT  = null;
    this._rafId  = null;

    this._onScroll = this._onScroll.bind(this);
    this._tick     = this._tick.bind(this);
  }

  // Euler-integrated spring step — good enough at 60fps with small dt
  static _spring(val, vel, target, k, d, m, dt) {
    const force = -k * (val - target) - d * vel;
    vel += (force / m) * dt;
    val += vel * dt;
    return [val, vel];
  }

  _onScroll() {
    const now     = performance.now();
    const elapsed = (now - this._lastScrollT) / 1000;
    if (elapsed > 0.004) {
      this._scrollVel  = (window.scrollY - this._lastScrollY) / elapsed;
      this._lastScrollY = window.scrollY;
      this._lastScrollT = now;
    }
  }

  _tick(t) {
    const dt = this._prevT ? Math.min((t - this._prevT) / 1000, 0.05) : 0.016;
    this._prevT = t;

    // Scroll progress p ∈ [0,1]
    // 0: section top at viewport bottom  |  1: section bottom at viewport top
    const rect = this._section.getBoundingClientRect();
    const vh   = window.innerHeight;
    const p    = Math.max(0, Math.min(1, (vh - rect.top) / (vh + rect.height)));

    // Base spring: linear target rolls from 0 → -restBulge
    const baseTarget = -this._restBulge * p;
    [this._bVal, this._bVel] = ElasticSectionVanilla._spring(
      this._bVal, this._bVel, baseTarget,
      this._bK, this._bD, this._bM, dt
    );

    // Velocity → stretch spring (critically damped, fast)
    const rawStretch = Math.abs(this._scrollVel) * 0.0145;
    [this._sVal, this._sVel] = ElasticSectionVanilla._spring(
      this._sVal, this._sVel, rawStretch, 400, 40, 1, dt
    );
    const stretch = Math.min(this._maxStretch, this._sVal);

    // Decay raw velocity when scroll events stop arriving
    const staleness = (t - this._lastScrollT) / 1000;
    if (staleness > 0.05) this._scrollVel *= (1 - Math.min(1, dt * 6));

    // SVG control points
    const topCtrl    = this._bVal - stretch;
    const bottomCtrl = this._bVal + 100 + this._restBulge + stretch;

    this._pathTop.setAttribute('d', `M 0 100 V 0 Q 50 ${topCtrl.toFixed(2)} 100 0 V 100 Z`);
    this._pathBot.setAttribute('d', `M 0 0 V 100 Q 50 ${bottomCtrl.toFixed(2)} 100 100 V 0 Z`);

    this._rafId = requestAnimationFrame(this._tick);
  }

  /** Attach scroll listener and start rAF loop. Returns `this` for chaining. */
  start() {
    window.addEventListener('scroll', this._onScroll, { passive: true });
    this._rafId = requestAnimationFrame(this._tick);
    return this;
  }

  /** Stop animation and detach scroll listener. */
  stop() {
    window.removeEventListener('scroll', this._onScroll);
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    return this;
  }
}
