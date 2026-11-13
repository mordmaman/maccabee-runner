// The Maccabee: flight physics, run cycle and the placeholder drawing.
// Position is the centre of the body. x is a fixed screen position;
// the world scrolls past.

import { CONFIG } from './config.js';

export function playerGroundY() {
  return CONFIG.world.floor - CONFIG.player.h / 2;
}

export function playerCeilY() {
  return CONFIG.world.ceiling + CONFIG.player.h / 2;
}

export function createPlayer() {
  const p = {
    x: 0, y: 0, prevY: 0, vy: 0,
    onGround: true, thrusting: false,
    hits: 0, inv: 0,
    runT: 0, spin: 0, prevSpin: 0,
    dead: false,
  };
  resetPlayer(p, 1);
  return p;
}

export function resetPlayer(p, hits) {
  p.x = CONFIG.player.screenX;
  p.y = p.prevY = playerGroundY();
  p.vy = 0;
  p.onGround = true;
  p.thrusting = false;
  p.hits = hits;
  p.inv = 0;
  p.runT = 0;
  p.spin = p.prevSpin = 0;
  p.dead = false;
}

// One fixed step. `held` is the button, `speed` the scroll speed (for legs).
export function stepPlayer(p, held, dt, speed) {
  const c = CONFIG.player;
  p.prevY = p.y;
  p.prevSpin = p.spin;

  const thrust = held && !p.dead;
  p.thrusting = thrust;

  let acc;
  if (thrust) acc = -(c.thrust - c.gravity) * (p.vy > 0 ? c.turnBoost : 1);
  else acc = c.gravity * (p.vy < 0 && !p.dead ? c.turnBoost : 1);

  p.vy += acc * dt;
  if (p.vy < -c.maxRise && !p.dead) p.vy = -c.maxRise;
  if (p.vy > c.maxFall) p.vy = c.maxFall;
  p.y += p.vy * dt;

  const gy = playerGroundY();
  const cy = playerCeilY();
  const wasAirborne = !p.onGround;
  if (p.y >= gy) {
    p.y = gy;
    if (p.vy > 0) p.vy = 0;
    p.onGround = true;
  } else {
    p.onGround = false;
  }
  if (p.y <= cy) {
    p.y = cy;
    if (p.vy < 0) p.vy = 0;
  }

  if (p.dead) {
    if (!p.onGround) {
      p.spin += dt * 10;
    } else if (wasAirborne) {
      // Land flat on the back or front, whichever is nearer.
      const half = Math.PI / 2;
      p.spin = p.prevSpin = half + Math.round((p.spin - half) / Math.PI) * Math.PI;
    }
  } else if (p.onGround) {
    p.runT += (dt * speed) / c.runStride;
  }

  if (p.inv > 0) p.inv = Math.max(0, p.inv - dt);
}

// Placeholder art: rectangles. Real sprites arrive in Phase 2.
export function drawPlayer(ctx, p, alpha, t) {
  if (p.inv > 0 && !p.dead && Math.floor(p.inv * CONFIG.flashHz * 2) % 2 === 1) return;

  const c = CONFIG.player;
  const y = Math.round(p.prevY + (p.y - p.prevY) * alpha);
  const spin = p.prevSpin + (p.spin - p.prevSpin) * alpha;
  const lying = p.dead && p.onGround;

  ctx.save();
  ctx.translate(Math.round(p.x), y + (lying ? (c.h - c.w) / 2 : 0));
  if (spin) ctx.rotate(spin);

  // Jetpack flame
  if (p.thrusting) {
    const flick = Math.floor(t * 30) % 3;
    const len = 7 + flick * 3;
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(-11, 8, 6, len);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-10, 8, 4, len - 4);
  }

  // Jetpack (an oil tank on the back)
  ctx.fillStyle = '#c08a3a';
  ctx.fillRect(-12, -9, 7, 3);
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(-12, -6, 7, 13);
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(-11, 7, 5, 2);

  // Legs
  ctx.fillStyle = '#5a3a22';
  if (p.onGround && !p.dead) {
    const step = Math.floor(p.runT) % 2;
    ctx.fillRect(-5, 8, 4, step ? 6 : 4);
    ctx.fillRect(1, 8, 4, step ? 4 : 6);
  } else {
    ctx.fillRect(-4, 8, 3, 5);
    ctx.fillRect(1, 8, 3, 6);
  }

  // Tunic and belt
  ctx.fillStyle = '#2f6fd6';
  ctx.fillRect(-6, -6, 13, 14);
  ctx.fillStyle = '#7a4a22';
  ctx.fillRect(-6, 2, 13, 2);

  // Arm
  ctx.fillStyle = '#f0c08a';
  ctx.fillRect(3, -3, 6, 3);

  // Head, headband, eye
  ctx.fillRect(-4, -14, 9, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-4, -12, 9, 2);
  ctx.fillStyle = '#1b1f3a';
  ctx.fillRect(2, -9, 2, 2);

  ctx.restore();
}
