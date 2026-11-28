import { clamp } from './math';
import type { RuneId } from './mechanics';
import {
  KeybindConfig,
  BindableAction,
  PadBindableAction,
  loadKeybinds,
  saveKeybinds,
  createDefaultKeybinds,
  rebindKeyboardAction,
  rebindGamepadAction,
} from './keybinds';

export type InputDevice = 'kbd' | 'pad' | 'touch';

export type TouchActionId =
  | 'attack'
  | 'jump'
  | 'roll'
  | 'shield'
  | 'aim'
  | 'lockOn'
  | 'interact'
  | 'rune'
  | 'heal'
  | 'surf'
  | 'sprint';

export interface InputSnapshot {
  moveX: number; // -1..1 (right positive)
  moveZ: number; // -1..1 (forward negative, backward positive)
  lookDeltaX: number; // radians delta this frame
  lookDeltaY: number; // radians delta this frame
  jumpPressed: boolean;
  jumpHeld: boolean;
  jumpJustReleased: boolean;
  sprintHeld: boolean;
  dodgePressed: boolean;
  attackPressed: boolean;
  attackHeld: boolean;
  attackReleased: boolean;
  aimHeld: boolean;
  aimReleased: boolean;
  shieldHeld: boolean;
  shieldPressed: boolean;
  lockOnPressed: boolean;
  interactPressed: boolean;
  runePressed: boolean;
  runeCycleDelta: number;
  runeSelect: RuneId | null;
  healPressed: boolean;
  surfPressed: boolean;
  timeCyclePressed: boolean;
  mapPressed: boolean;
  journalPressed: boolean;
  lampPressed: boolean;
  pausePressed: boolean;
  // Gamepad menu navigation edges (for Title, Pause, Controls & End screens)
  padMenuDir: 'up' | 'down' | 'left' | 'right' | null;
  padMenuConfirm: boolean;
  padMenuBack: boolean;
  padJustPressedButton: number | null;
  pointerLocked: boolean;
  activeDevice: InputDevice;
  gamepadConnected: boolean;
  gamepadName: string;
}

function applyDeadzone(x: number, y: number, deadzone = 0.16): [number, number] {
  const mag = Math.hypot(x, y);
  if (mag < deadzone) return [0, 0];
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  const curved = scaled * scaled * 0.45 + scaled * 0.55;
  return [(x / mag) * curved, (y / mag) * curved];
}

export class InputManager {
  private config: KeybindConfig = loadKeybinds();

  private readonly keys = new Set<string>();
  private readonly justPressedKeys = new Set<string>();
  private readonly justReleasedKeys = new Set<string>();
  private readonly mouseButtons = new Set<number>();
  private readonly justPressedMouse = new Set<number>();
  private readonly justReleasedMouse = new Set<number>();

  private mouseLookX = 0;
  private mouseLookY = 0;
  private wheelDelta = 0;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private hasLastMouse = false;

  private prevPadButtons: boolean[] = [];
  private padStickNavCooldown = 0;
  private activeDevice: InputDevice = 'kbd';
  private gamepadConnected = false;
  private gamepadName = '';

  // Input buffers for snappy BotW responsiveness (0.13s)
  private jumpBufferTimer = 0;
  private attackBufferTimer = 0;
  private dodgeBufferTimer = 0;
  private sprintTapTimer = 0;

  private canvas: HTMLCanvasElement | null = null;
  private pointerLockEnabled = false;
  private isPlayingGetter: () => boolean = () => false;

  // Virtual Mobile / Touch input state (multi-touch safe)
  private touchMoveX = 0;
  private touchMoveZ = 0;
  private touchSprint = false;
  private touchLookX = 0;
  private touchLookY = 0;
  private readonly touchHeld = new Set<TouchActionId>();
  private readonly touchJustPressed = new Set<TouchActionId>();
  private readonly touchJustReleased = new Set<TouchActionId>();
  private touchLookPointerId: number | null = null;
  private lastTouchLookX = 0;
  private lastTouchLookY = 0;
  private lastTouchTimestamp = 0;

