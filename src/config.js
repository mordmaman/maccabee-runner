// Maccabee Runner — every tunable number lives in CONFIG.
// Units: logical pixels (the screen is 640x360) and seconds.
// Tip for tuning in a desktop browser: open the console and change MR.CONFIG
// values while playing; the game reads them every frame.

export const CONFIG = {
  build: 'phase-1',

  view: { w: 640, h: 360 },

  display: {
    integerScale: true,     // whole-number scaling for a crisp pixel look
    // On high-density phone screens a whole-number scale can leave the game
    // small (e.g. with the browser address bar showing). If the integer fit
    // fills less than this share of the space, use a fractional fit instead;
    // at 2x+ density the uneven pixels are invisible. Set to 0 to always
    // use whole numbers.
    hiDpiMinFill: 0.85,
  },

  world: {
    ceiling: 22,            // top of the flying band (y)
    floor: 316,             // ground line where the Maccabee runs (y)
    pxPerMetre: 10,         // score: 10 px of scrolling = 1 metre
  },

  player: {
    screenX: 128,           // fixed position across the screen
    w: 18,
    h: 28,
    hitInset: 3,            // hitbox is this much smaller on every side (forgiving)
    gravity: 1550,          // px/s² pulling down when not holding
    thrust: 3000,           // px/s² pushing up while holding (net lift = thrust - gravity)
    turnBoost: 1.35,        // extra push when changing direction; makes it feel snappy
    maxRise: 340,           // px/s
    maxFall: 560,           // px/s
    runStride: 24,          // px of ground per leg swap when running
  },

  speed: {
    start: 220,             // px/s scroll at the start of a run
    ramp: 3,                // px/s added every second
    max: 380,               // cap for this stage
    titleScroll: 60,        // background drift on the title screen
  },

  // Difficulty sets hits per run. The picker arrives in Phase 2.
  difficulty: 'normal',
  difficulties: {
    easy:   { hits: 3 },
    normal: { hits: 2 },
    hard:   { hits: 1 },
  },
  invincibleTime: 1.4,      // seconds of flashing after a hit
  flashHz: 12,

  spawn: {
    firstAt: 900,           // px of open ground before the first obstacle
    lookahead: 240,         // build chunks this far beyond the right edge
    despawnMargin: 120,     // remove things this far off the left edge
    gapTime: [0.85, 1.35],  // seconds of open air between chunks (scaled by speed)
    slalomGapTime: 1.0,     // seconds between the barriers of a slalom
    introMetres: 150,       // only single barriers before this distance
    weights: { single: 6, slalom: 2.5, corridor: 1.5 },
    coinChance: 0.75,       // chance of a gelt shape in each gap
  },

  barrier: {
    thickness: 6,           // drawn beam width
    post: 10,               // drawn post size at each end
    hitRadius: 4,           // collision half-width of the beam
    length: [80, 150],      // single barriers
    floatClear: 40,         // min space above and below a floating upright barrier
    slalomLength: [140, 175],
    corridorLength: [150, 220],
    corridorGap: 120,       // space between the two beams of a corridor
  },

  gelt: {
    size: 8,
    pickupRadius: 14,       // generous on purpose
    spacing: 18,
    clearance: 10,          // keep coins this far from beams
    maxSlope: 0.75,         // steepest coin curve (px up per px across)
  },

  pools: { barriers: 24, coins: 256 },

  shake: { hit: 5, death: 8, time: 0.3 },
  deathPop: 260,            // upward bonk on the final hit (px/s)
  deathTime: 0.9,           // tumble before the results panel
  restartDelay: 0.3,        // ignore taps this long after the panel appears
};
