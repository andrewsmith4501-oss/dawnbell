import test from 'node:test';
import assert from 'node:assert/strict';
import { InputManager } from './input';

test('touch virtual stick steers 360° movement, clamps magnitude, and triggers auto-sprint', () => {
  const input = new InputManager();
  input.setTouchMove(0.9, -0.9, true);
  const snap = input.poll(0.016);
  assert.equal(snap.activeDevice, 'touch');
  assert.ok(Math.hypot(snap.moveX, snap.moveZ) <= 1.001);
  assert.ok(snap.moveX > 0.65 && snap.moveZ < -0.65);
  assert.equal(snap.sprintHeld, true);

  input.setTouchMove(0, 0, false);
  const stopSnap = input.poll(0.016);
  assert.equal(stopSnap.moveX, 0);
  assert.equal(stopSnap.moveZ, 0);
  assert.equal(stopSnap.sprintHeld, false);
});

test('touch drag look accumulates camera deltas for one frame and resets cleanly', () => {
  const input = new InputManager();
  input.addTouchLook(40, -25);
  const frame1 = input.poll(0.016);
  assert.ok(frame1.lookDeltaX > 0.2);
  assert.ok(frame1.lookDeltaY < -0.1);
  assert.equal(frame1.activeDevice, 'touch');

  const frame2 = input.poll(0.016);
  assert.equal(frame2.lookDeltaX, 0);
  assert.equal(frame2.lookDeltaY, 0);
});

test('touch action buttons support hold, edge press, release, and one-shot interact taps', () => {
  const input = new InputManager();
  input.setTouchAction('aim', true);
  input.setTouchAction('roll', true);
  input.triggerTouchTap('interact');

  const s1 = input.poll(0.016);
  assert.equal(s1.aimHeld, true);
  assert.equal(s1.aimReleased, false);
  assert.equal(s1.dodgePressed, true);
  assert.equal(s1.interactPressed, true);

  input.consumeDodgeBuffer();
  input.setTouchAction('roll', false);
  input.setTouchAction('aim', false);

  const s2 = input.poll(0.016);
  assert.equal(s2.aimHeld, false);
  assert.equal(s2.aimReleased, true);
  assert.equal(s2.dodgePressed, false);
  assert.equal(s2.interactPressed, false);
});
