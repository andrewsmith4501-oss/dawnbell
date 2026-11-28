export type BindableAction =
  | 'moveForward'
  | 'moveBack'
  | 'moveLeft'
  | 'moveRight'
  | 'jump'
  | 'roll'
  | 'sprint'
  | 'shieldSurf'
  | 'attack'
  | 'aim'
  | 'shield'
  | 'lockOn'
  | 'interact'
  | 'runeCast'
  | 'heal'
  | 'worldMap'
  | 'journal'
  | 'dawnLamp'
  | 'timeCycle'
  | 'pause';

export type PadBindableAction = Exclude<
  BindableAction,
  'moveForward' | 'moveBack' | 'moveLeft' | 'moveRight'
>;

export interface ActionDefinition {
  action: BindableAction;
  label: string;
  category: 'Movement' | 'Combat' | 'Runes & Exploration';
  padBindable: boolean;
}

export const ACTION_DEFINITIONS: ActionDefinition[] = [
  { action: 'moveForward', label: 'Move Forward', category: 'Movement', padBindable: false },
  { action: 'moveBack', label: 'Move Backward', category: 'Movement', padBindable: false },
  { action: 'moveLeft', label: 'Move Left', category: 'Movement', padBindable: false },
  { action: 'moveRight', label: 'Move Right', category: 'Movement', padBindable: false },
  { action: 'jump', label: 'Jump / Paraglide', category: 'Movement', padBindable: true },
  { action: 'roll', label: 'Roll / Dodge (Flurry)', category: 'Movement', padBindable: true },
  { action: 'sprint', label: 'Sprint', category: 'Movement', padBindable: true },
  { action: 'shieldSurf', label: 'Shield Surf', category: 'Movement', padBindable: true },
  { action: 'attack', label: 'Sword Attack / Spin', category: 'Combat', padBindable: true },
  { action: 'aim', label: 'Bow Aim / Bullet-Time', category: 'Combat', padBindable: true },
  { action: 'shield', label: 'Shield / Perfect Parry', category: 'Combat', padBindable: true },
  { action: 'lockOn', label: 'Z-Target / Recenter', category: 'Combat', padBindable: true },
  { action: 'interact', label: 'Interact / Talk / Mine', category: 'Runes & Exploration', padBindable: true },
  { action: 'runeCast', label: 'Cast Active Rune', category: 'Runes & Exploration', padBindable: true },
  { action: 'heal', label: 'Quick Heal (Meal/Apple)', category: 'Runes & Exploration', padBindable: true },
  { action: 'worldMap', label: 'World Map & Lodestones', category: 'Runes & Exploration', padBindable: true },
  { action: 'journal', label: 'Quest Journal', category: 'Runes & Exploration', padBindable: true },
  { action: 'dawnLamp', label: 'Dawn Lamp (Ch. III)', category: 'Runes & Exploration', padBindable: true },
  { action: 'timeCycle', label: 'Cycle Time of Day', category: 'Runes & Exploration', padBindable: true },
  { action: 'pause', label: 'Pause Menu', category: 'Runes & Exploration', padBindable: true },
];

export type KeyboardBindings = Record<BindableAction, string>;
export type GamepadBindings = Record<PadBindableAction, number>;

export interface KeybindConfig {
  kbd: KeyboardBindings;
  pad: GamepadBindings;
}

export const KEYBINDS_STORAGE_KEY = 'dawnbell_keybinds_v1';

export const DEFAULT_KEYBOARD_BINDINGS: KeyboardBindings = {
  moveForward: 'KeyW',
  moveBack: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  roll: 'KeyC',
  sprint: 'ShiftLeft',
  shieldSurf: 'KeyV',
  attack: 'Mouse0',
  aim: 'Mouse2',
  shield: 'ControlLeft',
  lockOn: 'Tab',
  interact: 'KeyE',
  runeCast: 'KeyF',
  heal: 'KeyH',
  worldMap: 'KeyM',
  journal: 'KeyI',
  dawnLamp: 'KeyG',
  timeCycle: 'KeyT',
  pause: 'Escape',
};

export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  jump: 0, // A / Cross
  roll: 1, // B / Circle
  sprint: 1, // B / Circle (hold)
  shieldSurf: 11, // R3 (plus LT+A)
  attack: 2, // X / Square
  interact: 3, // Y / Triangle
  runeCast: 5, // RB / R1
  lockOn: 6, // LT / L2
  shield: 6, // LT / L2
  aim: 7, // RT / R2
  worldMap: 8, // Back / View
  pause: 9, // Start / Options
  heal: 12, // D-Pad Up
  timeCycle: 13, // D-Pad Down
  journal: 14, // D-Pad Left
  dawnLamp: 15, // D-Pad Right
};

