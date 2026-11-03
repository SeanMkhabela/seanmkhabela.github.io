/* Crayon doodles: hand-drawn, "boiling" line art on canvas.
   Every drawing lives in a 400x400 space. Lines are re-jittered a few times a second
   (like 90s hand-animated outlines), stroked twice for a waxy edge, then grain is
   knocked out of them for a crayon texture. Paused off-screen and under reduced motion. */

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// Crayon colours come from CSS custom properties, so night (chalk) mode recolours every drawing
let INK = '#333';
const C = { purple: '#8a4fff', orange: '#ff8a2a', lime: '#8fd43a', sky: '#3fb3f5', yellow: '#ffcf2e' };
function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  INK = cs.getPropertyValue('--ink').trim() || INK;
  for (const k of Object.keys(C)) C[k] = cs.getPropertyValue('--' + k).trim() || C[k];
}
readPalette();
const BOIL_FPS = 8;   // how often the outlines re-wobble
const DRAW_FPS = 12;  // hand-animated frame rate
const S = 400;        // logical canvas size
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Deterministic noise in [-1, 1]
function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1;
}

// Subdivide a polyline so long edges wobble like a hand-drawn line
function densify(pts, closed, step = 14) {
  const out = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    const segs = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step));
    for (let s = 0; s < segs; s++) out.push([x1 + (x2 - x1) * s / segs, y1 + (y2 - y1) * s / segs]);
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return out;
}

function makePen(ctx) {
  let boil = 0, key = 0;
  const jit = (pts, amp) => pts.map(([x, y], i) => [x + hash(key * 131 + i, boil) * amp, y + hash(key * 131 + i + 7919, boil) * amp]);
  function path(pts, closed) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    if (closed) ctx.quadraticCurveTo(last[0], last[1], pts[0][0], pts[0][1]);
    else ctx.lineTo(last[0], last[1]);
  }
  return {
    setBoil(b) { boil = b; },
    // Crayon line: two jittered passes, slightly different, for a waxy edge
    line(pts, { color = INK, w = 2.6, closed = false, amp = 1.6, id = 1 } = {}) {
      key = id;
      const base = densify(pts, closed);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
      ctx.globalAlpha = .92; ctx.lineWidth = w; path(jit(base, amp), closed); ctx.stroke();
      key = id + 977;
      ctx.globalAlpha = .45; ctx.lineWidth = w * .55; path(jit(base, amp * 1.4), closed); ctx.stroke();
      ctx.globalAlpha = 1;
    },
    // Crayon fill: loose diagonal scribble hatching clipped to a shape
    hatch(pts, { color, gap = 6, angle = -0.7, id = 3, alpha = .75 } = {}) {
      key = id;
      const shape = jit(densify(pts, true), 1.5);
      ctx.save(); path(shape, true); ctx.clip();
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const r = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 4;
      ctx.translate(cx, cy); ctx.rotate(angle);
      ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineCap = 'round';
      for (let y = -r, i = 0; y < r; y += gap, i++) {
        ctx.lineWidth = 2.4 + hash(i, boil + id) * .8;
        ctx.beginPath();
        ctx.moveTo(-r, y + hash(i, boil) * 1.5);
        ctx.lineTo(r, y + hash(i + 50, boil) * 1.5 + gap * .35);
        ctx.stroke();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    },
    dot(x, y, r, color = INK, id = 5) {
      key = id;
      this.line(circle(x, y, r, 7), { color, w: 2.2, closed: true, amp: .7, id });
    },
  };
}

// Shape helpers
const circle = (cx, cy, r, n = 18) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * Math.PI * 2) * r, cy + Math.sin(i / n * Math.PI * 2) * r]);
const star = (cx, cy, R, rot = 0) => Array.from({ length: 10 }, (_, i) => {
  const a = rot - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * .45 : R;
  return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
});
const xf = (pts, x, y, rot = 0, s = 1) => pts.map(([px, py]) => [x + (px * Math.cos(rot) - py * Math.sin(rot)) * s, y + (px * Math.sin(rot) + py * Math.cos(rot)) * s]);

