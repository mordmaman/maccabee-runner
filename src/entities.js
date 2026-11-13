// Hazards and pickups. Everything is pooled: objects are made once at
// load and reused, so a run makes no garbage.
// Phase 1 has spear barriers and gelt. Particles and the rest come in Phase 2.

import { CONFIG } from './config.js';

// ---------- pools ----------

export function createPool(size, make) {
  const items = new Array(size);
  for (let i = 0; i < size; i++) items[i] = make();
  return { items, misses: 0 };
}

export function takeFromPool(pool) {
  const items = pool.items;
  for (let i = 0; i < items.length; i++) {
    if (!items[i].active) {
      items[i].active = true;
      return items[i];
    }
  }
  pool.misses++;
  return null;
}

export function clearPool(pool) {
  const items = pool.items;
  for (let i = 0; i < items.length; i++) items[i].active = false;
}

function makeBarrier() {
  return { active: false, x1: 0, y1: 0, x2: 0, y2: 0, minX: 0, maxX: 0 };
}

function makeCoin() {
  return { active: false, x: 0, y: 0 };
}

export function createEntities() {
  return {
    barriers: createPool(CONFIG.pools.barriers, makeBarrier),
    coins: createPool(CONFIG.pools.coins, makeCoin),
  };
}

export function clearEntities(ents) {
  clearPool(ents.barriers);
  clearPool(ents.coins);
}

// Remove anything that has scrolled off the left edge.
export function cullEntities(ents, leftX) {
  const bs = ents.barriers.items;
  for (let i = 0; i < bs.length; i++) if (bs[i].active && bs[i].maxX < leftX) bs[i].active = false;
  const cs = ents.coins.items;
  for (let i = 0; i < cs.length; i++) if (cs[i].active && cs[i].x < leftX) cs[i].active = false;
}

// ---------- spawning ----------

// A spear barrier: a beam between two posts. Angle in degrees, 0 = flat.
export function addBarrier(ents, cx, cy, len, angDeg) {
  const b = takeFromPool(ents.barriers);
  if (!b) return null;
  const a = (angDeg * Math.PI) / 180;
  const hx = (Math.cos(a) * len) / 2;
  const hy = (Math.sin(a) * len) / 2;
  const pad = CONFIG.barrier.post / 2;
  b.x1 = cx - hx;
  b.y1 = cy - hy;
  b.x2 = cx + hx;
  b.y2 = cy + hy;
  b.minX = Math.min(b.x1, b.x2) - pad;
  b.maxX = Math.max(b.x1, b.x2) + pad;
  return b;
}

// A coin, unless it would sit on or too near a beam.
export function addCoin(ents, x, y) {
  const W = CONFIG.world;
  if (y < W.ceiling + 8 || y > W.floor - 8) return null;
  const clear = CONFIG.barrier.hitRadius + CONFIG.gelt.size / 2 + CONFIG.gelt.clearance;
  const bs = ents.barriers.items;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (!b.active || x < b.minX - clear || x > b.maxX + clear) continue;
    if (pointSegDist2(x, y, b.x1, b.y1, b.x2, b.y2) < clear * clear) return null;
  }
  const c = takeFromPool(ents.coins);
  if (!c) return null;
  c.x = x;
  c.y = y;
  return c;
}

// ---------- collision ----------
// The player is a capsule: a short vertical segment with a radius.
// A barrier is also a capsule: its beam with hitRadius.

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function pointSegDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? clamp01(((px - ax) * dx + (py - ay) * dy) / len2) : 0;
  const ex = ax + dx * t - px;
  const ey = ay + dy * t - py;
  return ex * ex + ey * ey;
}

