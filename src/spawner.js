// Builds the course ahead of the player, one chunk at a time.
// Phase 1: simple generated chunks (single barrier, slalom, corridor) with a
// gelt shape in the gap after each. Phase 2 swaps this for hand-designed
// patterns weighted by stage and speed.
//
// Fairness rules used here:
// - the gap between chunks is measured in seconds of flight, so it stays
//   fair as the speed climbs;
// - every barrier leaves at least one opening taller than the player;
// - slalom barriers are spaced by time too.

import { CONFIG } from './config.js';
import { addBarrier, addCoin } from './entities.js';

// Small seeded random generator (mulberry32), so runs can be replayed in tests.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, a, b) {
  return a + (b - a) * rng();
}

function pickWeighted(rng, weights) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = rng() * total;
  let last = null;
  for (const k in weights) {
    last = k;
    r -= weights[k];
    if (r < 0) return k;
  }
  return last;
}

export function createSpawner() {
  return { nextX: 0, chunks: 0 };
}

export function resetSpawner(sp, startX) {
  sp.nextX = startX + CONFIG.spawn.firstAt;
  sp.chunks = 0;
}

// Scroll speed expected by the time the player reaches world x.
function speedAtX(g, x) {
  const S = CONFIG.speed;
  const ahead = x - (g.camX + CONFIG.player.screenX);
  const t = g.runTime + Math.max(0, ahead) / Math.max(1, g.speed);
  return Math.min(S.max, S.start + S.ramp * t);
}

export function updateSpawner(g) {
  const sp = g.spawner;
  const edge = g.camX + CONFIG.view.w + CONFIG.spawn.lookahead;
  while (sp.nextX < edge) sp.nextX = buildChunk(g, sp.nextX);
}

// Builds one chunk starting at world x and returns where the next one starts.
function buildChunk(g, x) {
  const S = CONFIG.spawn;
  const rng = g.rng;
  const speed = speedAtX(g, x);
  const metres = (x - g.runStartX) / CONFIG.world.pxPerMetre;
  const kind = metres < S.introMetres ? 'single' : pickWeighted(rng, S.weights);

  let end;
  if (kind === 'slalom') end = chunkSlalom(g, x, speed);
  else if (kind === 'corridor') end = chunkCorridor(g, x);
  else end = chunkSingle(g, x);

  const gap = speed * randRange(rng, S.gapTime[0], S.gapTime[1]);
  if (rng() < S.coinChance) placeGelt(g, end + 30, gap - 60);
  g.spawner.chunks++;
  return end + gap;
}

// One barrier: hanging, standing, floating upright, flat, a low hurdle to
// hop over, or diagonal. Standing barriers and hurdles stop the ground from
// being a lane you can idle along.
function chunkSingle(g, x) {
  const B = CONFIG.barrier;
  const W = CONFIG.world;
  const rng = g.rng;
  let len = randRange(rng, B.length[0], B.length[1]);
  const type = pickWeighted(rng, CONFIG.spawn.singleWeights);
  let ang;
  let cy;
  if (type === 'hang') {
    ang = 90; cy = W.ceiling + len / 2;
  } else if (type === 'stand') {
    ang = 90; cy = W.floor - len / 2;
  } else if (type === 'float') {
    ang = 90; // with room above and below
    cy = randRange(rng, W.ceiling + len / 2 + B.floatClear, W.floor - len / 2 - B.floatClear);
  } else if (type === 'flat') {
    ang = 0; cy = randRange(rng, W.ceiling + 20, W.floor - 40);
  } else if (type === 'hurdle') {
    ang = 0; cy = W.floor - B.hurdleHeight;
    len = randRange(rng, B.hurdleLength[0], B.hurdleLength[1]);
  } else {
    ang = rng() < 0.5 ? 45 : 135;
    const ext = (len * Math.SQRT1_2) / 2;
    cy = randRange(rng, W.ceiling + ext + 12, W.floor - ext - 12);
  }
  const halfW = Math.abs(Math.cos((ang * Math.PI) / 180)) * len / 2 + B.post / 2;
  addBarrier(g.ents, x + halfW, cy, len, ang);
  return x + halfW * 2;
}

