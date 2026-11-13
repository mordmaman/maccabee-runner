// Settings and their scrolling backgrounds.
// Phase 1 has one placeholder setting. Phase 3 adds the eight nights,
// each with its own palette and three-layer parallax.

import { CONFIG } from './config.js';

export const PLACEHOLDER_STAGE = {
  name: 'Placeholder hills',
  sky: ['#151a3e', '#1d2350', '#2b2f69', '#463f80', '#6c4f8e', '#9a5f8c'],
  star: '#f4ecc2',
  far: '#2a2c58',
  mid: '#2f3f34',
  midLight: '#3f5444',
  trunk: '#2a2018',
  ground: '#c9a46a',
  groundTop: '#e0bf84',
  groundDark: '#a8844e',
  sign: '#7a5a32',
};

// Fixed scenery tables, made once at load from a tiny seeded generator.
let scenerySeed = 1234567;
function sceneryRand() {
  scenerySeed = (scenerySeed * 1103515245 + 12345) & 0x7fffffff;
  return scenerySeed / 0x7fffffff;
}

const STAR_SPAN = 1280;
const STAR_COUNT = 56;
const STARS = new Int16Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  STARS[i * 3] = Math.floor(sceneryRand() * STAR_SPAN);
  STARS[i * 3 + 1] = Math.floor(sceneryRand() * 170);
  STARS[i * 3 + 2] = sceneryRand() < 0.2 ? 2 : 1;
}

const HILL_W = 16;
const HILL_N = 64;
const HILLS = new Int16Array(HILL_N);
for (let i = 0; i < HILL_N; i++) {
  const a = (i / HILL_N) * Math.PI * 2;
  HILLS[i] = Math.round(62 + 26 * Math.sin(a * 3) + 14 * Math.sin(a * 7 + 1.3));
}

const TREE_GAP = 96;
const TREE_N = 20;
const TREES = new Int16Array(TREE_N * 3); // x jitter, canopy width, height
for (let i = 0; i < TREE_N; i++) {
  TREES[i * 3] = Math.floor(sceneryRand() * 50);
  TREES[i * 3 + 1] = 18 + Math.floor(sceneryRand() * 14);
  TREES[i * 3 + 2] = 16 + Math.floor(sceneryRand() * 14);
}

function wrap(v, m) {
  return ((v % m) + m) % m;
}

// camX is the rounded camera position. Draws a little past each edge so
// screen shake never shows a gap.
export function drawBackground(ctx, st, camX) {
  const W = CONFIG.world;
  const vw = CONFIG.view.w;
  const vh = CONFIG.view.h;

  // Sky bands
  const n = st.sky.length;
  const bh = Math.ceil((W.floor + 8) / n);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = st.sky[i];
    ctx.fillRect(-8, -8 + i * bh, vw + 16, bh);
  }

  // Stars (barely move)
  ctx.fillStyle = st.star;
  const so = Math.floor(camX * 0.03);
  for (let i = 0; i < STAR_COUNT; i++) {
    const sx = wrap(STARS[i * 3] - so, STAR_SPAN);
    if (sx > vw + 8) continue;
    const s = STARS[i * 3 + 2];
    ctx.fillRect(sx, STARS[i * 3 + 1], s, s);
  }

  // Far hills (slow)
  ctx.fillStyle = st.far;
  const fo = Math.floor(camX * 0.15);
  const first = Math.floor(fo / HILL_W) - 1;
  for (let i = first; ; i++) {
    const sx = i * HILL_W - fo;
    if (sx > vw + 8) break;
    const h = HILLS[wrap(i, HILL_N)];
    ctx.fillRect(sx, W.floor - h, HILL_W, h);
  }

  // Mid layer: a ridge with olive trees (medium)
  const mo = Math.floor(camX * 0.45);
  ctx.fillStyle = st.mid;
  ctx.fillRect(-8, W.floor - 14, vw + 16, 14);
  const firstTree = Math.floor((mo - 60) / TREE_GAP);
  for (let i = firstTree; ; i++) {
    const k = wrap(i, TREE_N) * 3;
    const sx = i * TREE_GAP + TREES[k] - mo;
    if (sx > vw + 40) break;
    const cw = TREES[k + 1];
    const th = TREES[k + 2];
    ctx.fillStyle = st.trunk;
    ctx.fillRect(sx + (cw >> 1) - 2, W.floor - 14 - th, 4, th);
    ctx.fillStyle = st.mid;
    ctx.fillRect(sx, W.floor - 14 - th - 12, cw, 14);
    ctx.fillStyle = st.midLight;
    ctx.fillRect(sx + 2, W.floor - 14 - th - 12, cw - 6, 4);
  }

  // Ground (full speed) with two rows of dashes so speed is easy to feel
  ctx.fillStyle = st.ground;
  ctx.fillRect(-8, W.floor, vw + 16, vh - W.floor + 8);
  ctx.fillStyle = st.groundTop;
  ctx.fillRect(-8, W.floor, vw + 16, 3);
  ctx.fillStyle = st.groundDark;
  for (let x = -wrap(camX, 40) - 8; x < vw + 8; x += 40) ctx.fillRect(x, W.floor + 10, 12, 3);
  for (let x = -wrap(camX + 17, 28) - 8; x < vw + 8; x += 28) ctx.fillRect(x, W.floor + 26, 6, 2);
}

// Distance signs every 100 m, and a flag at the best distance so far.
const MARKER_LABELS = [];
function markerLabel(k) {
  while (MARKER_LABELS.length <= k) MARKER_LABELS.push(MARKER_LABELS.length * 100 + 'm');
  return MARKER_LABELS[k];
}

export function drawMarkers(ctx, g, camX) {
  const W = CONFIG.world;
  const vw = CONFIG.view.w;
  const step = 100 * W.pxPerMetre;
  const st = g.stage;
  // Signs line up with the player, so passing "100m" happens as the HUD reads 100m.
  const origin = g.runStartX + CONFIG.player.screenX;

  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let k = Math.max(1, Math.ceil((camX - 30 - origin) / step));
  for (; ; k++) {
    const sx = Math.round(origin + k * step - camX);
    if (sx > vw + 30) break;
    ctx.fillStyle = st.sign;
    ctx.fillRect(sx - 1, W.floor - 24, 3, 24);
    ctx.fillRect(sx - 17, W.floor - 38, 35, 15);
    ctx.fillStyle = '#f4e2b8';
    ctx.fillRect(sx - 15, W.floor - 36, 31, 11);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillText(markerLabel(k), sx + 1, W.floor - 30);
  }

  if (g.best > 0) {
    const sx = Math.round(origin + g.best * W.pxPerMetre - camX);
    if (sx > -40 && sx < vw + 40) {
      ctx.fillStyle = '#f4ecc2';
      ctx.fillRect(sx, W.floor - 64, 2, 64);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(sx + 2, W.floor - 64, 30, 14);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillText('BEST', sx + 17, W.floor - 57);
    }
  }
}
