// Settings and their scrolling backgrounds.
// Phase 1 has one placeholder setting. Phase 3 adds the eight nights,
// each with its own palette and three-layer parallax.

import { CONFIG } from './config.js';

export const PLACEHOLDER_STAGE = {
  name: 'Placeholder hills',
  candles: 8, // lit in the scenery chanukiot; in story mode this becomes the night number
  sky: ['#151a3e', '#1d2350', '#2b2f69', '#463f80', '#6c4f8e', '#9a5f8c'],
  star: '#f4ecc2',
  far: '#2a2c58',
  farMetal: '#9c7a34',
  mid: '#2f3f34',
  midLight: '#3f5444',
  trunk: '#2a2018',
  wall: '#3d3554',
  wallTop: '#51496e',
  door: '#241e34',
  window: '#2a1f30',
  windowGlow: 'rgba(255, 190, 90, 0.18)',
  metal: '#d9a83a',
  candle: '#eef0ff',
  bunting: ['#3a7bd5', '#f2f2f2'],
  string: '#1e1a2c',
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

// Two big chanukiot stand on the highest far hilltops.
const HILL_CHANUKIOT = [0, 0];
{
  const half = HILL_N / 2;
  for (let side = 0; side < 2; side++) {
    let best = side * half + 4;
    for (let i = side * half + 4; i < (side + 1) * half - 4; i++) if (HILLS[i] > HILLS[best]) best = i;
    HILL_CHANUKIOT[side] = best;
  }
}

// Mid layer: a village of olive trees and flat-roofed houses, each house with
// a chanukiah in the window. Slots: type (0 tree, 1 house), x jitter, width,
// height, bunting to the next house (0/1).
const MID_GAP = 96;
const MID_N = 20;
const MID = new Int16Array(MID_N * 5);
for (let i = 0; i < MID_N; i++) {
  const house = sceneryRand() < 0.55 ? 1 : 0;
  const k = i * 5;
  MID[k] = house;
  MID[k + 1] = Math.floor(sceneryRand() * (house ? 24 : 50));
  MID[k + 2] = house ? 36 + Math.floor(sceneryRand() * 14) : 18 + Math.floor(sceneryRand() * 14);
  MID[k + 3] = house ? 28 + Math.floor(sceneryRand() * 12) : 16 + Math.floor(sceneryRand() * 14);
}
for (let i = 0; i < MID_N; i++) {
  const j = ((i + 1) % MID_N) * 5;
  MID[i * 5 + 4] = MID[i * 5] && MID[j] && sceneryRand() < 0.7 ? 1 : 0;
}

function wrap(v, m) {
  return ((v % m) + m) % m;
}

// A chanukiah: eight candles in a row and the shamash raised in the middle.
// x is the centre, y the bottom of the foot, u the size of one pixel-block.
// Candles fill from the right (night 1 is the far-right candle), the
// shamash is always lit.
const CANDLE_ARMS = [8, 6, 4, 2, -2, -4, -6, -8];

function drawFlame(ctx, x, y, u, t, i) {
  ctx.fillStyle = Math.sin(t * 9 + i * 1.7) > -0.3 ? '#ffd23f' : '#ff9a2a';
  ctx.fillRect(x, y, u, 2 * u);
}

export function drawChanukiah(ctx, x, y, u, lit, metal, candle, t) {
  ctx.fillStyle = metal;
  ctx.fillRect(x - 2 * u, y - u, 5 * u, u);      // foot
  ctx.fillRect(x, y - 5 * u, u, 4 * u);          // stem
  ctx.fillRect(x - 8 * u, y - 5 * u, 17 * u, u); // branch bar
  ctx.fillRect(x, y - 9 * u, u, 4 * u);          // raised shamash holder
  ctx.fillStyle = candle;
  for (let i = 0; i < 8; i++) if (i < lit) ctx.fillRect(x + CANDLE_ARMS[i] * u, y - 7 * u, u, 2 * u);
  ctx.fillRect(x, y - 10 * u, u, u);
  for (let i = 0; i < 8; i++) if (i < lit) drawFlame(ctx, x + CANDLE_ARMS[i] * u, y - 9 * u, u, t, i);
  drawFlame(ctx, x, y - 12 * u, u, t, 9);
}

function drawHouse(ctx, st, x, base, w, h, t) {
  const top = base - h;
  ctx.fillStyle = st.wall;
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = st.wallTop;
  ctx.fillRect(x - 1, top - 2, w + 2, 3); // flat roof edge
  ctx.fillStyle = st.door;
  ctx.fillRect(x + w - 11, base - 12, 7, 12);
  // window with a chanukiah on the sill
  const wx = x + 4;
  const wy = top + 5;
  ctx.fillStyle = st.windowGlow;
  ctx.fillRect(wx - 3, wy - 3, 27, 21);
  ctx.fillStyle = st.window;
  ctx.fillRect(wx, wy, 21, 15);
  drawChanukiah(ctx, wx + 10, wy + 14, 1, st.candles, st.metal, st.candle, t);
}

function drawBunting(ctx, st, x1, x2, y) {
  const span = x2 - x1;
  if (span < 12) return;
  const sag = Math.min(10, span * 0.12);
  let n = 0;
  for (let x = x1; x <= x2; x += 2) {
    const k = (x - x1) / span;
    const yy = Math.round(y + sag * Math.sin(Math.PI * k));
    ctx.fillStyle = st.string;
    ctx.fillRect(x, yy, 2, 1);
    if ((x - x1) % 8 === 4) {
      ctx.fillStyle = st.bunting[n++ % 2];
      ctx.fillRect(x - 2, yy + 1, 5, 1);
      ctx.fillRect(x - 1, yy + 2, 3, 1);
      ctx.fillRect(x, yy + 3, 1, 1);
    }
  }
}

// camX is the rounded camera position, t the game clock (for flames).
// Draws a little past each edge so screen shake never shows a gap.
export function drawBackground(ctx, st, camX, t) {
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
  const first = Math.floor(fo / HILL_W) - 4;
  for (let i = first; ; i++) {
    const sx = i * HILL_W - fo;
    if (sx > vw + 8) break;
    const h = HILLS[wrap(i, HILL_N)];
    ctx.fillRect(sx, W.floor - h, HILL_W, h);
  }
  for (let i = first; ; i++) {
    const sx = i * HILL_W - fo;
    if (sx > vw + 60) break;
    const col = wrap(i, HILL_N);
    if (col !== HILL_CHANUKIOT[0] && col !== HILL_CHANUKIOT[1]) continue;
    drawChanukiah(ctx, sx + (HILL_W >> 1), W.floor - HILLS[col], 3, st.candles, st.farMetal, st.candle, t);
  }

  // Mid layer: a ridge with a village of houses and olive trees (medium)
  const mo = Math.floor(camX * 0.45);
  const ridge = W.floor - 14;
  ctx.fillStyle = st.mid;
  ctx.fillRect(-8, ridge, vw + 16, 14);
  const firstSlot = Math.floor((mo - 60) / MID_GAP);
  for (let i = firstSlot; ; i++) {
    const k = wrap(i, MID_N) * 5;
    const sx = i * MID_GAP + MID[k + 1] - mo;
    if (sx > vw + 40) break;
    const w = MID[k + 2];
    const h = MID[k + 3];
    if (MID[k] === 1) {
      drawHouse(ctx, st, sx, ridge, w, h, t);
      if (MID[k + 4]) {
        const n = wrap(i + 1, MID_N) * 5;
        const nx = (i + 1) * MID_GAP + MID[n + 1] - mo;
        drawBunting(ctx, st, sx + w, nx, Math.max(ridge - h, ridge - MID[n + 3]) - 1);
      }
    } else {
      ctx.fillStyle = st.trunk;
      ctx.fillRect(sx + (w >> 1) - 2, ridge - h, 4, h);
      ctx.fillStyle = st.mid;
      ctx.fillRect(sx, ridge - h - 12, w, 14);
      ctx.fillStyle = st.midLight;
      ctx.fillRect(sx + 2, ridge - h - 12, w - 6, 4);
    }
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