// Two or three uprights, alternating top and bottom: weave up and down.
function chunkSlalom(g, x, speed) {
  const B = CONFIG.barrier;
  const W = CONFIG.world;
  const rng = g.rng;
  const count = rng() < 0.4 ? 3 : 2;
  const spacing = speed * CONFIG.spawn.slalomGapTime;
  let fromTop = rng() < 0.5;
  let cx = x + B.post / 2;
  for (let i = 0; i < count; i++) {
    const len = randRange(rng, B.slalomLength[0], B.slalomLength[1]);
    const cy = fromTop ? W.ceiling + len / 2 : W.floor - len / 2;
    addBarrier(g.ents, cx, cy, len, 90);
    if (i < count - 1) cx += spacing;
    fromTop = !fromTop;
  }
  return cx + B.post / 2;
}

// Two flat beams with a gap between them, and a line of gelt down the middle.
function chunkCorridor(g, x) {
  const B = CONFIG.barrier;
  const W = CONFIG.world;
  const rng = g.rng;
  const len = randRange(rng, B.corridorLength[0], B.corridorLength[1]);
  const half = B.corridorGap / 2;
  const mid = randRange(rng, W.ceiling + half + 30, W.floor - half - 30);
  const cx = x + len / 2 + B.post / 2;
  addBarrier(g.ents, cx, mid - half, len, 0);
  addBarrier(g.ents, cx, mid + half, len, 0);
  const sp = CONFIG.gelt.spacing;
  for (let gx = x + 24; gx <= x + len - 16; gx += sp) addCoin(g.ents, gx, mid);
  return x + len + B.post;
}

// A shape of gelt filling (part of) the gap from x0, `width` px wide.
function placeGelt(g, x0, width) {
  const G = CONFIG.gelt;
  const W = CONFIG.world;
  const rng = g.rng;
  const sp = G.spacing;
  const maxCols = Math.min(12, Math.floor(width / sp) + 1);
  if (maxCols < 3) return;
  const top = W.ceiling + 14;
  const bot = W.floor - 10;
  const n = 3 + Math.floor(rng() * (maxCols - 2));
  const span = (n - 1) * sp;
  const xs = x0 + (width - span) / 2;
  const shape = Math.floor(rng() * 5);
  // Keep curves no steeper than the Maccabee can follow at top speed.
  const slope = G.maxSlope;

  if (shape === 0) {
    // straight line
    const y = randRange(rng, top, bot);
    for (let i = 0; i < n; i++) addCoin(g.ents, xs + i * sp, y);
  } else if (shape === 1) {
    // arc, up or down
    const amp = Math.min(randRange(rng, 30, 70), (slope * span) / Math.PI) * (rng() < 0.5 ? 1 : -1);
    const base = amp > 0 ? randRange(rng, top + amp, bot) : randRange(rng, top, bot + amp);
    for (let i = 0; i < n; i++) addCoin(g.ents, xs + i * sp, base - amp * Math.sin((Math.PI * i) / (n - 1)));
  } else if (shape === 2) {
    // wave
    const amp = Math.min(randRange(rng, 20, 40), (slope * span) / (2 * Math.PI));
    const mid = randRange(rng, top + amp, bot - amp);
    for (let i = 0; i < n; i++) addCoin(g.ents, xs + i * sp, mid + amp * Math.sin((2 * Math.PI * i) / (n - 1)));
  } else if (shape === 3) {
    // block
    const rows = 2 + Math.floor(rng() * 2);
    const cols = Math.min(n, 6);
    const bx = x0 + (width - (cols - 1) * sp) / 2;
    const y0 = randRange(rng, top, bot - (rows - 1) * sp);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) addCoin(g.ents, bx + c * sp, y0 + r * sp);
    }
  } else {
    // diagonal
    const dy = randRange(rng, 0.4, 1) * slope * sp * (rng() < 0.5 ? 1 : -1);
    const ext = dy * (n - 1);
    const y0 = dy > 0 ? randRange(rng, top, bot - ext) : randRange(rng, top - ext, bot);
    for (let i = 0; i < n; i++) addCoin(g.ents, xs + i * sp, y0 + i * dy);
  }
}