  getKeybinds(): KeybindConfig {
    return this.config;
  }

  rebindKeyboard(action: BindableAction, code: string): KeybindConfig {
    this.config = rebindKeyboardAction(this.config, action, code);
    saveKeybinds(this.config);
    return this.config;
  }

  rebindGamepad(action: PadBindableAction, btnIndex: number): KeybindConfig {
    this.config = rebindGamepadAction(this.config, action, btnIndex);
    saveKeybinds(this.config);
    return this.config;
  }

  resetKeybinds(): KeybindConfig {
    this.config = createDefaultKeybinds();
    saveKeybinds(this.config);
    return this.config;
  }

  setTouchMove(x: number, z: number, sprint = false): void {
    const mag = Math.hypot(x, z);
    if (mag > 1) {
      this.touchMoveX = x / mag;
      this.touchMoveZ = z / mag;
    } else {
      this.touchMoveX = x;
      this.touchMoveZ = z;
    }
    this.touchSprint = sprint;
    if (mag > 0.04 || sprint) this.activeDevice = 'touch';
  }

  addTouchLook(dxPx: number, dyPx: number): void {
    if (Math.abs(dxPx) < 0.01 && Math.abs(dyPx) < 0.01) return;
    this.touchLookX += clamp(dxPx, -90, 90) * 0.0068;
    this.touchLookY += clamp(dyPx, -90, 90) * 0.0052;
    this.activeDevice = 'touch';
  }

  setTouchAction(action: TouchActionId, down: boolean): void {
    if (down) {
      if (!this.touchHeld.has(action)) {
        this.touchJustPressed.add(action);
        if (action === 'jump') this.jumpBufferTimer = 0.14;
        if (action === 'attack') this.attackBufferTimer = 0.14;
        if (action === 'roll') this.dodgeBufferTimer = 0.14;
      }
      this.touchHeld.add(action);
      this.activeDevice = 'touch';
    } else {
      if (this.touchHeld.has(action)) {
        this.touchJustReleased.add(action);
      }
      this.touchHeld.delete(action);
    }
  }

  triggerTouchTap(action: TouchActionId): void {
    this.touchJustPressed.add(action);
    if (action === 'jump') this.jumpBufferTimer = 0.14;
    if (action === 'attack') this.attackBufferTimer = 0.14;
    if (action === 'roll') this.dodgeBufferTimer = 0.14;
    this.activeDevice = 'touch';
  }

  private isCodeHeld(code: string): boolean {
    if (code.startsWith('Mouse')) {
      return this.mouseButtons.has(Number(code.slice(5)));
    }
    return this.keys.has(code);
  }

  private isCodeJustPressed(code: string): boolean {
    if (code.startsWith('Mouse')) {
      return this.justPressedMouse.has(Number(code.slice(5)));
    }
    return this.justPressedKeys.has(code);
  }

