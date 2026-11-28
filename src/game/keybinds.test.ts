import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultKeybinds,
  rebindKeyboardAction,
  rebindGamepadAction,
  formatKeyCode,
  formatPadButton,
} from './keybinds';

test('default keybinds assign dedicated Roll key and clean BotW defaults', () => {
  const cfg = createDefaultKeybinds();
  assert.equal(cfg.kbd.roll, 'KeyC');
  assert.equal(cfg.kbd.sprint, 'ShiftLeft');
  assert.equal(cfg.kbd.attack, 'Mouse0');
  assert.equal(cfg.kbd.aim, 'Mouse2');
  assert.equal(cfg.pad.roll, 1);
  assert.equal(cfg.pad.jump, 0);
});

test('rebindKeyboardAction swaps conflicting keys cleanly without duplicates', () => {
  let cfg = createDefaultKeybinds();
  // Bind roll to KeyE (which is currently interact) -> interact should receive roll's previous KeyC
  cfg = rebindKeyboardAction(cfg, 'roll', 'KeyE');
  assert.equal(cfg.kbd.roll, 'KeyE');
  assert.equal(cfg.kbd.interact, 'KeyC');

  // Bind roll to an unbound key KeyQ -> no other action changes
  const beforeJump = cfg.kbd.jump;
  cfg = rebindKeyboardAction(cfg, 'roll', 'KeyQ');
  assert.equal(cfg.kbd.roll, 'KeyQ');
  assert.equal(cfg.kbd.jump, beforeJump);
});

test('rebindGamepadAction swaps non-paired buttons and preserves intentional BotW pairs', () => {
  let cfg = createDefaultKeybinds();
  // Rebind attack (2) to button 3 (interact) -> interact gets 2
  cfg = rebindGamepadAction(cfg, 'attack', 3);
  assert.equal(cfg.pad.attack, 3);
  assert.equal(cfg.pad.interact, 2);

  // Rebind roll (1) to L3 (10) -> sprint stays 1 without conflict
  cfg = rebindGamepadAction(cfg, 'roll', 10);
  assert.equal(cfg.pad.roll, 10);
  assert.equal(cfg.pad.sprint, 1);
});

test('formatKeyCode and formatPadButton return readable HUD labels', () => {
  assert.equal(formatKeyCode('Mouse0'), 'LMB');
  assert.equal(formatKeyCode('Mouse2'), 'RMB');
  assert.equal(formatKeyCode('KeyC'), 'C');
  assert.equal(formatKeyCode('ShiftLeft'), 'L-Shift');
  assert.equal(formatKeyCode('ControlLeft'), 'L-Ctrl');
  assert.equal(formatKeyCode('Space'), 'Space');
  assert.equal(formatPadButton(0), 'A / ✕');
  assert.equal(formatPadButton(1), 'B / ○');
  assert.equal(formatPadButton(5), 'RB');
});
