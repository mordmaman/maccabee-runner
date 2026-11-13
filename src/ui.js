// Screens and HUD. Phase 1: title, distance HUD, results, pause.
// The menu chanukiah, shop and full results screen come in later phases.

import { CONFIG } from './config.js';
import { drawBackground, drawMarkers } from './stages.js';
import { drawBarriers, drawCoins, drawCoinAt } from './entities.js';
import { drawPlayer } from './player.js';

const FONT_CACHE = {};
function fontFor(size) {
  return FONT_CACHE[size] || (FONT_CACHE[size] = 'bold ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif');
}

function drawLabel(ctx, str, x, y, size, align, color) {
  ctx.font = fontFor(size);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size >= 20 ? 4 : 3;
  ctx.strokeStyle = '#141428';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// 7x6 pixel heart drawn at 2x.
function drawHeart(ctx, x, y, full) {
  ctx.fillStyle = '#141428';
  ctx.fillRect(x - 2, y, 18, 10);
  ctx.fillRect(x, y - 2, 14, 12);
  ctx.fillRect(x + 2, y + 10, 10, 2);
  ctx.fillRect(x + 4, y + 12, 6, 2);
  ctx.fillStyle = full ? '#ff4a5a' : '#4a2a3a';
  ctx.fillRect(x + 2, y, 4, 2);
  ctx.fillRect(x + 8, y, 4, 2);
  ctx.fillRect(x, y + 2, 14, 4);
  ctx.fillRect(x + 2, y + 6, 10, 2);
  ctx.fillRect(x + 4, y + 8, 6, 2);
  ctx.fillRect(x + 6, y + 10, 2, 2);
  if (full) {
    ctx.fillStyle = '#ffb0b8';
    ctx.fillRect(x + 2, y + 2, 2, 2);
  }
}

// Cached HUD strings so drawing makes no new strings when nothing changed.
const hud = { metres: -1, metresText: '', gelt: -1, geltText: '', best: -1, bestText: '' };

function refreshHud(g) {
  const m = Math.floor(g.metres);
  if (m !== hud.metres) { hud.metres = m; hud.metresText = m + 'm'; }
  if (g.gelt !== hud.gelt) { hud.gelt = g.gelt; hud.geltText = String(g.gelt); }
  const b = Math.floor(g.best);
  if (b !== hud.best) { hud.best = b; hud.bestText = 'BEST ' + b + 'm'; }
}

export function drawHUD(ctx, g) {
  refreshHud(g);
  drawLabel(ctx, hud.metresText, 12, 8, 24, 'left', '#ffffff');
  if (hud.best > 0) drawLabel(ctx, hud.bestText, 13, 36, 11, 'left', '#f4ecc2');

  const maxHits = (CONFIG.difficulties[CONFIG.difficulty] || CONFIG.difficulties.normal).hits;
  for (let i = 0; i < maxHits; i++) drawHeart(ctx, 14 + i * 22, 56, i < g.player.hits);

  drawLabel(ctx, hud.geltText, CONFIG.view.w - 12, 10, 20, 'right', '#ffd23f');
  ctx.font = fontFor(20);
  const tw = ctx.measureText(hud.geltText).width;
  drawCoinAt(ctx, Math.round(CONFIG.view.w - 24 - tw), 21, 8);
}

function dim(ctx, a) {
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, CONFIG.view.w, CONFIG.view.h);
}

export function drawTitle(ctx, g) {
  const cx = CONFIG.view.w / 2;
  dim(ctx, 'rgba(10, 12, 30, 0.35)');
  drawLabel(ctx, 'MACCABEE RUNNER', cx, 62, 40, 'center', '#ffd23f');
  drawLabel(ctx, 'Hold to fly, let go to fall', cx, 128, 18, 'center', '#ffffff');
  drawLabel(ctx, 'Dodge the spears and grab the gelt', cx, 154, 15, 'center', '#f4ecc2');
  if (Math.floor(g.t * 2) % 2 === 0) {
    drawLabel(ctx, 'Tap, click or press Space to start', cx, 208, 16, 'center', '#ffffff');
  }
  drawLabel(ctx, 'Phase 1 prototype', CONFIG.view.w - 8, CONFIG.view.h - 18, 10, 'right', '#c8c0e0');
}

const results = { run: -1, distance: '', gelt: '', best: '' };

export function drawGameOver(ctx, g) {
  if (results.run !== g.runs) {
    results.run = g.runs;
    results.distance = 'Distance  ' + Math.floor(g.metres) + 'm';
    results.gelt = 'Gelt  ' + g.gelt;
    results.best = g.newBest ? 'New best!' : 'Best  ' + Math.floor(g.best) + 'm';
  }
  const cx = CONFIG.view.w / 2;
  const w = 300;
  const h = 184;
  const x = Math.round(cx - w / 2);
  const y = 84;
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#1d2350';
  ctx.fillRect(x, y, w, h);

  drawLabel(ctx, 'BONK!', cx, y + 12, 34, 'center', '#ffd23f');
  drawLabel(ctx, results.distance, cx, y + 62, 18, 'center', '#ffffff');
  drawLabel(ctx, results.gelt, cx, y + 88, 18, 'center', '#ffffff');
  drawLabel(ctx, results.best, cx, y + 114, 18, 'center', g.newBest ? '#ffd23f' : '#c8c0e0');
  if (g.sceneT >= CONFIG.restartDelay && Math.floor(g.t * 2) % 2 === 0) {
    drawLabel(ctx, 'Tap to fly again', cx, y + 150, 16, 'center', '#ffffff');
  }
}

export function drawPaused(ctx) {
  const cx = CONFIG.view.w / 2;
  dim(ctx, 'rgba(10, 12, 30, 0.6)');
  drawLabel(ctx, 'Paused', cx, 130, 32, 'center', '#ffd23f');
  drawLabel(ctx, 'Tap to carry on', cx, 182, 16, 'center', '#ffffff');
}

// Draws one frame. alpha (0..1) blends between the last two updates.
export function drawGame(ctx, g, alpha) {
  const camX = Math.round(g.prevCamX + (g.camX - g.prevCamX) * alpha);

  let ox = 0;
  let oy = 0;
  if (g.shakeT > 0) {
    const k = g.shakeMag * (g.shakeT / CONFIG.shake.time);
    ox = Math.round(Math.sin(g.t * 91) * k);
    oy = Math.round(Math.cos(g.t * 77) * k);
  }

  ctx.setTransform(1, 0, 0, 1, ox, oy);
  drawBackground(ctx, g.stage, camX);
  if (g.scene !== 'title') drawMarkers(ctx, g, camX);
  drawCoins(ctx, g.ents, camX, g.t);
  drawBarriers(ctx, g.ents, camX);
  drawPlayer(ctx, g.player, alpha, g.t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (g.scene === 'title') {
    drawTitle(ctx, g);
  } else {
    drawHUD(ctx, g);
    if (g.scene === 'over') drawGameOver(ctx, g);
  }
  if (g.paused) drawPaused(ctx);
}