// Squared distance between segments p1-q1 and p2-q2 (Ericson, RTCD 5.1.9).
export function segSegDist2(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y) {
  const d1x = q1x - p1x, d1y = q1y - p1y;
  const d2x = q2x - p2x, d2y = q2y - p2y;
  const rx = p1x - p2x, ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y;
  const e = d2x * d2x + d2y * d2y;
  const f = d2x * rx + d2y * ry;
  const EPS = 1e-9;
  let s, t;
  if (a <= EPS && e <= EPS) {
    s = 0; t = 0;
  } else if (a <= EPS) {
    s = 0; t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1y * ry;
    if (e <= EPS) {
      t = 0; s = clamp01(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y;
      const denom = a * e - b * b;
      s = denom !== 0 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  const dx = p1x + d1x * s - (p2x + d2x * t);
  const dy = p1y + d1y * s - (p2y + d2y * t);
  return dx * dx + dy * dy;
}

// px, py: player centre in world coordinates.
export function playerHitsBarrier(b, px, py) {
  const P = CONFIG.player;
  const pr = P.w / 2 - P.hitInset;
  const half = P.h / 2 - P.w / 2;
  const reach = pr + CONFIG.barrier.hitRadius;
  if (px + reach < b.minX || px - reach > b.maxX) return false;
  return segSegDist2(px, py - half, px, py + half, b.x1, b.y1, b.x2, b.y2) < reach * reach;
}

export function playerTouchesCoin(c, px, py) {
  const r = CONFIG.gelt.pickupRadius;
  const dx = c.x - px;
  if (dx > r || dx < -r) return false;
  const half = CONFIG.player.h / 2 - CONFIG.player.w / 2;
  const ny = c.y < py - half ? py - half : c.y > py + half ? py + half : c.y;
  const dy = c.y - ny;
  return dx * dx + dy * dy < r * r;
}

// ---------- drawing (placeholder rectangles) ----------

function drawBeam(ctx, x1, y1, x2, y2, size, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
  const h = size >> 1;
  ctx.fillStyle = color;
  for (let s = 0; s <= steps; s++) {
    const k = s / steps;
    ctx.fillRect(Math.round(x1 + dx * k) - h, Math.round(y1 + dy * k) - h, size, size);
  }
}

function drawPost(ctx, x, y) {
  const s = CONFIG.barrier.post;
  const h = s >> 1;
  const rx = Math.round(x) - h;
  const ry = Math.round(y) - h;
  ctx.fillStyle = '#2a1c10';
  ctx.fillRect(rx, ry, s, s);
  ctx.fillStyle = '#9a7440';
  ctx.fillRect(rx + 2, ry + 2, s - 4, s - 4);
}

export function drawBarriers(ctx, ents, camX) {
  const t = CONFIG.barrier.thickness;
  const vw = CONFIG.view.w;
  const items = ents.barriers.items;
  for (let i = 0; i < items.length; i++) {
    const b = items[i];
    if (!b.active || b.maxX - camX < -8 || b.minX - camX > vw + 8) continue;
    const x1 = b.x1 - camX, x2 = b.x2 - camX;
    drawBeam(ctx, x1, b.y1, x2, b.y2, t + 2, '#6e1a0e');
    drawBeam(ctx, x1, b.y1, x2, b.y2, t, '#e8452c');
    drawBeam(ctx, x1, b.y1, x2, b.y2, 2, '#ff9a6a');
    drawPost(ctx, x1, b.y1);
    drawPost(ctx, x2, b.y2);
  }
}

// w is the visible width (2..8), which fakes a spinning coin.
export function drawCoinAt(ctx, x, y, w) {
  const hw = w >> 1;
  const left = x - hw;
  ctx.fillStyle = '#a8740a';
  if (w > 4) {
    ctx.fillRect(left, y - 3, w, 6);
    ctx.fillRect(left + 1, y - 4, w - 2, 8);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(left + 1, y - 3, w - 2, 6);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(left + 2, y - 2, 2, 2);
  } else {
    ctx.fillRect(left, y - 4, w, 8);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(left + (w > 2 ? 1 : 0), y - 3, w > 2 ? w - 2 : w, 6);
  }
}

export function drawCoins(ctx, ents, camX, t) {
  const vw = CONFIG.view.w;
  const items = ents.coins.items;
  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    if (!c.active) continue;
    const sx = Math.round(c.x - camX);
    if (sx < -8 || sx > vw + 8) continue;
    const w = 4 + 2 * Math.round(2 * Math.abs(Math.cos(t * 3 + c.x * 0.02)));
    drawCoinAt(ctx, sx, Math.round(c.y), w);
  }
}