export function createDefaultKeybinds(): KeybindConfig {
  return {
    kbd: { ...DEFAULT_KEYBOARD_BINDINGS },
    pad: { ...DEFAULT_GAMEPAD_BINDINGS },
  };
}

export function loadKeybinds(): KeybindConfig {
  const def = createDefaultKeybinds();
  try {
    if (typeof localStorage === 'undefined') return def;
    const raw = localStorage.getItem(KEYBINDS_STORAGE_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw) as Partial<KeybindConfig>;
    if (parsed.kbd && typeof parsed.kbd === 'object') {
      for (const k of Object.keys(def.kbd) as BindableAction[]) {
        const v = parsed.kbd[k];
        if (typeof v === 'string' && v.length > 0) {
          def.kbd[k] = v;
        }
      }
    }
    if (parsed.pad && typeof parsed.pad === 'object') {
      for (const k of Object.keys(def.pad) as PadBindableAction[]) {
        const v = parsed.pad[k];
        if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 16) {
          def.pad[k] = v;
        }
      }
    }
    return def;
  } catch {
    return def;
  }
}

export function saveKeybinds(cfg: KeybindConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(cfg));
    }
  } catch {
    // Ignore private-mode storage errors
  }
}

export function rebindKeyboardAction(
  cfg: KeybindConfig,
  action: BindableAction,
  newCode: string
): KeybindConfig {
  const nextKbd: KeyboardBindings = { ...cfg.kbd };
  const prevCode = nextKbd[action];
  if (prevCode === newCode) return cfg;

  // Swap if another action already uses this key/mouse code
  for (const k of Object.keys(nextKbd) as BindableAction[]) {
    if (k !== action && nextKbd[k] === newCode) {
      nextKbd[k] = prevCode;
      break;
    }
  }
  nextKbd[action] = newCode;
  return { kbd: nextKbd, pad: { ...cfg.pad } };
}

function isIntentionalPadPair(a: PadBindableAction, b: PadBindableAction): boolean {
  return (
    (a === 'roll' && b === 'sprint') ||
    (a === 'sprint' && b === 'roll') ||
    (a === 'shield' && b === 'lockOn') ||
    (a === 'lockOn' && b === 'shield')
  );
}

export function rebindGamepadAction(
  cfg: KeybindConfig,
  action: PadBindableAction,
  buttonIndex: number
): KeybindConfig {
  const nextPad: GamepadBindings = { ...cfg.pad };
  const prevBtn = nextPad[action];
  if (prevBtn === buttonIndex) return cfg;

  for (const k of Object.keys(nextPad) as PadBindableAction[]) {
    if (k !== action && !isIntentionalPadPair(action, k) && nextPad[k] === buttonIndex) {
      nextPad[k] = prevBtn;
      break;
    }
  }
  nextPad[action] = buttonIndex;
  return { kbd: { ...cfg.kbd }, pad: nextPad };
}

export function formatKeyCode(code: string): string {
  if (!code) return '—';
  if (code === 'Mouse0') return 'LMB';
  if (code === 'Mouse1') return 'MMB';
  if (code === 'Mouse2') return 'RMB';
  if (code.startsWith('Mouse')) return `M${Number(code.slice(5)) + 1}`;
  if (code === 'Space') return 'Space';
  if (code === 'Escape') return 'Esc';
  if (code === 'Tab') return 'Tab';
  if (code === 'ShiftLeft') return 'L-Shift';
  if (code === 'ShiftRight') return 'R-Shift';
  if (code === 'ControlLeft') return 'L-Ctrl';
  if (code === 'ControlRight') return 'R-Ctrl';
  if (code === 'AltLeft') return 'L-Alt';
  if (code === 'AltRight') return 'R-Alt';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'Enter') return 'Enter';
  if (code === 'Backspace') return 'Bksp';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

const PAD_LABELS: Record<number, string> = {
  0: 'A / ✕',
  1: 'B / ○',
  2: 'X / □',
  3: 'Y / △',
  4: 'LB',
  5: 'RB',
  6: 'LT',
  7: 'RT',
  8: 'View',
  9: 'Start',
  10: 'L3',
  11: 'R3',
  12: 'D-Up',
  13: 'D-Down',
  14: 'D-Left',
  15: 'D-Right',
  16: 'Home',
};

export function formatPadButton(index: number): string {
  return PAD_LABELS[index] ?? `Btn ${index}`;
}
