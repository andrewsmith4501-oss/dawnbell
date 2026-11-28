import { getTerrainHeight, getBiomeAt, getRoadFactor, WATER_Y, WORLD_PLAY_RADIUS, LANDMARKS } from '../game/math';
import { CHAPTERS, SIDE_QUEST_LIST, type ChapterId } from '../game/story';
import { PUZZLE_LIST, isPuzzleSolved } from '../game/puzzles';
import type { HudSnapshot, PadMenuEvent } from '../game/engine';
import type { RuneId } from '../game/mechanics';
import type { TouchActionId } from '../game/input';
import {
  ACTION_DEFINITIONS,
  createDefaultKeybinds,
  formatKeyCode,
  formatPadButton,
  type BindableAction,
  type PadBindableAction,
  type KeybindConfig,
} from '../game/keybinds';

export interface HudActions {
  onNewGame: (ch?: number) => void;
  onContinue: () => void;
  onResume: () => void;
  onPause: () => void;
  onReturnTitle: () => void;
  onToggleMute: () => void;
  onToggleMap: () => void;
  onToggleJournal: () => void;
  onSelectMapTab: (tab: 'map' | 'journal') => void;
  onToggleLamp: () => void;
  onCycleTime: () => void;
  onCycleGraphics: () => string;
  getGraphicsLabel: () => string;
  onFastTravel: (landmarkId: string) => void;
  onSelectRune: (id: RuneId) => void;
  onDismissDialogue: () => void;
  onPickChoice: (index: number) => void;
  hasSave: () => boolean;
  getKeybinds: () => KeybindConfig;
  onRebindKey: (action: BindableAction, code: string) => KeybindConfig;
  onRebindPad: (action: PadBindableAction, btnIndex: number) => KeybindConfig;
  onResetKeybinds: () => KeybindConfig;
  onTouchMove: (x: number, z: number, sprint: boolean) => void;
  onTouchLook: (dxPx: number, dyPx: number) => void;
  onTouchAction: (action: TouchActionId, down: boolean) => void;
  onTouchTap: (action: TouchActionId) => void;
}

const HEART_SVG = (state: 'full' | 'half' | 'empty') => `
<svg class="heart-svg" viewBox="0 0 24 22" width="24" height="22" aria-hidden="true">
  <path d="M12 20.2L10.3 18.6C4.4 13.3 1 10.2 1 6.4C1 3.3 3.4 1 6.5 1C8.3 1 10 1.9 11.1 3.2L12 4.3L12.9 3.2C14 1.9 15.7 1 17.5 1C20.6 1 23 3.3 23 6.4C23 10.2 19.6 13.3 13.7 18.6L12 20.2Z"
    fill="${state === 'empty' ? 'rgba(22,18,14,0.72)' : '#e64245'}"
    stroke="#19130f" stroke-width="2.2" stroke-linejoin="round"/>
  ${
    state === 'half'
      ? `<path d="M12 4.3L12.9 3.2C14 1.9 15.7 1 17.5 1C20.6 1 23 3.3 23 6.4C23 10.2 19.6 13.3 13.7 18.6L12 20.2Z" fill="rgba(22,18,14,0.78)"/>`
      : ''
  }
  ${
    state !== 'empty'
      ? `<path d="M5.4 5.2C5.4 4.1 6.4 3.4 7.6 3.5" stroke="#ffadb0" stroke-width="2" stroke-linecap="round"/>`
      : ''
  }
</svg>`;

