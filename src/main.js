// Boot, fixed-step loop and scene switching.
// Everything above boot() is plain logic with no DOM, so tests/sim.js can
// import it and play the game in Node.

import { CONFIG } from './config.js';
import { createInput, attachInput, releaseInput } from './input.js';
import { createPlayer, resetPlayer, stepPlayer } from './player.js';
import { makeRng, createSpawner, resetSpawner, updateSpawner } from './spawner.js';
import { createEntities, clearEntities, cullEntities, playerHitsBarrier, playerTouchesCoin } from './entities.js';
import { PLACEHOLDER_STAGE } from './stages.js';
import { drawGame } from './ui.js';

export const STEP = 1 / 60;

function hitsForDifficulty() {
  return (CONFIG.difficulties[CONFIG.difficulty] || CONFIG.difficulties.normal).hits;
}

export function createGame(seed) {
  return {
    scene: 'title', // title | play | dying | over
    sceneT: 0,
    t: 0,
    paused: false,
    rng: makeRng(seed),
    stage: PLACEHOLDER_STAGE,
    player: createPlayer(),
    ents: createEntities(),
    spawner: createSpawner(),
    camX: 0,
    prevCamX: 0,
    runStartX: 0,
    speed: 0,
    deathSpeed: 0,
    runTime: 0,
    runs: 0,
    metres: 0,
    gelt: 0,
    best: 0, // this session only; saving arrives in Phase 3
    newBest: false,
    hitsTaken: 0,
    shakeT: 0,
    shakeMag: 0,
  };
}

function setScene(g, scene) {
  g.scene = scene;
  g.sceneT = 0;
}

function startShake(g, mag) {
  g.shakeMag = mag;
  g.shakeT = CONFIG.shake.time;
}

export function startRun(g) {
  clearEntities(g.ents);
  g.runStartX = g.camX;
  resetSpawner(g.spawner, g.camX);
  resetPlayer(g.player, hitsForDifficulty());
  g.speed = CONFIG.speed.start;
  g.runTime = 0;
  g.runs++;
  g.metres = 0;
  g.gelt = 0;
  g.newBest = false;
  g.hitsTaken = 0;
  g.shakeT = 0;
  setScene(g, 'play');
}

function hitPlayer(g) {
  const p = g.player;
  p.hits--;
  g.hitsTaken++;
  if (p.hits <= 0) {
    killPlayer(g);
    return;
  }
  p.inv = CONFIG.invincibleTime;
  startShake(g, CONFIG.shake.hit);
}

function killPlayer(g) {
  const p = g.player;
  p.dead = true;
  p.inv = 0;
  p.vy = -CONFIG.deathPop;
  startShake(g, CONFIG.shake.death);
  if (g.metres > g.best) {
    g.best = g.metres;
    g.newBest = true;
  }
  g.deathSpeed = g.speed;
  setScene(g, 'dying');
}

function stepPlay(g, held, dt) {
  const S = CONFIG.speed;
  g.runTime += dt;
  g.speed = Math.min(S.max, S.start + S.ramp * g.runTime);
  g.camX += g.speed * dt;
  g.metres = (g.camX - g.runStartX) / CONFIG.world.pxPerMetre;

  const p = g.player;
  stepPlayer(p, held, dt, g.speed);
  updateSpawner(g);
  cullEntities(g.ents, g.camX - CONFIG.spawn.despawnMargin);

  const px = g.camX + p.x;
  const py = p.y;

  const coins = g.ents.coins.items;
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    if (c.active && playerTouchesCoin(c, px, py)) {
      c.active = false;
      g.gelt++;
    }
  }

  if (p.inv <= 0) {
    const bs = g.ents.barriers.items;
    for (let i = 0; i < bs.length; i++) {
      if (bs[i].active && playerHitsBarrier(bs[i], px, py)) {
        hitPlayer(g);
        break;
      }
    }
  }
}

function stepDying(g, dt) {
  g.speed = g.deathSpeed * Math.max(0, 1 - g.sceneT / CONFIG.deathTime);
  g.camX += g.speed * dt;
  stepPlayer(g.player, false, dt, 0);
  if (g.sceneT >= CONFIG.deathTime) setScene(g, 'over');
}

// One fixed update. input = { held, pressed }; pressed is consumed here.
export function stepGame(g, input, dt = STEP) {
  const pressed = input.pressed > 0;
  input.pressed = 0;
  g.prevCamX = g.camX;

  if (g.paused) {
    g.player.prevY = g.player.y;
    g.player.prevSpin = g.player.spin;
    if (pressed) g.paused = false;
    return;
  }

  g.t += dt;
  g.sceneT += dt;
  if (g.shakeT > 0) g.shakeT = Math.max(0, g.shakeT - dt);

  if (g.scene === 'title') {
    g.camX += CONFIG.speed.titleScroll * dt;
    stepPlayer(g.player, false, dt, CONFIG.speed.titleScroll);
    if (pressed) startRun(g);
  } else if (g.scene === 'play') {
    stepPlay(g, input.held, dt);
  } else if (g.scene === 'dying') {
    stepDying(g, dt);
  } else if (g.scene === 'over') {
    stepPlayer(g.player, false, dt, 0);
    if (pressed && g.sceneT >= CONFIG.restartDelay) startRun(g);
  }
}

export function pauseGame(g) {
  if (g.scene === 'play') g.paused = true;
}

// ---------- browser only below ----------

function fitCanvas(canvas) {
  const W = CONFIG.view.w;
  const H = CONFIG.view.h;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(vw / W, vh / H);
  const devScale = Math.floor(Math.min((vw * dpr) / W, (vh * dpr) / H));
  let scale = fit;
  if (CONFIG.display.integerScale && devScale >= 1) {
    const whole = devScale / dpr;
    const lowFill = whole / fit < CONFIG.display.hiDpiMinFill;
    if (!(dpr >= 2 && lowFill)) scale = whole;
  }
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
}

function boot() {
  const canvas = document.getElementById('game');
  canvas.width = CONFIG.view.w;
  canvas.height = CONFIG.view.h;
  const ctx = canvas.getContext('2d', { alpha: false });

  const refit = () => fitCanvas(canvas);
  refit();
  window.addEventListener('resize', refit);
  window.addEventListener('orientationchange', refit);

  const input = createInput();
  attachInput(input, window);

  const g = createGame((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);

  const pause = () => {
    pauseGame(g);
    releaseInput(input);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('blur', pause);

  let last = 0;
  let acc = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (dt < 0) dt = 0;
    acc += dt;
    while (acc >= STEP) {
      stepGame(g, input, STEP);
      acc -= STEP;
    }
    ctx.imageSmoothingEnabled = false;
    drawGame(ctx, g, acc / STEP);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame((now) => {
    last = now;
    requestAnimationFrame(frame);
  });

  // Handy for tuning from a desktop console: MR.CONFIG.player.thrust = 3200
  window.MR = { CONFIG, game: g };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') boot();