// ----- The drawings -----
const ART = {
  // 1: a rocket drifting up, stars streaming past
  rocket(p, t) {
    for (let i = 0; i < 9; i++) {
      let sx = 40 + ((i * 97) % 320); const sy = ((i * 53 + t * 26) % 440) - 20;
      if (sx > 130 && sx < 270) sx = sx < 200 ? sx - 90 : sx + 90; // keep the rocket's lane clear
      const s = 4 + (i % 3) * 2.5;
      if (i % 4 === 0) p.line(star(sx, sy, s * 1.5, i), { closed: true, w: 1.8, amp: .8, id: 200 + i, color: i % 8 === 0 ? C.yellow : INK });
      else p.line([[sx - s, sy], [sx + s, sy]], { w: 1.6, amp: .6, id: 300 + i });
    }
    const x = 200 + Math.sin(t * .5) * 10, y = 200 + Math.sin(t * .8) * 9, r = Math.sin(t * .5) * .06;
    const T = (pts) => xf(pts, x, y, r);
    const flick = 1 + Math.sin(t * 9) * .15;
    const flame = T([[-22, 72], [0, 72 + 64 * flick], [22, 72]]);
    p.hatch(flame, { color: C.orange, gap: 5, id: 11 });
    p.line(T([[-12, 74], [0, 74 + 34 * flick], [12, 74]]), { color: C.yellow, w: 3, id: 12 });
    p.line(flame, { w: 2, id: 13 });
    const body = T([[0, -110], [26, -72], [34, -20], [32, 40], [24, 74], [-24, 74], [-32, 40], [-34, -20], [-26, -72]]);
    p.line(body, { closed: true, w: 3, id: 14 });
    p.line(T([[-31, 30], [-62, 64], [-58, 88], [-26, 70]]), { w: 3, id: 15 });
    p.line(T([[31, 30], [62, 64], [58, 88], [26, 70]]), { w: 3, id: 16 });
    p.hatch(T(circle(0, -24, 16, 12)), { color: C.sky, gap: 5, id: 17 });
    p.line(T(circle(0, -24, 17, 14)), { closed: true, w: 2.8, id: 18 });
    p.line(T([[-26, -72], [26, -72]]), { w: 2, id: 19 });
  },

  // 2: a paper plane looping a lazy figure-eight, leaving a dotted trail
  plane(p, t) {
    const path = (u) => [200 + Math.sin(u) * 135, 200 + Math.sin(u * 2) * 70];
    const u = t * .35;
    for (let k = 1; k < 26; k++) {
      const [tx, ty] = path(u - k * .09);
      p.line([[tx - 2.5, ty], [tx + 2.5, ty + .5]], { color: C.purple, w: 2.6, amp: .8, id: 400 + k });
    }
    const [x, y] = path(u), [nx, ny] = path(u + .01);
    const a = Math.atan2(ny - y, nx - x);
    const T = (pts) => xf(pts, x, y, a, 1);
    p.hatch(T([[34, 0], [-28, -22], [-14, 0]]), { color: C.purple, gap: 7, id: 21, alpha: .35 });
    p.line(T([[34, 0], [-28, -22], [-14, 0], [-28, 20]]), { closed: true, w: 2.8, id: 22 });
    p.line(T([[34, 0], [-14, 0]]), { w: 2, id: 23 });
    p.line(T([[-14, 0], [-6, 10]]), { w: 2, id: 24 });
    // a few still clouds
    p.line([[60, 330], [80, 316], [104, 322], [122, 310], [146, 328], [130, 340], [70, 342]], { closed: true, w: 1.8, id: 25 });
    p.line([[270, 72], [286, 60], [306, 66], [322, 56], [342, 70], [330, 80], [278, 82]], { closed: true, w: 1.8, id: 26 });
  },

  // 3: five blocks, one per role, oldest at the bottom; the newest gently settles on top
  blocks(p, t) {
    const colors = [C.yellow, C.sky, C.lime, C.orange, C.purple];
    const w = [150, 132, 118, 104, 92];
    let y = 350;
    p.line([[40, 352], [360, 350]], { w: 2.2, id: 30 });
    const cycle = (t % 9) / 9;
    const drop = cycle < .35 ? (1 - cycle / .35) : 0;
    const ease = drop * drop;
    for (let i = 0; i < 5; i++) {
      const h = 52;
      const sway = Math.sin(t * .6 + i) * (i * .9);
      const lift = i === 4 ? ease * 120 : 0;
      const x0 = 200 - w[i] / 2 + sway, y0 = y - h - lift;
      const box = [[x0, y0], [x0 + w[i], y0], [x0 + w[i], y0 + h], [x0, y0 + h]];
      p.hatch(box, { color: colors[i], gap: 7, id: 31 + i, alpha: .55, angle: i % 2 ? .7 : -.7 });
      p.line(box, { closed: true, w: 2.8, id: 40 + i });
      // a little doodle on each block
      const cx = x0 + w[i] / 2, cy = y0 + h / 2;
      if (i % 2 === 0) p.line(star(cx, cy, 11, i), { closed: true, w: 1.8, id: 50 + i });
      else p.line(circle(cx, cy, 10, 10), { closed: true, w: 1.8, id: 50 + i });
      y -= h;
    }
    if (drop > 0) for (let k = 0; k < 3; k++) {
      const yy = 350 - 4 * 52 - 52 - ease * 120 - 14 - k * 10, xx = 186 + k * 14;
      p.line([[xx, yy], [xx, yy - 10]], { w: 1.6, id: 60 + k });
    }
  },

  // 4: a crayon looping one long, unhurried line; when it reaches the edge it starts a fresh page
  crayon(p, t) {
    const LOOPS = 4.5, DUR = 7, REST = 2.5;
    const at = (u) => {
      const a = u * LOOPS * Math.PI * 2;
      return [52 + u * 236 - Math.sin(a) * 24, 262 - u * 20 + Math.cos(a) * 24 - 24 + Math.sin(u * 5) * 12];
    };
    const u = Math.min(1, (t % (DUR + REST)) / DUR);
    const n = Math.ceil(u * 140);
    const trail = Array.from({ length: n + 1 }, (_, i) => at(Math.min(u, i / 140)));
    p.line(trail, { color: C.orange, w: 3.6, amp: 1.1, id: 500 });
    // little sparkles where it has been
    for (let s = 0; s < 3; s++) {
      if (u > .25 + s * .3) {
        const [sx, sy] = at(.15 + s * .3);
        p.line(star(sx - 6, sy + 52, 6 + s * 1.5, s), { closed: true, w: 1.7, amp: .6, id: 510 + s, color: s === 1 ? C.yellow : INK });
      }
    }
    // the crayon itself, tip on the line, leaning like it is held
    const [x, y] = at(u);
    const r = .36 + Math.sin(t * 2.2) * .05 + (u >= 1 ? .12 : 0);
    const T = (pts) => xf(pts, x, y - (u >= 1 ? 10 : 0), r);
    const tip = T([[0, 0], [-13, -30], [13, -30]]);
    const body = T([[-13, -30], [-15, -150], [15, -150], [13, -30]]);
    p.hatch(tip, { color: C.orange, gap: 4, id: 520, alpha: .9 });
    p.hatch(body, { color: C.orange, gap: 6, id: 521, alpha: .55, angle: .7 });
    p.line(tip, { closed: true, w: 2.4, id: 522 });
    p.line(body, { closed: true, w: 2.8, id: 523 });
    p.line(T([[-14, -48], [14, -48]]), { w: 2, id: 524 });
    p.line(T([[-15, -128], [15, -128]]), { w: 2, id: 525 });
    p.line(T([[-10, -78], [-5, -88], [0, -78], [5, -88], [10, -78]]), { w: 1.8, amp: .7, id: 526 });
    p.line(T([[-10, -100], [10, -100]]), { w: 1.4, amp: .7, id: 527 });
  },

  // 5: crayon squiggles drifting like slow waves; one line in colour
  waves(p, t) {
    for (let j = 0; j < 9; j++) {
      const pts = [];
      const base = 70 + j * 33;
      for (let x = 20; x <= 380; x += 12) {
        pts.push([x, base + Math.sin(x * .025 + t * .7 + j * .6) * (12 + j) + Math.sin(x * .06 - t * .4) * 4]);
      }
      p.line(pts, { color: j === 4 ? C.sky : INK, w: j === 4 ? 3.4 : 1.7, amp: 1.2, id: 140 + j });
    }
  },

  // 6: an envelope bobbing gently, a small heart floating out of it
  letter(p, t) {
    const y = 220 + Math.sin(t * .8) * 8, x = 200, r = Math.sin(t * .5) * .05;
    const T = (pts) => xf(pts, x, y, r);
    const hy = -92 - ((t * 18) % 80), ha = 1 - ((t * 18) % 80) / 80;
    const heart = [[0, 12], [-16, -2], [-17, -12], [-10, -18], [0, -11], [10, -18], [17, -12], [16, -2]];
    const H = xf(heart, x + Math.sin(t * 1.4) * 8, y + hy, 0, 1.1);
    p.hatch(H, { color: C.orange, gap: 4, id: 160, alpha: .8 * ha + .1 });
    p.line(H, { closed: true, w: 2.4, id: 161 });
    p.line(T([[-110, -62], [110, -62], [110, 66], [-110, 66]]), { closed: true, w: 3, id: 162 });
    p.line(T([[-110, -62], [0, 14], [110, -62]]), { w: 2.6, id: 163 });
    p.line(T([[-110, 66], [-28, 0]]), { w: 1.8, id: 164 });
    p.line(T([[110, 66], [28, 0]]), { w: 1.8, id: 165 });
    // motion squiggles
    p.line([[60, 330], [80, 322], [100, 330], [120, 322]], { w: 1.6, id: 168 });
    p.line([[280, 330], [300, 322], [320, 330], [340, 322]], { w: 1.6, id: 169 });
  },
};

