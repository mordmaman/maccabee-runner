// One button: touch anywhere, mouse, or Space.
// The game reads `held` (is the button down?) and `pressed` (new presses
// since the last update). Nothing here is needed by the headless test.

export function createInput() {
  return { held: false, pressed: 0, pointers: new Set(), key: false };
}

function syncHeld(input) {
  input.held = input.pointers.size > 0 || input.key;
}

export function releaseInput(input) {
  input.pointers.clear();
  input.key = false;
  syncHeld(input);
}

export function attachInput(input, target) {
  target.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.pointers.add(e.pointerId);
    input.pressed++;
    syncHeld(input);
  }, { passive: false });

  const up = (e) => {
    input.pointers.delete(e.pointerId);
    syncHeld(input);
  };
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);

  target.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (!e.repeat && !input.key) input.pressed++;
    input.key = true;
    syncHeld(input);
  });
  target.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    input.key = false;
    syncHeld(input);
  });

  // Stop long-press menus, double-tap zoom and page scrolling.
  target.addEventListener('contextmenu', (e) => e.preventDefault());
  target.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  target.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}
