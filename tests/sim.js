// Headless test of the core logic. Run: node tests/sim.js
// Phase 1 checks: the logic runs without a browser, flight physics stays in
// bounds, hits and game over work, and a look-ahead bot can fly every
// generated course without being hit (so no layout is impossible).
// Phase 2 extends this to run the bot through every hand-designed chunk.

import { CONFIG } from '../src/config.js';
import { createGame, stepGame, startRun, STEP } from '../src/main.js';
import { createPlayer, resetPlayer, stepPlayer, playerGroundY, playerCeilY } from '../src/player.js';
import { playerHitsBarrier } from '../src/entities.js';

let failures = 0;
function check(ok, msg) {
  console.log((ok ? '  ok   ' : '  FAIL ') + msg);
  if (!ok) failures++;
}

// ---------- 1. flight physics ----------
console.log('Flight physics');
{
  const p = createPlayer();
  resetPlayer(p, 2);
  let t = 0;
  while (p.y > playerCeilY() + 0.5 && t < 5) { stepPlayer(p, true, STEP, 200); t += STEP; }
  const up = t;
  check(Math.abs(p.y - playerCeilY()) < 0.6, `holding reaches the ceiling (${up.toFixed(2)}s floor to ceiling)`);
  for (let i = 0; i < 120; i++) stepPlayer(p, true, STEP, 200);
  check(p.y >= playerCeilY() && p.vy === 0, 'stays clamped at the ceiling while held');
  t = 0;
  while (p.y < playerGroundY() - 0.5 && t < 5) { stepPlayer(p, false, STEP, 200); t += STEP; }
  check(Math.abs(p.y - playerGroundY()) < 0.6, `letting go falls to the ground (${t.toFixed(2)}s ceiling to floor)`);
  for (let i = 0; i < 120; i++) stepPlayer(p, false, STEP, 200);
  check(p.y === playerGroundY() && p.onGround, 'runs along the ground when released');
}

// ---------- 2. hits and game over ----------
console.log('Hits and game over');
{
  const g = createGame(42);
  const input = { held: false, pressed: 1 };
  stepGame(g, input);
  check(g.scene === 'play', 'a press on the title starts a run');

  // Never press: the bot will run into a standing barrier sooner or later.
  let steps = 0;
  let sawInvincible = false;
  while (g.scene === 'play' && steps < 60 * 300) {
    stepGame(g, input);
    if (g.player.inv > 0) sawInvincible = true;
    steps++;
  }
  const hits = CONFIG.difficulties[CONFIG.difficulty].hits;
  check(g.scene === 'dying', `the run ends after ${hits} hits (ended at ${Math.floor(g.metres)}m)`);
  check(hits === 1 || sawInvincible, 'a non-final hit gives invincibility frames');
  check(g.hitsTaken === hits, `exactly ${hits} hits were counted (got ${g.hitsTaken})`);

  while (g.scene === 'dying') stepGame(g, input);
  check(g.scene === 'over', 'the tumble leads to the results panel');
  check(g.best > 0 && g.newBest, 'the first run sets a best distance');

  input.pressed = 1;
  stepGame(g, input);
  check(g.scene === 'over', 'a tap straight away is ignored (no accidental restart)');
  for (let i = 0; i < Math.ceil(CONFIG.restartDelay / STEP); i++) stepGame(g, input);
  input.pressed = 1;
  stepGame(g, input);
  check(g.scene === 'play' && g.gelt === 0 && g.player.hits === hits, 'a tap after the delay restarts with a fresh run');
}

// ---------- 3. a look-ahead bot flies every course ----------
// The bot searches the next 1.5 s of inputs (a decision every 0.1 s) for a
// path that touches no barrier. If it ever gets hit, that layout was
// impossible or too tight.
const DECIDE = 6;
const DEPTH = 15;
const scratch = createPlayer();