// Grain: speckles knocked out of every stroke to read as wax on paper
function makeGrain(size) {
  const g = document.createElement('canvas');
  g.width = g.height = size;
  const gx = g.getContext('2d');
  const img = gx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random();
    img.data[i + 3] = v > .72 ? 255 * (v - .72) / .28 * .9 : 0;
  }
  gx.putImageData(img, 0, 0);
  return g;
}

const scenes = [];
let grain = null;

function setup(canvas) {
  const draw = ART[canvas.dataset.art];
  if (!draw) return;
  const ctx = canvas.getContext('2d');
  const pen = makePen(ctx);
  const scene = { canvas, ctx, pen, draw, visible: false, phase: Math.random() * 10 };
  const size = () => {
    const css = canvas.clientWidth || 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.height = Math.round(css * dpr);
    scene.scale = canvas.width / S;
    if (!grain || grain.width < canvas.width) grain = makeGrain(canvas.width);
  };
  size();
  scene.resize = size;
  scenes.push(scene);
  render(scene, scene.phase);
}

function render(s, t) {
  const { ctx, canvas, pen } = s;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(s.scale, 0, 0, s.scale, 0, 0);
  pen.setBoil(Math.floor(t * BOIL_FPS) % 3);
  s.draw(pen, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(grain, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

document.querySelectorAll('canvas.art').forEach(setup);

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const s = scenes.find((x) => x.canvas === e.target);
    if (s) s.visible = e.isIntersecting;
  }), { rootMargin: '80px' });
  scenes.forEach((s) => io.observe(s.canvas));
} else scenes.forEach((s) => { s.visible = true; });