  private isCodeJustReleased(code: string): boolean {
    if (code.startsWith('Mouse')) {
      return this.justReleasedMouse.has(Number(code.slice(5)));
    }
    return this.justReleasedKeys.has(code);
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Tab' ||
      code === 'AltLeft'
    ) {
      if (this.isPlayingGetter()) e.preventDefault();
    }
    if (!this.keys.has(code)) {
      this.justPressedKeys.add(code);
      if (code === this.config.kbd.jump) this.jumpBufferTimer = 0.13;
      if (code === this.config.kbd.attack || code === 'KeyJ') this.attackBufferTimer = 0.13;
      if (code === this.config.kbd.roll || code === 'AltLeft') this.dodgeBufferTimer = 0.13;
      if (code === this.config.kbd.sprint || code === 'ShiftRight') {
        this.sprintTapTimer = 0.22;
      }
    }
    this.keys.add(code);
    this.activeDevice = 'kbd';
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    const code = e.code;
    this.keys.delete(code);
    this.justReleasedKeys.add(code);
    // Quick-tap on Sprint (Shift) also performs a Roll/Dodge for instant BotW/Souls muscle memory!
    if ((code === this.config.kbd.sprint || code === 'ShiftRight') && this.sprintTapTimer > 0) {
      this.dodgeBufferTimer = 0.14;
      this.sprintTapTimer = 0;
    }
  };

  private readonly onMouseDown = (e: MouseEvent) => {
    if (!this.isPlayingGetter()) return;
    if (e.target !== this.canvas) return;
    // Ignore compatibility mouse events synthesized by mobile browsers after touch drags/taps
    if (this.touchLookPointerId !== null || performance.now() - this.lastTouchTimestamp < 600) {
      return;
    }
    const mCode = `Mouse${e.button}`;
    if (!this.mouseButtons.has(e.button)) {
      this.justPressedMouse.add(e.button);
      if (mCode === this.config.kbd.attack) this.attackBufferTimer = 0.13;
      if (mCode === this.config.kbd.jump) this.jumpBufferTimer = 0.13;
      if (mCode === this.config.kbd.roll) this.dodgeBufferTimer = 0.13;
    }
    this.mouseButtons.add(e.button);
    this.activeDevice = 'kbd';
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.hasLastMouse = true;

    const isCoarseTouch =
      typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    if (
      !isCoarseTouch &&
      this.pointerLockEnabled &&
      this.canvas &&
      document.pointerLockElement !== this.canvas &&
      e.button === 0
    ) {
      try {
        const res = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch {
        // Fallback drag look remains active
      }
    }
  };

  private readonly onCanvasPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !this.isPlayingGetter()) return;
    if (e.target !== this.canvas) return;
    this.lastTouchTimestamp = performance.now();
    if (this.touchLookPointerId === null) {
      this.touchLookPointerId = e.pointerId;
      this.lastTouchLookX = e.clientX;
      this.lastTouchLookY = e.clientY;
      this.activeDevice = 'touch';
    }
  };

  private readonly onCanvasPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || e.pointerId !== this.touchLookPointerId) return;
    if (!this.isPlayingGetter()) {
      this.touchLookPointerId = null;
      return;
    }
    const dx = e.clientX - this.lastTouchLookX;
    const dy = e.clientY - this.lastTouchLookY;
    this.lastTouchLookX = e.clientX;
    this.lastTouchLookY = e.clientY;
    this.addTouchLook(dx, dy);
  };

  private readonly onCanvasPointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.touchLookPointerId) {
      this.touchLookPointerId = null;
    }
  };

  private readonly onMouseUp = (e: MouseEvent) => {
    if (this.mouseButtons.has(e.button)) {
      this.justReleasedMouse.add(e.button);
    }
    this.mouseButtons.delete(e.button);
  };

  private readonly onMouseMove = (e: MouseEvent) => {
    if (!this.isPlayingGetter()) return;
    const locked = this.canvas !== null && document.pointerLockElement === this.canvas;
    if (locked) {
      this.mouseLookX += e.movementX * 0.0024;
      this.mouseLookY += e.movementY * 0.0020;
      this.activeDevice = 'kbd';
    } else if (this.mouseButtons.has(2) || this.mouseButtons.has(1)) {
      if (this.hasLastMouse) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.mouseLookX += dx * 0.0045;
        this.mouseLookY += dy * 0.0038;
        this.activeDevice = 'kbd';
      }
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.hasLastMouse = true;
    }
  };

  private readonly onWheel = (e: WheelEvent) => {
    if (!this.isPlayingGetter()) return;
    if (Math.abs(e.deltaY) > 4) {
      this.wheelDelta += e.deltaY > 0 ? 1 : -1;
      this.activeDevice = 'kbd';
    }
  };

  private readonly onContextMenu = (e: MouseEvent) => {
    if (this.isPlayingGetter() && e.target === this.canvas) {
      e.preventDefault();
    }
  };

  private readonly onBlur = () => {
    this.clearHeld();
  };

  private readonly onVisibilityChange = () => {
    if (document.hidden) this.clearHeld();
  };

  private readonly onGamepadConnected = (e: GamepadEvent) => {
    this.gamepadConnected = true;
    this.gamepadName = e.gamepad.id || 'Game Controller';
    this.activeDevice = 'pad';
  };

  private readonly onGamepadDisconnected = () => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const active = Array.from(pads).find(Boolean);
    this.gamepadConnected = Boolean(active);
    this.gamepadName = active?.id ?? '';
  };

  attach(canvas: HTMLCanvasElement, isPlayingGetter: () => boolean): void {
    this.canvas = canvas;
    this.isPlayingGetter = isPlayingGetter;
    this.pointerLockEnabled = true;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    window.addEventListener('pointermove', this.onCanvasPointerMove);
    window.addEventListener('pointerup', this.onCanvasPointerUp);
    window.addEventListener('pointercancel', this.onCanvasPointerUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    this.canvas?.removeEventListener('pointerdown', this.onCanvasPointerDown);
    window.removeEventListener('pointermove', this.onCanvasPointerMove);
    window.removeEventListener('pointerup', this.onCanvasPointerUp);
    window.removeEventListener('pointercancel', this.onCanvasPointerUp);
    this.exitPointerLock();
  }

  clearHeld(): void {
    this.keys.clear();
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
    this.mouseButtons.clear();
    this.justPressedMouse.clear();
    this.justReleasedMouse.clear();
    this.touchHeld.clear();
    this.touchJustPressed.clear();
    this.touchJustReleased.clear();
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.touchSprint = false;
    this.touchLookX = 0;
    this.touchLookY = 0;
    this.touchLookPointerId = null;
    this.mouseLookX = 0;
    this.mouseLookY = 0;
    this.wheelDelta = 0;
    this.jumpBufferTimer = 0;
    this.attackBufferTimer = 0;
    this.dodgeBufferTimer = 0;
    this.sprintTapTimer = 0;
  }

  exitPointerLock(): void {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // Ignore
      }
    }
  }

  consumeJumpBuffer(): void {
    this.jumpBufferTimer = 0;
  }

  consumeAttackBuffer(): void {
    this.attackBufferTimer = 0;
  }

  consumeDodgeBuffer(): void {
    this.dodgeBufferTimer = 0;
  }

  rumble(intensity = 0.4, durationMs = 110): void {
    if (this.activeDevice === 'touch') {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(Math.round(clamp(durationMs * 0.25, 10, 32)));
        }
      } catch {
        // Ignore browsers without vibration support
      }
      return;
    }
    if (this.activeDevice !== 'pad') return;
    try {
      const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i] as (Gamepad & {
          vibrationActuator?: {
            playEffect?: (type: string, opts: { duration: number; strongMagnitude: number; weakMagnitude: number }) => Promise<void>;
          };
        }) | null;
        if (p && p.connected && p.vibrationActuator?.playEffect) {
          const mag = clamp(intensity, 0.05, 1);
          p.vibrationActuator
            .playEffect('dual-rumble', {
              duration: durationMs,
              strongMagnitude: mag,
              weakMagnitude: mag * 0.7,
            })
            .catch(() => {});
          break;
        }
      }
    } catch {
      // Ignore browsers without vibrationActuator
    }
  }

  poll(dt: number): InputSnapshot {
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    this.attackBufferTimer = Math.max(0, this.attackBufferTimer - dt);
    this.dodgeBufferTimer = Math.max(0, this.dodgeBufferTimer - dt);
    this.sprintTapTimer = Math.max(0, this.sprintTapTimer - dt);
    this.padStickNavCooldown = Math.max(0, this.padStickNavCooldown - dt);

    const k = this.config.kbd;
    const p = this.config.pad;

    // Keyboard movement (custom bindings + Arrow keys backup)
    let moveX = 0;
    let moveZ = 0;
    if (this.isCodeHeld(k.moveLeft) || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.isCodeHeld(k.moveRight) || this.keys.has('ArrowRight')) moveX += 1;
    if (this.isCodeHeld(k.moveForward) || this.keys.has('ArrowUp')) moveZ -= 1;
    if (this.isCodeHeld(k.moveBack) || this.keys.has('ArrowDown')) moveZ += 1;
    const kLen = Math.hypot(moveX, moveZ);
    if (kLen > 1) {
      moveX /= kLen;
      moveZ /= kLen;
    }

    // Keyboard fallback camera orbit (Q / E-free: BracketLeft/BracketRight or Q/X when unbound)
    let lookDeltaX = this.mouseLookX;
    let lookDeltaY = this.mouseLookY;
    if (this.keys.has('BracketLeft') || (this.keys.has('KeyQ') && !Object.values(k).includes('KeyQ'))) {
      lookDeltaX -= 2.2 * dt;
    }
    if (this.keys.has('BracketRight')) {
      lookDeltaX += 2.2 * dt;
    }

    let jumpPressed = this.isCodeJustPressed(k.jump) || this.jumpBufferTimer > 0;
    let jumpHeld = this.isCodeHeld(k.jump);
    let jumpJustReleased = this.isCodeJustReleased(k.jump);

    let sprintHeld = this.isCodeHeld(k.sprint) || this.keys.has('ShiftRight');
    let dodgePressed =
      this.isCodeJustPressed(k.roll) ||
      (!Object.values(k).includes('AltLeft') && this.justPressedKeys.has('AltLeft')) ||
      this.dodgeBufferTimer > 0;

    let attackPressed =
      this.isCodeJustPressed(k.attack) ||
      (!Object.values(k).includes('KeyJ') && this.justPressedKeys.has('KeyJ')) ||
      this.attackBufferTimer > 0;
    let attackHeld =
      this.isCodeHeld(k.attack) || (!Object.values(k).includes('KeyJ') && this.keys.has('KeyJ'));
    let attackReleased =
      this.isCodeJustReleased(k.attack) ||
      (!Object.values(k).includes('KeyJ') && this.justReleasedKeys.has('KeyJ'));

    let aimHeld =
      this.isCodeHeld(k.aim) || (!Object.values(k).includes('KeyB') && this.keys.has('KeyB'));
    let aimReleased =
      this.isCodeJustReleased(k.aim) ||
      (!Object.values(k).includes('KeyB') && this.justReleasedKeys.has('KeyB'));

    let shieldHeld =
      this.isCodeHeld(k.shield) ||
      this.keys.has('ControlRight') ||
      (!Object.values(k).includes('KeyK') && this.keys.has('KeyK'));
    let shieldPressed =
      this.isCodeJustPressed(k.shield) ||
      this.justPressedKeys.has('ControlRight') ||
      (!Object.values(k).includes('KeyK') && this.justPressedKeys.has('KeyK'));

    let lockOnPressed =
      this.isCodeJustPressed(k.lockOn) ||
      (!Object.values(k).includes('KeyL') && this.justPressedKeys.has('KeyL')) ||
      (!Object.values(k).includes('Mouse1') && this.justPressedMouse.has(1));

    let interactPressed = this.isCodeJustPressed(k.interact);
    let runePressed =
      this.isCodeJustPressed(k.runeCast) ||
      (!Object.values(k).includes('KeyR') && this.justPressedKeys.has('KeyR'));
    let runeCycleDelta = this.wheelDelta;
    let runeSelect: RuneId | null = null;
    if (this.justPressedKeys.has('Digit1')) runeSelect = 'bomb';
    else if (this.justPressedKeys.has('Digit2')) runeSelect = 'stasis';
    else if (this.justPressedKeys.has('Digit3')) runeSelect = 'gale';
    else if (this.justPressedKeys.has('Digit4')) runeSelect = 'cryonis';

    let healPressed = this.isCodeJustPressed(k.heal);
    let surfPressed = this.isCodeJustPressed(k.shieldSurf);
    let timeCyclePressed = this.isCodeJustPressed(k.timeCycle);
    let mapPressed = this.isCodeJustPressed(k.worldMap);
    let journalPressed = this.isCodeJustPressed(k.journal);
    let lampPressed = this.isCodeJustPressed(k.dawnLamp);
    let pausePressed =
      this.isCodeJustPressed(k.pause) ||
      this.justPressedKeys.has('Escape') ||
      (!Object.values(k).includes('KeyP') && this.justPressedKeys.has('KeyP'));

    let padMenuDir: 'up' | 'down' | 'left' | 'right' | null = null;
    let padMenuConfirm = false;
    let padMenuBack = false;
    let padJustPressedButton: number | null = null;

    // Merge Mobile Virtual Touch Stick, Touch-Drag Look, and Touch Action Buttons
    if (Math.abs(this.touchMoveX) > 0.01 || Math.abs(this.touchMoveZ) > 0.01) {
      moveX = clamp(moveX + this.touchMoveX, -1, 1);
      moveZ = clamp(moveZ + this.touchMoveZ, -1, 1);
    }
    lookDeltaX += this.touchLookX;
    lookDeltaY += this.touchLookY;

    if (this.touchSprint || this.touchHeld.has('sprint')) sprintHeld = true;
    if (this.touchJustPressed.has('jump')) jumpPressed = true;
    if (this.touchHeld.has('jump')) jumpHeld = true;
    if (this.touchJustReleased.has('jump')) jumpJustReleased = true;
    if (this.touchJustPressed.has('roll')) dodgePressed = true;
    if (this.touchJustPressed.has('attack')) attackPressed = true;
    if (this.touchHeld.has('attack')) attackHeld = true;
    if (this.touchJustReleased.has('attack')) attackReleased = true;
    if (this.touchHeld.has('aim')) aimHeld = true;
    if (this.touchJustReleased.has('aim')) aimReleased = true;
    if (this.touchHeld.has('shield')) shieldHeld = true;
    if (this.touchJustPressed.has('shield')) shieldPressed = true;
    if (this.touchJustPressed.has('lockOn')) lockOnPressed = true;
    if (this.touchJustPressed.has('interact')) interactPressed = true;
    if (this.touchJustPressed.has('rune')) runePressed = true;
    if (this.touchJustPressed.has('heal')) healPressed = true;
    if (this.touchJustPressed.has('surf')) surfPressed = true;

    // Poll standard Gamepad API
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let activePad: Gamepad | null = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i]!.connected) {
        activePad = pads[i];
        break;
      }
    }

    this.gamepadConnected = Boolean(activePad);
    if (activePad) {
      this.gamepadName = activePad.id || 'Game Controller';
      const [lx, ly] = applyDeadzone(activePad.axes[0] ?? 0, activePad.axes[1] ?? 0);
      const [rx, ry] = applyDeadzone(activePad.axes[2] ?? 0, activePad.axes[3] ?? 0);

      if (Math.abs(lx) > 0.01 || Math.abs(ly) > 0.01) {
        moveX = clamp(moveX + lx, -1, 1);
        moveZ = clamp(moveZ + ly, -1, 1);
        this.activeDevice = 'pad';
      }
      if (Math.abs(rx) > 0.01 || Math.abs(ry) > 0.01) {
        lookDeltaX += rx * 2.8 * dt;
        lookDeltaY += ry * 2.1 * dt;
        this.activeDevice = 'pad';
      }

      const btnDown = (idx: number) => {
        const b = activePad!.buttons[idx];
        return Boolean(b && (b.pressed || b.value > 0.35));
      };
      const btnJustPressed = (idx: number) => btnDown(idx) && !this.prevPadButtons[idx];
      const btnJustReleased = (idx: number) => !btnDown(idx) && Boolean(this.prevPadButtons[idx]);

      for (let i = 0; i < Math.min(18, activePad.buttons.length); i++) {
        if (btnJustPressed(i)) {
          this.activeDevice = 'pad';
          if (padJustPressedButton === null) padJustPressedButton = i;
        }
      }

      // Gamepad menu navigation (D-Pad + Left Stick repeat)
      if (btnJustPressed(12)) padMenuDir = 'up';
      else if (btnJustPressed(13)) padMenuDir = 'down';
      else if (btnJustPressed(14)) padMenuDir = 'left';
      else if (btnJustPressed(15)) padMenuDir = 'right';
      else if (this.padStickNavCooldown <= 0) {
        if (ly < -0.6) {
          padMenuDir = 'up';
          this.padStickNavCooldown = 0.22;
        } else if (ly > 0.6) {
          padMenuDir = 'down';
          this.padStickNavCooldown = 0.22;
        } else if (lx < -0.6) {
          padMenuDir = 'left';
          this.padStickNavCooldown = 0.22;
        } else if (lx > 0.6) {
          padMenuDir = 'right';
          this.padStickNavCooldown = 0.22;
        }
      }
      if (btnJustPressed(0)) padMenuConfirm = true;
      if (btnJustPressed(1)) padMenuBack = true;

      // Custom gamepad gameplay bindings
      if (btnJustPressed(p.jump)) {
        jumpPressed = true;
        this.jumpBufferTimer = 0.13;
      }
      if (btnDown(p.jump)) jumpHeld = true;
      if (btnJustReleased(p.jump)) jumpJustReleased = true;

      if (btnDown(p.sprint)) sprintHeld = true;
      if (btnJustPressed(p.roll)) {
        dodgePressed = true;
        this.dodgeBufferTimer = 0.13;
      }

      if (btnJustPressed(p.attack)) {
        attackPressed = true;
        this.attackBufferTimer = 0.13;
      }
      if (btnDown(p.attack)) attackHeld = true;
      if (btnJustReleased(p.attack)) attackReleased = true;

      if (btnJustPressed(p.interact)) interactPressed = true;
      if (btnJustPressed(4)) runeCycleDelta -= 1; // LB always cycles runes
      if (btnJustPressed(p.runeCast)) runePressed = true;

      if (btnDown(p.shield)) shieldHeld = true;
      if (btnJustPressed(p.shield)) shieldPressed = true;
      if (btnJustPressed(p.lockOn)) lockOnPressed = true;

      if (btnDown(p.aim)) aimHeld = true;
      if (btnJustReleased(p.aim)) aimReleased = true;

      if (btnJustPressed(p.shieldSurf)) surfPressed = true;
      if (btnJustPressed(p.worldMap)) mapPressed = true;
      if (btnJustPressed(p.pause)) pausePressed = true;
      if (btnJustPressed(p.heal)) healPressed = true;
      if (btnJustPressed(p.timeCycle)) timeCyclePressed = true;
      if (btnJustPressed(p.journal)) journalPressed = true;
      if (btnJustPressed(p.dawnLamp)) lampPressed = true;

      const nextPrev: boolean[] = [];
      for (let i = 0; i < Math.min(18, activePad.buttons.length); i++) {
        nextPrev[i] = btnDown(i);
      }
      this.prevPadButtons = nextPrev;
    } else {
      this.prevPadButtons = [];
    }

    // Reset per-frame edges & deltas
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
    this.justPressedMouse.clear();
    this.justReleasedMouse.clear();
    this.touchJustPressed.clear();
    this.touchJustReleased.clear();
    this.touchLookX = 0;
    this.touchLookY = 0;
    this.mouseLookX = 0;
    this.mouseLookY = 0;
    this.wheelDelta = 0;

    return {
      moveX,
      moveZ,
      lookDeltaX,
      lookDeltaY,
      jumpPressed,
      jumpHeld,
      jumpJustReleased,
      sprintHeld,
      dodgePressed,
      attackPressed,
      attackHeld,
      attackReleased,
      aimHeld,
      aimReleased,
      shieldHeld,
      shieldPressed,
      lockOnPressed,
      interactPressed,
      runePressed,
      runeCycleDelta,
      runeSelect,
      healPressed,
      surfPressed,
      timeCyclePressed,
      mapPressed,
      journalPressed,
      lampPressed,
      pausePressed,
      padMenuDir,
      padMenuConfirm,
      padMenuBack,
      padJustPressedButton,
      pointerLocked:
        typeof document !== 'undefined' && this.canvas !== null && document.pointerLockElement === this.canvas,
      activeDevice: this.activeDevice,
      gamepadConnected: this.gamepadConnected,
      gamepadName: this.gamepadName,
    };
  }
}