function pathClear(g, y, vy, onGround, camX, runTime, depth, held, seen) {
  // simulate DECIDE frames with this choice
  scratch.y = y; scratch.vy = vy; scratch.onGround = onGround; scratch.dead = false; scratch.inv = 0;
  const S = CONFIG.speed;
  const bs = g.ents.barriers.items;
  for (let f = 0; f < DECIDE; f++) {
    runTime += STEP;
    camX += Math.min(S.max, S.start + S.ramp * runTime) * STEP;
    stepPlayer(scratch, held, STEP, 0);
    const px = camX + scratch.x;
    for (let i = 0; i < bs.length; i++) {
      if (bs[i].active && playerHitsBarrier(bs[i], px, scratch.y)) return false;
    }
  }
  if (depth + 1 >= DEPTH) return true;
  const key = (depth + 1) * 1e7 + Math.round(scratch.y / 3) * 1e3 + Math.round(scratch.vy / 40 + 50);
  if (seen.has(key)) return false;
  seen.add(key);
  const ny = scratch.y, nvy = scratch.vy, ng = scratch.onGround;
  return pathClear(g, ny, nvy, ng, camX, runTime, depth + 1, held, seen)
      || pathClear(g, ny, nvy, ng, camX, runTime, depth + 1, !held, seen);
}

// The bot would like to fly towards the next coin, but safety comes first.
function wish(g, prev) {
  const p = g.player;
  const px = g.camX + p.x;
  let best = null;
  const cs = g.ents.coins.items;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c.active && c.x > px - 4 && c.x < px + 160 && (!best || c.x < best.x)) best = c;
  }
  if (!best) return prev;
  // aim where we will be shortly, not where we are, to avoid overshooting
  return best.y < p.y + p.vy * 0.12;
}

function decide(g, prev) {
  const p = g.player;
  const want = wish(g, prev);
  const seen = new Set();
  if (pathClear(g, p.y, p.vy, p.onGround, g.camX, g.runTime, 0, want, seen)) return want;
  if (pathClear(g, p.y, p.vy, p.onGround, g.camX, g.runTime, 0, !want, seen)) return !want;
  return want;
}

console.log('Bot survival');
{
  const SEEDS = 30;
  const TARGET_M = 2500;
  let totalGelt = 0;
  let totalCoins = 0;
  let totalChunks = 0;
  let heldFrames = 0;
  let frames = 0;
  let worst = null;
  let poolMisses = 0;
  const t0 = Date.now();
  for (let seed = 1; seed <= SEEDS; seed++) {
    const g = createGame(seed);
    startRun(g);
    const input = { held: false, pressed: 0 };
    const coinsSeen = new Set();
    let held = false;
    let frame = 0;
    while (g.scene === 'play' && g.metres < TARGET_M) {
      if (frame % 2 === 0) held = decide(g, held);
      input.held = held;
      stepGame(g, input);
      frame++;
      if (held) heldFrames++;
      for (const c of g.ents.coins.items) if (c.active) coinsSeen.add(c.x + ',' + c.y);
      if (g.hitsTaken > 0 && !worst) worst = { seed, metres: Math.floor(g.metres) };
    }
    frames += frame;
    totalGelt += g.gelt;
    totalCoins += coinsSeen.size;
    totalChunks += g.spawner.chunks;
    poolMisses += g.ents.barriers.misses + g.ents.coins.misses;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`       ${totalChunks} chunks, button held ${Math.round((100 * heldFrames) / frames)}% of the time`);
  check(!worst, worst ? `bot was hit: seed ${worst.seed} at ${worst.metres}m` : `bot flew ${SEEDS} courses of ${TARGET_M}m with no hits (${secs}s)`);
  const share = totalGelt / Math.max(1, totalCoins);
  check(share > 0.6, `gelt is reachable: the bot collected ${totalGelt} of ${totalCoins} (${Math.round(share * 100)}%)`);
  check(poolMisses === 0, `entity pools never ran out (misses: ${poolMisses})`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exitCode = failures ? 1 : 0;