let last = 0;
const start = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  if (reduceMotion.matches || document.hidden) return;
  if (now - last < 1000 / DRAW_FPS) return;
  last = now;
  const t = (now - start) / 1000;
  for (const s of scenes) if (s.visible) render(s, t + s.phase);
}
requestAnimationFrame(loop);

// Reduced motion: one still frame each (already drawn), redrawn on change
reduceMotion.addEventListener?.('change', () => scenes.forEach((s) => render(s, s.phase)));

let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => scenes.forEach((s) => { s.resize(); render(s, s.phase); }), 150);
});

// ----- Night crayon mode (chalk on a blackboard) -----
// The inline <head> script picks the first theme (saved choice, else prefers-color-scheme) before paint.
const root = document.documentElement;
const themeBtn = document.querySelector('.theme-toggle');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const logos = [...document.querySelectorAll('.roles .logo')];
const repaintListeners = [];

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  const night = theme === 'night';
  themeBtn?.setAttribute('aria-pressed', String(night));
  themeMeta?.setAttribute('content', night ? '#1e2824' : '#F0EEE6');
  // Chalk versions of the logos live in assets/logos/night/ (scripts/make-night-logos.mjs)
  for (const img of logos) {
    const src = img.getAttribute('src').replace('logos/night/', 'logos/');
    img.setAttribute('src', night ? src.replace('logos/', 'logos/night/') : src);
  }
  readPalette();
  scenes.forEach((s) => render(s, reduceMotion.matches ? s.phase : (performance.now() - start) / 1000 + s.phase));
  repaintListeners.forEach((fn) => fn());
}
applyTheme(root.getAttribute('data-theme') === 'night' ? 'night' : 'day');