const RUNE_META: Array<{ id: RuneId; label: string; key: string; pad: string; icon: string }> = [
  {
    id: 'bomb',
    label: 'Ember Bomb',
    key: '1',
    pad: 'LB',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="13.5" r="7" fill="#2b4260" stroke="#48e8ff" stroke-width="2"/><path d="M9 13.5h6M12 10.5v6" stroke="#8cf4ff" stroke-width="1.8" stroke-linecap="round"/><path d="M12 6.5V3.5M14.5 4.2l1.8-1.4" stroke="#f0c65a" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'stasis',
    label: 'Stillstone Lock',
    key: '2',
    pad: 'LB',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" transform="rotate(45 12 12)" fill="#3b2f14" stroke="#ffd84a" stroke-width="2"/><path d="M9 10h6M9 14h6" stroke="#ffe98a" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'gale',
    label: 'Gale Updraft',
    key: '3',
    pad: 'LB',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 15c3-1 5-4 8-4 2.5 0 4 1.2 4 2.8S14.5 16.5 12 16.5H6" fill="none" stroke="#6ef2ce" stroke-width="2.2" stroke-linecap="round"/><path d="M5 10c2.6-.8 4.6-3.2 7.4-3.2 2.2 0 3.6 1 3.6 2.4" fill="none" stroke="#b6fff0" stroke-width="2" stroke-linecap="round"/><path d="M12 19V8M9 10.5L12 7.5l3 3" fill="none" stroke="#f0c65a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'cryonis',
    label: 'Frostrise Ice',
    key: '4',
    pad: 'LB',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6" y="7" width="12" height="12" rx="1.5" fill="#2c6c94" stroke="#8cf4ff" stroke-width="2"/><path d="M6 12h12M12 7v12M9 4l3 3 3-3" fill="none" stroke="#d4ffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export class GameHud {
  private readonly root: HTMLElement;
  private readonly actions: HudActions;

  private titleEl!: HTMLElement;
  private titleHintEl!: HTMLElement;
  private continueBtn!: HTMLButtonElement;
  private hudLayer!: HTMLElement;
  private heartsEl!: HTMLElement;
  private shrinesCountEl!: HTMLElement;
  private seedsCountEl!: HTMLElement;
  private marksCountEl!: HTMLElement;
  private arrowsCountEl!: HTMLElement;
  private mealsCountEl!: HTMLElement;
  private questChapterEl!: HTMLElement;
  private questGoalEl!: HTMLElement;
  private lampBtn!: HTMLButtonElement;
  private timeBtn!: HTMLButtonElement;
  private muteBtn!: HTMLButtonElement;
  private regionBannerEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private promptEl!: HTMLElement;
  private promptKeyEl!: HTMLElement;
  private promptTextEl!: HTMLElement;
  private bossBarEl!: HTMLElement;
  private bossNameEl!: HTMLElement;
  private bossFillEl!: HTMLElement;
  private staminaEl!: HTMLElement;
  private staminaCircle!: SVGCircleElement;
  private crosshairEl!: HTMLElement;
  private crosshairRing!: SVGCircleElement;
  private lockReticleEl!: HTMLElement;
  private lockNameEl!: HTMLElement;
  private lockHpEl!: HTMLElement;
  private slowMoBadgeEl!: HTMLElement;
  private runeButtons = new Map<RuneId, HTMLButtonElement>();
  private runeCastHintEl!: HTMLElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private terrainMapCache!: HTMLCanvasElement;
  private fullMapModal!: HTMLElement;
  private tabMapBtn!: HTMLButtonElement;
  private tabJournalBtn!: HTMLButtonElement;
  private panelMapEl!: HTMLElement;
  private panelJournalEl!: HTMLElement;
  private fullMapCanvas!: HTMLCanvasElement;
  private fullMapCtx!: CanvasRenderingContext2D;
  private fullMapLegendEl!: HTMLElement;
  private dialogueEl!: HTMLElement;
  private dialogueWhoEl!: HTMLElement;
  private dialogueTextEl!: HTMLElement;
  private dialogueNextEl!: HTMLElement;
  private dialogueChoicesEl!: HTMLElement;
  private lastChoiceKey = '';
  private pauseModal!: HTMLElement;
  private pauseControlsGridEl!: HTMLElement;
  private controlsModal!: HTMLElement;
  private controlsTabKbdBtn!: HTMLButtonElement;
  private controlsTabPadBtn!: HTMLButtonElement;
  private controlsListEl!: HTMLElement;
  private controlsStatusEl!: HTMLElement;
  private endModal!: HTMLElement;
  private endTitleEl!: HTMLElement;
  private endSubEl!: HTMLElement;
  private endStatsEl!: HTMLElement;
  private controllerTagEl!: HTMLElement;
  private touchControlsEl!: HTMLElement;
  private touchStickZoneEl!: HTMLElement;
  private touchStickBaseEl!: HTMLElement;
  private touchStickKnobEl!: HTMLElement;
  private healStatBtn!: HTMLButtonElement;
  private pauseTouchBtn!: HTMLButtonElement;
  private pauseMuteBtn!: HTMLButtonElement;
  private pauseTimeBtn!: HTMLButtonElement;

  private lastHeartsKey = '';
  private lastLegendKey = '';
  private lastJournalKey = '';
  private lastKeybindSig = '';
  private lastMenuContext = '';
  private focusedButton: HTMLButtonElement | null = null;
  private activeRuneId: RuneId = 'bomb';

  private touchEnabled = false;
  private touchOverride: boolean | null = null;
  private stickPointerId: number | null = null;
  private stickOriginX = 0;
  private stickOriginY = 0;

  private controlsOpen = false;
  private controlsTab: 'kbd' | 'pad' = 'kbd';
  private listeningTarget: { device: 'kbd' | 'pad'; action: BindableAction } | null = null;
  private listeningArmed = false;
  private currentKeybinds: KeybindConfig = createDefaultKeybinds();

  constructor(root: HTMLElement, actions: HudActions) {
    this.root = root;
    this.actions = actions;
    this.currentKeybinds = actions.getKeybinds();
    this.buildTerrainCache();
    this.buildDom();
    this.bindMenuAndRemapEvents();
    this.refreshKeybindLabels();
  }

  private buildTerrainCache(): void {
    const size = 240;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);

    for (let py = 0; py < size; py++) {
      const wz = ((py / size) * 2 - 1) * WORLD_PLAY_RADIUS;
      for (let px = 0; px < size; px++) {
        const wx = ((px / size) * 2 - 1) * WORLD_PLAY_RADIUS;
        const h = getTerrainHeight(wx, wz);
        const biome = getBiomeAt(wx, wz);
        const road = getRoadFactor(wx, wz);

        let r = 74;
        let gr = 148;
        let b = 62;

        if (h < WATER_Y) {
          r = 42;
          gr = 128;
          b = 188;
        } else if (biome === 'desert') {
          r = 224;
          gr = 192;
          b = 118;
        } else if (biome === 'swamp') {
          r = 66;
          gr = 98;
          b = 72;
        } else if (biome === 'wilds') {
          r = 76;
          gr = 66;
          b = 72;
          if (Math.hypot(wx - 32, wz + 152) < 12) {
            r = 165;
            gr = 74;
            b = 42;
          }
        } else if (biome === 'snow') {
          r = 220;
          gr = 232;
          b = 242;
        } else if (biome === 'canyon') {
          r = 176;
          gr = 118;
          b = 78;
        } else if (biome === 'shore') {
          r = 212;
          gr = 192;
          b = 144;
        } else if (biome === 'peak' || h > 11.5) {
          r = 130;
          gr = 134;
          b = 144;
        } else if (biome === 'highland' || h > 6.5) {
          r = 98;
          gr = 144;
          b = 76;
        }

        if (road > 0.25 && h >= WATER_Y + 0.15) {
          r = Math.round(r + (208 - r) * road * 0.8);
          gr = Math.round(gr + (168 - gr) * road * 0.8);
          b = Math.round(b + (116 - b) * road * 0.8);
        }

        if (h > WATER_Y && Math.abs((h % 3.8) - 1.9) < 0.14) {
          r = Math.max(0, r - 16);
          gr = Math.max(0, gr - 16);
          b = Math.max(0, b - 16);
        }

        const idx = (py * size + px) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = gr;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    this.terrainMapCache = c;
  }

  private buildDom(): void {
    this.root.innerHTML = `
      <!-- TITLE SCREEN -->
      <section id="title-screen" class="screen-overlay title-screen" aria-label="Dawnbell Title Screen">
        <div class="title-lockup">
          <svg class="title-crest" viewBox="0 0 88 88" width="82" height="82" aria-hidden="true">
            <path d="M44 8L50 18H38L44 8Z" fill="#f0c65a" stroke="#1b140d" stroke-width="2.5"/>
            <path d="M26 56C26 36 33 22 44 22C55 22 62 36 62 56L68 64H20L26 56Z" fill="#f0c65a" stroke="#1b140d" stroke-width="3.5" stroke-linejoin="round"/>
            <path d="M34 54C34 40 38 30 44 30" fill="none" stroke="#fff6cf" stroke-width="3" stroke-linecap="round"/>
            <circle cx="44" cy="70" r="6" fill="#3fb04e" stroke="#1b140d" stroke-width="3"/>
            <path d="M12 44L20 40M76 44L68 40M16 30L24 31M72 30L64 31" stroke="#ffe89c" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <h1 class="title-wordmark">DAWNBELL</h1>
          <p class="title-sub">A Gallowmark adventure · The Warden's Trial · The Hollow Deep · The Gloaming Fen · Saltmarrow Coast</p>
          <div class="title-actions">
            <button id="btn-start" class="btn-primary menu-nav-item" data-start="true" data-menu-row="0">New Adventure</button>
            <button id="btn-continue" class="btn-secondary menu-nav-item" data-menu-row="0" hidden>Continue</button>
            <button id="btn-title-controls" class="btn-secondary menu-nav-item" data-menu-row="0">Controls</button>
          </div>
          <div class="title-chapters" role="group" aria-label="Start at Chapter">
            <button class="chapter-btn menu-nav-item" data-chapter="2" data-menu-row="1">Test: skip to Ch. II</button>
            <button class="chapter-btn menu-nav-item" data-chapter="3" data-menu-row="1">Test: skip to Ch. III</button>
            <button class="chapter-btn menu-nav-item" data-chapter="4" data-menu-row="1">Test: skip to Ch. IV</button>
          </div>
        </div>
        <div id="title-hint" class="title-hint">Arrows / WASD Navigate Menu · Enter Select · C / Tap Shift Roll &amp; Dodge · Space Jump &amp; Paraglide · LMB Sword · RMB Bow · Gamepad Ready</div>
      </section>

      <!-- ACTIVE GAMEPLAY HUD -->
      <div id="hud-layer" class="hud-layer" hidden>
        <!-- Top-Left: Hearts + Resource Strip + Compact Chapter Objective -->
        <div class="hud-top-left">
          <div id="hud-hearts" class="hearts-row" aria-label="Health"></div>
          <div class="stats-line">
            <span class="stat-item" title="Bell Shrines Awakened">
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 2L16 14H4L10 2Z" fill="#6ef2ce" stroke="#14100c" stroke-width="1.8"/><circle cx="10" cy="16" r="2.2" fill="#f0c65a"/></svg>
              <b id="hud-shrines">0/3</b>
            </span>
            <span class="stat-sep">·</span>
            <span class="stat-item" title="Whisper-Sprite Seeds Found (+Stamina every 2)">
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 3C14 5 16 9 14 14C12 16 8 16 6 14C4 9 6 5 10 3Z" fill="#68e86a" stroke="#14100c" stroke-width="1.7"/><path d="M10 6v8" stroke="#1b4d1e" stroke-width="1.5" stroke-linecap="round"/></svg>
              <b id="hud-seeds">0/6</b>
            </span>
            <span class="stat-sep">·</span>
            <span class="stat-item" title="Golden Marks">
              <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><polygon points="10,2 17,10 10,18 3,10" fill="#f0c65a" stroke="#14100c" stroke-width="1.8"/></svg>
              <b id="hud-marks">0</b>
            </span>
            <span class="stat-sep">·</span>
            <span class="stat-item" title="Arrows">
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 16L15 5M10 5h5v5" fill="none" stroke="#8ceeff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <b id="hud-arrows">18</b>
            </span>
            <span class="stat-sep">·</span>
            <button id="btn-hud-heal" class="stat-item stat-heal-btn" tabindex="-1" title="Hearty Meals & Apples (Press H or Tap to Heal)" aria-label="Quick Heal">
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="11.5" r="5.5" fill="#e8483c" stroke="#14100c" stroke-width="1.6"/><path d="M10 6V3.5M10 5.5c1.5-1.5 3.2-1.5 4-.5" fill="none" stroke="#58c448" stroke-width="1.8" stroke-linecap="round"/></svg>
              <b id="hud-meals">1</b>
            </button>
          </div>
          <div class="quest-tracker" aria-label="Current Objective">
            <span id="hud-quest-chapter" class="quest-tracker-chapter">CH I · THE WARDEN'S TRIAL</span>
            <span id="hud-quest-goal" class="quest-tracker-goal">▸ Speak with Elder Aldous in Brackenford</span>
          </div>
        </div>

        <!-- Top-Center: Transient Region Banner & Toast -->
        <div class="hud-top-center">
          <div id="hud-region" class="region-banner" hidden></div>
          <div id="hud-toast" class="hud-toast" hidden></div>
          <div id="hud-slowmo" class="slowmo-badge" hidden>FLURRY RUSH</div>
        </div>

        <!-- Top-Right: Compact Utility Icon Buttons -->
        <div class="hud-top-right">
          <span id="hud-controller-tag" class="controller-tag" hidden>Controller Active</span>
          <button id="btn-lamp" class="icon-btn" tabindex="-1" hidden aria-label="Toggle Dawn Lamp" title="Dawn Lamp (G)">
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M9 4h6M10 4v2.5h4V4M7.5 9.5c0-1.6 2-3 4.5-3s4.5 1.4 4.5 3v6.5c0 1.4-2 2.5-4.5 2.5s-4.5-1.1-4.5-2.5V9.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="12" cy="12.5" r="2.2" fill="currentColor"/></svg>
          </button>
          <button id="btn-journal" class="icon-btn" tabindex="-1" aria-label="Quest Journal" title="Quest Journal (I)">
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M5 4h11a2 2 0 012 2v13a1 1 0 01-1 1H6a2 2 0 01-2-2V5a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 8h7M8 12h7M8 16h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
          <button id="btn-time" class="icon-btn" tabindex="-1" aria-label="Cycle Time of Day" title="Cycle Time of Day (T)">
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button id="btn-map" class="icon-btn" tabindex="-1" aria-label="World Map" title="World Map & Lodestones (M)">
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="1.8"/></svg>
          </button>
          <button id="btn-mute" class="icon-btn" tabindex="-1" aria-label="Toggle Sound" title="Toggle Sound">
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button id="btn-pause" class="icon-btn" tabindex="-1" aria-label="Pause Game" title="Pause (Esc)">
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>
          </button>
        </div>

        <!-- Diegetic Stamina Wheel -->
        <div id="hud-stamina" class="stamina-wheel" hidden aria-label="Stamina">
          <svg viewBox="0 0 56 56" width="54" height="54">
            <circle cx="28" cy="28" r="20" fill="rgba(16,14,11,0.58)" stroke="rgba(255,255,255,0.18)" stroke-width="7"/>
            <circle id="stamina-ring" cx="28" cy="28" r="20" fill="none" stroke="#62e65e" stroke-width="7"
              stroke-dasharray="125.66" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 28 28)"/>
          </svg>
        </div>

        <!-- Bow Crosshair -->
        <div id="hud-crosshair" class="bow-crosshair" hidden>
          <svg viewBox="0 0 48 48" width="48" height="48">
            <circle id="crosshair-ring" cx="24" cy="24" r="16" fill="none" stroke="#8cf4ff" stroke-width="2.2"
              stroke-dasharray="100.53" stroke-dashoffset="100.53" transform="rotate(-90 24 24)"/>
            <path d="M24 10v6M24 32v6M10 24h6M32 24h6" stroke="#fff6d8" stroke-width="2" stroke-linecap="round"/>
            <circle cx="24" cy="24" r="2.2" fill="#ffe266"/>
          </svg>
        </div>

        <!-- Lock-on Reticle -->
        <div id="hud-lock" class="lock-reticle" hidden>
          <div class="lock-diamond"></div>
          <div id="hud-lock-name" class="lock-name"></div>
          <div class="lock-hp-bar"><div id="hud-lock-hp" class="lock-hp-fill"></div></div>
        </div>

        <!-- Contextual Interaction Prompt -->
        <div id="hud-prompt" class="interact-prompt" hidden>
          <kbd id="hud-prompt-key">E</kbd>
          <span id="hud-prompt-text">Interact</span>
        </div>

        <!-- Boss Health Bar (Iron Sentinel) -->
        <div id="hud-boss" class="boss-bar" hidden>
          <div id="hud-boss-name" class="boss-name">Iron Sentinel</div>
          <div class="boss-track"><div id="hud-boss-fill" class="boss-fill"></div></div>
        </div>

        <!-- Bottom-Left: Active Dawnbell Runes -->
        <div class="hud-bottom-left">
          <div class="rune-strip" role="group" aria-label="Dawnbell Runes">
            ${RUNE_META.map(
              (r) => `
              <button class="rune-slot" data-rune="${r.id}" tabindex="-1" title="${r.label}">
                <span class="rune-key">${r.key}</span>
                ${r.icon}
                <span class="rune-name">${r.label.split(' ')[0]}</span>
                <span class="rune-cd" hidden></span>
              </button>`
            ).join('')}
          </div>
          <div id="hud-rune-cast" class="rune-cast-hint">[F] Cast Rune · [I] Quests · [M] Map · [Space×2] Paraglide</div>
        </div>

        <!-- Bottom-Right: Circular Minimap -->
        <div class="hud-bottom-right">
          <div class="minimap-frame">
            <canvas id="minimap-canvas" width="136" height="136"></canvas>
            <span class="minimap-n">N</span>
          </div>
        </div>

        <!-- Mobile / Touch On-Screen Thumb Controls (clean 4-button right arc + left stick & ZL shield) -->
        <div id="touch-controls" class="touch-controls" hidden aria-label="Touch Controls">
          <div id="touch-stick-zone" class="touch-stick-zone" aria-label="Virtual Movement Stick">
            <div id="touch-stick-base" class="touch-stick-base">
              <div id="touch-stick-knob" class="touch-stick-knob"></div>
              <span class="touch-stick-sprint-hint">SPRINT</span>
            </div>
          </div>

          <button class="touch-btn tb-shield" data-touch-act="shield" tabindex="-1" aria-label="Shield, Parry, and Z-Lock">
            <span>Shield</span>
          </button>

          <div class="touch-actions" aria-label="Action Buttons">
            <button class="touch-btn tb-attack" data-touch-act="attack" tabindex="-1" aria-label="Sword Attack or Hold Spin">
              <span>Sword</span>
            </button>
            <button class="touch-btn tb-jump" data-touch-act="jump" tabindex="-1" aria-label="Jump or Paraglide">
              <span>Jump</span>
            </button>
            <button class="touch-btn tb-roll" data-touch-act="roll" tabindex="-1" aria-label="Roll or Dodge">
              <span>Roll</span>
            </button>
            <button class="touch-btn tb-bow" data-touch-act="aim" tabindex="-1" aria-label="Hold and Drag to Aim Bow">
              <span>Bow</span>
            </button>
          </div>
        </div>

        <!-- Dialogue Box -->
        <div id="hud-dialogue" class="dialogue-overlay" hidden>
          <div class="dialogue-card">
            <div id="dlg-who" class="dialogue-who"></div>
            <p id="dlg-text" class="dialogue-text"></p>
            <div id="dlg-choices" class="dialogue-choices" hidden></div>
            <div id="dlg-next" class="dialogue-next">Press E / Space / A to continue</div>
          </div>
        </div>
      </div>

      <!-- WORLD MAP & QUEST JOURNAL MODAL -->
      <section id="map-modal" class="screen-overlay modal-backdrop" hidden aria-label="Realm Map and Quest Journal">
        <div class="modal-card map-card">
          <div class="modal-header">
            <div class="modal-tabs" role="tablist">
              <button id="tab-map" class="modal-tab is-active" role="tab">World Map &amp; Lodestones</button>
              <button id="tab-journal" class="modal-tab" role="tab">Quest Journal</button>
            </div>
            <button id="btn-map-close" class="btn-secondary small">Close</button>
          </div>
          <div id="panel-map" class="map-body">
            <canvas id="fullmap-canvas" width="380" height="380" class="fullmap-canvas"></canvas>
            <div id="fullmap-legend" class="map-legend"></div>
          </div>
          <div id="panel-journal" class="journal-body" hidden></div>
        </div>
      </section>

      <!-- PAUSE MODAL -->
      <section id="pause-modal" class="screen-overlay modal-backdrop" hidden aria-label="Paused">
        <div class="modal-card">
          <h2>Paused</h2>
          <div id="pause-controls-grid" class="controls-grid"></div>
          <div class="modal-actions">
            <button id="btn-resume" class="btn-primary menu-nav-item">Resume</button>
            <button id="btn-pause-controls" class="btn-secondary menu-nav-item">Remap Controls</button>
            <button id="btn-pause-touch" class="btn-secondary menu-nav-item">Touch Controls: Off</button>
            <button id="btn-pause-gfx" class="btn-secondary menu-nav-item">Graphics: Auto</button>
            <button id="btn-pause-time" class="btn-secondary menu-nav-item">Time: Morning</button>
            <button id="btn-pause-mute" class="btn-secondary menu-nav-item">Sound: On</button>
            <button id="btn-restart" class="btn-secondary menu-nav-item">Restart</button>
            <button id="btn-title" class="btn-secondary menu-nav-item">Title</button>
          </div>
        </div>
      </section>

      <!-- CONTROLS & KEY REMAPPING MODAL -->
      <section id="controls-modal" class="screen-overlay modal-backdrop" hidden aria-label="Remap Controls">
        <div class="modal-card controls-remap-card">
          <div class="modal-header">
            <h2>Controls &amp; Remapping</h2>
            <button id="btn-controls-close" class="btn-secondary small menu-nav-item">Done</button>
          </div>
          <div class="controls-remap-bar">
            <div class="modal-tabs" role="tablist">
              <button id="tab-ctrl-kbd" class="modal-tab is-active" role="tab">Keyboard &amp; Mouse</button>
              <button id="tab-ctrl-pad" class="modal-tab" role="tab">Game Controller</button>
            </div>
            <button id="btn-controls-reset" class="btn-secondary small menu-nav-item">Reset Defaults</button>
          </div>
          <div id="controls-status" class="controls-status">Select any action to rebind its key, mouse button, or controller button.</div>
          <div id="controls-remap-list" class="controls-remap-list"></div>
        </div>
      </section>

      <!-- VICTORY / GAME OVER MODAL -->
      <section id="end-modal" class="screen-overlay modal-backdrop" hidden aria-label="Adventure Complete">
        <div class="modal-card end-card">
          <h2 id="end-title">The Great Dawnbell Rings</h2>
          <p id="end-sub" class="end-sub"></p>
          <div id="end-stats" class="end-stats"></div>
          <div class="modal-actions">
            <button id="btn-play-again" class="btn-primary menu-nav-item" data-start="true">Play Again</button>
            <button id="btn-end-title" class="btn-secondary menu-nav-item">Title Screen</button>
          </div>
        </div>
      </section>
    `;

    this.titleEl = this.root.querySelector('#title-screen')!;
    this.titleHintEl = this.root.querySelector('#title-hint')!;
    this.continueBtn = this.root.querySelector('#btn-continue')!;
    this.hudLayer = this.root.querySelector('#hud-layer')!;
    this.heartsEl = this.root.querySelector('#hud-hearts')!;
    this.shrinesCountEl = this.root.querySelector('#hud-shrines')!;
    this.seedsCountEl = this.root.querySelector('#hud-seeds')!;
    this.marksCountEl = this.root.querySelector('#hud-marks')!;
    this.arrowsCountEl = this.root.querySelector('#hud-arrows')!;
    this.mealsCountEl = this.root.querySelector('#hud-meals')!;
    this.questChapterEl = this.root.querySelector('#hud-quest-chapter')!;
    this.questGoalEl = this.root.querySelector('#hud-quest-goal')!;
    this.lampBtn = this.root.querySelector('#btn-lamp')!;
    this.timeBtn = this.root.querySelector('#btn-time')!;
    this.muteBtn = this.root.querySelector('#btn-mute')!;
    this.regionBannerEl = this.root.querySelector('#hud-region')!;
    this.toastEl = this.root.querySelector('#hud-toast')!;
    this.promptEl = this.root.querySelector('#hud-prompt')!;
    this.promptKeyEl = this.root.querySelector('#hud-prompt-key')!;
    this.promptTextEl = this.root.querySelector('#hud-prompt-text')!;
    this.bossBarEl = this.root.querySelector('#hud-boss')!;
    this.bossNameEl = this.root.querySelector('#hud-boss-name')!;
    this.bossFillEl = this.root.querySelector('#hud-boss-fill')!;
    this.staminaEl = this.root.querySelector('#hud-stamina')!;
    this.staminaCircle = this.root.querySelector('#stamina-ring')!;
    this.crosshairEl = this.root.querySelector('#hud-crosshair')!;
    this.crosshairRing = this.root.querySelector('#crosshair-ring')!;
    this.lockReticleEl = this.root.querySelector('#hud-lock')!;
    this.lockNameEl = this.root.querySelector('#hud-lock-name')!;
    this.lockHpEl = this.root.querySelector('#hud-lock-hp')!;
    this.slowMoBadgeEl = this.root.querySelector('#hud-slowmo')!;
    this.runeCastHintEl = this.root.querySelector('#hud-rune-cast')!;
    this.minimapCanvas = this.root.querySelector('#minimap-canvas')!;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
    this.fullMapModal = this.root.querySelector('#map-modal')!;
    this.tabMapBtn = this.root.querySelector('#tab-map')!;
    this.tabJournalBtn = this.root.querySelector('#tab-journal')!;
    this.panelMapEl = this.root.querySelector('#panel-map')!;
    this.panelJournalEl = this.root.querySelector('#panel-journal')!;
    this.fullMapCanvas = this.root.querySelector('#fullmap-canvas')!;
    this.fullMapCtx = this.fullMapCanvas.getContext('2d')!;
    this.fullMapLegendEl = this.root.querySelector('#fullmap-legend')!;
    this.dialogueEl = this.root.querySelector('#hud-dialogue')!;
    this.dialogueWhoEl = this.root.querySelector('#dlg-who')!;
    this.dialogueTextEl = this.root.querySelector('#dlg-text')!;
    this.dialogueNextEl = this.root.querySelector('#dlg-next')!;
    this.dialogueChoicesEl = this.root.querySelector('#dlg-choices')!;
    this.dialogueChoicesEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-choice]');
      if (b && !b.disabled) this.actions.onPickChoice(Number(b.dataset.choice));
    });
    this.pauseModal = this.root.querySelector('#pause-modal')!;
    this.pauseControlsGridEl = this.root.querySelector('#pause-controls-grid')!;
    this.controlsModal = this.root.querySelector('#controls-modal')!;
    this.controlsTabKbdBtn = this.root.querySelector('#tab-ctrl-kbd')!;
    this.controlsTabPadBtn = this.root.querySelector('#tab-ctrl-pad')!;
    this.controlsListEl = this.root.querySelector('#controls-remap-list')!;
    this.controlsStatusEl = this.root.querySelector('#controls-status')!;
    this.endModal = this.root.querySelector('#end-modal')!;
    this.endTitleEl = this.root.querySelector('#end-title')!;
    this.endSubEl = this.root.querySelector('#end-sub')!;
    this.endStatsEl = this.root.querySelector('#end-stats')!;
    this.controllerTagEl = this.root.querySelector('#hud-controller-tag')!;
    this.touchControlsEl = this.root.querySelector('#touch-controls')!;
    this.touchStickZoneEl = this.root.querySelector('#touch-stick-zone')!;
    this.touchStickBaseEl = this.root.querySelector('#touch-stick-base')!;
    this.touchStickKnobEl = this.root.querySelector('#touch-stick-knob')!;
    this.healStatBtn = this.root.querySelector('#btn-hud-heal')!;
    this.pauseTouchBtn = this.root.querySelector('#btn-pause-touch')!;
    this.pauseMuteBtn = this.root.querySelector('#btn-pause-mute')!;
    this.pauseTimeBtn = this.root.querySelector('#btn-pause-time')!;

    for (const r of RUNE_META) {
      const btn = this.root.querySelector<HTMLButtonElement>(`.rune-slot[data-rune="${r.id}"]`)!;
      this.runeButtons.set(r.id, btn);
      btn.addEventListener('click', (e) => {
        (e.currentTarget as HTMLButtonElement).blur();
        if (this.touchEnabled && this.activeRuneId === r.id) {
          this.actions.onTouchTap('rune');
        } else {
          this.actions.onSelectRune(r.id);
        }
      });
    }

    this.root.querySelector('#btn-start')!.addEventListener('click', () => {
      this.closeControlsModal();
      this.actions.onNewGame(1);
    });
    this.continueBtn.addEventListener('click', () => {
      this.closeControlsModal();
      this.actions.onContinue();
    });
    this.root.querySelector('#btn-title-controls')!.addEventListener('click', () => this.openControlsModal());
    this.root.querySelector('#btn-pause-controls')!.addEventListener('click', () => this.openControlsModal());
    this.root.querySelector('#btn-controls-close')!.addEventListener('click', () => this.closeControlsModal());
    this.controlsTabKbdBtn.addEventListener('click', () => {
      this.controlsTab = 'kbd';
      this.listeningTarget = null;
      this.renderControlsModal();
    });
    this.controlsTabPadBtn.addEventListener('click', () => {
      this.controlsTab = 'pad';
      this.listeningTarget = null;
      this.renderControlsModal();
    });
    this.root.querySelector('#btn-controls-reset')!.addEventListener('click', () => {
      this.listeningTarget = null;
      this.currentKeybinds = this.actions.onResetKeybinds();
      this.controlsStatusEl.textContent = 'Controls restored to Breath-of-the-Wild defaults.';
      this.renderControlsModal();
      this.refreshKeybindLabels();
    });
    this.controlsListEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.remap-key-btn');
      if (!btn || !btn.dataset.action) return;
      this.startListening(this.controlsTab, btn.dataset.action as BindableAction);
    });

    this.root.querySelectorAll<HTMLButtonElement>('.chapter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.closeControlsModal();
        this.actions.onNewGame(Number(btn.dataset.chapter) || 1);
      });
    });

    this.lampBtn.addEventListener('click', (e) => {
      (e.currentTarget as HTMLButtonElement).blur();
      this.actions.onToggleLamp();
    });
    this.root.querySelector('#btn-journal')!.addEventListener('click', (e) => {
      (e.currentTarget as HTMLButtonElement).blur();
      this.actions.onToggleJournal();
    });
    this.timeBtn.addEventListener('click', (e) => {
      (e.currentTarget as HTMLButtonElement).blur();
      this.actions.onCycleTime();
    });
    this.root.querySelector('#btn-pause')!.addEventListener('click', (e) => {
      (e.currentTarget as HTMLButtonElement).blur();
      this.actions.onPause();
    });
    this.root.querySelector('#btn-map')!.addEventListener('click', (e) => {
      (e.currentTarget as HTMLButtonElement).blur();
      this.actions.onToggleMap();
    });
    this.tabMapBtn.addEventListener('click', () => this.actions.onSelectMapTab('map'));
    this.tabJournalBtn.addEventListener('click', () => this.actions.onSelectMapTab('journal'));
    this.root.querySelector('#btn-map-close')!.addEventListener('click', () => {
      if (this.panelJournalEl.hidden) this.actions.onToggleMap();
      else this.actions.onToggleJournal();
    });
    this.fullMapLegendEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-travel]');
      if (target && target.dataset.travel) {
        this.actions.onFastTravel(target.dataset.travel);
      }
    });
    this.muteBtn.addEventListener('click', (e) => {
      (e.currentTarget as HTMLButtonElement).blur();
      this.actions.onToggleMute();
    });
    this.root.querySelector('#btn-resume')!.addEventListener('click', () => {
      this.closeControlsModal();
      this.actions.onResume();
    });
    this.root.querySelector('#btn-restart')!.addEventListener('click', () => {
      this.closeControlsModal();
      this.actions.onNewGame(1);
    });
    this.root.querySelector('#btn-title')!.addEventListener('click', () => {
      this.closeControlsModal();
      this.actions.onReturnTitle();
    });
    this.root.querySelector('#btn-play-again')!.addEventListener('click', () => this.actions.onNewGame(1));
    this.root.querySelector('#btn-end-title')!.addEventListener('click', () => this.actions.onReturnTitle());
    this.dialogueEl.addEventListener('click', () => this.actions.onDismissDialogue());

    // Direct tap on Contextual Interact Prompt (essential for mobile play!)
    this.promptEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.actions.onTouchTap('interact');
    });

    // Direct tap on Top-Left Meal/Apple stat counter triggers Quick Heal
    this.healStatBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.actions.onTouchTap('heal');
    });

    // Pause menu quick utility toggles (especially handy on mobile!)
    this.pauseTouchBtn.addEventListener('click', () => {
      this.touchOverride = !this.touchEnabled;
      this.setTouchMode(this.touchOverride);
    });
    const gfxBtn = this.root.querySelector('#btn-pause-gfx') as HTMLButtonElement;
    gfxBtn.textContent = this.actions.getGraphicsLabel();
    gfxBtn.addEventListener('click', () => {
      gfxBtn.textContent = this.actions.onCycleGraphics();
    });
    this.pauseTimeBtn.addEventListener('click', () => {
      this.actions.onCycleTime();
    });
    this.pauseMuteBtn.addEventListener('click', () => {
      this.actions.onToggleMute();
    });

    // Auto-detect mobile / coarse touch devices on boot & first touch interaction
    const coarseNow =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || (navigator.maxTouchPoints ?? 0) > 0);
    this.setTouchMode(coarseNow);
    window.addEventListener(
      'touchstart',
      () => {
        if (this.touchOverride === null && !this.touchEnabled) {
          this.setTouchMode(true);
        }
      },
      { passive: true, once: true }
    );

    this.initTouchControls();

    // Keep mouse hover synced with keyboard/gamepad menu highlight
    this.root.addEventListener('pointerover', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.menu-nav-item');
      if (btn && this.getActiveMenuItems().includes(btn)) {
        this.setFocusedButton(btn, false);
      }
    });
  }

  private setTouchMode(enabled: boolean): void {
    this.touchEnabled = enabled;
    document.body.dataset.touch = enabled ? '1' : '0';
    if (this.pauseTouchBtn) {
      this.pauseTouchBtn.textContent = enabled ? 'Touch Controls: On' : 'Touch Controls: Off';
    }
    if (this.touchControlsEl) {
      const isPlaying = document.body.dataset.state === 'playing';
      const modalBlocking = !this.fullMapModal.hidden || !this.dialogueEl.hidden;
      this.touchControlsEl.hidden = !enabled || !isPlaying || modalBlocking;
    }
    this.lastKeybindSig = '';
    this.refreshKeybindLabels();
  }

  private initTouchControls(): void {
    const MAX_RADIUS = 48;

    const resetStick = () => {
      this.stickPointerId = null;
      this.touchStickBaseEl.classList.remove('is-live', 'is-sprinting');
      this.touchStickBaseEl.style.left = '';
      this.touchStickBaseEl.style.top = '';
      this.touchStickKnobEl.style.transform = 'translate3d(0, 0, 0)';
      this.actions.onTouchMove(0, 0, false);
    };

    const updateStick = (clientX: number, clientY: number) => {
      const dx = clientX - this.stickOriginX;
      const dy = clientY - this.stickOriginY;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, MAX_RADIUS);
      const nx = dist > 0.001 ? (dx / dist) * (clamped / MAX_RADIUS) : 0;
      const ny = dist > 0.001 ? (dy / dist) * (clamped / MAX_RADIUS) : 0;
      const sprint = dist >= MAX_RADIUS * 0.9;

      this.touchStickKnobEl.style.transform = `translate3d(${(nx * MAX_RADIUS).toFixed(1)}px, ${(ny * MAX_RADIUS).toFixed(1)}px, 0)`;
      this.touchStickBaseEl.classList.toggle('is-sprinting', sprint);
      this.actions.onTouchMove(nx, ny, sprint);
    };

    this.touchStickZoneEl.addEventListener('pointerdown', (e) => {
      if (this.stickPointerId !== null) return;
      e.preventDefault();
      e.stopPropagation();
      this.stickPointerId = e.pointerId;
      try {
        this.touchStickZoneEl.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if capture unsupported
      }
      const rect = this.touchStickZoneEl.getBoundingClientRect();
      const pad = 64;
      const localX = Math.max(pad, Math.min(rect.width - pad, e.clientX - rect.left));
      const localY = Math.max(pad, Math.min(rect.height - pad, e.clientY - rect.top));
      this.stickOriginX = rect.left + localX;
      this.stickOriginY = rect.top + localY;
      this.touchStickBaseEl.style.left = `${localX}px`;
      this.touchStickBaseEl.style.top = `${localY}px`;
      this.touchStickBaseEl.classList.add('is-live');
      updateStick(e.clientX, e.clientY);
    });

    this.touchStickZoneEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      e.preventDefault();
      updateStick(e.clientX, e.clientY);
    });

    const onStickEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return;
      e.preventDefault();
      resetStick();
    };
    this.touchStickZoneEl.addEventListener('pointerup', onStickEnd);
    this.touchStickZoneEl.addEventListener('pointercancel', onStickEnd);
    this.touchStickZoneEl.addEventListener('lostpointercapture', () => {
      if (this.stickPointerId !== null) resetStick();
    });

    // Right Thumb Action Buttons (with Bow hold-and-drag 360° aiming!)
    this.touchControlsEl.querySelectorAll<HTMLButtonElement>('.touch-btn').forEach((btn) => {
      const action = btn.dataset.touchAct as TouchActionId | undefined;
      if (!action) return;
      let activePid: number | null = null;
      let lastX = 0;
      let lastY = 0;

      const releaseBtn = () => {
        if (activePid === null) return;
        activePid = null;
        btn.classList.remove('is-pressed');
        this.actions.onTouchAction(action, false);
      };

      btn.addEventListener('pointerdown', (e) => {
        if (activePid !== null) return;
        e.preventDefault();
        e.stopPropagation();
        activePid = e.pointerId;
        lastX = e.clientX;
        lastY = e.clientY;
        try {
          btn.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
        btn.classList.add('is-pressed');
        this.actions.onTouchAction(action, true);
        // Just like BotW ZL: pressing Shield on mobile also Z-Locks nearest foe / recenters camera!
        if (action === 'shield') {
          this.actions.onTouchTap('lockOn');
        }
      });

      btn.addEventListener('pointermove', (e) => {
        if (e.pointerId !== activePid) return;
        // Dragging on the Bow button aims smoothly in 360° while drawing!
        if (action === 'aim') {
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
          this.actions.onTouchLook(dx, dy);
        }
      });

      btn.addEventListener('pointerup', (e) => {
        if (e.pointerId !== activePid) return;
        e.preventDefault();
        releaseBtn();
      });

      btn.addEventListener('pointercancel', (e) => {
        if (e.pointerId !== activePid) return;
        releaseBtn();
      });

      btn.addEventListener('lostpointercapture', () => {
        releaseBtn();
      });
    });
  }

  private openControlsModal(): void {
    this.controlsOpen = true;
    this.listeningTarget = null;
    this.currentKeybinds = this.actions.getKeybinds();
    this.controlsModal.hidden = false;
    this.renderControlsModal();
    this.syncMenuFocus('controls');
  }

  private closeControlsModal(): void {
    if (!this.controlsOpen) return;
    this.controlsOpen = false;
    this.listeningTarget = null;
    this.controlsModal.hidden = true;
    this.syncMenuFocus(document.body.dataset.state || 'title');
  }

  private startListening(device: 'kbd' | 'pad', action: BindableAction): void {
    this.listeningTarget = { device, action };
    this.listeningArmed = false;
    const def = ACTION_DEFINITIONS.find((d) => d.action === action);
    this.controlsStatusEl.textContent =
      device === 'kbd'
        ? `Listening for "${def?.label ?? action}" — press any key or mouse button (Esc to cancel)…`
        : `Listening for "${def?.label ?? action}" — press any controller button (Esc / Back to cancel)…`;
    this.renderControlsModal();
    window.setTimeout(() => {
      this.listeningArmed = true;
    }, 50);
  }

  private renderControlsModal(): void {
    this.controlsTabKbdBtn.classList.toggle('is-active', this.controlsTab === 'kbd');
    this.controlsTabPadBtn.classList.toggle('is-active', this.controlsTab === 'pad');

    const renderSection = (cat: 'Movement' | 'Combat' | 'Runes & Exploration'): string => {
      const rows = ACTION_DEFINITIONS.filter(
        (d) => d.category === cat && (this.controlsTab === 'kbd' || d.padBindable)
      )
        .map((d) => {
          const isListening =
            this.listeningTarget !== null &&
            this.listeningTarget.device === this.controlsTab &&
            this.listeningTarget.action === d.action;
          const currentLabel =
            this.controlsTab === 'kbd'
              ? formatKeyCode(this.currentKeybinds.kbd[d.action])
              : formatPadButton(this.currentKeybinds.pad[d.action as PadBindableAction]);
          return `
            <div class="remap-row">
              <span class="remap-label">${d.label}</span>
              <button class="remap-key-btn menu-nav-item ${isListening ? 'is-listening' : ''}" data-action="${d.action}">
                ${isListening ? 'Press input…' : currentLabel}
              </button>
            </div>
          `;
        })
        .join('');
      return `<div class="remap-section"><h3>${cat}</h3>${rows}</div>`;
    };

    const k = this.currentKeybinds.kbd;
    const p = this.currentKeybinds.pad;
    const tipsHtml =
      this.controlsTab === 'kbd'
        ? `
          <div class="remap-tips">
            <h3>Hero Techniques</h3>
            <ul>
              <li><b>Roll Anytime:</b> Press <b>${formatKeyCode(k.roll)}</b> or quick-tap <b>${formatKeyCode(k.sprint)}</b>.</li>
              <li><b>Backflip / Side-Hop:</b> Dodge while holding <b>${formatKeyCode(k.shield)}</b> or Z-Locked for <b>Flurry Rush</b>.</li>
              <li><b>Jump-Strike Slam:</b> Press <b>${formatKeyCode(k.attack)}</b> mid-air for an AoE shockwave.</li>
              <li><b>Air Bullet-Time:</b> Hold <b>${formatKeyCode(k.aim)}</b> mid-air to slow time.</li>
            </ul>
          </div>
        `
        : `
          <div class="remap-tips">
            <h3>Controller Techniques</h3>
            <ul>
              <li><b>Roll / Sprint:</b> Tap <b>${formatPadButton(p.roll)}</b> to combat roll, hold to sprint.</li>
              <li><b>Flurry Rush:</b> Hold <b>${formatPadButton(p.lockOn)}</b> + stick + <b>${formatPadButton(p.jump)}</b> to Backflip / Side-Hop.</li>
              <li><b>Jump-Strike Slam:</b> Press <b>${formatPadButton(p.attack)}</b> mid-air for an AoE slam.</li>
              <li><b>Sticks:</b> Left Stick moves · Right Stick orbits 360° camera.</li>
            </ul>
          </div>
        `;

    this.controlsListEl.innerHTML = `
      <div class="remap-col">
        ${renderSection('Movement')}
        ${tipsHtml}
      </div>
      <div class="remap-col">
        ${renderSection('Combat')}
        ${renderSection('Runes & Exploration')}
      </div>
    `;
  }

  private refreshKeybindLabels(): void {
    const k = this.currentKeybinds.kbd;
    const p = this.currentKeybinds.pad;
    const sig = JSON.stringify(this.currentKeybinds);
    if (sig === this.lastKeybindSig && this.pauseControlsGridEl.innerHTML.length > 0) return;
    this.lastKeybindSig = sig;

    const mv = `${formatKeyCode(k.moveForward)}${formatKeyCode(k.moveLeft)}${formatKeyCode(k.moveBack)}${formatKeyCode(k.moveRight)}`;
    this.titleHintEl.textContent = this.touchEnabled
      ? 'Left Stick Move · Drag Screen to Look · Sword, Jump, Roll & Bow · Tap Active Rune to Cast'
      : `Arrows / WASD Navigate Menu · Enter Select · ${formatKeyCode(k.roll)} Roll/Dodge · ${formatKeyCode(k.jump)} Jump/Glide · ${formatKeyCode(k.attack)} Sword · ${formatKeyCode(k.aim)} Bow · Gamepad Ready`;

    this.pauseControlsGridEl.innerHTML = `
      <div class="controls-col">
        <h3>Mouse &amp; Keyboard</h3>
        <ul>
          <li><b>${mv} / Arrows</b> Move &amp; Climb</li>
          <li><b>Mouse (Click Canvas)</b> 360° Camera</li>
          <li><b>${formatKeyCode(k.jump)} (×2 in air)</b> Jump / Paraglide</li>
          <li><b>${formatKeyCode(k.roll)} (or Tap ${formatKeyCode(k.sprint)})</b> Roll · Backflip / Side-Hop</li>
          <li><b>${formatKeyCode(k.sprint)} (Hold)</b> Sprint</li>
          <li><b>${formatKeyCode(k.shieldSurf)} (or Shield+Jump)</b> Shield Surf down slopes</li>
          <li><b>${formatKeyCode(k.attack)}</b> Sword Combo · Air Jump-Slam · Hold Spin</li>
          <li><b>${formatKeyCode(k.aim)}</b> Bow Aim (Air: Bullet-Time)</li>
          <li><b>${formatKeyCode(k.shield)}</b> Shield (Tap: Perfect Parry)</li>
          <li><b>${formatKeyCode(k.lockOn)}</b> Z-Target Lock-On / Recenter Camera</li>
          <li><b>1–4 + ${formatKeyCode(k.runeCast)}</b> Bomb · Stillstone · Gale · Frostrise</li>
          <li><b>${formatKeyCode(k.interact)} / ${formatKeyCode(k.heal)} / ${formatKeyCode(k.dawnLamp)}</b> Interact · Heal · Dawn Lamp</li>
          <li><b>${formatKeyCode(k.worldMap)} / ${formatKeyCode(k.journal)} / ${formatKeyCode(k.timeCycle)}</b> Map · Quests · Time</li>
        </ul>
      </div>
      <div class="controls-col">
        <h3>Game Controller</h3>
        <ul>
          <li><b>Left / Right Stick</b> Move &amp; 360° Camera</li>
          <li><b>${formatPadButton(p.jump)}</b> Jump · Paraglide · Climb Leap</li>
          <li><b>${formatPadButton(p.roll)} (Tap / Hold)</b> Roll / Dodge · Sprint</li>
          <li><b>${formatPadButton(p.shieldSurf)} (or LT+A)</b> Shield Surf down slopes</li>
          <li><b>${formatPadButton(p.attack)}</b> Sword Combo · Air Slam · Hold Spin</li>
          <li><b>${formatPadButton(p.interact)}</b> Interact · Cook · Mine · Shrine</li>
          <li><b>${formatPadButton(p.lockOn)}</b> Z-Target / Shield / Perfect Parry</li>
          <li><b>${formatPadButton(p.aim)}</b> Draw &amp; Aim Bow (Air: Bullet-Time)</li>
          <li><b>LB / ${formatPadButton(p.runeCast)}</b> Cycle Rune · Cast Rune</li>
          <li><b>${formatPadButton(p.heal)} / ${formatPadButton(p.timeCycle)}</b> Quick Heal · Time of Day</li>
          <li><b>${formatPadButton(p.pause)} / ${formatPadButton(p.worldMap)}</b> Pause · World Map</li>
        </ul>
      </div>
    `;
  }

  private getActiveMenuContainer(): HTMLElement | null {
    if (this.controlsOpen && !this.controlsModal.hidden) return this.controlsModal;
    const st = document.body.dataset.state || 'title';
    if (st === 'title' && !this.titleEl.hidden) return this.titleEl;
    if (st === 'paused' && !this.pauseModal.hidden) return this.pauseModal;
    if (st === 'gameover' && !this.endModal.hidden) return this.endModal;
    return null;
  }

  private getActiveMenuItems(): HTMLButtonElement[] {
    const container = this.getActiveMenuContainer();
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLButtonElement>('.menu-nav-item')).filter(
      (btn) => !btn.hidden && !btn.disabled && btn.offsetParent !== null
    );
  }

  private setFocusedButton(btn: HTMLButtonElement | null, scrollIntoView = true): void {
    if (this.focusedButton && this.focusedButton !== btn) {
      this.focusedButton.classList.remove('is-focused');
      this.focusedButton.removeAttribute('aria-current');
    }
    this.focusedButton = btn;
    if (btn) {
      btn.classList.add('is-focused');
      btn.setAttribute('aria-current', 'true');
      if (scrollIntoView) {
        btn.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  private syncMenuFocus(contextKey: string): void {
    const items = this.getActiveMenuItems();
    if (items.length === 0) {
      this.setFocusedButton(null, false);
      this.lastMenuContext = contextKey;
      return;
    }
    if (contextKey !== this.lastMenuContext || !this.focusedButton || !items.includes(this.focusedButton)) {
      this.lastMenuContext = contextKey;
      const preferred =
        items.find((b) => b.id === 'btn-start' || b.id === 'btn-resume' || b.id === 'btn-play-again') ??
        items[0];
      this.setFocusedButton(preferred, false);
    }
  }

  private navigateMenu(dir: 'up' | 'down' | 'left' | 'right'): void {
    const items = this.getActiveMenuItems();
    if (items.length === 0) return;

    let idx = this.focusedButton ? items.indexOf(this.focusedButton) : -1;
    if (idx < 0) {
      this.setFocusedButton(items[0]);
      return;
    }

    // 2-row aware navigation on Title Screen (row 0: New Adventure/Continue/Controls, row 1: Chapters I–III)
    const curRow = items[idx].dataset.menuRow;
    if (curRow !== undefined && (dir === 'up' || dir === 'down')) {
      const targetRow = curRow === '0' ? '1' : '0';
      const rowItems = items.filter((b) => b.dataset.menuRow === targetRow);
      if (rowItems.length > 0) {
        const sameRowItems = items.filter((b) => b.dataset.menuRow === curRow);
        const col = sameRowItems.indexOf(items[idx]);
        const nextBtn = rowItems[Math.min(col, rowItems.length - 1)];
        this.setFocusedButton(nextBtn);
        return;
      }
    }

    const delta = dir === 'right' || dir === 'down' ? 1 : -1;
    const nextIdx = (idx + delta + items.length) % items.length;
    this.setFocusedButton(items[nextIdx]);
  }

  private activateFocusedMenuItem(): void {
    const items = this.getActiveMenuItems();
    if (items.length === 0) return;
    const target = this.focusedButton && items.includes(this.focusedButton) ? this.focusedButton : items[0];
    target.click();
  }

  handleGamepadMenu(ev: PadMenuEvent): void {
    if (this.listeningTarget && this.listeningTarget.device === 'pad') {
      if (this.listeningArmed && ev.rawButton !== undefined) {
        const action = this.listeningTarget.action as PadBindableAction;
        this.listeningTarget = null;
        this.currentKeybinds = this.actions.onRebindPad(action, ev.rawButton);
        const def = ACTION_DEFINITIONS.find((d) => d.action === action);
        this.controlsStatusEl.textContent = `Bound "${def?.label ?? action}" to ${formatPadButton(ev.rawButton)}.`;
        this.renderControlsModal();
        this.refreshKeybindLabels();
      }
      return;
    }

    if (ev.dir) {
      this.navigateMenu(ev.dir);
    } else if (ev.confirm) {
      this.activateFocusedMenuItem();
    } else if (ev.back && this.controlsOpen) {
      this.closeControlsModal();
    }
  }

  private bindMenuAndRemapEvents(): void {
    window.addEventListener(
      'keydown',
      (e) => {
        // 1. Key Capture mode inside Controls Remapping Modal
        if (this.controlsOpen && this.listeningTarget) {
          e.preventDefault();
          e.stopPropagation();
          if (e.code === 'Escape') {
            this.listeningTarget = null;
            this.controlsStatusEl.textContent = 'Rebinding cancelled.';
            this.renderControlsModal();
            return;
          }
          if (this.listeningTarget.device === 'kbd') {
            const action = this.listeningTarget.action;
            this.listeningTarget = null;
            this.currentKeybinds = this.actions.onRebindKey(action, e.code);
            const def = ACTION_DEFINITIONS.find((d) => d.action === action);
            this.controlsStatusEl.textContent = `Bound "${def?.label ?? action}" to ${formatKeyCode(e.code)}.`;
            this.renderControlsModal();
            this.refreshKeybindLabels();
          }
          return;
        }

        // 2. Escape closes Controls Modal
        if (this.controlsOpen && e.code === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.closeControlsModal();
          return;
        }

        // 3. Unified Keyboard Navigation for Title, Pause, Controls & End screens
        const container = this.getActiveMenuContainer();
        if (!container) return;

        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          this.navigateMenu('up');
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault();
          this.navigateMenu('down');
        } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          this.navigateMenu('left');
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          this.navigateMenu('right');
        } else if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          this.activateFocusedMenuItem();
        }
      },
      true
    );

    // Mouse button capture while listening in Controls Remapping Modal
    window.addEventListener(
      'mousedown',
      (e) => {
        if (!this.controlsOpen || !this.listeningTarget || this.listeningTarget.device !== 'kbd' || !this.listeningArmed) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const code = `Mouse${e.button}`;
        const action = this.listeningTarget.action;
        this.listeningTarget = null;
        this.currentKeybinds = this.actions.onRebindKey(action, code);
        const def = ACTION_DEFINITIONS.find((d) => d.action === action);
        this.controlsStatusEl.textContent = `Bound "${def?.label ?? action}" to ${formatKeyCode(code)}.`;
        this.renderControlsModal();
        this.refreshKeybindLabels();
      },
      true
    );

    window.addEventListener(
      'contextmenu',
      (e) => {
        if (this.controlsOpen && this.listeningTarget) {
          e.preventDefault();
        }
      },
      true
    );
  }

  render(s: HudSnapshot): void {
    this.currentKeybinds = s.keybinds;
    this.refreshKeybindLabels();

    const isTitle = s.state === 'title';
    const isPlaying = s.state === 'playing';
    const isPaused = s.state === 'paused';
    const isOver = s.state === 'gameover';

    if (isPlaying && this.controlsOpen) {
      this.closeControlsModal();
    }

    this.titleEl.hidden = !isTitle;
    this.continueBtn.hidden = !isTitle || !this.actions.hasSave();
    this.hudLayer.hidden = isTitle;
    this.pauseModal.hidden = !isPaused || this.controlsOpen;
    this.endModal.hidden = !isOver;
    this.fullMapModal.hidden = !(isPlaying && s.mapOpen);

    this.syncMenuFocus(this.controlsOpen ? 'controls' : s.state);

    if (isOver) {
      this.endTitleEl.textContent = s.victory ? 'The Great Dawnbell Rings' : 'Fallen in the Wilds';
      this.endSubEl.textContent = s.victory
        ? "The Great Dawnbell rings again!"
        : 'Wren fell before restoring the Great Dawnbell. Gather Hearty Skewers and try again!';
      this.endStatsEl.innerHTML = `
        <div class="stat-tile"><span>Shrines</span><b>${s.shrinesActivated.length}/${s.totalShrines}</b></div>
        <div class="stat-tile"><span>Puzzles Solved</span><b>${s.puzzles.solved.length}/${PUZZLE_LIST.length}</b></div>
        <div class="stat-tile"><span>Clear Time</span><b>${formatTime(s.elapsedSeconds)}</b></div>
        <div class="stat-tile"><span>Golden Marks</span><b>${s.marks}</b></div>
      `;
    }

    if (isTitle) return;

    // Hearts
    const heartsKey = `${s.hp}/${s.maxHp}`;
    if (heartsKey !== this.lastHeartsKey) {
      this.lastHeartsKey = heartsKey;
      const total = Math.ceil(s.maxHp / 2);
      let html = '';
      for (let i = 0; i < total; i++) {
        const st = s.hp >= (i + 1) * 2 ? 'full' : s.hp === i * 2 + 1 ? 'half' : 'empty';
        html += HEART_SVG(st);
      }
      this.heartsEl.innerHTML = html;
    }

    this.shrinesCountEl.textContent = `${s.shrinesActivated.length}/${s.totalShrines}`;
    this.seedsCountEl.textContent = `${s.seedsFound.length}/${s.totalSeeds}`;
    this.marksCountEl.textContent = String(Math.round(s.marks));
    this.arrowsCountEl.textContent = String(Math.round(s.arrows));
    const totalFood = Math.round(s.meals + s.apples);
    this.mealsCountEl.textContent = String(totalFood);
    this.healStatBtn.classList.toggle('has-food', totalFood > 0);
    this.activeRuneId = s.activeRune;
    this.touchControlsEl.hidden = !this.touchEnabled || !isPlaying || s.mapOpen || Boolean(s.dialogue);

    // Compact Chapter & Active Objective Strip
    this.questChapterEl.textContent = s.story.storyFinished
      ? 'ETERNAL DAWN RESTORED'
      : `CH ${s.chapterRoman} · ${s.chapterTitle.toUpperCase()}`;
    this.questGoalEl.textContent = `▸ ${s.activeObjective}`;

    // Dawn Lamp Button (unlocked in Chapter III)
    this.lampBtn.hidden = !s.dawnLampUnlocked;
    this.lampBtn.classList.toggle('is-lit', s.dawnLampOn);
    this.lampBtn.title = `Dawn Lamp: ${s.dawnLampOn ? 'Lit' : 'Off'} (Press G)`;

    const todLabel = s.timeOfDay === 'day' ? 'Morning' : s.timeOfDay === 'sunset' ? 'Sunset' : 'Starlight';
    this.timeBtn.dataset.tod = s.timeOfDay;
    this.timeBtn.title = `Time: ${todLabel} (Press T)`;
    this.pauseTimeBtn.textContent = `Time: ${todLabel}`;
    const gfxLabel = this.actions.getGraphicsLabel();
    const gfxEl = this.root.querySelector('#btn-pause-gfx');
    if (gfxEl && gfxEl.textContent !== gfxLabel) gfxEl.textContent = gfxLabel;
    this.muteBtn.classList.toggle('is-muted', s.muted);
    this.pauseMuteBtn.textContent = s.muted ? 'Sound: Muted' : 'Sound: On';
    this.controllerTagEl.hidden = !s.gamepadConnected;

    // Transient Region Banner & Toast
    this.regionBannerEl.hidden = s.regionBannerTimer <= 0;
    if (s.regionBannerTimer > 0) this.regionBannerEl.textContent = s.regionName;

    this.toastEl.hidden = !s.toastText;
    if (s.toastText) this.toastEl.textContent = s.toastText;

    // Bullet Time / Flurry Rush badge + subtle BotW edge vignette
    this.slowMoBadgeEl.hidden = !(s.flurryRush || s.bulletTime);
    if (s.flurryRush) this.slowMoBadgeEl.textContent = 'FLURRY RUSH';
    else if (s.bulletTime) this.slowMoBadgeEl.textContent = 'BULLET TIME';
    this.hudLayer.classList.toggle('is-flurry', s.flurryRush);
    this.hudLayer.classList.toggle('is-bullettime', !s.flurryRush && s.bulletTime);

    // Diegetic Stamina Wheel
    this.staminaEl.hidden = !s.staminaVisible;
    if (s.staminaVisible) {
      const pct = Math.max(0, Math.min(1, s.stamina / s.staminaMax));
      const circ = 125.66;
      this.staminaCircle.style.strokeDashoffset = String(circ * (1 - pct));
      this.staminaCircle.style.stroke = s.staminaExhausted
        ? '#ef5244'
        : pct < 0.28
          ? '#f0b642'
          : '#62e65e';
    }

    // Bow Crosshair
    this.crosshairEl.hidden = !s.aiming;
    if (s.aiming) {
      const circ = 100.53;
      this.crosshairRing.style.strokeDashoffset = String(circ * (1 - s.aimCharge));
    }

    // Lock-on Reticle
    if (s.lockedTargetScreen) {
      this.lockReticleEl.hidden = false;
      this.lockReticleEl.style.left = `${s.lockedTargetScreen.x}%`;
      this.lockReticleEl.style.top = `${s.lockedTargetScreen.y}%`;
      this.lockNameEl.textContent = s.lockedTargetScreen.name;
      this.lockHpEl.style.width = `${s.lockedTargetScreen.hpPct}%`;
    } else {
      this.lockReticleEl.hidden = true;
    }

    // Contextual Interaction Prompt (tappable on mobile, reflects custom keybind on desktop/pad!)
    if (s.promptLabel && !s.dialogue) {
      this.promptEl.hidden = false;
      this.promptKeyEl.textContent =
        this.touchEnabled || s.activeDevice === 'touch'
          ? 'TAP'
          : s.activeDevice === 'pad'
            ? formatPadButton(s.keybinds.pad.interact)
            : formatKeyCode(s.keybinds.kbd.interact);
      this.promptTextEl.textContent = s.promptLabel;
    } else {
      this.promptEl.hidden = true;
    }

    // Boss Bar
    if (s.bossBar) {
      this.bossBarEl.hidden = false;
      this.bossNameEl.textContent = s.bossBar.name;
      this.bossFillEl.style.width = `${Math.max(0, (s.bossBar.hp / s.bossBar.maxHp) * 100)}%`;
    } else {
      this.bossBarEl.hidden = true;
    }

    // Dialogue overlay
    if (s.dialogue) {
      this.dialogueEl.hidden = false;
      this.dialogueWhoEl.textContent = s.dialogue.speaker;
      this.dialogueTextEl.textContent = s.dialogue.text;
      const keyLbl = formatKeyCode(s.keybinds.kbd.interact);
      const choiceKey = s.dialogueChoices ? JSON.stringify(s.dialogueChoices) + s.dialogueChoiceIndex : '';
      if (choiceKey !== this.lastChoiceKey) {
        this.lastChoiceKey = choiceKey;
        this.dialogueChoicesEl.hidden = !s.dialogueChoices;
        this.dialogueChoicesEl.innerHTML = (s.dialogueChoices ?? [])
          .map(
            (c, i) =>
              `<button class="dialogue-choice${i === s.dialogueChoiceIndex ? ' is-selected' : ''}" data-choice="${i}" ${c.disabled ? 'disabled' : ''}>${c.label}</button>`
          )
          .join('');
      }
      this.dialogueNextEl.hidden = Boolean(s.dialogueChoices);
      if (this.touchEnabled || s.activeDevice === 'touch') {
        this.dialogueNextEl.textContent =
          s.dialogueRemaining > 0
            ? `Next (${s.dialogueRemaining} more) · Tap anywhere to continue`
            : 'Tap anywhere to continue';
      } else {
        this.dialogueNextEl.textContent =
          s.dialogueRemaining > 0
            ? `Next (${s.dialogueRemaining} more) · Press ${keyLbl} / Space / A`
            : `Press ${keyLbl} / Space / A to continue`;
      }
    } else {
      this.dialogueEl.hidden = true;
    }

    // Rune Strip
    for (const r of RUNE_META) {
      const btn = this.runeButtons.get(r.id)!;
      btn.classList.toggle('is-active', s.activeRune === r.id);
      const cdEl = btn.querySelector<HTMLElement>('.rune-cd')!;
      const cd = s.runeCooldowns[r.id];
      if (r.id === 'bomb' && s.bombActive) {
        cdEl.hidden = false;
        cdEl.textContent = 'BOOM';
      } else if (cd > 0.05) {
        cdEl.hidden = false;
        cdEl.textContent = cd.toFixed(1);
      } else {
        cdEl.hidden = true;
      }
    }

    const kb = s.keybinds.kbd;
    const pb = s.keybinds.pad;
    if (s.activeDevice === 'pad') {
      this.runeCastHintEl.textContent = s.shieldSurfing
        ? `Shield Surfing · Steer Stick · (${formatPadButton(pb.jump)}) Ollie -> Glide`
        : `(${formatPadButton(pb.roll)}) Roll/Dodge · (${formatPadButton(pb.runeCast)}) Rune · (${formatPadButton(pb.heal)}) Heal · (${formatPadButton(pb.aim)}) Bow`;
    } else {
      this.runeCastHintEl.textContent = s.shieldSurfing
        ? `Shield Surfing · Steer · [${formatKeyCode(kb.jump)}] Ollie -> Paraglide`
        : s.gliding
          ? `Gliding · Steer · [${formatKeyCode(kb.attack)}] Jump-Slam · Ride Updrafts`
          : s.climbing
            ? `Climbing · Move · [${formatKeyCode(kb.jump)}] Leap Up`
            : `[${formatKeyCode(kb.roll)}] Roll/Dodge · [${formatKeyCode(kb.runeCast)}] Rune · [${formatKeyCode(kb.journal)}] Quests · [${formatKeyCode(kb.worldMap)}] Map · [${formatKeyCode(kb.jump)}×2] Glide`;
    }

    // Render Minimap (and Full Map / Quest Journal when open)
    this.drawMap(this.minimapCtx, this.minimapCanvas.width, s, true);
    if (isPlaying && s.mapOpen) {
      const showMap = s.mapTab === 'map';
      this.tabMapBtn.classList.toggle('is-active', showMap);
      this.tabJournalBtn.classList.toggle('is-active', !showMap);
      this.panelMapEl.hidden = !showMap;
      this.panelJournalEl.hidden = showMap;
      if (showMap) {
        this.drawMap(this.fullMapCtx, this.fullMapCanvas.width, s, false);
        this.renderFullMapLegend(s);
      } else {
        this.renderQuestJournal(s);
      }
    }
  }

  private drawMap(ctx: CanvasRenderingContext2D, size: number, s: HudSnapshot, zoomed: boolean): void {
    ctx.clearRect(0, 0, size, size);
    ctx.save();

    if (zoomed) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
    }

    ctx.drawImage(this.terrainMapCache, 0, 0, size, size);

    const toMap = (wx: number, wz: number): [number, number] => [
      ((wx / WORLD_PLAY_RADIUS) * 0.5 + 0.5) * size,
      ((wz / WORLD_PLAY_RADIUS) * 0.5 + 0.5) * size,
    ];

    // Subtle Puzzle Diamonds on Full World Map
    if (!zoomed) {
      for (const pz of PUZZLE_LIST) {
        const [mx, my] = toMap(pz.x, pz.z);
        const solved = isPuzzleSolved(s.puzzles, pz.id);
        ctx.beginPath();
        ctx.fillStyle = solved ? '#72f078' : '#7ef4ff';
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#14100c';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Draw Landmarks
    for (const lm of LANDMARKS) {
      if (lm.kind === 'overlook' && lm.id === 'overlook') continue;
      const [mx, my] = toMap(lm.x, lm.z);
      const awakened = lm.kind === 'shrine' && s.shrinesActivated.includes(lm.id);

      ctx.beginPath();
      if (lm.kind === 'spire') {
        ctx.fillStyle = '#f0c65a';
        ctx.arc(mx, my, zoomed ? 4.2 : 6.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#18120c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (lm.kind === 'shrine') {
        ctx.fillStyle = awakened ? '#ffe266' : lm.accent;
        const r = zoomed ? 3.5 : 5.5;
        ctx.moveTo(mx, my - r);
        ctx.lineTo(mx + r, my);
        ctx.lineTo(mx, my + r);
        ctx.lineTo(mx - r, my);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#18120c';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else if (lm.kind === 'city' || lm.kind === 'village') {
        ctx.fillStyle = lm.accent;
        const r = zoomed ? 3.2 : 4.5;
        ctx.fillRect(mx - r, my - r, r * 2, r * 2);
        ctx.strokeStyle = '#18120c';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(mx - r, my - r, r * 2, r * 2);
      } else if (lm.kind === 'tower' || lm.kind === 'desert' || lm.kind === 'quarry' || lm.kind === 'wilds') {
        ctx.fillStyle = lm.accent;
        ctx.arc(mx, my, zoomed ? 3 : 4.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#18120c';
        ctx.lineWidth = 1.3;
        ctx.stroke();
      } else if (!zoomed && lm.kind === 'camp') {
        ctx.fillStyle = '#ef6454';
        ctx.arc(mx, my, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!zoomed) {
        const showLabel =
          lm.fastTravel ||
          lm.kind === 'shrine' ||
          lm.id === 'gloaming_fen' ||
          lm.id === 'frostpeak' ||
          lm.id === 'stone_circle';
        if (showLabel) {
          const labelOffsets: Record<string, [number, number]> = {
            spire: [0, -10],
            village: [22, 14],
            shrine_wind: [-12, -10],
            shrine_embers: [14, -9],
            shrine_stillness: [0, -9],
            valenrock: [-14, -10],
            wizards_tower: [18, -10],
            sunscorch_oasis: [-14, -10],
            dwarven_quarry: [-10, -10],
            ashen_wilds: [0, 14],
            gloaming_fen: [4, -10],
            frostpeak: [18, 12],
            stone_circle: [4, -9],
          };
          const [ox, oy] = labelOffsets[lm.id] ?? [0, -10];
          ctx.font = '700 10.5px "Pixelify Sans", monospace';
          ctx.textAlign = 'center';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(14, 10, 6, 0.94)';
          ctx.strokeText(lm.name, mx + ox, my + oy);
          ctx.fillStyle = lm.fastTravel ? '#ffe99a' : lm.kind === 'shrine' ? '#c8fff0' : '#f4ead2';
          ctx.fillText(lm.name, mx + ox, my + oy);
        }
      }
    }

    // Draw Wren's live position & facing arrow
    const [px, py] = toMap(s.playerX, s.playerZ);
    ctx.translate(px, py);
    ctx.rotate(-s.playerYaw + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(4.8, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.8, 5);
    ctx.closePath();
    ctx.fillStyle = '#72f078';
    ctx.fill();
    ctx.strokeStyle = '#14100c';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.restore();
  }

  private renderFullMapLegend(s: HudSnapshot): void {
    const key = `${s.shrinesActivated.join(',')}|${s.seedsFound.length}|${s.chestsOpened}|${s.puzzles.solved.length}|${s.marks}`;
    if (key === this.lastLegendKey) return;
    this.lastLegendKey = key;

    const lodestones = LANDMARKS.filter((l) => l.fastTravel);
    const shrines = LANDMARKS.filter((l) => l.kind === 'shrine');
    this.fullMapLegendEl.innerHTML = `
      <h3>Lodestone Home-Teleports</h3>
      <ul class="shrine-checklist">
        ${lodestones
          .map(
            (lm) => `<li class="done">
              <span>✦ ${lm.name}</span>
              <button class="travel-btn" data-travel="${lm.id}">Warp</button>
            </li>`
          )
          .join('')}
      </ul>
      <h3>Ancient Bell Shrines (${s.shrinesActivated.length}/${s.totalShrines})</h3>
      <ul class="shrine-checklist">
        ${shrines
          .map((sh) => {
            const done = s.shrinesActivated.includes(sh.id);
            return `<li class="${done ? 'done' : ''}">
              <span>${done ? '★' : '◆'} ${sh.name}</span>
              ${done ? `<button class="travel-btn" data-travel="${sh.id}">Warp</button>` : '<span class="travel-lock">Locked</span>'}
            </li>`;
          })
          .join('')}
      </ul>
      <div class="map-stats">
        <div><span>Ancient Puzzles</span><b>${s.puzzles.solved.length}/${PUZZLE_LIST.length}</b></div>
        <div><span>Whisper-Seeds</span><b>${s.seedsFound.length}/${s.totalSeeds}</b></div>
        <div><span>Chests Opened</span><b>${s.chestsOpened}/${s.totalChests}</b></div>
        <div><span>Golden Marks</span><b>${s.marks}</b></div>
      </div>
    `;
  }

  private renderQuestJournal(s: HudSnapshot): void {
    const sqKey = SIDE_QUEST_LIST.map((q) => `${q.id}:${s.sideQuests[q.id].status}:${s.sideQuests[q.id].progress}`).join('|');
    const key = `${s.story.currentChapter}|${s.story.completedChapters.join(',')}|${s.story.completedEvents.join(',')}|${sqKey}|${s.puzzles.solved.join(',')}|${JSON.stringify(s.sagaJournal)}`;
    if (key === this.lastJournalKey) return;
    this.lastJournalKey = key;

    const chaptersHtml = ([1, 2, 3] as ChapterId[])
      .map((cid) => {
        const ch = CHAPTERS[cid];
        const isDone = s.story.completedChapters.includes(cid);
        const isCurrent = !s.story.storyFinished && s.story.currentChapter === cid;
        const badge = isDone ? 'Complete' : isCurrent ? 'Active' : 'Upcoming';
        const badgeCls = isDone ? 'done' : isCurrent ? 'active' : 'dim';
        return `
          <div class="quest-card ${isCurrent ? 'is-current' : isDone ? 'is-done' : ''}">
            <div class="quest-card-top">
              <strong>Bell Shrines ${ch.roman} · ${ch.goals[ch.goals.length - 1].label.replace(/^.*& /, '').replace(/^Awaken /, '')}</strong>
              <span class="quest-badge ${badgeCls}">${badge}</span>
            </div>
            <p class="quest-desc">${ch.summary}</p>
            <ul class="quest-goals">
              ${ch.goals
                .map((g) => {
                  const met = isDone || s.story.completedEvents.includes(g.event);
                  return `<li class="${met ? 'met' : ''}">${met ? '✓' : '○'} ${g.label}</li>`;
                })
                .join('')}
            </ul>
            <div class="quest-reward">Reward: ${ch.rewardText}</div>
          </div>
        `;
      })
      .join('');

    const sideQuestsHtml = SIDE_QUEST_LIST.map((q) => {
      const entry = s.sideQuests[q.id];
      const badgeText =
        entry.status === 'completed'
          ? 'Complete'
          : entry.status === 'ready'
            ? 'Turn In!'
            : entry.status === 'active'
              ? `${entry.progress}/${q.targetCount}`
              : 'Available';
      const badgeCls =
        entry.status === 'completed'
          ? 'done'
          : entry.status === 'ready'
            ? 'ready'
            : entry.status === 'active'
              ? 'active'
              : 'dim';
      return `
        <div class="quest-card ${entry.status === 'completed' ? 'is-done' : ''}">
          <div class="quest-card-top">
            <strong>${q.title}</strong>
            <span class="quest-badge ${badgeCls}">${badgeText}</span>
          </div>
          <div class="quest-meta">${q.giver} · ${q.region}</div>
          <p class="quest-desc">${q.summary}</p>
          <div class="quest-reward">${q.objectiveLabel}: ${entry.progress}/${q.targetCount} · ${q.rewardText}</div>
        </div>
      `;
    }).join('');

    const puzzlesHtml = PUZZLE_LIST.map((pz) => {
      const solved = isPuzzleSolved(s.puzzles, pz.id);
      return `
        <div class="quest-card ${solved ? 'is-done' : ''}">
          <div class="quest-card-top">
            <strong>${pz.title}</strong>
            <span class="quest-badge ${solved ? 'done' : 'active'}">${solved ? 'Solved' : 'Unsolved'}</span>
          </div>
          <div class="quest-meta">${pz.region}</div>
          <p class="quest-desc">${pz.hint}</p>
          <div class="quest-reward">${pz.rewardText}</div>
        </div>
      `;
    }).join('');

    const card = (e: HudSnapshot['sagaJournal']['main'][number]) => `
        <div class="quest-card ${e.status === 'active' ? 'is-current' : e.status === 'done' ? 'is-done' : ''}">
          <div class="quest-card-top">
            <strong>${e.title}</strong>
            <span class="quest-badge ${e.status}">${e.badge}</span>
          </div>
          <div class="quest-meta">${e.meta}</div>
          <p class="quest-desc">${e.text}</p>
          ${e.goals ? `<ul class="quest-goals">${e.goals.map((g) => `<li class="${g.met ? 'met' : ''}">${g.met ? '✓' : '○'} ${g.label}</li>`).join('')}</ul>` : ''}
        </div>`;
    const sagaMain = s.sagaJournal.main.map(card).join('');
    const sagaSide = s.sagaJournal.side.map(card).join('');
    const shrinesStarted = s.story.completedEvents.length > 0;

    this.panelJournalEl.innerHTML = `
      <div class="journal-grid">
        <div class="journal-col">
          <h3>Main Story · The Dawnbell Chronicle</h3>
          ${sagaMain}
        </div>
        <div class="journal-col">
          <h3>Side Quests</h3>
          ${sagaSide}
          ${sideQuestsHtml}
          <h3>The Bell Shrines</h3>
          ${shrinesStarted ? chaptersHtml : '<p class="quest-desc">Brother Aldous at the Chapel of the Dawn knows an old tale about three shrines.</p>'}
          <h3>Ancient Puzzles (${s.puzzles.solved.length}/${PUZZLE_LIST.length})</h3>
          ${puzzlesHtml}
        </div>
      </div>
    `;
  }
}