themeBtn?.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'night' ? 'day' : 'night';
  try { localStorage.setItem('theme', next); } catch (e) { /* private mode: still switch */ }
  applyTheme(next);
});
// Follow the system setting until the visitor picks a theme themselves
darkQuery.addEventListener?.('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch (err) { /* ignore */ }
  if (saved !== 'night' && saved !== 'day') applyTheme(e.matches ? 'night' : 'day');
});

// ----- Easter egg: grab a crayon and doodle on the page -----
// Nothing is created until the crayon is first picked up. The overlay only takes pointer
// events while doodling; otherwise it is pointer-events: none (or absent), so links,
// text selection and scrolling are untouched. Strokes are stored in page coordinates and
// redrawn on a viewport-sized canvas, so they scroll with the page without a giant bitmap.
(() => {
  const grab = document.querySelector('.grab-crayon');
  const tools = document.getElementById('doodle-tools');
  const status = document.getElementById('doodle-status');
  if (!grab || !tools) return;
  const btnColor = tools.querySelector('.dt-color');
  const btnClear = tools.querySelector('.dt-clear');
  const btnDone = tools.querySelector('.dt-done');
  const COLORS = ['orange', 'sky', 'purple', 'lime', 'yellow'];
  let ci = 0, on = false, layer = null, ctx = null, pen = null, dpr = 1, grainPat = null;
  let strokes = [], cur = null, queued = false, timer = 0, boil = 0;

  const say = (msg) => { status.textContent = ''; setTimeout(() => { status.textContent = msg; }, 30); };
  const colorName = () => COLORS[ci];

  function cursorFor(color) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><g transform='rotate(225 16 16)' stroke='${INK}' stroke-width='1.4' stroke-linejoin='round'><path d='M16 2.5l-3.6 6.5h7.2z' fill='${color}'/><path d='M12.4 9h7.2v19.5c0 .8-.6 1.2-1.2 1.2h-4.8c-.6 0-1.2-.4-1.2-1.2z' fill='${color}' fill-opacity='.85'/><path d='M12.4 13h7.2M12.4 24.5h7.2' fill='none'/></g></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 6 26, crosshair`;
  }

  function paintSwatch() {
    const color = C[colorName()];
    root.style.setProperty('--crayon', color);
    btnColor.setAttribute('aria-label', `Crayon colour: ${colorName()}. Next colour`);
    btnColor.querySelector('.dt-label').textContent = colorName();
    if (layer) layer.style.cursor = cursorFor(color);
  }

  function makeLayer() {
    layer = document.createElement('canvas');
    layer.className = 'doodle-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    ctx = layer.getContext('2d');
    pen = makePen(ctx);
    const g = makeGrain(160);
    grainPat = ctx.createPattern(g, 'repeat');
    size();
    layer.addEventListener('pointerdown', down);
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', up);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', () => { size(); schedule(); });
    repaintListeners.push(() => { paintSwatch(); schedule(); });
  }

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    layer.width = Math.round(window.innerWidth * dpr);
    layer.height = Math.round(window.innerHeight * dpr);
  }

  function draw() {
    queued = false;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, layer.width, layer.height);
    if (!strokes.length) return;
    const sx = window.scrollX, sy = window.scrollY, vh = window.innerHeight, vw = window.innerWidth;
    ctx.setTransform(dpr, 0, 0, dpr, -sx * dpr, -sy * dpr);
    pen.setBoil(boil);
    for (const s of strokes) {
      if (s.maxY < sy - 20 || s.minY > sy + vh + 20 || s.maxX < sx - 20 || s.minX > sx + vw + 20) continue;
      pen.line(s.pts, { color: C[s.color], w: 6, amp: 1.4, id: s.id });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = grainPat;
    ctx.fillRect(0, 0, layer.width, layer.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(draw); } }

  function addPoint(s, x, y) {
    const last = s.pts[s.pts.length - 1];
    if (last && Math.hypot(x - last[0], y - last[1]) < 5) return;
    s.pts.push([x, y]);
    s.minX = Math.min(s.minX, x); s.maxX = Math.max(s.maxX, x);
    s.minY = Math.min(s.minY, y); s.maxY = Math.max(s.maxY, y);
  }
  function down(e) {
    if (e.button > 0) return;
    e.preventDefault();
    layer.setPointerCapture?.(e.pointerId);
    const x = e.clientX + window.scrollX, y = e.clientY + window.scrollY;
    cur = { pts: [], color: colorName(), id: 1000 + strokes.length * 37, minX: x, maxX: x, minY: y, maxY: y };
    addPoint(cur, x, y);
    strokes.push(cur);
    schedule();
  }
  function move(e) {
    if (!cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) addPoint(cur, ev.clientX + window.scrollX, ev.clientY + window.scrollY);
    schedule();
  }
  function up() { cur = null; }

  // Lines "boil" like the rest of the page while doodling (not under reduced motion)
  function startBoil() {
    clearInterval(timer);
    if (reduceMotion.matches) return;
    timer = setInterval(() => { if (strokes.length && !document.hidden) { boil = (boil + 1) % 3; schedule(); } }, 1000 / BOIL_FPS);
  }

  function enter() {
    if (!layer) makeLayer();
    on = true;
    root.classList.add('doodling');
    grab.setAttribute('aria-pressed', 'true');
    tools.hidden = false;
    paintSwatch();
    startBoil();
    btnColor.focus();
    say(`Doodle mode on with a ${colorName()} crayon. Draw anywhere on the page. Press Escape to stop.`);
  }
  function exit() {
    if (!on) return;
    on = false;
    cur = null;
    clearInterval(timer);
    root.classList.remove('doodling');
    grab.setAttribute('aria-pressed', 'false');
    tools.hidden = true;
    grab.focus({ preventScroll: true });
    say(strokes.length ? 'Doodle mode off. Your doodles stay until you clear them.' : 'Doodle mode off.');
  }
  function nextColor() {
    ci = (ci + 1) % COLORS.length;
    paintSwatch();
    say(`${colorName()} crayon`);
  }

  grab.addEventListener('click', () => (on ? nextColor() : enter()));
  btnColor.addEventListener('click', nextColor);
  btnClear.addEventListener('click', () => { strokes = []; schedule(); say('Doodles cleared.'); });
  btnDone.addEventListener('click', exit);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && on) exit(); });
  paintSwatch();
})();
