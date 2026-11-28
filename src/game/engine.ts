import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  WATER_Y,
  WORLD_PLAY_RADIUS,
  LANDMARKS,
  clamp,
  damp,
  dampAngle,
  getTerrainHeight,
  getTerrainNormal,
  getRegionName,
} from './math';
import {
  RuneId,
  TimeOfDayPreset,
  StaminaState,
  StaminaActivity,
  PlayerInventory,
  ArrowState,
  DodgeStyle,
  TOTAL_SHRINES,
  TOTAL_SEEDS,
  createStamina,
  stepStamina,
  consumeClimbLeap,
  consumeRollStamina,
  classifyDodgeStyle,
  computeJumpSlamDamage,
  computeSwordDamage,
  checkPerfectParry,
  checkFlurryRush,
  createArrow,
  stepArrow,
  computeBombBlast,
  computeStasisLaunch,
  createInitialInventory,
  cookHeartyMeal,
  consumeHealingItem,
  activateShrine,
  stepShieldSurf,
  planCryonisPillars,
  collectWhisperSeed,
  nextTimeOfDay,
} from './mechanics';
import { InputManager, InputDevice, type TouchActionId } from './input';
import type { KeybindConfig, BindableAction, PadBindableAction } from './keybinds';
import { SoundEngine } from './audio';
import {
  MaterialLibrary,
  createMaterialLibrary,
  buildWrenHero,
  buildPipCompanion,
  buildBombMesh,
  buildCryonisPillar,
  HeroRig,
  PipRig,
} from './voxelBuilder';
import {
  buildOpenWorld,
  WorldData,
  SolidCollider,
  StasisBoulderProp,
  WhisperSecretProp,
  ChimeBellProp,
  DawnBrazierProp,
  OreVeinProp,
} from './world';
import {
  resolveActorAgainstColliders,
  sampleSupportSurfaceHeight,
  resolveCircleOverlapXZ,
  DEFAULT_STEP_UP_HEIGHT,
} from './collision';
import { COLLISION_PROXY_LAYER } from './collisionProxies';
import { EnemyManager, EnemyEntity, EnemyUpdateCallbacks } from './enemies';
import {
  CHAPTERS,
  SIDE_QUESTS,
  StoryState,
  SideQuestState,
  ChapterId,
  StoryEvent,
  DialogueLine,
  createStoryState,
  createSideQuestState,
  recordStoryEvent,
  acceptSideQuest,
  setSideQuestProgress,
  completeSideQuest,
  getCurrentChapterDef,
  getNextObjectiveLabel,
  getOdoDialogue,
  getMiraDialogue,
  getBramDialogue,
} from './story';
import {
  PuzzleId,
  PuzzleState,
  createPuzzleState,
  ringChimeBell,
  checkStasisSocketLock,
  igniteDawnBrazier,
  countSolvedPuzzles,
  isPuzzleSolved,
} from './puzzles';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export interface HudSnapshot {
  state: GameState;
  victory: boolean;
  hp: number;
  maxHp: number;
  stamina: number;
  staminaMax: number;
  staminaExhausted: boolean;
  staminaVisible: boolean;
  marks: number;
  arrows: number;
  apples: number;
  meals: number;
  shrinesActivated: string[];
  totalShrines: number;
  seedsFound: string[];
  totalSeeds: number;
  activeRune: RuneId;
  runeCooldowns: Record<RuneId, number>;
  bombActive: boolean;
  regionName: string;
  regionBannerTimer: number;
  toastText: string;
  promptLabel: string;
  aiming: boolean;
  aimCharge: number;
  bulletTime: boolean;
  flurryRush: boolean;
  climbing: boolean;
  gliding: boolean;
  shieldSurfing: boolean;
  rolling: boolean;
  jumpSlamming: boolean;
  timeOfDay: TimeOfDayPreset;
  lockedTargetScreen: { x: number; y: number; name: string; hpPct: number } | null;
  bossBar: { name: string; hp: number; maxHp: number } | null;
  activeDevice: InputDevice;
  gamepadConnected: boolean;
  pointerLocked: boolean;
  keybinds: KeybindConfig;
  muted: boolean;
  mapOpen: boolean;
  mapTab: 'map' | 'journal';
  story: StoryState;
  chapterRoman: 'I' | 'II' | 'III';
  chapterTitle: string;
  activeObjective: string;
  sideQuests: SideQuestState;
  puzzles: PuzzleState;
  dawnLampUnlocked: boolean;
  dawnLampOn: boolean;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  elapsedSeconds: number;
  enemiesDefeated: number;
  chestsOpened: number;
  totalChests: number;
  dialogue: { speaker: string; text: string } | null;
  dialogueRemaining: number;
}

export interface PadMenuEvent {
  dir?: 'up' | 'down' | 'left' | 'right';
  confirm?: boolean;
  back?: boolean;
  rawButton?: number;
}

interface PooledShockwave {
  active: boolean;
  age: number;
  duration: number;
  maxRadius: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

interface ActiveCryonis {
  id: string;
  x: number;
  baseY: number;
  z: number;
  rise: number;
  mesh: THREE.Group;
  collider: SolidCollider;
}

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  color: THREE.Color;
}

interface ActiveArrow {
  state: ArrowState;
  mesh: THREE.Group;
}

interface ActiveBomb {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  mesh: THREE.Group;
}

const SAVE_KEY = 'dawnbell_3d_botw_save_v1';

// Scratch objects outside render loop (zero-GC discipline)
const _v3A = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const _v3C = new THREE.Vector3();
const _ray = new THREE.Raycaster();
_ray.layers.set(COLLISION_PROXY_LAYER);
const _dummy = new THREE.Object3D();
const _zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
const _colA = new THREE.Color();
const _colB = new THREE.Color();
const _colC = new THREE.Color();

import { GraphicsPipeline } from './graphics';

function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class DawnbellEngine {
  private readonly mountEl: HTMLElement;
  private readonly onHudUpdate: (snap: HudSnapshot) => void;

  private readonly isSoftwareGl: boolean;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private gfx!: GraphicsPipeline;
  private sunOrb!: THREE.Mesh;

  private mats!: MaterialLibrary;
  private world!: WorldData;
  private hero!: HeroRig;
  private pip!: PipRig;
  private enemies!: EnemyManager;
  private input = new InputManager();
  private audio = new SoundEngine();

  // Particle & Shockwave pools
  private readonly particleCap = 220;
  private particleMesh!: THREE.InstancedMesh;
  private particles: PooledParticle[] = [];
  private particleCursor = 0;
  private shockwaves: PooledShockwave[] = [];
  private padMenuHandler: ((ev: PadMenuEvent) => void) | null = null;

  // Dynamic gameplay entities
  private arrows: ActiveArrow[] = [];
  private activeBomb: ActiveBomb | null = null;
  private cryonisPillars: ActiveCryonis[] = [];
  private cryonisSeq = 0;
  private galeVisual: THREE.Group | null = null;
  private galeTimer = 0;

  // Core game state
  private gameState: GameState = 'title';
  private victory = false;
  private mapOpen = false;
  private mapTab: 'map' | 'journal' = 'map';
  private dialogue: { speaker: string; text: string } | null = null;
  private dialogueQueue: DialogueLine[] = [];
  private story: StoryState = createStoryState(1);
  private sideQuests: SideQuestState = createSideQuestState();
  private puzzles: PuzzleState = createPuzzleState();
  private dawnLampOn = false;
  private minedOres: string[] = [];
  private hitTargets: string[] = [];
  private rowanGifted = false;
  private stasisHomePositions: Array<{ id: string; x: number; y: number; z: number }> = [];
  private elapsedSeconds = 0;
  private enemiesDefeated = 0;
  private dayTime = 0.28; // luminous sunny late-morning start
  private timeOfDay: TimeOfDayPreset = 'day';

  // Player kinematics & BotW state
  private px = 0;
  private py = 6.0;
  private pz = 46;
  private pvx = 0;
  private pvy = 0;
  private pvz = 0;
  private pYaw = Math.PI; // facing North (-Z) straight toward Dawnbell Spire!
  private grounded = true;
  private coyoteTimer = 0;
  private climbing = false;
  private climbNormalX = 0;
  private climbNormalZ = 1;
  private climbTargetCollider: SolidCollider | null = null;
  private climbCooldown = 0;
  private gliding = false;
  private glideGraceTimer = 0;
  private shieldSurfing = false;
  private swimming = false;
  private walkDist = 0;
  private stepAccum = 0;
  private scaleX = 1;
  private scaleY = 1;

  // Combat & Rune state
  private inv: PlayerInventory = createInitialInventory();
  private stamina: StaminaState = createStamina(100);
  private invulnTimer = 0;
  private hitFlashTimer = 0;
  private hitstopTimer = 0;
  private trauma = 0;
  private comboStep: 1 | 2 | 3 = 1;
  private comboResetTimer = 0;
  private attackTimer = 0;
  private attackCooldown = 0;
  private attackHitSet = new Set<string>();
  private spinChargeTime = 0;
  private isSpinning = false;
  private shieldHeldTime = 0;
  private isShielding = false;
  private dodgeTimer = 0;
  private dodgeDuration = 0.42;
  private dodgeStyle: DodgeStyle = 'roll';
  private jumpSlamming = false;
  private jumpSlamStartY = 0;
  private flurryTimer = 0;
  private aimCharge = 0;
  private isAiming = false;
  private lockedTarget: EnemyEntity | null = null;
  private activeRune: RuneId = 'bomb';
  private runeCooldowns: Record<RuneId, number> = { bomb: 0, stasis: 0, gale: 0, cryonis: 0 };

  // Camera rig
  private camYaw = Math.PI; // behind Wren looking North
  private camPitch = 0.14;
  private camPos = new THREE.Vector3(0, 12, 56);
  private camLook = new THREE.Vector3(0, 6, 30);
  private titleOrbitAngle = 0.4;

  // UI feedback
  private currentRegion = 'Awakening Overlook';
  private regionBannerTimer = 0;
  private toastText = '';
  private toastTimer = 0;
  private promptLabel = '';
  private nearestInteractAction: (() => void) | null = null;
  private lastActiveDevice: InputDevice = 'kbd';
  private lastGamepadConnected = false;
  private lastPointerLocked = false;

  // Loop management
  private running = false;
  private frameId = 0;
  private lastTime = 0;
  private hudEmitAccum = 0;
  private readonly onResizeBound = () => this.handleResize();

  constructor(mountEl: HTMLElement, onHudUpdate: (snap: HudSnapshot) => void) {
    this.mountEl = mountEl;
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareGl();

    this.initThree();
    this.initParticles();
    this.buildAllSceneObjects();
    this.gfx.resize(this.mountEl.clientWidth || window.innerWidth, Math.max(1, this.mountEl.clientHeight || window.innerHeight), true);
    this.gfx.apply();

    this.input.attach(this.renderer.domElement, () => this.gameState === 'playing' && !this.mapOpen && !this.dialogue);
    window.addEventListener('resize', this.onResizeBound);

    this.setGameState('title');
    this.running = true;
    this.lastTime = performance.now();
    this.tick();
  }

  hasSave(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  getKeybinds(): KeybindConfig {
    return this.input.getKeybinds();
  }

  rebindKey(action: BindableAction, code: string): KeybindConfig {
    const next = this.input.rebindKeyboard(action, code);
    this.emitHud();
    return next;
  }

  rebindPad(action: PadBindableAction, btnIndex: number): KeybindConfig {
    const next = this.input.rebindGamepad(action, btnIndex);
    this.emitHud();
    return next;
  }

  resetKeybinds(): KeybindConfig {
    const next = this.input.resetKeybinds();
    this.emitHud();
    return next;
  }

  setPadMenuHandler(fn: (ev: PadMenuEvent) => void): void {
    this.padMenuHandler = fn;
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          inv: this.inv,
          story: this.story,
          sideQuests: this.sideQuests,
          puzzles: this.puzzles,
          dawnLampOn: this.dawnLampOn,
          minedOres: this.minedOres,
          hitTargets: this.hitTargets,
          rowanGifted: this.rowanGifted,
          timeOfDay: this.timeOfDay,
          px: this.px,
          pz: this.pz,
          enemiesDefeated: this.enemiesDefeated,
          elapsedSeconds: this.elapsedSeconds,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }

  private loadProgress(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data && data.inv) {
        this.inv = { ...createInitialInventory(), ...data.inv };
        if (data.story) {
          this.story = { ...createStoryState(1), ...data.story };
        }
        if (data.sideQuests) {
          this.sideQuests = { ...createSideQuestState(), ...data.sideQuests };
        }
        if (data.puzzles) {
          this.puzzles = { ...createPuzzleState(), ...data.puzzles };
        }
        this.dawnLampOn = Boolean(data.dawnLampOn);
        this.minedOres = Array.isArray(data.minedOres) ? data.minedOres : [];
        this.hitTargets = Array.isArray(data.hitTargets) ? data.hitTargets : [];
        this.rowanGifted = Boolean(data.rowanGifted);
        if (data.timeOfDay === 'day' || data.timeOfDay === 'sunset' || data.timeOfDay === 'starlight') {
          this.timeOfDay = data.timeOfDay;
        }
        if (typeof data.px === 'number' && typeof data.pz === 'number') {
          this.px = clamp(data.px, -WORLD_PLAY_RADIUS + 8, WORLD_PLAY_RADIUS - 8);
          this.pz = clamp(data.pz, -WORLD_PLAY_RADIUS + 8, WORLD_PLAY_RADIUS - 8);
          this.py = Math.max(WATER_Y + 0.5, getTerrainHeight(this.px, this.pz));
        }
        this.enemiesDefeated = data.enemiesDefeated || 0;
        this.elapsedSeconds = data.elapsedSeconds || 0;
        // Restore visual state of activated shrines, puzzles, ore veins, targets & opened chests
        for (const s of this.world.shrines) {
          if (this.inv.shrinesActivated.includes(s.id)) this.applyShrineVisualActivated(s);
        }
        for (const ch of this.world.chests) {
          if (this.inv.chestsOpened.includes(ch.id)) {
            ch.opened = true;
            ch.openAnim = 1;
            ch.lid.rotation.x = -1.65;
            if (ch.sealRing) ch.sealRing.visible = false;
          } else if (ch.puzzleId && isPuzzleSolved(this.puzzles, ch.puzzleId) && ch.sealRing) {
            ch.sealRing.visible = false;
          }
        }
        for (const ws of this.world.whisperSecrets) {
          if (this.inv.seedsFound.includes(ws.id)) {
            ws.found = true;
            if (ws.balloon) ws.balloon.visible = false;
            ws.sprite.visible = true;
          }
        }
        for (const bell of this.world.chimeBells) {
          bell.lit = isPuzzleSolved(this.puzzles, 'chime_bells') || this.puzzles.chimeProgress.includes(bell.color);
          bell.glowMat.emissiveIntensity = bell.lit ? 1.5 : 0.15;
        }
        if (this.puzzles.socketLocked) {
          this.applySocketLockedVisual();
        }
        for (const br of this.world.dawnBraziers) {
          if (this.puzzles.litBraziers.includes(br.id)) {
            br.lit = true;
            br.flame1.visible = true;
            br.flame2.visible = true;
            br.light.intensity = 2.4;
          }
        }
        for (const tgt of this.world.archeryTargets) {
          if (this.hitTargets.includes(tgt.id)) {
            tgt.hit = true;
            tgt.hitAnim = 1;
            tgt.board.rotation.x = -Math.PI * 0.48;
          }
        }
        for (const vein of this.world.oreVeins) {
          if (this.minedOres.includes(vein.id)) {
            vein.mined = true;
            vein.crystalGroup.visible = false;
          }
        }
        this.stamina = createStamina(this.inv.maxStamina || 100);
        return true;
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  }

  private initThree(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    const isMobileViewport =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 900);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, isMobileViewport ? 1.5 : 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.mountEl.clientWidth || window.innerWidth, this.mountEl.clientHeight || window.innerHeight);

    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Dawnbell 3D Open World');
    this.mountEl.innerHTML = '';
    this.mountEl.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#78bff2');
    this.scene.fog = new THREE.Fog('#96cef7', 95, 320);

    // Studio Environment Reflections via RoomEnvironment + PMREMGenerator (balanced so voxel shading stays rich)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.36;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      56,
      (this.mountEl.clientWidth || window.innerWidth) / Math.max(1, this.mountEl.clientHeight || window.innerHeight),
      0.2,
      560
    );

    // Warm sunlit key light + crisp cool sky/forest HemisphereLight contrast
    this.hemiLight = new THREE.HemisphereLight(0xaad8ff, 0x3b542c, 0.48);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffefc8, 1.75);
    this.sunLight.position.set(34, 52, 26);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 6;
    this.sunLight.shadow.camera.far = 140;
    const d = 36;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.gfx = new GraphicsPipeline(this.renderer, this.scene, this.camera, this.sunLight, this.isSoftwareGl);

    // Voxel sun orb high in the sky
    this.sunOrb = new THREE.Mesh(
      new THREE.BoxGeometry(8, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff3b8 })
    );
    this.scene.add(this.sunOrb);

    this.mats = createMaterialLibrary(this.renderer.capabilities.getMaxAnisotropy());
  }

  private initParticles(): void {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(geo, mat, this.particleCap);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < this.particleCap; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 0.15,
        gravity: 9.8,
        color: new THREE.Color(0xffffff),
      });
      this.particleMesh.setMatrixAt(i, _zeroMat);
      this.particleMesh.setColorAt(i, new THREE.Color(0xffffff));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);

    // Pre-allocated BotW Shockwave Ring pool (Parry, Jump-Strike Slam, Spin Attack, Explosions)
    const ringGeo = new THREE.RingGeometry(0.72, 1.0, 28);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe466,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockwaves.push({
        active: false,
        age: 0,
        duration: 0.35,
        maxRadius: 4,
        mesh,
        mat,
      });
    }
  }

  private spawnShockwave(x: number, y: number, z: number, colorHex: number, maxRadius = 4.5, duration = 0.36): void {
    const sw = this.shockwaves.find((s) => !s.active) ?? this.shockwaves[0];
    sw.active = true;
    sw.age = 0;
    sw.duration = duration;
    sw.maxRadius = maxRadius;
    sw.mat.color.setHex(colorHex);
    sw.mat.opacity = 0.85;
    sw.mesh.position.set(x, y + 0.14, z);
    sw.mesh.scale.set(0.3, 1, 0.3);
    sw.mesh.visible = true;
  }

  private spawnParticles(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count: number,
    speed = 5,
    gravity = 11,
    size = 0.18
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particleCap;
      const a = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.85) * speed;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.35;
      p.y = y + (Math.random() - 0.5) * 0.35;
      p.z = z + (Math.random() - 0.5) * 0.35;
      p.vx = Math.cos(a) * spd;
      p.vy = (0.4 + Math.random() * 0.9) * speed * 0.75;
      p.vz = Math.sin(a) * spd;
      p.maxLife = 0.35 + Math.random() * 0.45;
      p.life = p.maxLife;
      p.size = size * (0.7 + Math.random() * 0.7);
      p.gravity = gravity;
      p.color.setHex(colorHex);
    }
  }

  private updateParticles(dt: number): void {
    let anyChange = false;
    for (let i = 0; i < this.particleCap; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChange = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.particleMesh.setMatrixAt(i, _zeroMat);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const s = p.size * (p.life / p.maxLife);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 6, p.life * 4, 0);
      _dummy.scale.set(s, s, s);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    if (anyChange) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }

    // Update active Shockwave Rings
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;
      sw.age += dt;
      const t = sw.age / sw.duration;
      if (t >= 1) {
        sw.active = false;
        sw.mesh.visible = false;
      } else {
        const eased = 1 - Math.pow(1 - t, 3);
        const rad = 0.35 + eased * sw.maxRadius;
        sw.mesh.scale.set(rad, 1, rad);
        sw.mat.opacity = (1 - t) * 0.82;
      }
    }
  }

  private buildAllSceneObjects(): void {
    this.world = buildOpenWorld(this.mats);
    this.scene.add(this.world.group);
    this.stasisHomePositions = this.world.stasisBoulders.map((sb) => ({
      id: sb.id,
      x: sb.x,
      y: sb.y,
      z: sb.z,
    }));

    this.hero = buildWrenHero(this.mats);
    this.scene.add(this.hero.root);
    this.scene.add(this.hero.contactShadow);

    this.pip = buildPipCompanion(this.mats);
    this.scene.add(this.pip.root);

    this.enemies = new EnemyManager(this.scene, this.mats);
    this.enemies.spawnAll();

    this.resetPlayerToOverlook();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private resetPlayerToOverlook(): void {
    this.px = 0;
    this.pz = 46;
    this.py = getTerrainHeight(this.px, this.pz);
    this.pvx = 0;
    this.pvy = 0;
    this.pvz = 0;
    this.pYaw = Math.PI; // Facing North straight toward the Great Dawnbell Spire!
    this.camYaw = Math.PI;
    this.camPitch = 0.14;
    this.grounded = true;
    this.climbing = false;
    this.gliding = false;
    this.glideGraceTimer = 0;
    this.shieldSurfing = false;
    this.swimming = false;
    this.stamina = createStamina(this.inv.maxStamina || 100);
    this.invulnTimer = 0;
    this.hitFlashTimer = 0;
    this.flurryTimer = 0;
    this.lockedTarget = null;
    this.isAiming = false;
    this.isShielding = false;
    this.hero.root.position.set(this.px, this.py, this.pz);
    this.hero.root.rotation.y = this.pYaw;
    this.hero.contactShadow.position.set(this.px, this.py + 0.04, this.pz);
    this.pip.root.position.set(this.px + 0.9, this.py + 1.9, this.pz - 0.5);
  }

  startNewGame(startChapter: ChapterId = 1, skipIntroDialogue = false): void {
    this.audio.unlock();
    this.inv = createInitialInventory();
    this.story = createStoryState(startChapter);
    this.sideQuests = createSideQuestState();
    this.puzzles = createPuzzleState();
    this.minedOres = [];
    this.hitTargets = [];
    this.rowanGifted = false;
    this.dawnLampOn = startChapter === 3;
    this.victory = false;
    this.mapOpen = false;
    this.mapTab = 'map';
    this.dialogue = null;
    this.dialogueQueue = [];
    this.elapsedSeconds = 0;
    this.enemiesDefeated = 0;
    this.timeOfDay = startChapter === 3 ? 'starlight' : startChapter === 2 ? 'sunset' : 'day';
    this.runeCooldowns = { bomb: 0, stasis: 0, gale: 0, cryonis: 0 };
    this.clearDynamicCombatEntities();

    // Reset world interactables, puzzles, ore veins, targets & enemies
    for (const s of this.world.shrines) {
      s.activated = false;
      (s.beam.material as THREE.MeshBasicMaterial).opacity = 0.24;
      s.beam.scale.set(1, 1, 1);
    }
    for (const ch of this.world.chests) {
      ch.opened = false;
      ch.openAnim = 0;
      ch.lid.rotation.x = 0;
      ch.glow.visible = false;
      if (ch.sealRing) ch.sealRing.visible = true;
    }
    for (const cb of this.world.crackedBoulders) {
      cb.broken = false;
      cb.group.visible = true;
      cb.collider.active = true;
      this.world.proxyRegistry.sync(cb.collider);
    }
    for (const b of this.world.barrels) {
      b.exploded = false;
      b.group.visible = true;
    }
    for (const p of this.world.pickups) {
      p.collected = false;
      p.mesh.visible = true;
    }
    for (const ws of this.world.whisperSecrets) {
      ws.found = false;
      if (ws.balloon) ws.balloon.visible = true;
      ws.sprite.visible = false;
    }
    for (const bell of this.world.chimeBells) {
      bell.lit = false;
      bell.swingAngle = 0;
      bell.swingVel = 0;
      bell.bell.rotation.x = 0;
      bell.glowMat.emissiveIntensity = 0.15;
    }
    const sock = this.world.runicSocket;
    sock.locked = false;
    sock.runeMat.color.setHex(0x6ef2ce);
    sock.runeMat.emissive.setHex(0x42d8b4);
    sock.runeMat.emissiveIntensity = 0.55;
    for (const bm of sock.beacons) {
      bm.color.setHex(0x6ef2ce);
      bm.emissive.setHex(0x42d8b4);
      bm.emissiveIntensity = 0.7;
    }
    for (const sb of this.world.stasisBoulders) {
      const home = this.stasisHomePositions.find((h) => h.id === sb.id);
      if (home) {
        sb.x = home.x;
        sb.y = home.y;
        sb.z = home.z;
      }
      sb.vx = 0;
      sb.vy = 0;
      sb.vz = 0;
      sb.stasisTimer = 0;
      sb.stasisHits = 0;
      sb.arrowIndicator.visible = false;
      sb.group.position.set(sb.x, sb.y, sb.z);
      sb.group.rotation.set(0, 0, 0);
      sb.collider.x = sb.x;
      sb.collider.z = sb.z;
      sb.collider.minY = sb.y;
      sb.collider.maxY = sb.y + 1.85;
      this.world.proxyRegistry.sync(sb.collider);
    }
    for (const br of this.world.dawnBraziers) {
      br.lit = false;
      br.flame1.visible = false;
      br.flame2.visible = false;
      br.light.intensity = 0;
    }
    for (const tgt of this.world.archeryTargets) {
      tgt.hit = false;
      tgt.hitAnim = 0;
      tgt.board.rotation.x = 0;
    }
    for (const vein of this.world.oreVeins) {
      vein.mined = false;
      vein.crystalGroup.visible = true;
    }

    this.enemies.spawnAll();
    this.resetPlayerToOverlook();

    const chDef = CHAPTERS[startChapter];
    this.currentRegion = 'Awakening Overlook';
    this.regionBannerTimer = 3.2;
    this.showToast(`${chDef.subtitle} — ${getNextObjectiveLabel(this.story)}`, 4.0);

    // Immediately snap gameplay camera smoothly behind Wren framing the full Dawnbell Spire!
    this.camPos.set(this.px, this.py + 3.4, this.pz + 7.8);
    this.camLook.set(this.px, this.py + 2.7, this.pz - 12);

    this.setGameState('playing');
    if (!skipIntroDialogue) {
      this.enqueueDialogue(chDef.introDialogue);
    }
  }

  continueGame(): void {
    this.audio.unlock();
    this.startNewGame(1, true);
    this.loadProgress();
    this.camPos.set(this.px - Math.sin(this.camYaw) * 8.2, this.py + 4.2, this.pz - Math.cos(this.camYaw) * 8.2);
    this.camLook.set(this.px, this.py + 1.8, this.pz);
    this.showToast('Journey resumed');
    this.emitHud();
  }

  resumeGame(): void {
    if (this.gameState === 'paused') {
      this.audio.unlock();
      this.setGameState('playing');
    }
  }

  pauseGame(): void {
    if (this.gameState === 'playing') {
      this.mapOpen = false;
      this.dialogue = null;
      this.dialogueQueue = [];
      this.setGameState('paused');
    }
  }

  returnToTitle(): void {
    this.mapOpen = false;
    this.dialogue = null;
    this.dialogueQueue = [];
    this.setGameState('title');
  }

  toggleMute(): boolean {
    const m = this.audio.toggleMute();
    this.emitHud();
    return m;
  }

  toggleMap(): void {
    if (this.gameState !== 'playing') return;
    if (this.mapOpen && this.mapTab === 'map') {
      this.mapOpen = false;
    } else {
      this.mapOpen = true;
      this.mapTab = 'map';
      this.input.exitPointerLock();
    }
    this.emitHud();
  }

  toggleJournal(): void {
    if (this.gameState !== 'playing') return;
    if (this.mapOpen && this.mapTab === 'journal') {
      this.mapOpen = false;
    } else {
      this.mapOpen = true;
      this.mapTab = 'journal';
      this.input.exitPointerLock();
    }
    this.emitHud();
  }

  openMapTab(tab: 'map' | 'journal'): void {
    if (this.gameState !== 'playing') return;
    this.mapOpen = true;
    this.mapTab = tab;
    this.input.exitPointerLock();
    this.emitHud();
  }

  toggleDawnLamp(): void {
    if (this.gameState !== 'playing') return;
    if (!this.story.dawnLampUnlocked) {
      this.showToast('The Dawn Lamp kindles when Chapter III: The Gloaming Fen begins!', 2.6);
      return;
    }
    this.dawnLampOn = !this.dawnLampOn;
    this.audio.playPickup();
    this.showToast(this.dawnLampOn ? 'Dawn Lamp Kindled — Mist parts before you' : 'Dawn Lamp Dimmed', 2.0);
    this.emitHud();
  }

  private enqueueDialogue(lines: DialogueLine[]): void {
    if (lines.length === 0) return;
    this.dialogue = lines[0];
    this.dialogueQueue = lines.slice(1);
    this.input.exitPointerLock();
    this.emitHud();
  }

  dismissDialogue(): void {
    if (this.dialogueQueue.length > 0) {
      this.dialogue = this.dialogueQueue.shift() ?? null;
    } else {
      this.dialogue = null;
    }
    this.emitHud();
  }

  selectRune(id: RuneId): void {
    this.activeRune = id;
    this.emitHud();
  }

  cycleGraphics(): string {
    return this.gfx.cycleSetting();
  }

  graphicsLabel(): string {
    return this.gfx.label();
  }

  cycleTimeOfDay(): void {
    this.timeOfDay = nextTimeOfDay(this.timeOfDay);
    const label =
      this.timeOfDay === 'day'
        ? 'Morning Sunlight'
        : this.timeOfDay === 'sunset'
          ? 'Golden Sunset'
          : 'Starlight Twilight';
    this.audio.playPickup();
    this.showToast(`Time shifted to ${label}`, 2.4);
    this.emitHud();
  }

  fastTravelTo(landmarkId: string): void {
    if (this.gameState !== 'playing') return;
    const lm = LANDMARKS.find((l) => l.id === landmarkId);
    if (!lm) return;
    const allowed = Boolean(lm.fastTravel) || lm.id === 'overlook' || this.inv.shrinesActivated.includes(lm.id);
    if (!allowed) {
      this.showToast('Awaken this Bell Shrine first to unlock Fast Travel!', 2.4);
      return;
    }
    this.mapOpen = false;
    this.climbing = false;
    this.gliding = false;
    this.shieldSurfing = false;
    this.swimming = false;

    const safeOffsets: Record<string, [number, number]> = {
      spire: [0, 9.2],
      village: [-4.5, 4.5],
      valenrock: [0, 9.5],
      wizards_tower: [10, -4.5],
      sunscorch_oasis: [-4, 1.5],
      dwarven_quarry: [-7, 0],
      ashen_wilds: [-10, 14],
    };
    const [ox, oz] = safeOffsets[lm.id] ?? [0, 4.2];
    this.px = lm.x + ox;
    this.pz = lm.z + oz;
    this.py = Math.max(WATER_Y + 0.6, getTerrainHeight(this.px, this.pz)) + 0.15;
    this.pvx = 0;
    this.pvy = 0;
    this.pvz = 0;
    this.camPos.set(this.px, this.py + 3.6, this.pz + 7.8);
    this.camLook.set(this.px, this.py + 2.2, this.pz - 10);
    this.audio.playGale();
    this.input.rumble(0.35, 130);
    this.spawnParticles(this.px, this.py + 1.2, this.pz, 0x7ef4ff, 24, 6.5, -2, 0.22);
    this.showToast(`Home-Teleported to ${lm.name}`, 2.6);
    this.emitHud();
  }

  private setGameState(next: GameState): void {
    this.gameState = next;
    document.body.dataset.state = next;
    if (next === 'playing') {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      this.input.clearHeld();
    } else {
      this.input.clearHeld();
      this.input.exitPointerLock();
    }
    this.emitHud();
  }

  private showToast(text: string, duration = 3.2): void {
    this.toastText = text;
    this.toastTimer = duration;
  }

  private clearDynamicCombatEntities(): void {
    for (const a of this.arrows) this.scene.remove(a.mesh);
    this.arrows.length = 0;
    if (this.activeBomb) {
      this.scene.remove(this.activeBomb.mesh);
      this.activeBomb = null;
    }
    for (const cp of this.cryonisPillars) {
      this.scene.remove(cp.mesh);
      cp.collider.active = false;
      this.world.proxyRegistry.remove(cp.collider);
      const idx = this.world.colliders.indexOf(cp.collider);
      if (idx >= 0) this.world.colliders.splice(idx, 1);
    }
    this.cryonisPillars.length = 0;
    if (this.galeVisual) {
      this.scene.remove(this.galeVisual);
      this.galeVisual = null;
    }
    this.galeTimer = 0;
  }

  setTouchMove(x: number, z: number, sprint: boolean): void {
    this.input.setTouchMove(x, z, sprint);
  }

  addTouchLook(dxPx: number, dyPx: number): void {
    this.input.addTouchLook(dxPx, dyPx);
  }

  setTouchAction(action: TouchActionId, down: boolean): void {
    if (this.gameState !== 'playing') return;
    this.audio.unlock();
    this.input.setTouchAction(action, down);
  }

  triggerTouchTap(action: TouchActionId): void {
    if (this.gameState !== 'playing') return;
    this.audio.unlock();
    this.input.triggerTouchTap(action);
  }

  private handleResize(): void {
    const w = this.mountEl.clientWidth || window.innerWidth;
    const h = Math.max(1, this.mountEl.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.gfx.resize(w, h);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (!this.running) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const st = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (st === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private readonly tick = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const realDt = clamp((now - this.lastTime) / 1000, 0.001, 0.05);
    this.lastTime = now;

    this.stepFrame(realDt);
    this.gfx.render(realDt);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private stepFrame(realDt: number): void {
    const inp = this.input.poll(realDt);
    this.lastActiveDevice = inp.activeDevice;
    this.lastGamepadConnected = inp.gamepadConnected;
    this.lastPointerLocked = inp.pointerLocked;

    // Forward Gamepad navigation / raw button capture whenever a menu/modal is active
    if (this.padMenuHandler && (this.gameState !== 'playing' || this.mapOpen)) {
      if (
        inp.padMenuDir ||
        inp.padMenuConfirm ||
        inp.padMenuBack ||
        inp.padJustPressedButton !== null
      ) {
        this.padMenuHandler({
          dir: inp.padMenuDir ?? undefined,
          confirm: inp.padMenuConfirm,
          back: inp.padMenuBack,
          rawButton: inp.padJustPressedButton ?? undefined,
        });
      }
    }

    // Handle global Pause / Map / Journal / Dialogue dismissals
    if (this.gameState === 'playing') {
      if (this.dialogue) {
        if (inp.interactPressed || inp.jumpPressed || inp.attackPressed || inp.pausePressed) {
          this.dismissDialogue();
        }
      } else if (inp.pausePressed) {
        if (this.mapOpen) {
          this.mapOpen = false;
          this.emitHud();
        } else {
          this.pauseGame();
          return;
        }
      } else if (inp.mapPressed) {
        this.toggleMap();
      } else if (inp.journalPressed) {
        this.toggleJournal();
      } else if (inp.lampPressed) {
        this.toggleDawnLamp();
      }
    } else if (this.gameState === 'paused' && inp.pausePressed) {
      // Only resume via Escape/Pause if Controls Remapping modal isn't open
      if (!document.getElementById('controls-modal') || document.getElementById('controls-modal')!.hidden) {
        this.resumeGame();
        return;
      }
    }

    // World ambient animations (water ripples, drifting clouds, sunbeams, wind ribbons, shrine crystals, campfires, spire bell)
    this.updateWorldAmbience(realDt);

    if (this.gameState === 'title') {
      this.updateTitleCamera(realDt);
      this.updateHeroVisuals(realDt, 0);
      this.updatePip(realDt);
      this.updateParticles(realDt);
      return;
    }

    if (this.gameState !== 'playing' || this.mapOpen || this.dialogue) {
      this.updateParticles(realDt);
      return;
    }

    this.elapsedSeconds += realDt;
    if (this.regionBannerTimer > 0) this.regionBannerTimer = Math.max(0, this.regionBannerTimer - realDt);
    if (this.toastTimer > 0) {
      this.toastTimer = Math.max(0, this.toastTimer - realDt);
      if (this.toastTimer === 0) this.toastText = '';
    }
    if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - realDt * 2.4);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - realDt);
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - realDt);
    for (const k of ['bomb', 'stasis', 'gale', 'cryonis'] as RuneId[]) {
      if (this.runeCooldowns[k] > 0) this.runeCooldowns[k] = Math.max(0, this.runeCooldowns[k] - realDt);
    }

    // Sim-level hitstop freeze (rendering & hit flashes continue in realDt!)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - realDt);
      this.updateParticles(realDt);
      this.updateGameplayCamera(realDt, inp);
      return;
    }

    // Bullet-Time (aiming bow mid-air!) & Flurry Rush slow-motion time scaling
    const bulletTime = this.isAiming && !this.grounded && !this.climbing && !this.stamina.exhausted;
    if (this.flurryTimer > 0) this.flurryTimer = Math.max(0, this.flurryTimer - realDt);
    const timeScale = this.flurryTimer > 0 ? 0.25 : bulletTime ? 0.28 : 1.0;
    const simDt = realDt * timeScale;

    // 1. Update Camera Look Inputs & Time-of-Day Cycle
    this.camYaw -= inp.lookDeltaX;
    this.camPitch = clamp(this.camPitch + inp.lookDeltaY, -0.35, 1.08);
    if (inp.timeCyclePressed) {
      this.cycleTimeOfDay();
    }

    // 2. Rune Cycling / Selection / Casting
    if (inp.runeSelect) this.activeRune = inp.runeSelect;
    if (inp.runeCycleDelta !== 0) {
      const order: RuneId[] = ['bomb', 'stasis', 'gale', 'cryonis'];
      const cur = order.indexOf(this.activeRune);
      this.activeRune = order[(cur + (inp.runeCycleDelta > 0 ? 1 : -1) + order.length) % order.length];
    }
    if (inp.runePressed) {
      this.castActiveRune();
    }

    // 3. Quick Heal
    if (inp.healPressed) {
      const healRes = consumeHealingItem(this.inv);
      if (healRes.healed > 0) {
        this.inv = healRes.inv;
        this.audio.playCook();
        this.spawnParticles(this.px, this.py + 1.2, this.pz, 0x72f078, 14, 4, -2);
        this.showToast(
          healRes.item === 'meal' ? 'Ate Hearty Skewer (+3 Hearts)' : 'Ate Wild Apple (+1 Heart)',
          2.2
        );
      } else if (this.inv.hp >= this.inv.maxHp) {
        this.showToast('Hearts are already full!', 1.6);
      } else {
        this.showToast('No meals or apples — forage apples or cook at a campfire!', 2.2);
      }
    }

    // 4. Lock-on Targeting & Classic Zelda Z-Target Camera Recenter!
    if (inp.lockOnPressed) {
      if (this.lockedTarget && !this.lockedTarget.dead) {
        this.lockedTarget = null;
      } else {
        const found = this.findNearestLockableEnemy();
        if (found) {
          this.lockedTarget = found;
          this.audio.playPickup();
        } else {
          // No enemy nearby: smoothly recenter camera directly behind Wren!
          this.camYaw = this.pYaw;
          this.camPitch = 0.16;
          this.audio.playStep(false);
        }
      }
    }
    if (this.lockedTarget && (this.lockedTarget.dead || this.lockedTarget.state === 'ko' || Math.hypot(this.lockedTarget.x - this.px, this.lockedTarget.z - this.pz) > 26)) {
      this.lockedTarget = null;
    }

    // 5. Update Enemies & Combat Callbacks
    const enemyCallbacks: EnemyUpdateCallbacks = {
      onPlayerDamaged: (dmg, fromX, fromZ, attacker, isProj) => {
        this.handlePlayerIncomingHit(dmg, fromX, fromZ, attacker, isProj);
      },
      onTelegraph: () => this.audio.playTelegraph(),
      onEnemyKilled: (e) => this.handleEnemyKilled(e),
      onExplosion: (x, y, z, r, dmg) => this.triggerExplosion(x, y, z, r, dmg),
      spawnParticles: (x, y, z, col, count, spd) => this.spawnParticles(x, y, z, col, count, spd),
    };

    const { anyAggro, imminentThreat } = this.enemies.update(
      simDt,
      realDt,
      this.px,
      this.py,
      this.pz,
      enemyCallbacks,
      this.world.colliders
    );
    this.audio.tickAmbience(realDt, anyAggro);

    // 6. Player Movement, Climbing, Gliding, Combat & Bow
    const moveMag = this.updatePlayerPhysicsAndActions(realDt, simDt, inp, bulletTime, imminentThreat);

    // Prevent Wren from clipping through live enemies during close melee
    for (let i = 0; i < this.enemies.enemies.length; i++) {
      const e = this.enemies.enemies[i];
      if (e.dead || e.state === 'ko') continue;
      if (Math.abs(this.py - e.y) > e.height + 0.3) continue;
      const dx = this.px - e.x;
      const dz = this.pz - e.z;
      const minD = e.radius + 0.52;
      const dSq = dx * dx + dz * dz;
      if (dSq < minD * minD && dSq > 0.0001) {
        const d = Math.sqrt(dSq);
        const push = (minD - d) * 0.65;
        this.px += (dx / d) * push;
        this.pz += (dz / d) * push;
      }
    }

    // 7. Update Arrows, Active Bomb, Stasis Boulders, Pickups & Interactions
    this.updateArrows(simDt, enemyCallbacks);
    this.updateActiveBomb(simDt, enemyCallbacks);
    this.updateStasisBoulders(simDt, enemyCallbacks);
    this.updatePickupsAndInteractions(realDt, inp);
    this.updateParticles(realDt);

    // 8. Visuals, Pip Companion, Camera & Region Check
    this.updateHeroVisuals(realDt, moveMag);
    this.updatePip(realDt);
    this.updateGameplayCamera(realDt, inp);

    const reg = getRegionName(this.px, this.pz);
    if (reg !== this.currentRegion) {
      this.currentRegion = reg;
      this.regionBannerTimer = 3.0;
    }

    this.hudEmitAccum += realDt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updatePlayerPhysicsAndActions(
    realDt: number,
    simDt: number,
    inp: ReturnType<InputManager['poll']>,
    bulletTime: boolean,
    imminentThreat: EnemyEntity | null
  ): number {
    // Player responds smoothly even during slow-mo Flurry Rush
    const pDt = this.flurryTimer > 0 ? realDt * 0.85 : simDt;

    if (this.climbCooldown > 0) this.climbCooldown = Math.max(0, this.climbCooldown - realDt);
    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - pDt);
    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - pDt);
    if (this.comboResetTimer > 0) {
      this.comboResetTimer = Math.max(0, this.comboResetTimer - realDt);
      if (this.comboResetTimer === 0) this.comboStep = 1;
    }
    if (this.dodgeTimer > 0) this.dodgeTimer = Math.max(0, this.dodgeTimer - realDt);

    // Bow Aiming (Right Click / B / RT)
    const wantAim = inp.aimHeld && !this.climbing && !this.swimming && this.inv.arrows > 0;
    if (wantAim) {
      this.isAiming = true;
      this.gliding = false;
      this.aimCharge = clamp(this.aimCharge + realDt * 1.4, 0, 1);
      // Aim Wren forward along camera yaw
      this.pYaw = dampAngle(this.pYaw, this.camYaw, 18, realDt);
      if (inp.attackPressed) {
        this.input.consumeAttackBuffer();
        this.fireArrow();
      }
    } else {
      if (this.isAiming && inp.aimReleased && this.aimCharge > 0.15) {
        this.fireArrow();
      }
      this.isAiming = false;
      this.aimCharge = 0;
    }

    // Shield & Parry (Ctrl / K / LT)
    this.isShielding = inp.shieldHeld && this.grounded && !this.climbing && !this.isAiming && this.attackTimer <= 0;
    if (this.isShielding) {
      this.shieldHeldTime += realDt;
    } else {
      this.shieldHeldTime = 0;
    }

    // Sword Attack, Airborne Jump-Strike Slam & Spin Attack Charge
    if (!this.isAiming && !this.climbing && !this.swimming) {
      if (inp.attackPressed && this.attackCooldown <= 0) {
        this.input.consumeAttackBuffer();
        if (!this.grounded && !this.jumpSlamming) {
          // BotW Airborne Jump-Strike Plunge Slam!
          this.gliding = false;
          this.shieldSurfing = false;
          this.jumpSlamming = true;
          this.jumpSlamStartY = this.py;
          this.pvy = Math.min(this.pvy, -16.5);
          this.attackTimer = 0.4;
          this.attackCooldown = 0.35;
          this.audio.playSwordSwing(3, false);
        } else {
          this.startSwordSwing(false);
        }
      }
      if (inp.attackHeld && this.grounded && this.attackTimer <= 0) {
        this.spinChargeTime += realDt;
      } else {
        if (this.spinChargeTime >= 0.55 && !this.stamina.exhausted) {
          this.stamina = stepStamina(this.stamina, 'sprint', 0.9, true);
          this.startSwordSwing(true);
        }
        this.spinChargeTime = 0;
      }
    } else {
      this.spinChargeTime = 0;
    }

    // Active Sword Hitbox Window
    if (this.attackTimer > 0.08 && this.attackTimer < 0.28) {
      this.checkSwordHits();
    }

    // Camera-relative movement direction
    const forwardX = Math.sin(this.camYaw);
    const forwardZ = Math.cos(this.camYaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;
    let wishX = rightX * inp.moveX + forwardX * -inp.moveZ;
    let wishZ = rightZ * inp.moveX + forwardZ * -inp.moveZ;
    const wishMag = Math.min(1, Math.hypot(wishX, wishZ));
    if (wishMag > 0.01) {
      wishX /= wishMag;
      wishZ /= wishMag;
    }

    // Free Combat Roll (anytime on ground!) OR BotW Locked Backflip / Side-Hop + Flurry Rush!
    if (inp.dodgePressed && this.grounded && !this.climbing && !this.swimming && this.dodgeTimer <= 0) {
      this.input.consumeDodgeBuffer();
      const rollCost = consumeRollStamina(this.stamina);
      if (rollCost.allowed) {
        this.stamina = rollCost.state;
        this.shieldSurfing = false;
        this.attackTimer = 0;
        const style = classifyDodgeStyle({
          isLockedOn: Boolean(this.lockedTarget),
          isShielding: this.isShielding,
          moveX: inp.moveX,
          moveZ: inp.moveZ,
        });
        this.dodgeStyle = style;
        this.dodgeDuration = style === 'roll' ? 0.44 : 0.42;
        this.dodgeTimer = this.dodgeDuration;

        let dx = 0;
        let dz = 0;
        if (style === 'roll') {
          dx = wishMag > 0.1 ? wishX : Math.sin(this.pYaw);
          dz = wishMag > 0.1 ? wishZ : Math.cos(this.pYaw);
          this.pYaw = Math.atan2(dx, dz);
          this.pvx = dx * 11.4;
          this.pvz = dz * 11.4;
          this.pvy = 1.6;
        } else if (style === 'sidehop_left' || style === 'sidehop_right') {
          const sign = style === 'sidehop_left' ? -1 : 1;
          // Perpendicular to Wren's facing direction
          dx = -Math.cos(this.pYaw) * sign;
          dz = Math.sin(this.pYaw) * sign;
          this.pvx = dx * 11.8;
          this.pvz = dz * 11.8;
          this.pvy = 4.6;
          this.grounded = false;
        } else {
          // Acrobatic Backflip away from facing
          dx = -Math.sin(this.pYaw);
          dz = -Math.cos(this.pYaw);
          this.pvx = dx * 11.2;
          this.pvz = dz * 11.2;
          this.pvy = 5.4;
          this.grounded = false;
        }

        this.scaleX = 1.15;
        this.scaleY = 0.82;
        this.audio.playJump();
        this.input.rumble(0.25, 75);
        this.spawnParticles(this.px, this.py + 0.18, this.pz, 0xeae2c8, 12, 4.8, 8, 0.18);
        this.spawnShockwave(this.px, this.py + 0.12, this.pz, 0xeee5c8, 1.85, 0.26);
        this.emitHud();

        if (imminentThreat && checkFlurryRush(0.1, true, Math.hypot(imminentThreat.x - this.px, imminentThreat.z - this.pz))) {
          this.flurryTimer = 2.8;
          this.audio.playFlurryTrigger();
          this.input.rumble(0.55, 160);
          this.spawnShockwave(this.px, this.py + 0.4, this.pz, 0xffe466, 4.2, 0.38);
          this.showToast('FLURRY RUSH! Strike rapidly!', 2.2);
          this.spawnParticles(this.px, this.py + 1.0, this.pz, 0xffe066, 18, 6.5);
        }
      }
    }

    // Subtle dust trail while rolling!
    if (this.dodgeTimer > 0.1 && this.dodgeStyle === 'roll' && Math.random() < 0.55) {
      this.spawnParticles(this.px, this.py + 0.12, this.pz, 0xe2dac0, 1, 2.2, 6, 0.13);
    }

    // Determine stamina activity
    let activity: StaminaActivity = 'idle';

    // === CLIMBING MODE (Climb any steep cliff, Dawnbell Spire, cottage, watchtower!) ===
    if (this.climbing) {
      const climbInput = Math.hypot(inp.moveX, inp.moveZ);
      if (climbInput > 0.1) activity = 'climb';

      // Tangential right vector along wall surface
      const wallRightX = -this.climbNormalZ;
      const wallRightZ = this.climbNormalX;
      const climbVert = -inp.moveZ * 3.8;
      const climbHoriz = inp.moveX * 3.1;

      this.py += climbVert * pDt;
      this.px += wallRightX * climbHoriz * pDt;
      this.pz += wallRightZ * climbHoriz * pDt;
      this.pYaw = dampAngle(this.pYaw, Math.atan2(-this.climbNormalX, -this.climbNormalZ), 14, realDt);

      if (climbInput > 0.15) {
        this.stepAccum += climbInput * 3.6 * pDt;
        if (this.stepAccum > 0.85) {
          this.stepAccum = 0;
          this.audio.playClimbGrab();
        }
      }

      // Climb Leap (Space / A)
      if (inp.jumpPressed) {
        this.input.consumeJumpBuffer();
        if (inp.moveZ > 0.5) {
          // Kick off wall backward
          this.climbing = false;
          this.climbCooldown = 0.35;
          this.pvx = this.climbNormalX * 6.5;
          this.pvz = this.climbNormalZ * 6.5;
          this.pvy = 6.2;
          this.audio.playJump();
        } else {
          const leap = consumeClimbLeap(this.stamina);
          if (leap.allowed) {
            this.stamina = leap.state;
            this.py += 1.65;
            this.audio.playJump();
            this.spawnParticles(this.px, this.py + 0.5, this.pz, 0xd4cbb8, 6, 3.5);
          }
        }
      }

      // Check top-out vault over solid collider or terrain cliff!
      const terrainH = getTerrainHeight(this.px - this.climbNormalX * 0.75, this.pz - this.climbNormalZ * 0.75);
      const colTop = this.climbTargetCollider ? this.climbTargetCollider.maxY : -999;
      if (this.climbTargetCollider && this.py >= colTop - 0.35) {
        this.climbing = false;
        this.climbCooldown = 0.35;
        this.py = colTop + 0.05;
        this.px -= this.climbNormalX * 0.95;
        this.pz -= this.climbNormalZ * 0.95;
        this.pvy = 2.8;
        this.audio.playLand(false);
      } else if (!this.climbTargetCollider && (this.py >= terrainH - 0.15 || getTerrainNormal(this.px, this.pz).y > 0.78)) {
        this.climbing = false;
        this.climbCooldown = 0.3;
        this.py = Math.max(this.py, terrainH);
        this.px -= this.climbNormalX * 0.65;
        this.pz -= this.climbNormalZ * 0.65;
      }

      // Drop off if stamina exhausted or reached bottom ground
      if (this.stamina.exhausted || (inp.moveZ > 0.4 && this.py <= getTerrainHeight(this.px, this.pz) + 0.25)) {
        this.climbing = false;
        this.climbCooldown = 0.45;
      }

      this.stamina = stepStamina(this.stamina, activity, realDt, false);
      return climbInput;
    }

    // === SHIELD SURFING TRIGGER (V or Shield + Jump!) ===
    if (
      !this.climbing &&
      !this.swimming &&
      !this.gliding &&
      !this.isAiming &&
      (inp.surfPressed || (inp.shieldHeld && inp.jumpPressed && !this.shieldSurfing))
    ) {
      if (this.shieldSurfing) {
        this.shieldSurfing = false;
      } else {
        this.shieldSurfing = true;
        this.input.consumeJumpBuffer();
        const fx = Math.sin(this.pYaw);
        const fz = Math.cos(this.pYaw);
        const curSpd = Math.hypot(this.pvx, this.pvz);
        if (curSpd < 8.5) {
          this.pvx = fx * 9.5;
          this.pvz = fz * 9.5;
        }
        if (this.grounded) {
          this.pvy = 4.6;
          this.grounded = false;
        }
        this.audio.playJump();
        this.input.rumble(0.28, 85);
        this.spawnParticles(this.px, this.py + 0.15, this.pz, 0xf0e4c4, 8, 4.2);
        this.showToast('Shield Surfing! Carve down hills · Space to Ollie!', 2.2);
      }
    }

    // === STANDARD GROUND / AIR / GLIDE / SHIELD SURF / SWIM MOVEMENT ===
    if (this.shieldSurfing) {
      if (this.isAiming || this.attackTimer > 0 || this.swimming || this.gliding) {
        this.shieldSurfing = false;
      } else {
        const tn = getTerrainNormal(this.px, this.pz);
        const surfRes = stepShieldSurf(this.pvx, this.pvz, tn.x, tn.z, wishX * wishMag, wishZ * wishMag, pDt);
        this.pvx = surfRes.vx;
        this.pvz = surfRes.vz;
        if (surfRes.speed > 0.5) {
          this.pYaw = dampAngle(this.pYaw, Math.atan2(this.pvx, this.pvz), 10, realDt);
        }
        if (this.grounded && Math.random() < 0.65) {
          this.spawnParticles(this.px, this.py + 0.1, this.pz, 0xd8e2b8, 1, 3.0, 9, 0.14);
        }
        if (this.grounded && !surfRes.keepSurfing) {
          this.shieldSurfing = false;
        }
      }
    }

    const sprinting = !this.shieldSurfing && inp.sprintHeld && wishMag > 0.15 && this.grounded && !this.isAiming && !this.isShielding && !this.stamina.exhausted && !this.swimming;
    const baseSpeed = this.swimming
      ? 4.2
      : this.gliding
        ? 9.2
        : this.isAiming || this.isShielding
          ? 4.0
          : sprinting
            ? 10.6
            : 6.8;

    const accel = this.grounded ? 16 : this.gliding ? 5.5 : 7.5;
    if (!this.shieldSurfing && this.dodgeTimer <= 0 && this.attackTimer <= 0.12) {
      this.pvx = damp(this.pvx, wishX * wishMag * baseSpeed, accel, pDt);
      this.pvz = damp(this.pvz, wishZ * wishMag * baseSpeed, accel, pDt);
    }

    // Rotate Wren toward movement or locked target
    if (!this.isAiming && !this.shieldSurfing) {
      if (this.lockedTarget) {
        const targetYaw = Math.atan2(this.lockedTarget.x - this.px, this.lockedTarget.z - this.pz);
        this.pYaw = dampAngle(this.pYaw, targetYaw, 14, realDt);
      } else if (wishMag > 0.08) {
        const moveYaw = Math.atan2(wishX, wishZ);
        this.pYaw = dampAngle(this.pYaw, moveYaw, this.gliding ? 6 : 12, realDt);
      }
    }

    // Coyote time
    if (this.grounded) this.coyoteTimer = 0.11;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - realDt);

    if (this.glideGraceTimer > 0) this.glideGraceTimer = Math.max(0, this.glideGraceTimer - realDt);

    // Jump & Paraglider Deploy!
    if (inp.jumpPressed) {
      if (this.coyoteTimer > 0 && !this.swimming) {
        this.input.consumeJumpBuffer();
        this.coyoteTimer = 0;
        this.grounded = false;
        this.pvy = this.shieldSurfing ? 10.2 : 9.4;
        this.scaleX = 0.85;
        this.scaleY = 1.18;
        this.audio.playJump();
        this.spawnParticles(this.px, this.py + 0.1, this.pz, 0xdfe6d0, 5, 3.2);
      } else if (!this.grounded && !this.swimming && !this.isAiming) {
        this.input.consumeJumpBuffer();
        if (!this.gliding && !this.stamina.exhausted) {
          this.gliding = true;
          this.shieldSurfing = false;
          this.glideGraceTimer = 0.35;
          this.pvy = Math.max(this.pvy, -1.5);
          this.audio.playGlideOpen();
          this.spawnParticles(this.px, this.py + 1.8, this.pz, 0xf6eed9, 7, 3.5, 1);
        } else if (this.gliding && this.glideGraceTimer <= 0) {
          this.gliding = false;
        }
      }
    }

    // Variable jump height cut on early release
    if (inp.jumpJustReleased && this.pvy > 3.0 && !this.gliding) {
      this.pvy *= 0.48;
    }

    // Paraglider Updrafts & Buoyancy
    if (this.gliding) {
      if (this.stamina.exhausted) {
        this.gliding = false;
      } else {
        activity = 'glide';
        let inUpdraft = this.galeTimer > 0.35;
        if (!inUpdraft) {
          for (let i = 0; i < this.world.updrafts.length; i++) {
            const u = this.world.updrafts[i];
            if (Math.hypot(this.px - u.x, this.pz - u.z) <= u.radius && this.py >= u.y - 0.5 && this.py <= u.y + u.height) {
              inUpdraft = true;
              break;
            }
          }
        }
        if (inUpdraft) {
          const targetLift = this.galeTimer > 0.35 ? 11.2 : 7.6;
          this.pvy = damp(this.pvy, targetLift, 7.5, pDt);
          if (Math.random() < 0.45) {
            this.spawnParticles(this.px, this.py + 0.4, this.pz, 0x9af8e2, 1, 2.2, -5, 0.14);
          }
        } else {
          this.pvy = damp(this.pvy, -2.05, 5.5, pDt);
        }
      }
    } else if (!this.swimming) {
      this.pvy -= 24.5 * pDt;
    }

    if (sprinting) activity = 'sprint';
    else if (this.swimming && wishMag > 0.1) activity = 'swim';
    else if (bulletTime) activity = 'glide';

    // Horizontal position step + solid collider resolution (and Climb engagement!)
    let nextX = this.px + this.pvx * pDt;
    let nextZ = this.pz + this.pvz * pDt;

    // Soft natural valley perimeter constraint
    const rCenter = Math.hypot(nextX, nextZ);
    if (rCenter > WORLD_PLAY_RADIUS) {
      const k = WORLD_PLAY_RADIUS / rCenter;
      nextX *= k;
      nextZ *= k;
    }

    const colRes = this.resolveSolidCollisions(nextX, this.py, nextZ, wishX, wishZ, wishMag);
    this.px = colRes.x;
    this.pz = colRes.z;

    // Vertical support check combining terrain + simplified invisible ramp/bridge/plinth surfaces
    const terrainY = getTerrainHeight(this.px, this.pz);
    const support = sampleSupportSurfaceHeight(
      this.px,
      this.pz,
      this.py,
      terrainY,
      this.world.colliders,
      0.46,
      DEFAULT_STEP_UP_HEIGHT
    );
    const floorY = support.floorY;

    // Steep cliff climb engagement on natural terrain (only when NOT walking on a bridge/stair/plinth proxy!)
    const norm = getTerrainNormal(this.px, this.pz);
    const pushedIntoCliff =
      !support.onCollider &&
      norm.y < 0.68 &&
      wishMag > 0.35 &&
      !this.stamina.exhausted &&
      this.climbCooldown <= 0 &&
      (wishX * norm.x + wishZ * norm.z) < -0.25 &&
      this.py > WATER_Y + 0.3;

    if (pushedIntoCliff) {
      this.climbing = true;
      this.gliding = false;
      this.grounded = false;
      this.climbTargetCollider = null;
      const nLen = Math.hypot(norm.x, norm.z) || 1;
      this.climbNormalX = norm.x / nLen;
      this.climbNormalZ = norm.z / nLen;
      this.pvy = 0;
      this.audio.playClimbGrab();
    }

    // Water swimming check
    if (floorY < WATER_Y - 0.55 && this.py <= WATER_Y - 0.35) {
      this.swimming = true;
      this.gliding = false;
      this.grounded = false;
      this.py = damp(this.py, WATER_Y - 0.45, 10, pDt);
      this.pvy = 0;
      if (wishMag > 0.15 && Math.random() < 0.25) {
        this.spawnParticles(this.px, WATER_Y + 0.05, this.pz, 0xd8f4ff, 2, 2.5, 8, 0.12);
      }
      if (this.stamina.exhausted) {
        // Rescue gently to nearest dry ground (-1 heart)
        this.takeDamage(2, this.px, this.pz);
        this.px = 0;
        this.pz = 46;
        this.py = getTerrainHeight(0, 46);
        this.swimming = false;
      }
    } else {
      this.swimming = false;
      const wasGrounded = this.grounded;
      const stepDelta = floorY - this.py;
      if (wasGrounded && this.pvy <= 0 && stepDelta > 0.005 && stepDelta <= DEFAULT_STEP_UP_HEIGHT + 0.05) {
        // Smooth step-up across stair ramps, plinth ledges & bridge aprons — zero snap flicker!
        this.py = damp(this.py, floorY, 26, pDt);
        if (Math.abs(floorY - this.py) < 0.015) this.py = floorY;
        this.pvy = 0;
        this.grounded = true;
        this.gliding = false;
      } else {
        this.py += this.pvy * pDt;
        if (this.py <= floorY) {
          if (!wasGrounded && this.jumpSlamming) {
            this.jumpSlamming = false;
            this.py = floorY;
            this.pvy = 0;
            this.grounded = true;
            this.gliding = false;
            this.executeJumpSlamImpact(Math.max(0.5, this.jumpSlamStartY - floorY));
          } else {
            if (!wasGrounded && this.pvy < -7) {
              this.scaleX = 1.24;
              this.scaleY = 0.76;
              this.audio.playLand(this.pvy < -15);
              this.spawnParticles(this.px, floorY + 0.08, this.pz, 0xd8d0b8, 7, 3.8);
            }
            this.py = floorY;
            this.pvy = 0;
            this.grounded = true;
            this.gliding = false;
          }
        } else {
          this.grounded = false;
        }
      }
    }

    // Footstep cadence synced to actual distance traveled
    const horizSpeed = Math.hypot(this.pvx, this.pvz);
    if (this.grounded && horizSpeed > 0.6) {
      this.walkDist += horizSpeed * pDt;
      this.stepAccum += horizSpeed * pDt;
      if (this.stepAccum > 2.2) {
        this.stepAccum = 0;
        this.audio.playStep(support.onCollider);
        if (sprinting) {
          this.spawnParticles(this.px, this.py + 0.08, this.pz, 0xd6cca8, 2, 2.0, 6, 0.12);
        }
      }
    }

    this.stamina = stepStamina(this.stamina, activity, realDt, this.grounded);
    return wishMag;
  }

  private getSupportingColliderTop(x: number, y: number, z: number): number {
    const sup = sampleSupportSurfaceHeight(x, z, y, -999, this.world.colliders, 0.46, DEFAULT_STEP_UP_HEIGHT);
    return sup.onCollider ? sup.floorY : -999;
  }

  private resolveSolidCollisions(
    x: number,
    y: number,
    z: number,
    wishX: number,
    wishZ: number,
    wishMag: number
  ): { x: number; z: number } {
    const res = resolveActorAgainstColliders(x, y, z, 0.48, 1.65, this.world.colliders, {
      stepUpHeight: DEFAULT_STEP_UP_HEIGHT,
      passes: 2,
    });

    if (
      res.collided &&
      res.hitCollider?.climbable &&
      wishMag > 0.35 &&
      !this.stamina.exhausted &&
      this.climbCooldown <= 0 &&
      wishX * res.hitNormalX + wishZ * res.hitNormalZ < -0.2
    ) {
      this.climbing = true;
      this.gliding = false;
      this.grounded = false;
      this.climbNormalX = res.hitNormalX;
      this.climbNormalZ = res.hitNormalZ;
      this.climbTargetCollider = res.hitCollider;
      this.pvy = 0;
      this.audio.playClimbGrab();
    }

    return { x: res.x, z: res.z };
  }

  private executeJumpSlamImpact(fallHeight: number): void {
    const slamDmg = computeJumpSlamDamage(fallHeight);
    this.scaleX = 1.32;
    this.scaleY = 0.68;
    this.hitstopTimer = 0.055;
    this.trauma = Math.min(1, this.trauma + 0.48);
    this.audio.playLand(true);
    this.audio.playHit(true);
    this.input.rumble(0.55, 140);
    this.spawnShockwave(this.px, this.py, this.pz, 0x8efae0, 4.8, 0.38);
    this.spawnParticles(this.px, this.py + 0.25, this.pz, 0xffe466, 18, 7.2, 10, 0.22);
    this.spawnParticles(this.px, this.py + 0.15, this.pz, 0xe0d8be, 12, 5.5, 11, 0.18);

    const cb: EnemyUpdateCallbacks = {
      onPlayerDamaged: () => {},
      onTelegraph: () => {},
      onEnemyKilled: (e) => this.handleEnemyKilled(e),
      onExplosion: (x, y, z, r, d) => this.triggerExplosion(x, y, z, r, d),
      spawnParticles: (x, y, z, col, count, spd) => this.spawnParticles(x, y, z, col, count, spd),
    };

    for (let i = 0; i < this.enemies.enemies.length; i++) {
      const e = this.enemies.enemies[i];
      if (e.dead || e.state === 'ko') continue;
      const dx = e.x - this.px;
      const dz = e.z - this.pz;
      const dist = Math.hypot(dx, dz);
      if (dist <= 4.6 + e.radius) {
        const len = dist || 1;
        this.enemies.damageEnemy(e, slamDmg, (dx / len) * 11.5, (dz / len) * 11.5, cb, {
          stunDuration: 1.4,
          isCrit: fallHeight > 2.4,
        });
      }
    }
    this.sliceNearbyBushes(4.2);
  }

  private sliceNearbyBushes(radius: number): void {
    let anyCut = false;
    for (let i = 0; i < this.world.cuttableBushes.length; i++) {
      const b = this.world.cuttableBushes[i];
      if (b.cut) continue;
      if (Math.hypot(b.x - this.px, b.z - this.pz) <= radius) {
        b.cut = true;
        anyCut = true;
        for (let m = 0; m < this.world.bushMeshes.length; m++) {
          this.world.bushMeshes[m].setMatrixAt(b.index, _zeroMat);
        }
        this.spawnParticles(b.x, b.y + 0.45, b.z, 0x58c448, 10, 4.8, 9, 0.16);
        this.spawnParticles(b.x, b.y + 0.55, b.z, 0xf25a52, 3, 3.6, 8, 0.12);
        // Classic Zelda bush foraging bonus!
        if (b.index % 5 === 0) {
          this.inv.marks += 2;
          this.audio.playPickup();
          this.showToast('Found +2 Golden Marks in the brush!', 1.8);
        } else if (b.index % 9 === 0) {
          this.inv.apples += 1;
          this.audio.playPickup();
          this.showToast('Foraged a Wild Apple from the brush!', 1.8);
        }
      }
    }
    if (anyCut) {
      for (let m = 0; m < this.world.bushMeshes.length; m++) {
        this.world.bushMeshes[m].instanceMatrix.needsUpdate = true;
      }
    }
  }

  private startSwordSwing(spin: boolean): void {
    this.isSpinning = spin;
    this.attackTimer = spin ? 0.42 : 0.32;
    this.attackCooldown = spin ? 0.48 : this.flurryTimer > 0 ? 0.15 : 0.24;
    this.attackHitSet.clear();
    if (!spin) {
      this.comboStep = this.comboResetTimer > 0 ? ((this.comboStep % 3) + 1) as 1 | 2 | 3 : 1;
      this.comboResetTimer = 0.72;
    } else {
      this.spawnShockwave(this.px, this.py + 0.35, this.pz, 0xffe466, 3.6, 0.32);
    }

    // BotW Flurry Rush Auto-Dash toward nearest target!
    if (this.flurryTimer > 0) {
      const target = this.lockedTarget && !this.lockedTarget.dead ? this.lockedTarget : this.findNearestLockableEnemy(9.5);
      if (target) {
        const dx = target.x - this.px;
        const dz = target.z - this.pz;
        const dist = Math.hypot(dx, dz);
        this.pYaw = Math.atan2(dx, dz);
        if (dist > target.radius + 1.6) {
          const step = Math.min(dist - (target.radius + 1.3), 4.0);
          this.px += (dx / dist) * step;
          this.pz += (dz / dist) * step;
          this.spawnParticles(this.px, this.py + 0.9, this.pz, 0xffe466, 8, 4.5, 4, 0.14);
        }
      }
    }

    // Slight athletic forward lunge
    this.pvx += Math.sin(this.pYaw) * (spin ? 3.5 : 5.5);
    this.pvz += Math.cos(this.pYaw) * (spin ? 3.5 : 5.5);
    this.audio.playSwordSwing(this.comboStep, spin);
  }

  private checkSwordHits(): void {
    const reach = this.isSpinning ? 3.2 : 2.7;
    const fx = Math.sin(this.pYaw);
    const fz = Math.cos(this.pYaw);
    const dmg = computeSwordDamage({
      comboStep: this.comboStep,
      isSpinAttack: this.isSpinning,
      isFlurryRush: this.flurryTimer > 0,
      isJumpStrike: !this.grounded,
    });

    const cb: EnemyUpdateCallbacks = {
      onPlayerDamaged: () => {},
      onTelegraph: () => {},
      onEnemyKilled: (e) => this.handleEnemyKilled(e),
      onExplosion: (x, y, z, r, d) => this.triggerExplosion(x, y, z, r, d),
      spawnParticles: (x, y, z, col, count, spd) => this.spawnParticles(x, y, z, col, count, spd),
    };

    // Hit enemies
    for (let i = 0; i < this.enemies.enemies.length; i++) {
      const e = this.enemies.enemies[i];
      if (e.dead || e.state === 'ko' || this.attackHitSet.has(e.id)) continue;
      const dx = e.x - this.px;
      const dz = e.z - this.pz;
      const dist = Math.hypot(dx, dz);
      if (dist > reach + e.radius) continue;
      const dot = (dx * fx + dz * fz) / (dist || 1);
      if (!this.isSpinning && dot < 0.15) continue;

      this.attackHitSet.add(e.id);
      const kb = this.isSpinning || this.comboStep === 3 ? 12 : 6.5;
      this.enemies.damageEnemy(e, dmg, (dx / (dist || 1)) * kb, (dz / (dist || 1)) * kb, cb);
      this.audio.playHit(this.isSpinning || this.comboStep === 3);
      this.hitstopTimer = this.isSpinning || this.comboStep === 3 ? 0.055 : 0.032;
      this.trauma = Math.min(1, this.trauma + (this.isSpinning ? 0.35 : 0.16));
    }

    // Strike Stasis Boulders to build kinetic launch energy!
    for (let i = 0; i < this.world.stasisBoulders.length; i++) {
      const sb = this.world.stasisBoulders[i];
      if (sb.stasisTimer <= 0 || this.attackHitSet.has(sb.id)) continue;
      const dx = sb.x - this.px;
      const dz = sb.z - this.pz;
      const dist = Math.hypot(dx, dz);
      if (dist <= reach + sb.radius) {
        this.attackHitSet.add(sb.id);
        sb.stasisHits = Math.min(6, sb.stasisHits + 1);
        sb.chargeDirX = dx / (dist || 1);
        sb.chargeDirZ = dz / (dist || 1);
        sb.arrowIndicator.visible = true;
        sb.arrowIndicator.rotation.y = Math.atan2(sb.chargeDirX, sb.chargeDirZ);
        sb.arrowIndicator.scale.set(1, 1, 0.7 + sb.stasisHits * 0.25);
        this.audio.playStasisHit(sb.stasisHits);
        this.hitstopTimer = 0.035;
        this.spawnParticles(sb.x, sb.y + 1.0, sb.z, 0xffe252, 10, 5.5);
      }
    }

    // Strike Resonance Chime Bells!
    for (let i = 0; i < this.world.chimeBells.length; i++) {
      const bell = this.world.chimeBells[i];
      if (this.attackHitSet.has(bell.id)) continue;
      if (Math.hypot(bell.x - this.px, bell.z - this.pz) <= reach + 0.9) {
        this.attackHitSet.add(bell.id);
        this.handleBellRing(bell);
      }
    }

    // Mine Gleaming Ore Veins with sword strikes!
    for (let i = 0; i < this.world.oreVeins.length; i++) {
      const vein = this.world.oreVeins[i];
      if (vein.mined || this.attackHitSet.has(vein.id)) continue;
      if (Math.hypot(vein.x - this.px, vein.z - this.pz) <= reach + 1.1) {
        this.attackHitSet.add(vein.id);
        this.handleMineOre(vein);
      }
    }

    // Strike Explosive Barrels!
    for (let i = 0; i < this.world.barrels.length; i++) {
      const b = this.world.barrels[i];
      if (b.exploded || this.attackHitSet.has(b.id)) continue;
      if (Math.hypot(b.x - this.px, b.z - this.pz) <= reach + 0.7) {
        this.attackHitSet.add(b.id);
        this.detonateBarrel(b);
      }
    }

    // Classic Zelda Bush-Slicing!
    this.sliceNearbyBushes(reach + 0.55);
  }

  private fireArrow(): void {
    if (this.inv.arrows <= 0) return;
    this.inv.arrows--;
    this.audio.playBowShoot();

    // Shoot straight along camera forward direction
    this.camera.getWorldDirection(_v3A);
    const origin = {
      x: this.px + _v3A.x * 0.8,
      y: this.py + 1.38 + _v3A.y * 0.4,
      z: this.pz + _v3A.z * 0.8,
    };
    const state = createArrow(origin, { x: _v3A.x, y: _v3A.y, z: _v3A.z }, this.aimCharge);

    const mesh = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.9),
      this.mats.getMat('#e0bd82', { roughness: 0.7 })
    );
    const tip = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.11, 0.16),
      this.mats.getMat('#6ce8ff', { emissive: '#38c8ff', emissiveIntensity: 1.1 })
    );
    tip.position.z = 0.48;
    mesh.add(shaft, tip);
    mesh.position.set(origin.x, origin.y, origin.z);
    this.scene.add(mesh);

    this.arrows.push({ state, mesh });
    this.aimCharge = 0;
  }

  private updateArrows(simDt: number, cb: EnemyUpdateCallbacks): void {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.state = stepArrow(a.state, simDt);
      a.mesh.position.set(a.state.x, a.state.y, a.state.z);
      a.mesh.lookAt(a.state.x + a.state.vx, a.state.y + a.state.vy, a.state.z + a.state.vz);

      let hit = a.state.life <= 0 || a.state.y <= getTerrainHeight(a.state.x, a.state.z);

      if (!hit) {
        for (let j = 0; j < this.enemies.enemies.length; j++) {
          const e = this.enemies.enemies[j];
          if (e.dead || e.state === 'ko') continue;
          const dXZ = Math.hypot(a.state.x - e.x, a.state.z - e.z);
          if (dXZ <= e.radius + 0.55 && a.state.y >= e.y && a.state.y <= e.y + e.height + 0.4) {
            const isCoreShot = e.kind === 'sentinel' && a.state.y > e.y + 1.5 && a.state.y < e.y + 3.4;
            this.enemies.damageEnemy(
              e,
              a.state.damage,
              a.state.vx * 0.2,
              a.state.vz * 0.2,
              cb,
              { isCrit: isCoreShot, stunDuration: isCoreShot ? 2.4 : 0 }
            );
            this.audio.playHit(isCoreShot);
            if (isCoreShot) {
              this.hitstopTimer = 0.055;
              this.showToast('Critical Core Shot!', 1.6);
            }
            hit = true;
            break;
          }
        }
      }

      if (!hit) {
        for (let j = 0; j < this.world.barrels.length; j++) {
          const b = this.world.barrels[j];
          if (!b.exploded && Math.hypot(a.state.x - b.x, a.state.z - b.z) < 0.95 && Math.abs(a.state.y - (b.y + 0.55)) < 0.9) {
            this.detonateBarrel(b);
            hit = true;
            break;
          }
        }
      }

      // Pop Floating Balloon Targets (Whisper-Sprite Secrets!)
      if (!hit) {
        for (let j = 0; j < this.world.whisperSecrets.length; j++) {
          const ws = this.world.whisperSecrets[j];
          if (ws.found || ws.kind !== 'balloon') continue;
          const by = ws.group.position.y;
          if (Math.hypot(a.state.x - ws.x, a.state.z - ws.z) < 1.35 && Math.abs(a.state.y - by) < 1.35) {
            this.discoverWhisperSecret(ws);
            hit = true;
            break;
          }
        }
      }

      // Ring Resonance Chime Bells with Arrows!
      if (!hit) {
        for (let j = 0; j < this.world.chimeBells.length; j++) {
          const bell = this.world.chimeBells[j];
          if (Math.hypot(a.state.x - bell.x, a.state.z - bell.z) < 1.1 && Math.abs(a.state.y - (bell.y + 2.0)) < 1.2) {
            this.handleBellRing(bell);
            hit = true;
            break;
          }
        }
      }

      // Bram's Fletcher Trial — Crimson Archery Bull's-Eye Targets!
      if (!hit) {
        for (let j = 0; j < this.world.archeryTargets.length; j++) {
          const tgt = this.world.archeryTargets[j];
          if (tgt.hit) continue;
          if (Math.hypot(a.state.x - tgt.x, a.state.z - tgt.z) < 1.35 && Math.abs(a.state.y - (tgt.y + 1.7)) < 1.35) {
            tgt.hit = true;
            if (!this.hitTargets.includes(tgt.id)) this.hitTargets.push(tgt.id);
            this.audio.playHit(true);
            this.spawnParticles(tgt.x, tgt.y + 1.7, tgt.z, 0xffe466, 18, 6.2);
            const qRes = setSideQuestProgress(this.sideQuests, 'bram_archery', this.hitTargets.length, false);
            this.sideQuests = qRes.state;
            this.showToast(
              this.hitTargets.length >= SIDE_QUESTS.bram_archery.targetCount
                ? "Bull's-eye! All 3 targets struck — return to Bram the Smith!"
                : `Bull's-eye! (${this.hitTargets.length}/3 Bram Archery Targets)`,
              3.2
            );
            this.saveProgress();
            this.emitHud();
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        this.spawnParticles(a.state.x, a.state.y, a.state.z, 0x8ceeff, 6, 3.5);
        this.scene.remove(a.mesh);
        this.arrows.splice(i, 1);
      }
    }
  }

  private discoverWhisperSecret(ws: WhisperSecretProp): void {
    if (ws.found) return;
    ws.found = true;
    if (ws.balloon) ws.balloon.visible = false;
    ws.sprite.visible = true;
    const res = collectWhisperSeed(this.inv, ws.id);
    if (res.newlyFound) {
      this.inv = res.inv;
      if (res.staminaUpgraded) {
        this.stamina = { ...this.stamina, max: this.inv.maxStamina, current: this.inv.maxStamina, exhausted: false };
      }
      const canopyRes = setSideQuestProgress(this.sideQuests, 'whisper_canopy', this.inv.seedsFound.length, true);
      this.sideQuests = canopyRes.state;
      if (canopyRes.justCompleted) {
        this.inv.marks += 60;
        this.inv.maxStamina += 20;
        this.stamina = { ...this.stamina, max: this.inv.maxStamina, current: this.inv.maxStamina, exhausted: false };
        this.showToast('Side Quest Complete: Voices of the Canopy! +60 Marks & +20 Max Stamina!', 4.2);
      } else {
        this.showToast(
          res.staminaUpgraded
            ? `Yahaha! Whisper-Seed ${this.inv.seedsFound.length}/${TOTAL_SEEDS} — Max Stamina Upgraded!`
            : `Yahaha! Found a Whisper-Sprite (${this.inv.seedsFound.length}/${TOTAL_SEEDS}) · +15 Marks!`,
          3.6
        );
      }
      this.audio.playShrineActivate();
      this.input.rumble(0.45, 160);
      this.spawnParticles(ws.x, ws.group.position.y + 0.5, ws.z, 0x86f278, 22, 6.2, -1, 0.2);
      this.spawnParticles(ws.x, ws.group.position.y + 0.5, ws.z, 0xffe466, 14, 5.2, -1, 0.18);
      this.saveProgress();
      this.emitHud();
    }
  }

  private handleEnemyKilled(e: EnemyEntity): void {
    this.enemiesDefeated++;
    this.inv.marks += e.kind === 'sentinel' ? 80 : e.kind === 'beetle' ? 15 : 8;
    this.hitstopTimer = e.kind === 'sentinel' ? 0.08 : 0.04;
    this.trauma = Math.min(1, this.trauma + (e.kind === 'sentinel' ? 0.7 : 0.3));
    if (e.kind === 'sentinel') {
      this.showToast('Iron Sentinel defeated! The Shrine of Stillness lies open!', 4.2);
      this.audio.playShrineActivate();
      this.triggerStoryEvent('defeated_sentinel');
    }
    if (e.campId && this.enemies.isCampCleared(e.campId)) {
      const chest = this.world.chests.find((c) => c.campId === e.campId);
      if (chest && chest.sealRing) {
        chest.sealRing.visible = false;
        this.audio.playChestOpen();
        this.showToast('Camp cleared! Treasure Chest unlocked!', 3.2);
      }
      if (e.campId === 'camp_whisper') this.triggerStoryEvent('cleared_whisper_camp');
      else if (e.campId === 'camp_canyon') this.triggerStoryEvent('cleared_canyon_camp');
      else if (e.campId === 'camp_highland') this.triggerStoryEvent('cleared_highland_camp');
    }
    this.saveProgress();
    this.emitHud();
  }

  private triggerStoryEvent(ev: StoryEvent): void {
    const res = recordStoryEvent(this.story, ev);
    this.story = res.state;
    if (res.chapterJustCompleted) {
      const finishedDef = CHAPTERS[res.chapterJustCompleted];
      this.inv.maxHp += 2;
      this.inv.hp = this.inv.maxHp;
      this.audio.playShrineActivate();
      this.spawnParticles(this.px, this.py + 1.6, this.pz, 0xffe466, 28, 7.5, -2, 0.24);
      if (res.chapterJustCompleted === 1) {
        this.timeOfDay = 'sunset';
        this.showToast(`Chapter I Complete! ${finishedDef.rewardText}`, 4.5);
        this.enqueueDialogue([
          { speaker: 'The Great Dawnbell', text: finishedDef.completionText },
          ...CHAPTERS[2].introDialogue,
        ]);
      } else if (res.chapterJustCompleted === 2) {
        this.timeOfDay = 'starlight';
        this.dawnLampOn = true;
        this.showToast(`Chapter II Complete! Dawn Lamp Kindled (Press G to toggle)!`, 4.8);
        this.enqueueDialogue([
          { speaker: 'The Great Dawnbell', text: finishedDef.completionText },
          ...CHAPTERS[3].introDialogue,
        ]);
      } else if (res.chapterJustCompleted === 3 || res.storyFinished) {
        this.timeOfDay = 'day';
        this.victory = true;
        this.showToast('All three Chapters complete! Eternal Dawn returns to Dawnbell!', 5.0);
        window.setTimeout(() => {
          if (this.running && this.gameState === 'playing') {
            this.setGameState('gameover');
          }
        }, 1600);
      }
    } else if (res.newlyCompletedGoal) {
      this.showToast(`Objective Complete: ${res.newlyCompletedGoal}`, 3.2);
    }
    this.saveProgress();
    this.emitHud();
  }

  private onPuzzleSolved(puzzleId: PuzzleId): void {
    const chest = this.world.chests.find((c) => c.puzzleId === puzzleId);
    if (chest && chest.sealRing) {
      chest.sealRing.visible = false;
    }
    this.audio.playShrineActivate();
    this.trauma = Math.min(1, this.trauma + 0.35);
    const solvedCount = countSolvedPuzzles(this.puzzles);
    const qRes = setSideQuestProgress(this.sideQuests, 'ancient_sanctuaries', solvedCount, true);
    this.sideQuests = qRes.state;
    if (qRes.justCompleted) {
      this.inv.maxHp += 2;
      this.inv.hp = this.inv.maxHp;
      this.inv.marks += 100;
      this.showToast("Side Quest Complete: The Three Ancient Trials! +1 Heart Container & +100 Marks!", 4.5);
    } else {
      this.showToast(`Ancient Puzzle Solved (${solvedCount}/3)! Relic Chest unlocked!`, 3.6);
    }
    this.saveProgress();
    this.emitHud();
  }

  private handleBellRing(bell: ChimeBellProp): void {
    bell.swingVel = 7.2;
    const res = ringChimeBell(this.puzzles, bell.color);
    this.puzzles = res.state;
    this.audio.playStasisHit(Math.max(1, res.stepIndex * 2));
    this.spawnParticles(bell.x, bell.y + 1.9, bell.z, 0xffe678, 14, 5.2, 4, 0.18);
    for (const b of this.world.chimeBells) {
      b.lit = isPuzzleSolved(this.puzzles, 'chime_bells') || this.puzzles.chimeProgress.includes(b.color);
      b.glowMat.emissiveIntensity = b.lit ? 1.55 : 0.15;
    }
    if (res.justSolved) {
      this.onPuzzleSolved('chime_bells');
    } else if (res.matchedStep) {
      this.showToast(`Resonance Bell ${bell.label} rings true! (${res.stepIndex}/3)`, 2.2);
    } else {
      this.showToast('The harmony falters — strike Gold, then Teal, then Coral!', 2.6);
    }
  }

  private applySocketLockedVisual(): void {
    const sock = this.world.runicSocket;
    sock.locked = true;
    sock.runeMat.color.setHex(0xffe25a);
    sock.runeMat.emissive.setHex(0xffc63a);
    sock.runeMat.emissiveIntensity = 1.8;
    for (const bm of sock.beacons) {
      bm.color.setHex(0xffe25a);
      bm.emissive.setHex(0xffc63a);
      bm.emissiveIntensity = 1.9;
    }
  }

  private handleIgniteBrazier(br: DawnBrazierProp): void {
    const res = igniteDawnBrazier(this.puzzles, br.id);
    this.puzzles = res.state;
    if (!res.newlyLit) return;
    br.lit = true;
    br.flame1.visible = true;
    br.flame2.visible = true;
    br.light.intensity = 2.4;
    this.audio.playCook();
    this.spawnParticles(br.x, br.y + 1.7, br.z, 0xffaa38, 18, 5.5, -2, 0.2);
    if (res.justSolved) {
      this.onPuzzleSolved('dawn_braziers');
    } else {
      this.showToast(`Dawn Brazier kindled (${res.litCount}/3 around Dawnbell Spire)`, 2.6);
    }
  }

  private handleMineOre(vein: OreVeinProp): void {
    if (vein.mined) return;
    vein.mined = true;
    vein.crystalGroup.visible = false;
    if (!this.minedOres.includes(vein.id)) this.minedOres.push(vein.id);
    this.inv.marks += vein.marks;
    const colHex = vein.tier === 'mithril' ? 0x62b4ff : vein.tier === 'gold' ? 0xffe066 : 0xe48a54;
    this.audio.playHit(true);
    this.spawnParticles(vein.x, vein.y + 0.9, vein.z, colHex, 20, 6.2, 10, 0.22);
    const tierName = vein.tier === 'mithril' ? 'Mithril' : vein.tier === 'gold' ? 'Gold' : 'Copper';
    const qRes = setSideQuestProgress(this.sideQuests, 'ore_prospector', this.minedOres.length, true);
    this.sideQuests = qRes.state;
    if (qRes.justCompleted) {
      this.inv.marks += 90;
      this.inv.arrows += 15;
      this.stamina = { ...this.stamina, current: this.stamina.max, exhausted: false };
      this.audio.playShrineActivate();
      this.showToast(`Mined ${tierName} Ore! Side Quest Complete: Dwarven Ore Assay (+90 Marks · +15 Arrows)!`, 4.4);
    } else {
      this.showToast(`Mined ${tierName} Ore Vein! +${vein.marks} Marks (${this.minedOres.length}/3 Assay)`, 2.8);
    }
    this.saveProgress();
    this.emitHud();
  }

  private castActiveRune(): void {
    if (this.activeRune === 'bomb') {
      if (this.activeBomb) {
        // Remote detonate!
        const b = this.activeBomb;
        this.scene.remove(b.mesh);
        this.activeBomb = null;
        this.triggerExplosion(b.x, b.y + 0.3, b.z, 6.2, 52);
        this.runeCooldowns.bomb = 1.6;
        return;
      }
      if (this.runeCooldowns.bomb > 0) return;
      const mesh = buildBombMesh(this.mats);
      const fx = Math.sin(this.pYaw);
      const fz = Math.cos(this.pYaw);
      const bx = this.px + fx * 0.85;
      const by = this.py + 1.5;
      const bz = this.pz + fz * 0.85;
      mesh.position.set(bx, by, bz);
      this.scene.add(mesh);
      this.activeBomb = {
        x: bx,
        y: by,
        z: bz,
        vx: fx * 11.5,
        vy: 5.5,
        vz: fz * 11.5,
        life: 9.0,
        mesh,
      };
      this.audio.playBombThrow();
      this.showToast('Ember Bomb deployed — press Rune again to detonate!', 2.0);
    } else if (this.activeRune === 'stasis') {
      if (this.runeCooldowns.stasis > 0) return;
      // Lock nearest Stasis Boulder or Enemy within 18m in front!
      let bestBoulder: StasisBoulderProp | null = null;
      let bestDist = 18;
      for (const sb of this.world.stasisBoulders) {
        const d = Math.hypot(sb.x - this.px, sb.z - this.pz);
        if (d < bestDist) {
          bestDist = d;
          bestBoulder = sb;
        }
      }
      if (bestBoulder) {
        bestBoulder.stasisTimer = 5.5;
        bestBoulder.stasisHits = 0;
        bestBoulder.vx = 0;
        bestBoulder.vy = 0;
        bestBoulder.vz = 0;
        this.runeCooldowns.stasis = 6.5;
        this.audio.playStasisLock();
        this.spawnParticles(bestBoulder.x, bestBoulder.y + 1.0, bestBoulder.z, 0xffe454, 16, 5);
        this.showToast('Stasis Locked! Strike boulder with sword to launch!', 2.6);
        return;
      }

      const bestEnemy = this.findNearestLockableEnemy(18);
      if (bestEnemy) {
        this.enemies.freezeEnemy(bestEnemy, 5.0);
        this.runeCooldowns.stasis = 7.5;
        this.audio.playStasisLock();
        this.spawnParticles(bestEnemy.x, bestEnemy.y + 1.0, bestEnemy.z, 0xffe454, 16, 5);
        this.showToast(`${bestEnemy.name} frozen in Stasis!`, 2.2);
      } else {
        this.showToast('No boulder or enemy in Stasis range', 1.6);
      }
    } else if (this.activeRune === 'gale') {
      if (this.runeCooldowns.gale > 0) return;
      this.runeCooldowns.gale = 9.0;
      this.climbing = false;
      this.grounded = false;
      this.gliding = true;
      this.glideGraceTimer = 0.85;
      this.py += 0.35;
      this.pvy = 13.5;
      this.stamina = { ...this.stamina, current: Math.max(this.stamina.current, 60), exhausted: false };
      this.audio.playGale();
      this.spawnParticles(this.px, this.py + 0.4, this.pz, 0x8efae0, 26, 7, -4, 0.22);

      // Temporary swirling emerald gale ring visual
      if (this.galeVisual) this.scene.remove(this.galeVisual);
      this.galeVisual = new THREE.Group();
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x8efae0, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.1 + i * 0.45, 1.35 + i * 0.45, 18), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = i * 1.4;
        this.galeVisual.add(ring);
      }
      this.galeVisual.position.set(this.px, this.py, this.pz);
      this.scene.add(this.galeVisual);
      this.galeTimer = 1.25;
      this.input.rumble(0.55, 180);
      this.showToast('Gale Updraft! Ride the wind!', 2.0);
    } else if (this.activeRune === 'cryonis') {
      if (this.runeCooldowns.cryonis > 0) return;
      const fx = Math.sin(this.pYaw);
      const fz = Math.cos(this.pYaw);
      const tx = this.px + fx * 3.8;
      const tz = this.pz + fz * 3.8;
      const gh = getTerrainHeight(tx, tz);
      const onWater = gh <= WATER_Y + 0.25;
      const baseY = onWater ? WATER_Y - 0.15 : gh;
      const pillarId = `cryo_${++this.cryonisSeq}`;
      const plan = planCryonisPillars(
        this.cryonisPillars.map((c) => ({ id: c.id, x: c.x, z: c.z })),
        { id: pillarId, x: tx, z: tz },
        3
      );
      if (plan.evicted) {
        const oldIdx = this.cryonisPillars.findIndex((c) => c.id === plan.evicted!.id);
        if (oldIdx >= 0) {
          const old = this.cryonisPillars[oldIdx];
          this.spawnParticles(old.x, old.baseY + 1.4, old.z, 0x9ef4ff, 16, 6, 12, 0.22);
          this.scene.remove(old.mesh);
          old.collider.active = false;
          this.world.proxyRegistry.remove(old.collider);
          const ci = this.world.colliders.indexOf(old.collider);
          if (ci >= 0) this.world.colliders.splice(ci, 1);
          this.cryonisPillars.splice(oldIdx, 1);
        }
      }
      const mesh = buildCryonisPillar(this.mats);
      mesh.position.set(tx, baseY - 2.4, tz);
      this.scene.add(mesh);
      const collider: SolidCollider = {
        id: pillarId,
        kind: 'box',
        x: tx,
        z: tz,
        minY: baseY,
        maxY: baseY + 2.65,
        halfX: 1.25,
        halfZ: 1.25,
        blocksCamera: true,
        climbable: true,
        active: true,
      };
      this.world.colliders.push(collider);
      this.world.proxyRegistry.register(collider);
      this.cryonisPillars.push({ id: pillarId, x: tx, baseY, z: tz, rise: 0, mesh, collider });
      this.runeCooldowns.cryonis = 2.0;
      this.audio.playStasisLock();
      this.input.rumble(0.42, 130);
      this.spawnParticles(tx, baseY + 0.6, tz, 0xa8f6ff, 20, 6.2, 8, 0.22);
      this.showToast(onWater ? 'Cryonis Ice Bridge raised! Climb or leap across!' : 'Cryonis Ice Pillar raised! Climb for high ground!', 2.4);
    }
  }

  private updateActiveBomb(simDt: number, _cb: EnemyUpdateCallbacks): void {
    // Animate rising Cryonis Ice Pillars!
    for (const cp of this.cryonisPillars) {
      if (cp.rise < 1) {
        cp.rise = Math.min(1, cp.rise + simDt * 4.2);
        const eased = 1 - Math.pow(1 - cp.rise, 3);
        cp.mesh.position.y = cp.baseY - 2.4 * (1 - eased);
      }
    }

    if (this.galeVisual && this.galeTimer > 0) {
      this.galeTimer -= simDt;
      this.galeVisual.rotation.y += simDt * 8;
      this.galeVisual.position.y += simDt * 5;
      if (this.galeTimer <= 0) {
        this.scene.remove(this.galeVisual);
        this.galeVisual = null;
      }
    }

    if (!this.activeBomb) return;
    const b = this.activeBomb;
    b.life -= simDt;
    b.vy -= 21 * simDt;
    b.x += b.vx * simDt;
    b.y += b.vy * simDt;
    b.z += b.vz * simDt;
    const gh = getTerrainHeight(b.x, b.z) + 0.24;
    if (b.y < gh) {
      b.y = gh;
      b.vy *= -0.32;
      b.vx *= 0.65;
      b.vz *= 0.65;
    }
    b.mesh.position.set(b.x, b.y, b.z);
    b.mesh.rotation.y += simDt * 3;
    if (b.life <= 0) {
      this.scene.remove(b.mesh);
      this.activeBomb = null;
    }
  }

  private triggerExplosion(x: number, y: number, z: number, radius: number, maxDamage: number): void {
    this.audio.playExplosion();
    this.trauma = Math.min(1, this.trauma + 0.65);
    this.hitstopTimer = 0.045;
    this.spawnShockwave(x, y + 0.15, z, 0xffaa38, radius * 1.05, 0.44);
    this.spawnParticles(x, y + 0.4, z, 0xff8c2a, 24, 9.5, 9, 0.28);
    this.spawnParticles(x, y + 0.6, z, 0xffe870, 14, 7.5, 4, 0.22);

    const cb: EnemyUpdateCallbacks = {
      onPlayerDamaged: () => {},
      onTelegraph: () => {},
      onEnemyKilled: (e) => this.handleEnemyKilled(e),
      onExplosion: () => {},
      spawnParticles: (px, py, pz, col, count, spd) => this.spawnParticles(px, py, pz, col, count, spd),
    };

    if (maxDamage > 0) {
      for (const e of this.enemies.enemies) {
        if (e.dead || e.state === 'ko') continue;
        const dx = e.x - x;
        const dz = e.z - z;
        const dist = Math.hypot(dx, dz);
        const res = computeBombBlast(dist, radius, maxDamage);
        if (res.hit) {
          this.enemies.damageEnemy(
            e,
            res.damage,
            (dx / (dist || 1)) * res.knockback,
            (dz / (dist || 1)) * res.knockback,
            cb,
            { stunDuration: e.kind === 'beetle' ? 3.2 : 1.0 }
          );
        }
      }
    }

    // Shatter Cracked Blast Boulders!
    for (const cr of this.world.crackedBoulders) {
      if (cr.broken) continue;
      const res = computeBombBlast(Math.hypot(cr.x - x, cr.z - z), radius + 1.2, maxDamage || 48);
      if (res.breaksCrackedRock) {
        cr.broken = true;
        cr.group.visible = false;
        cr.collider.active = false;
        this.world.proxyRegistry.sync(cr.collider);
        this.spawnParticles(cr.x, cr.y + 1.2, cr.z, 0x808490, 22, 8.5, 14, 0.34);
        this.showToast('Cracked Hollow Seal shattered!', 2.6);
        this.triggerStoryEvent('shattered_boulder');
      }
    }

    // Ignite Dawn Braziers within blast radius!
    for (const br of this.world.dawnBraziers) {
      if (!br.lit && Math.hypot(br.x - x, br.z - z) < radius + 1.5) {
        this.handleIgniteBrazier(br);
      }
    }

    // Blast Mineable Ore Veins!
    for (const vein of this.world.oreVeins) {
      if (!vein.mined && Math.hypot(vein.x - x, vein.z - z) < radius + 1.2) {
        this.handleMineOre(vein);
      }
    }

    // Chain-detonate Explosive Barrels!
    for (const b of this.world.barrels) {
      if (!b.exploded && Math.hypot(b.x - x, b.z - z) < radius) {
        this.detonateBarrel(b);
      }
    }
  }

  private detonateBarrel(b: { exploded: boolean; x: number; y: number; z: number; group: THREE.Group }): void {
    if (b.exploded) return;
    b.exploded = true;
    b.group.visible = false;
    this.triggerExplosion(b.x, b.y + 0.5, b.z, 6.8, 64);
  }

  private updateStasisBoulders(simDt: number, cb: EnemyUpdateCallbacks): void {
    for (const sb of this.world.stasisBoulders) {
      if (sb.stasisTimer > 0) {
        sb.stasisTimer -= simDt;
        const pulse = sb.stasisTimer < 1.2 ? Math.sin(sb.stasisTimer * 28) * 0.5 + 0.5 : 0.75;
        for (const m of sb.coreMats) {
          m.emissive.setHex(0xffd23a);
          m.emissiveIntensity = 0.45 + pulse * 0.65;
        }
        if (sb.stasisTimer <= 0) {
          for (const m of sb.coreMats) {
            m.emissive.setHex(0x000000);
            m.emissiveIntensity = 0;
          }
          sb.arrowIndicator.visible = false;
          if (sb.stasisHits > 0) {
            const launch = computeStasisLaunch({
              hits: sb.stasisHits,
              dirX: sb.chargeDirX,
              dirZ: sb.chargeDirZ,
            });
            sb.vx = launch.vx;
            sb.vy = launch.vy;
            sb.vz = launch.vz;
            sb.stasisHits = 0;
            this.audio.playStasisLaunch();
            this.trauma = Math.min(1, this.trauma + 0.35);
            this.spawnParticles(sb.x, sb.y + 0.9, sb.z, 0xffe252, 16, 7);
          }
        }
        continue;
      }

      const spd = Math.hypot(sb.vx, sb.vz);
      if (spd > 0.1 || Math.abs(sb.vy) > 0.1) {
        sb.vy -= 22 * simDt;
        sb.x += sb.vx * simDt;
        sb.y += sb.vy * simDt;
        sb.z += sb.vz * simDt;
        const gh = getTerrainHeight(sb.x, sb.z);
        if (sb.y <= gh) {
          sb.y = gh;
          sb.vy = Math.abs(sb.vy) > 3 ? -sb.vy * 0.35 : 0;
          sb.vx *= Math.exp(-2.8 * simDt);
          sb.vz *= Math.exp(-2.8 * simDt);
        }
        sb.group.position.set(sb.x, sb.y, sb.z);
        sb.group.rotation.x += sb.vz * simDt * 0.6;
        sb.group.rotation.z -= sb.vx * simDt * 0.6;
        sb.collider.x = sb.x;
        sb.collider.z = sb.z;
        sb.collider.minY = sb.y;
        sb.collider.maxY = sb.y + 1.85;
        this.world.proxyRegistry.sync(sb.collider);

        // Bowling through enemies!
        if (spd > 4.5) {
          for (const e of this.enemies.enemies) {
            if (e.dead || e.state === 'ko') continue;
            if (Math.hypot(sb.x - e.x, sb.z - e.z) < sb.radius + e.radius + 0.4) {
              this.enemies.damageEnemy(e, 55, sb.vx * 0.6, sb.vz * 0.6, cb, { stunDuration: 2.5, isCrit: true });
              this.audio.playHit(true);
            }
          }
        }

        // Check Heavy Stone Socket Lock Puzzle!
        const sock = this.world.runicSocket;
        if (!sock.locked) {
          const lockRes = checkStasisSocketLock(this.puzzles, sb.x, sb.z, sock.x, sock.z);
          if (lockRes.justSolved) {
            this.puzzles = lockRes.state;
            sb.x = sock.x;
            sb.z = sock.z;
            sb.y = sock.y + 0.2;
            sb.vx = 0;
            sb.vy = 0;
            sb.vz = 0;
            sb.group.position.set(sb.x, sb.y, sb.z);
            sb.collider.x = sb.x;
            sb.collider.z = sb.z;
            sb.collider.minY = sb.y;
            sb.collider.maxY = sb.y + 1.85;
            this.world.proxyRegistry.sync(sb.collider);
            this.applySocketLockedVisual();
            this.spawnParticles(sock.x, sock.y + 1.2, sock.z, 0xffe466, 26, 7.2, 4, 0.24);
            this.onPuzzleSolved('stasis_socket');
          }
        }
      }
    }
  }

  private handlePlayerIncomingHit(
    damage: number,
    fromX: number,
    fromZ: number,
    attacker: EnemyEntity,
    isProjectile: boolean
  ): void {
    if (this.invulnTimer > 0 || this.dodgeTimer > 0.14) return;

    // Check Shield Block & PERFECT PARRY!
    const toAttackerYaw = Math.atan2(fromX - this.px, fromZ - this.pz);
    const angleDelta = Math.abs(Math.atan2(Math.sin(toAttackerYaw - this.pYaw), Math.cos(toAttackerYaw - this.pYaw)));
    if (this.isShielding && angleDelta < 1.35) {
      if (checkPerfectParry(this.shieldHeldTime)) {
        this.audio.playParry();
        this.hitstopTimer = 0.075;
        this.trauma = Math.min(1, this.trauma + 0.45);
        this.spawnShockwave(this.px, this.py + 0.85, this.pz, 0xffe878, 3.8, 0.34);
        this.spawnParticles(this.px, this.py + 1.1, this.pz, 0xffe878, 18, 7.5);
        this.showToast('PERFECT PARRY!', 1.8);
        if (isProjectile) {
          // Reflect Guardian beam / Wisp bolt back!
          for (const p of this.enemies.projectiles) {
            if (!p.reflected && Math.hypot(p.x - this.px, p.z - this.pz) < 2.2) {
              p.reflected = true;
              p.vx = -p.vx * 1.4;
              p.vy = -p.vy * 1.1;
              p.vz = -p.vz * 1.4;
              p.life = 2.5;
              (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x62f4ff);
            }
          }
        } else if (attacker && !attacker.dead) {
          attacker.state = 'stunned';
          attacker.stateTimer = 3.2;
          this.enemies.tokenPool.release(attacker.id);
        }
        return;
      }
      // Normal shield block
      this.audio.playHit(false);
      this.spawnParticles(this.px, this.py + 1.0, this.pz, 0x86bdf0, 8, 4);
      const dx = this.px - fromX;
      const dz = this.pz - fromZ;
      const len = Math.hypot(dx, dz) || 1;
      this.pvx += (dx / len) * 6;
      this.pvz += (dz / len) * 6;
      this.invulnTimer = 0.35;
      return;
    }

    this.takeDamage(damage, fromX, fromZ);
  }

  private takeDamage(damage: number, fromX: number, fromZ: number): void {
    this.inv.hp = Math.max(0, this.inv.hp - damage);
    this.invulnTimer = 1.05;
    this.hitFlashTimer = 0.16;
    this.hitstopTimer = 0.05;
    this.trauma = Math.min(1, this.trauma + 0.6);
    this.audio.playHurt();
    this.spawnParticles(this.px, this.py + 1.0, this.pz, 0xff5a4a, 14, 6);

    const dx = this.px - fromX;
    const dz = this.pz - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    this.pvx = (dx / len) * 8.5;
    this.pvz = (dz / len) * 8.5;
    this.pvy = 4.5;
    this.climbing = false;
    this.gliding = false;

    if (this.inv.hp <= 0) {
      this.victory = false;
      this.setGameState('gameover');
    }
    this.emitHud();
  }

  private applyShrineVisualActivated(s: WorldData['shrines'][number]): void {
    s.activated = true;
    for (const m of s.runeMats) {
      m.color.setHex(0xffe066);
      m.emissive.setHex(0xffc63a);
      m.emissiveIntensity = 1.8;
    }
    (s.beam.material as THREE.MeshBasicMaterial).color.setHex(0xffe678);
    (s.beam.material as THREE.MeshBasicMaterial).opacity = 0.42;
    s.beam.scale.set(1.4, 1.5, 1.4);
  }

  private updatePickupsAndInteractions(realDt: number, inp: ReturnType<InputManager['poll']>): void {
    // Auto-collect nearby apples & marks
    for (const p of this.world.pickups) {
      if (p.collected) continue;
      p.phase += realDt * 2.5;
      p.mesh.position.y = p.y + Math.sin(p.phase) * 0.12;
      p.mesh.rotation.y += realDt * 1.4;
      if (Math.hypot(p.x - this.px, p.z - this.pz) < 1.55 && Math.abs(p.y - this.py) < 2.0) {
        p.collected = true;
        p.mesh.visible = false;
        this.audio.playPickup();
        this.spawnParticles(p.x, p.y + 0.3, p.z, p.kind === 'apple' ? 0xe84238 : 0xf0c65a, 8, 3.8);
        if (p.kind === 'apple') {
          this.inv.apples += p.amount;
          const mRes = setSideQuestProgress(this.sideQuests, 'mira_harvest', this.inv.apples + this.inv.meals, false);
          this.sideQuests = mRes.state;
          this.showToast('Picked Wild Apple (Cook at a campfire or bring 3 to Mira)', 2.2);
        } else if (p.kind === 'mark') {
          this.inv.marks += p.amount;
          this.showToast(`+${p.amount} Golden Marks`, 1.6);
        }
      }
    }

    // Animate opening chests
    for (const ch of this.world.chests) {
      if (ch.opened && ch.openAnim < 1) {
        ch.openAnim = Math.min(1, ch.openAnim + realDt * 3.5);
        ch.lid.rotation.x = -1.65 * ch.openAnim;
      }
    }

    // Find closest interactive prompt
    this.promptLabel = '';
    this.nearestInteractAction = null;
    let bestDist = 3.5;

    // 1. Bell Shrines
    for (const s of this.world.shrines) {
      if (s.activated) continue;
      const d = Math.hypot(s.x - this.px, s.z - this.pz);
      if (d < 4.0 && Math.abs(s.y - this.py) < 3.0 && d < bestDist + 0.8) {
        bestDist = d;
        this.promptLabel = `Awaken ${s.name}`;
        this.nearestInteractAction = () => {
          const res = activateShrine(this.inv, s.id);
          if (res.newlyActivated) {
            this.inv = res.inv;
            this.applyShrineVisualActivated(s);
            this.audio.playShrineActivate();
            this.spawnParticles(s.x, s.y + 2.8, s.z, 0xffe478, 32, 8.5, -2, 0.25);
            this.trauma = 0.45;
            if (s.id === 'shrine_wind') this.triggerStoryEvent('awakened_wind_shrine');
            else if (s.id === 'shrine_embers') this.triggerStoryEvent('awakened_ember_shrine');
            else if (s.id === 'shrine_stillness') this.triggerStoryEvent('awakened_stillness_shrine');
            this.saveProgress();
            if (res.allComplete && !this.victory) {
              this.victory = true;
              this.showToast('All 3 Bell Shrines awakened! The Great Dawnbell tolls across the realm!', 5.0);
              window.setTimeout(() => {
                if (this.running && this.gameState === 'playing') {
                  this.setGameState('gameover');
                }
              }, 1400);
            } else if (!res.allComplete) {
              this.showToast(`${s.name} Awakened! +1 Heart Container & Full Heal!`, 3.6);
            }
          }
        };
      }
    }

    // 2. Treasure Chests (camp-sealed OR puzzle-sealed)
    for (const ch of this.world.chests) {
      if (ch.opened) continue;
      const d = Math.hypot(ch.x - this.px, ch.z - this.pz);
      if (d < 2.8 && Math.abs(ch.y - this.py) < 2.2 && d < bestDist) {
        bestDist = d;
        const campLocked = Boolean(ch.campId && !this.enemies.isCampCleared(ch.campId));
        const puzzleLocked = Boolean(ch.puzzleId && !isPuzzleSolved(this.puzzles, ch.puzzleId));
        const locked = campLocked || puzzleLocked;
        this.promptLabel = campLocked
          ? 'Defeat camp monsters to unlock'
          : puzzleLocked
            ? 'Solve the nearby Ancient Puzzle to unlock'
            : 'Open Treasure Chest';
        this.nearestInteractAction = () => {
          if (campLocked) {
            this.showToast('Clear all nearby camp monsters to break the crimson seal!', 2.4);
            return;
          }
          if (puzzleLocked) {
            this.showToast('Solve the nearby Ancient Puzzle (check Quest Journal [I]) to break this seal!', 2.8);
            return;
          }
          ch.opened = true;
          ch.glow.visible = true;
          this.inv.arrows += ch.arrows;
          this.inv.marks += ch.marks;
          this.inv.apples += ch.apples;
          this.inv.chestsOpened.push(ch.id);
          if (ch.heartContainer) {
            this.inv.maxHp += 2;
            this.inv.hp = this.inv.maxHp;
          }
          this.audio.playChestOpen();
          this.spawnParticles(ch.x, ch.y + 0.9, ch.z, 0xffe478, 22, 6, 4, 0.22);
          this.showToast(ch.rewardText, 3.4);
          this.saveProgress();
        };
      }
    }

    // 3. Campfire Cooking Pots
    for (const cf of this.world.campfires) {
      if (!cf.withPot) continue;
      const d = Math.hypot(cf.x - this.px, cf.z - this.pz);
      if (d < 3.0 && Math.abs(cf.y - this.py) < 2.2 && d < bestDist) {
        bestDist = d;
        this.promptLabel = this.inv.apples > 0 ? 'Cook Hearty Skewer (1 Apple)' : 'Warm Campfire (Need 1 Apple to Cook)';
        this.nearestInteractAction = () => {
          const res = cookHeartyMeal(this.inv);
          if (res.cooked) {
            this.inv = res.inv;
            const mRes = setSideQuestProgress(this.sideQuests, 'mira_harvest', this.inv.apples + this.inv.meals, false);
            this.sideQuests = mRes.state;
            this.audio.playCook();
            this.spawnParticles(cf.x, cf.y + 1.3, cf.z, 0xffd860, 14, 4.5, -2, 0.16);
            this.showToast('Cooked Hearty Skewer! Press H to restore 3 Hearts!', 2.8);
          } else {
            this.showToast('Gather Wild Apples under trees to cook Hearty Skewers!', 2.4);
          }
        };
      }
    }

    // 4. Realm NPCs (Odo, Mira, Bram, Merchant Rowan, Archmage Sedric, Guildmaster Keldor)
    for (const npc of this.world.npcs) {
      const d = Math.hypot(npc.x - this.px, npc.z - this.pz);
      if (d < 3.4 && d < bestDist) {
        bestDist = d;
        this.promptLabel = `Speak with ${npc.name}`;
        this.nearestInteractAction = () => {
          this.audio.playPickup();
          if (npc.role === 'warden') {
            this.triggerStoryEvent('spoke_odo');
            this.enqueueDialogue(getOdoDialogue(this.story));
          } else if (npc.role === 'herbalist') {
            const count = this.inv.apples + this.inv.meals;
            const res = getMiraDialogue(this.sideQuests, count);
            if (res.action === 'accept') {
              this.sideQuests = acceptSideQuest(this.sideQuests, 'mira_harvest');
              const pRes = setSideQuestProgress(this.sideQuests, 'mira_harvest', count, false);
              this.sideQuests = pRes.state;
              this.showToast('Side Quest Accepted: Hearthbrook Harvest', 2.8);
            } else if (res.action === 'complete') {
              const comp = completeSideQuest(this.sideQuests, 'mira_harvest');
              this.sideQuests = comp.state;
              if (comp.newlyCompleted) {
                this.inv.meals += 2;
                this.inv.marks += 40;
                this.inv.arrows += 10;
                this.audio.playShrineActivate();
                this.showToast('Side Quest Complete: Hearthbrook Harvest! +2 Skewers · +40 Marks · +10 Arrows!', 4.0);
              }
            }
            this.saveProgress();
            this.enqueueDialogue(res.lines);
          } else if (npc.role === 'blacksmith') {
            const res = getBramDialogue(this.sideQuests, this.hitTargets.length);
            if (res.action === 'accept') {
              this.sideQuests = acceptSideQuest(this.sideQuests, 'bram_archery');
              const pRes = setSideQuestProgress(this.sideQuests, 'bram_archery', this.hitTargets.length, false);
              this.sideQuests = pRes.state;
              this.showToast("Side Quest Accepted: Bram's Fletcher Trial", 2.8);
            } else if (res.action === 'complete') {
              const comp = completeSideQuest(this.sideQuests, 'bram_archery');
              this.sideQuests = comp.state;
              if (comp.newlyCompleted) {
                this.inv.maxHp += 2;
                this.inv.hp = this.inv.maxHp;
                this.inv.arrows += 20;
                this.inv.marks += 50;
                this.audio.playShrineActivate();
                this.showToast("Side Quest Complete: Bram's Fletcher Trial! +1 Heart Container · +20 Arrows!", 4.2);
              }
            }
            this.saveProgress();
            this.enqueueDialogue(res.lines);
          } else if (npc.role === 'merchant') {
            if (!this.rowanGifted) {
              this.rowanGifted = true;
              this.inv.arrows += 5;
              this.showToast('Merchant Rowan gifted you +5 Valenrock Arrows!', 2.8);
              this.saveProgress();
            }
            this.enqueueDialogue([
              {
                speaker: npc.name,
                text: 'Welcome to Valenrock Square, traveler! The Grand Fountain and Castle Gatehouse have stood watch over the Great North Road for five hundred winters.',
              },
              {
                speaker: npc.name,
                text: 'Use the Home-Teleport Lodestones on your World Map (M) to travel swiftly between Valenrock, Hearthbrook Keep, Sunscorch Oasis, and the Wizards’ Sea Tower — and beware the Ashen Wilds north of the stone ditch!',
              },
            ]);
          } else if (npc.role === 'wizard') {
            this.enqueueDialogue([
              {
                speaker: npc.name,
                text: 'Greetings, bearer of the Dawnbell Runes! From our azure Sea Tower we study the Resonance Bells, the Druidic Stone Circle, and the ancient forces of Ember, Stasis, Gale, and Cryonis.',
              },
              {
                speaker: npc.name,
                text: 'Check your Quest Journal (I) whenever you seek the Three Ancient Trials — solving all three unlocks the Warden’s Relic!',
              },
            ]);
          } else if (npc.role === 'prospector') {
            this.enqueueDialogue([
              {
                speaker: npc.name,
                text: 'Ho there! Guildmaster Keldor of the Dwarven Ore Quarry. Strike or blast any gleaming Copper, Gold, or blue Mithril vein with your sword or Ember Bomb!',
              },
              {
                speaker: npc.name,
                text: `You’ve assayed ${this.minedOres.length}/3 veins for the Valenrock smithies. The richest Mithril seams sleep in the deep Quarry and up in the Ashen Wilds!`,
              },
            ]);
          }
        };
      }
    }

    // 5. Resonance Chime Bells (E to ring!)
    for (const bell of this.world.chimeBells) {
      const d = Math.hypot(bell.x - this.px, bell.z - this.pz);
      if (d < 2.8 && Math.abs(bell.y - this.py) < 2.5 && d < bestDist) {
        bestDist = d;
        this.promptLabel = `Ring ${bell.label} Resonance Bell`;
        this.nearestInteractAction = () => this.handleBellRing(bell);
      }
    }

    // 6. Unlit Dawn Braziers (E to ignite with Flint / Dawn Lamp!)
    for (const br of this.world.dawnBraziers) {
      if (br.lit) continue;
      const d = Math.hypot(br.x - this.px, br.z - this.pz);
      if (d < 2.9 && Math.abs(br.y - this.py) < 2.5 && d < bestDist) {
        bestDist = d;
        this.promptLabel = this.story.dawnLampUnlocked ? 'Kindle Dawn Brazier with Dawn Lamp' : 'Ignite Dawn Brazier';
        this.nearestInteractAction = () => this.handleIgniteBrazier(br);
      }
    }

    // 7. Mineable Ore Veins (E to mine!)
    for (const vein of this.world.oreVeins) {
      if (vein.mined) continue;
      const d = Math.hypot(vein.x - this.px, vein.z - this.pz);
      if (d < 3.0 && Math.abs(vein.y - this.py) < 2.5 && d < bestDist) {
        bestDist = d;
        const label = vein.tier === 'mithril' ? 'Mithril' : vein.tier === 'gold' ? 'Gold' : 'Copper';
        this.promptLabel = `Mine ${label} Ore Vein`;
        this.nearestInteractAction = () => this.handleMineOre(vein);
      }
    }

    // 8. Signposts
    for (const sg of this.world.signs) {
      const d = Math.hypot(sg.x - this.px, sg.z - this.pz);
      if (d < 2.8 && d < bestDist) {
        bestDist = d;
        this.promptLabel = `Read ${sg.title}`;
        this.nearestInteractAction = () => {
          this.audio.playPickup();
          this.enqueueDialogue([{ speaker: sg.title, text: sg.text }]);
        };
      }
    }

    // 9. Whisper-Sprite Pinwheel Secrets!
    for (const ws of this.world.whisperSecrets) {
      if (ws.found || ws.kind !== 'pinwheel') continue;
      const d = Math.hypot(ws.x - this.px, ws.z - this.pz);
      if (d < 2.6 && Math.abs(ws.y - this.py) < 2.4 && d < bestDist) {
        bestDist = d;
        this.promptLabel = 'Examine Sparkling Pinwheel';
        this.nearestInteractAction = () => this.discoverWhisperSecret(ws);
      }
    }

    if (inp.interactPressed && this.nearestInteractAction) {
      this.nearestInteractAction();
    }
  }

  private findNearestLockableEnemy(maxRange = 22): EnemyEntity | null {
    let best: EnemyEntity | null = null;
    let bestDist = maxRange;
    for (let i = 0; i < this.enemies.enemies.length; i++) {
      const e = this.enemies.enemies[i];
      if (e.dead || e.state === 'ko') continue;
      const d = Math.hypot(e.x - this.px, e.z - this.pz);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  private pushWildlifeOutOfColliders(x: number, z: number, radius: number): { x: number; z: number } {
    const gy = getTerrainHeight(x, z);
    return resolveCircleOverlapXZ(x, z, gy, 1.4, radius + 0.12, this.world.colliders);
  }

  private updateWorldAmbience(dt: number): void {
    this.world.waterUniforms.uTime.value += dt;
    this.world.grassUniforms.uTime.value += dt;
    const t = performance.now() * 0.001;

    // Smooth Time-of-Day atmosphere transitions (Sky Dome Gradient + Fog + Sun + Lanterns + Fireflies!)
    const zenithHex =
      this.timeOfDay === 'day' ? 0x4b9ce8 : this.timeOfDay === 'sunset' ? 0x5c4678 : 0x0b152c;
    const horizonHex =
      this.timeOfDay === 'day' ? 0xb4dffb : this.timeOfDay === 'sunset' ? 0xf59d62 : 0x1e3256;
    const fogHex =
      this.timeOfDay === 'day' ? 0x9cd2f7 : this.timeOfDay === 'sunset' ? 0xefa572 : 0x1b2c4c;
    const sunColHex =
      this.timeOfDay === 'day' ? 0xffefc8 : this.timeOfDay === 'sunset' ? 0xffa658 : 0xa6ccff;
    const hemiSkyHex =
      this.timeOfDay === 'day' ? 0x9cd8ff : this.timeOfDay === 'sunset' ? 0xffb278 : 0x3a5c96;
    const hemiGroundHex =
      this.timeOfDay === 'day' ? 0x5c7c48 : this.timeOfDay === 'sunset' ? 0x70483a : 0x162238;
    const sunIntTarget = this.timeOfDay === 'day' ? 1.78 : this.timeOfDay === 'sunset' ? 1.72 : 0.78;
    const hemiIntTarget = this.timeOfDay === 'day' ? 0.5 : this.timeOfDay === 'sunset' ? 0.56 : 0.38;
    const starOpacityTarget = this.timeOfDay === 'starlight' ? 0.94 : this.timeOfDay === 'sunset' ? 0.34 : 0;
    const lanternTarget = this.timeOfDay === 'starlight' ? 2.2 : this.timeOfDay === 'sunset' ? 1.65 : 0.72;
    const fireflyTarget = this.timeOfDay === 'starlight' ? 0.95 : this.timeOfDay === 'sunset' ? 0.82 : 0.42;

    const blend = Math.min(1, dt * 6.5);
    _colA.setHex(zenithHex);
    _colB.setHex(horizonHex);
    _colC.setHex(sunColHex);

    this.world.skyUniforms.uZenith.value.lerp(_colA, blend);
    this.world.skyUniforms.uHorizon.value.lerp(_colB, blend);
    this.world.skyUniforms.uSunColor.value.lerp(_colC, blend);
    (this.scene.background as THREE.Color).lerp(_colB, blend);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.lerp(_colA.setHex(fogHex), blend);
      const targetFogNear = this.timeOfDay === 'starlight' ? 42 : 95;
      const targetFogFar = this.timeOfDay === 'starlight' ? 185 : 320;
      this.scene.fog.near = damp(this.scene.fog.near, targetFogNear, 4, dt);
      this.scene.fog.far = damp(this.scene.fog.far, targetFogFar, 4, dt);
    }
    this.sunLight.color.lerp(_colC, blend);
    this.hemiLight.color.lerp(_colA.setHex(hemiSkyHex), blend);
    this.hemiLight.groundColor.lerp(_colB.setHex(hemiGroundHex), blend);
    this.sunLight.intensity = damp(this.sunLight.intensity, sunIntTarget, 6, dt);
    this.hemiLight.intensity = damp(this.hemiLight.intensity, hemiIntTarget, 6, dt);
    const starMat = this.world.starsMesh.material as THREE.PointsMaterial;
    starMat.opacity = damp(starMat.opacity, starOpacityTarget, 4, dt);
    const ffMat = this.world.firefliesMesh.material as THREE.PointsMaterial;
    ffMat.opacity = damp(ffMat.opacity, fireflyTarget, 4, dt) * (0.85 + Math.sin(t * 2.4) * 0.15);
    this.world.firefliesMesh.position.y = Math.sin(t * 0.85) * 0.45;
    this.world.firefliesMesh.rotation.y = Math.sin(t * 0.12) * 0.04;

    for (const lm of this.world.lanternMats) {
      lm.emissiveIntensity = damp(lm.emissiveIntensity, lanternTarget, 4, dt);
    }

    // Sun / Moon arc positioning synced to Sky Dome solar halo
    this.dayTime = (this.dayTime + dt * 0.004) % 1;
    const sunAngle =
      this.timeOfDay === 'day'
        ? 0.45 + Math.sin(this.dayTime * Math.PI * 2) * 0.3
        : this.timeOfDay === 'sunset'
          ? 2.45
          : -1.1;
    const sunY = this.timeOfDay === 'day' ? 68 : this.timeOfDay === 'sunset' ? 28 : 48;
    const sunDist = 185;
    const sunX = Math.cos(sunAngle) * sunDist;
    const sunZ = Math.sin(sunAngle) * sunDist;
    this.sunLight.position.set(
      this.px + Math.cos(sunAngle) * 46,
      this.py + sunY,
      this.pz + Math.sin(sunAngle) * 34
    );
    this.sunLight.target.position.set(this.px, this.py, this.pz);
    this.sunOrb.position.set(sunX, sunY * 1.45, sunZ);
    this.world.skyUniforms.uSunDir.value.set(sunX, sunY * 1.45, sunZ).normalize();
    this.world.skyUniforms.uPost.value = this.gfx.usesPost() ? 1 : 0;
    this.gfx.updateAtmosphere(this.world.skyUniforms.uSunDir.value, this.sunLight.color, this.timeOfDay);
    (this.sunOrb.material as THREE.MeshBasicMaterial).color.setHex(
      this.timeOfDay === 'day' ? 0xfff4bc : this.timeOfDay === 'sunset' ? 0xff9a44 : 0xd8ecff
    );

    // Turn Hearthbrook Windmill sails, Wizards' Tower arcane crystal ring, & flutter Dawnbell Spire royal banners!
    this.world.windmillSails.rotation.z -= dt * 0.65;
    this.world.wizardsCrystalRing.rotation.y += dt * 0.85;
    for (let i = 0; i < this.world.spireBanners.length; i++) {
      this.world.spireBanners[i].rotation.x = Math.sin(t * 2.8 + i * 1.2) * 0.14;
    }

    // Drift voxel clouds lazily across the vast kingdom
    for (let i = 0; i < this.world.cloudsGroup.children.length; i++) {
      const cg = this.world.cloudsGroup.children[i];
      cg.position.x += dt * (0.75 + (i % 3) * 0.28);
      if (cg.position.x > 220) cg.position.x = -220;
    }

    // Pulse soft Fresnel golden sunbeams by Time of Day
    const beamTarget = this.timeOfDay === 'day' ? 0.088 : this.timeOfDay === 'sunset' ? 0.125 : 0.0;
    const beamUniforms = this.world.sunbeamMat.uniforms;
    beamUniforms.uOpacity.value = damp(
      beamUniforms.uOpacity.value,
      beamTarget * (0.86 + Math.sin(t * 0.9) * 0.14),
      3,
      dt
    );
    beamUniforms.uColor.value.setHex(this.timeOfDay === 'sunset' ? 0xffbe72 : 0xfff2c2);
    beamUniforms.uTime.value = t;
    this.world.sunbeamsGroup.visible = beamUniforms.uOpacity.value > 0.005;

    // Sweep Breath-of-the-Wild translucent wind ribbons across the valley!
    const windOpacityTarget = this.timeOfDay === 'starlight' ? 0.22 : 0.42;
    this.world.windStreaksMat.opacity = damp(this.world.windStreaksMat.opacity, windOpacityTarget, 3, dt);
    const windItems = this.world.windStreaks;
    for (let i = 0; i < windItems.length; i++) {
      const w = windItems[i];
      w.x += w.speed * dt;
      w.z += w.speed * 0.28 * dt;
      if (w.x > 160) w.x = -160;
      if (w.z > 160) w.z = -160;
      const gh = Math.max(WATER_Y + 0.5, getTerrainHeight(w.x, w.z));
      const bob = Math.sin(t * 2.2 + w.phase) * 0.55;
      _dummy.position.set(w.x, gh + w.y + bob, w.z);
      _dummy.rotation.set(0, Math.atan2(w.speed, w.speed * 0.28), Math.sin(t * 2.6 + w.phase) * 0.12);
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.7 + w.phase);
      _dummy.scale.set(1, 1, w.len * (0.45 + pulse * 0.75));
      _dummy.updateMatrix();
      this.world.windStreaksMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.world.windStreaksMesh.instanceMatrix.needsUpdate = true;

    // Friendly Villagers gently breathe and turn to greet Wren when nearby
    for (let i = 0; i < this.world.npcs.length; i++) {
      const npc = this.world.npcs[i];
      const distP = Math.hypot(npc.x - this.px, npc.z - this.pz);
      const targetYaw = distP < 7.5 ? Math.atan2(this.px - npc.x, this.pz - npc.z) : npc.baseYaw;
      npc.group.rotation.y = dampAngle(npc.group.rotation.y, targetYaw, 5, dt);
      npc.group.scale.y = 1 + Math.sin(t * 2.2 + i * 1.7) * 0.018;
    }

    // Soaring Sky-Birds wheeling above the valley!
    for (const bird of this.world.birds) {
      bird.angle += bird.speed * dt;
      const bx = bird.centerX + Math.cos(bird.angle) * bird.radius;
      const bz = bird.centerZ + Math.sin(bird.angle) * bird.radius;
      const by = bird.altitude + Math.sin(t * 1.5 + bird.angle) * 1.2;
      bird.group.position.set(bx, by, bz);
      bird.group.rotation.y = Math.atan2(-Math.sin(bird.angle) * bird.speed, Math.cos(bird.angle) * bird.speed);
      const flap = Math.sin(t * 7.5 + bird.angle * 3) * 0.55;
      bird.wingL.rotation.z = flap;
      bird.wingR.rotation.z = -flap;
    }

    // Playful Woodland Foxes with articulated 4-leg trotting & solid building avoidance!
    for (const fox of this.world.foxes) {
      const distP = Math.hypot(fox.x - this.px, fox.z - this.pz);
      if (distP < 5.5) fox.scaredTimer = 2.4;
      let moveSpd = 0;
      if (fox.scaredTimer > 0) {
        fox.scaredTimer = Math.max(0, fox.scaredTimer - dt);
        const dx = fox.x - this.px;
        const dz = fox.z - this.pz;
        const len = Math.hypot(dx, dz) || 1;
        fox.x += (dx / len) * 5.2 * dt;
        fox.z += (dz / len) * 5.2 * dt;
        fox.yaw = dampAngle(fox.yaw, Math.atan2(dx, dz), 10, dt);
        moveSpd = 12;
      } else {
        fox.angle += dt * 0.45;
        const tx = fox.homeX + Math.cos(fox.angle) * 4.5;
        const tz = fox.homeZ + Math.sin(fox.angle * 0.8) * 4.5;
        const dx = tx - fox.x;
        const dz = tz - fox.z;
        fox.x += dx * dt * 0.7;
        fox.z += dz * dt * 0.7;
        if (Math.hypot(dx, dz) > 0.15) {
          fox.yaw = dampAngle(fox.yaw, Math.atan2(dx, dz), 6, dt);
          moveSpd = 6.5;
        }
      }
      const resolved = this.pushWildlifeOutOfColliders(fox.x, fox.z, 0.55);
      fox.x = resolved.x;
      fox.z = resolved.z;
      const fy = Math.max(WATER_Y + 0.15, getTerrainHeight(fox.x, fox.z));
      fox.group.position.set(fox.x, fy + Math.abs(Math.sin(t * (moveSpd || 4) + fox.angle)) * 0.08, fox.z);
      fox.group.rotation.y = fox.yaw;
      fox.contactShadow.position.set(fox.x, fy + 0.05, fox.z);
      fox.tail.rotation.y = Math.sin(t * 8 + fox.angle) * 0.35;
      const stride = Math.sin(t * (moveSpd || 4) + fox.angle) * (moveSpd > 0 ? 0.55 : 0.05);
      fox.legs[0].rotation.x = stride;
      fox.legs[1].rotation.x = -stride;
      fox.legs[2].rotation.x = -stride;
      fox.legs[3].rotation.x = stride;
    }

    // Graceful Meadow Deer (grazing, bounding away when approached, avoiding buildings!)
    for (const dr of this.world.deer) {
      const distP = Math.hypot(dr.x - this.px, dr.z - this.pz);
      if (distP < 7.2) dr.scaredTimer = 3.2;
      let trotRate = 0;
      if (dr.scaredTimer > 0) {
        dr.scaredTimer = Math.max(0, dr.scaredTimer - dt);
        const dx = dr.x - this.px;
        const dz = dr.z - this.pz;
        const len = Math.hypot(dx, dz) || 1;
        const nx = dr.x + (dx / len) * 6.4 * dt;
        const nz = dr.z + (dz / len) * 6.4 * dt;
        if (getTerrainHeight(nx, nz) > WATER_Y + 0.4 && Math.hypot(nx, nz) < WORLD_PLAY_RADIUS - 8) {
          dr.x = nx;
          dr.z = nz;
        }
        dr.yaw = dampAngle(dr.yaw, Math.atan2(dx, dz), 8, dt);
        dr.headGroup.rotation.x = damp(dr.headGroup.rotation.x, -0.08, 8, dt);
        trotRate = 11;
      } else {
        const grazing = Math.sin(t * 0.55 + dr.phase) > 0.25;
        if (grazing) {
          dr.headGroup.rotation.x = damp(dr.headGroup.rotation.x, 0.72 + Math.sin(t * 3 + dr.phase) * 0.08, 4, dt);
        } else {
          dr.headGroup.rotation.x = damp(dr.headGroup.rotation.x, 0.0, 4, dt);
          dr.angle += dt * 0.24;
          const tx = dr.homeX + Math.cos(dr.angle) * 5.2;
          const tz = dr.homeZ + Math.sin(dr.angle * 0.75) * 5.2;
          const dx = tx - dr.x;
          const dz = tz - dr.z;
          dr.x += dx * dt * 0.45;
          dr.z += dz * dt * 0.45;
          if (Math.hypot(dx, dz) > 0.2) {
            dr.yaw = dampAngle(dr.yaw, Math.atan2(dx, dz), 4.5, dt);
            trotRate = 5.2;
          }
        }
      }
      const resD = this.pushWildlifeOutOfColliders(dr.x, dr.z, 0.85);
      dr.x = resD.x;
      dr.z = resD.z;
      const dy = Math.max(WATER_Y + 0.15, getTerrainHeight(dr.x, dr.z));
      dr.group.position.set(dr.x, dy + (trotRate > 8 ? Math.abs(Math.sin(t * trotRate)) * 0.18 : 0), dr.z);
      dr.group.rotation.y = dr.yaw;
      dr.contactShadow.position.set(dr.x, dy + 0.05, dr.z);
      const ds = trotRate > 0 ? Math.sin(t * trotRate + dr.phase) * 0.52 : 0;
      dr.legs[0].rotation.x = ds;
      dr.legs[1].rotation.x = -ds;
      dr.legs[2].rotation.x = -ds;
      dr.legs[3].rotation.x = ds;
    }

    // Cozy Lake Ducks paddling across Azure Mirror Lake
    for (const dk of this.world.ducks) {
      dk.angle += dk.speed * dt;
      const dx = dk.centerX + Math.cos(dk.angle) * dk.radius;
      const dz = dk.centerZ + Math.sin(dk.angle) * dk.radius;
      dk.group.position.set(dx, WATER_Y + 0.04 + Math.sin(t * 2.6 + dk.angle) * 0.03, dz);
      dk.group.rotation.y = Math.atan2(-Math.sin(dk.angle) * dk.speed, Math.cos(dk.angle) * dk.speed);
    }

    // Fluttering Meadow Butterflies weaving in sunlit figure-8s
    for (const bf of this.world.butterflies) {
      const a = t * 1.4 + bf.phase;
      const bx = bf.homeX + Math.sin(a) * 1.8;
      const bz = bf.homeZ + Math.sin(a * 2) * 1.1;
      const by = bf.homeY + Math.sin(t * 3.5 + bf.phase) * 0.35;
      bf.group.position.set(bx, by, bz);
      bf.group.rotation.y = Math.atan2(Math.cos(a) * 1.8, Math.cos(a * 2) * 2.2);
      const wf = Math.sin(t * 24 + bf.phase) * 0.85;
      bf.wingL.rotation.z = wf;
      bf.wingR.rotation.z = -wf;
    }

    // Spin Whisper-Sprite pinwheels, bob floating balloons, dance revealed sprites!
    for (const ws of this.world.whisperSecrets) {
      if (ws.blades) ws.blades.rotation.z -= dt * (ws.found ? 1.5 : 4.2);
      if (ws.balloon && !ws.found) {
        ws.group.position.y = ws.y + Math.sin(t * 2.2 + ws.phase) * 0.55;
        ws.balloon.rotation.y = t * 1.1 + ws.phase;
      }
      if (ws.found) {
        ws.sprite.rotation.y = Math.atan2(this.px - ws.x, this.pz - ws.z);
        ws.sprite.position.y = 0.25 + Math.abs(Math.sin(t * 5.2 + ws.phase)) * 0.32;
      }
    }

    // Sway Dawnbell spire bell & rotate shrine crystals
    this.world.spireBell.rotation.z = Math.sin(t * 1.4) * 0.14;
    for (const s of this.world.shrines) {
      s.crystal.rotation.y = t * (s.activated ? 2.2 : 1.1);
      s.crystal.position.y = 3.15 + Math.sin(t * 2.4 + s.x) * 0.16;
    }

    // Flicker campfires, Dawn Braziers, Resonance Bells, Archery Targets, Pasture Livestock & wind geysers
    for (const cf of this.world.campfires) {
      const f = Math.sin(t * 16 + cf.x) * 0.14;
      cf.flame1.scale.set(0.38 + f * 0.25, 0.54 + Math.sin(t * 12 + cf.z) * 0.12, 0.38 + f * 0.25);
      cf.flame2.scale.set(0.22 - f * 0.15, 0.44 + Math.cos(t * 15 + cf.x) * 0.1, 0.22 - f * 0.15);
      cf.light.intensity = 2.2 + Math.sin(t * 14 + cf.x) * 0.35;
    }

    for (const bell of this.world.chimeBells) {
      if (Math.abs(bell.swingAngle) > 0.002 || Math.abs(bell.swingVel) > 0.002) {
        const accel = -22 * bell.swingAngle - 3.6 * bell.swingVel;
        bell.swingVel += accel * dt;
        bell.swingAngle += bell.swingVel * dt;
        bell.bell.rotation.x = bell.swingAngle;
      }
    }

    for (const br of this.world.dawnBraziers) {
      if (br.lit) {
        const f = Math.sin(t * 15 + br.x) * 0.12;
        br.flame1.scale.set(1 + f, 1 + Math.cos(t * 13 + br.z) * 0.15, 1 + f);
        br.flame2.scale.set(1 - f * 0.6, 1 + Math.sin(t * 17 + br.x) * 0.14, 1 - f * 0.6);
        br.light.intensity = 2.4 + Math.sin(t * 14 + br.x) * 0.4;
      }
    }

    for (const tgt of this.world.archeryTargets) {
      if (tgt.hit && tgt.hitAnim < 1) {
        tgt.hitAnim = Math.min(1, tgt.hitAnim + dt * 5.2);
        tgt.board.rotation.x = -Math.PI * 0.48 * tgt.hitAnim;
      }
    }

    // Grazing RuneScape-inspired Sheep & Dairy Cows in Hearthbrook pastures
    for (const an of this.world.pastureAnimals) {
      const graze = Math.sin(t * 0.65 + an.phase) > 0.15;
      if (graze) {
        an.head.rotation.x = damp(an.head.rotation.x, 0.42 + Math.sin(t * 3.2 + an.phase) * 0.07, 4, dt);
      } else {
        an.head.rotation.x = damp(an.head.rotation.x, 0, 4, dt);
        const targetX = an.homeX + Math.cos(t * 0.22 + an.phase) * 2.8;
        const targetZ = an.homeZ + Math.sin(t * 0.18 + an.phase * 1.4) * 2.8;
        const dx = targetX - an.x;
        const dz = targetZ - an.z;
        an.x += dx * dt * 0.35;
        an.z += dz * dt * 0.35;
        if (Math.hypot(dx, dz) > 0.15) {
          an.yaw = dampAngle(an.yaw, Math.atan2(dx, dz), 3.5, dt);
        }
      }
      const resA = this.pushWildlifeOutOfColliders(an.x, an.z, an.kind === 'cow' ? 0.85 : 0.55);
      an.x = resA.x;
      an.z = resA.z;
      const ay = Math.max(WATER_Y + 0.15, getTerrainHeight(an.x, an.z));
      an.group.position.set(an.x, ay, an.z);
      an.group.rotation.y = an.yaw;
      an.contactShadow.position.set(an.x, ay + 0.05, an.z);
    }

    for (const u of this.world.updrafts) {
      if (u.mesh) {
        u.mesh.rotation.y += dt * 2.8;
        u.mesh.children.forEach((child, idx) => {
          child.position.y = (t * 4.5 + idx * (u.height / 6)) % u.height;
        });
      }
    }
  }

  private updateHeroVisuals(dt: number, moveMag: number): void {
    const H = this.hero;
    this.scaleX = damp(this.scaleX, 1, 14, dt);
    this.scaleY = damp(this.scaleY, 1, 14, dt);

    H.root.position.set(this.px, this.py, this.pz);
    H.root.rotation.y = this.pYaw;
    H.body.scale.set(this.scaleX, this.scaleY, this.scaleX);

    // Contact shadow grounded directly on surface beneath Wren
    const groundY = Math.max(getTerrainHeight(this.px, this.pz), this.getSupportingColliderTop(this.px, this.py + 0.1, this.pz));
    H.contactShadow.position.set(this.px, Math.max(WATER_Y + 0.04, groundY + 0.04), this.pz);
    const heightAbove = Math.max(0, this.py - groundY);
    H.contactShadow.scale.setScalar(clamp(1 - heightAbove * 0.07, 0.25, 1));
    H.contactShadow.visible = !this.climbing && !this.swimming;

    // Hit flash on Wren
    for (const m of H.flashMats) {
      if (this.hitFlashTimer > 0) {
        m.emissive.setHex(0xff5040);
        m.emissiveIntensity = 0.85;
      } else if (this.flurryTimer > 0) {
        m.emissive.setHex(0xffd858);
        m.emissiveIntensity = 0.28;
      } else {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
    }

    // Equipment visibility toggles (Paraglider, Bow, Shield on hand vs back vs underfoot, Dawn Lamp!)
    const stowHands = this.gliding || this.climbing || this.swimming || this.isAiming || this.shieldSurfing;
    H.gliderGroup.visible = this.gliding;
    H.bowGroup.visible = this.isAiming;
    H.bowArrow.visible = this.isAiming && this.inv.arrows > 0;
    H.sword.visible = !stowHands;
    H.shieldHand.visible = !stowHands;
    H.shieldBack.visible = stowHands && !this.shieldSurfing;
    H.shieldSurf.visible = this.shieldSurfing;
    H.swordGlow.visible = this.spinChargeTime > 0.25 || this.isSpinning || this.flurryTimer > 0;
    H.dawnLampGroup.visible = this.story.dawnLampUnlocked;
    const lampActive = this.story.dawnLampUnlocked && this.dawnLampOn;
    H.dawnLampLight.intensity = lampActive ? 2.8 + Math.sin(performance.now() * 0.012) * 0.35 : 0;
    H.dawnLampFlameMat.emissiveIntensity = lampActive ? 2.2 : 0.1;

    // Slash arc visual
    if (this.attackTimer > 0.05) {
      H.slashArc.visible = true;
      const prog = 1 - this.attackTimer / (this.isSpinning ? 0.42 : 0.32);
      H.slashArc.rotation.z = this.isSpinning
        ? prog * Math.PI * 2.4
        : this.comboStep === 2
          ? -1.2 + prog * 2.4
          : 1.2 - prog * 2.4;
      H.slashArc.scale.setScalar(this.isSpinning ? 1.35 : 1.0);
    } else {
      H.slashArc.visible = false;
    }

    const t = performance.now() * 0.001;
    H.hoodTail.rotation.x = 0.18 + Math.min(0.65, Math.hypot(this.pvx, this.pvz) * 0.06) + Math.sin(t * 7) * 0.08;

    // Reset center-of-mass body pivot unless mid-somersault
    H.body.position.set(0, 0, 0);

    if (this.dodgeTimer > 0) {
      // Crisp 360-degree Forward Combat Roll, Backflip, or Side-Hop pivoting around center of mass!
      const p = clamp(1 - this.dodgeTimer / Math.max(0.1, this.dodgeDuration), 0, 1);
      const cy = 0.78;
      if (this.dodgeStyle === 'roll') {
        const angle = p * Math.PI * 2;
        H.body.rotation.set(angle, 0, 0);
        H.body.position.set(
          0,
          cy - cy * Math.cos(angle) + Math.sin(p * Math.PI) * 0.18,
          -cy * Math.sin(angle)
        );
        H.armL.rotation.set(-1.35, 0.35, -0.35);
        H.armR.rotation.set(-1.35, -0.35, 0.35);
        H.elL.rotation.x = -1.2;
        H.elR.rotation.x = -1.2;
        H.legL.rotation.x = -1.15;
        H.legR.rotation.x = -1.15;
        H.shinL.rotation.x = 1.35;
        H.shinR.rotation.x = 1.35;
      } else if (this.dodgeStyle === 'backflip') {
        const angle = -p * Math.PI * 2;
        H.body.rotation.set(angle, 0, 0);
        H.body.position.set(
          0,
          cy - cy * Math.cos(angle) + Math.sin(p * Math.PI) * 0.32,
          -cy * Math.sin(angle)
        );
        H.armL.rotation.set(-2.2, 0, -0.5);
        H.armR.rotation.set(-2.2, 0, 0.5);
        H.legL.rotation.x = -0.85;
        H.legR.rotation.x = -0.85;
        H.shinL.rotation.x = 1.1;
        H.shinR.rotation.x = 1.1;
      } else {
        const tilt = this.dodgeStyle === 'sidehop_left' ? 0.55 : -0.55;
        H.body.rotation.set(0.18, 0, Math.sin(p * Math.PI) * tilt);
        H.armL.rotation.set(-0.9, 0, -0.7);
        H.armR.rotation.set(-0.9, 0, 0.7);
        H.legL.rotation.x = -0.45;
        H.legR.rotation.x = 0.35;
      }
    } else if (this.jumpSlamming) {
      // Airborne Jump-Strike Plunge Pose (sword raised overhead ready to slam!)
      H.body.rotation.set(0.28, 0, 0);
      H.armR.rotation.set(-2.85, 0, 0.2);
      H.armL.rotation.set(-1.8, 0.4, -0.2);
      H.legL.rotation.x = -0.35;
      H.legR.rotation.x = 0.42;
    } else if (this.shieldSurfing) {
      // Crouched snowboarder stance balancing atop the Dawnbell Kite Shield!
      H.body.rotation.set(0.14, 0.55, clamp((this.pvx * Math.cos(this.pYaw) - this.pvz * Math.sin(this.pYaw)) * 0.03, -0.25, 0.25));
      H.armL.rotation.set(-0.35, 0, -1.15);
      H.armR.rotation.set(-0.35, 0, 1.15);
      H.elL.rotation.x = -0.2;
      H.elR.rotation.x = -0.2;
      H.legL.rotation.x = -0.35;
      H.legR.rotation.x = 0.28;
      H.shinL.rotation.x = 0.42;
      H.shinR.rotation.x = 0.35;
    } else if (this.gliding) {
      // Holding glider overhead with wind-swept legs & banking tilt
      H.armL.rotation.set(-2.95, 0, -0.2);
      H.armR.rotation.set(-2.95, 0, 0.2);
      H.elL.rotation.x = 0;
      H.elR.rotation.x = 0;
      H.legL.rotation.x = 0.35 + Math.sin(t * 5) * 0.08;
      H.legR.rotation.x = 0.25 - Math.sin(t * 5) * 0.08;
      H.body.rotation.x = 0.2;
      H.body.rotation.z = clamp((this.pvx * Math.cos(this.pYaw) - this.pvz * Math.sin(this.pYaw)) * 0.035, -0.28, 0.28);
    } else if (this.climbing) {
      const cy = Math.sin(this.py * 5.2 + this.px * 4.0);
      H.armL.rotation.set(-2.3 + cy * 0.55, 0, -0.25);
      H.armR.rotation.set(-2.3 - cy * 0.55, 0, 0.25);
      H.legL.rotation.x = -0.35 - cy * 0.45;
      H.legR.rotation.x = -0.35 + cy * 0.45;
      H.body.rotation.set(0.08, 0, 0);
    } else if (this.isAiming) {
      H.armL.rotation.set(-1.55, 0.2, 0);
      H.armR.rotation.set(-1.55, -0.35 - this.aimCharge * 0.4, 0);
      H.elL.rotation.x = 0;
      H.elR.rotation.x = -0.6 - this.aimCharge * 0.5;
      H.body.rotation.set(0, -0.35, 0);
      H.legL.rotation.x = 0;
      H.legR.rotation.x = 0;
    } else {
      H.body.rotation.set(moveMag * 0.08, 0, 0);
      const sw = this.grounded ? Math.sin(this.walkDist * 2.3) * Math.min(1, Math.hypot(this.pvx, this.pvz) / 5.5) : 0.35;
      H.legL.rotation.x = sw * 0.72;
      H.legR.rotation.x = -sw * 0.72;
      H.shinL.rotation.x = Math.max(0, -sw * 0.55);
      H.shinR.rotation.x = Math.max(0, sw * 0.55);

      if (this.attackTimer > 0) {
        const p = 1 - this.attackTimer / (this.isSpinning ? 0.42 : 0.32);
        if (this.isSpinning) {
          H.body.rotation.y = p * Math.PI * 2;
          H.armR.rotation.set(-1.5, 0, 1.3);
        } else {
          H.armR.rotation.set(-1.7 + p * 2.1, this.comboStep === 2 ? -1.1 + p * 2.2 : 1.1 - p * 2.2, 0);
        }
        H.armL.rotation.set(-0.5, 0.3, 0);
      } else if (this.isShielding) {
        H.armL.rotation.set(-1.35, 0.65, 0);
        H.elL.rotation.x = -0.5;
        H.armR.rotation.set(-0.4, 0, 0);
      } else {
        H.armL.rotation.set(-sw * 0.55, 0, 0);
        H.armR.rotation.set(sw * 0.55 - 0.25, 0, 0);
        H.elL.rotation.x = -0.15;
        H.elR.rotation.x = -0.25;
      }
    }
  }

  private updatePip(dt: number): void {
    const t = performance.now() * 0.001;
    const tx = this.px + Math.cos(t * 1.4) * 1.05;
    const ty = this.py + 2.15 + Math.sin(t * 2.6) * 0.22;
    const tz = this.pz + Math.sin(t * 1.4) * 1.05;
    this.pip.root.position.x = damp(this.pip.root.position.x, tx, 5, dt);
    this.pip.root.position.y = damp(this.pip.root.position.y, ty, 5, dt);
    this.pip.root.position.z = damp(this.pip.root.position.z, tz, 5, dt);
    this.pip.root.rotation.y = t * 1.5;
    const flap = Math.sin(t * 22) * 0.65;
    this.pip.wingL.rotation.y = flap;
    this.pip.wingR.rotation.y = -flap;
  }

  private updateTitleCamera(dt: number): void {
    // Sweeping live valley flyover framing Awakening Overlook, Whisperwood, and the towering Dawnbell Spire!
    this.titleOrbitAngle += dt * 0.085;
    const radius = 34;
    const cx = Math.sin(this.titleOrbitAngle) * radius;
    const cz = 22 + Math.cos(this.titleOrbitAngle) * 24;
    const cy = Math.max(getTerrainHeight(cx, cz) + 8.5, 19.5 + Math.sin(this.titleOrbitAngle * 1.3) * 2.5);

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(0, 11.5, 2);
  }

  private updateGameplayCamera(dt: number, _inp: ReturnType<InputManager['poll']>): void {
    // Target FOV kick on sprint/glide/aim
    const targetFov = this.isAiming ? 40 : this.gliding ? 64 : Math.hypot(this.pvx, this.pvz) > 8.5 ? 61 : 55;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = damp(this.camera.fov, targetFov, 9, dt);
      this.camera.updateProjectionMatrix();
    }

    // Soft lock-on camera assist
    if (this.lockedTarget && !this.isAiming) {
      const desiredYaw = Math.atan2(this.lockedTarget.x - this.px, this.lockedTarget.z - this.pz);
      this.camYaw = dampAngle(this.camYaw, desiredYaw, 5.5, dt);
    }

    const pivotX = this.px;
    const pivotY = this.py + (this.isAiming ? 1.62 : 1.75);
    const pivotZ = this.pz;

    let dist = this.isAiming ? 3.1 : this.gliding ? 9.5 : 7.8;
    const rightOffset = this.isAiming ? 0.95 : 0;

    const cosP = Math.cos(this.camPitch);
    const sinP = Math.sin(this.camPitch);
    const sinY = Math.sin(this.camYaw);
    const cosY = Math.cos(this.camYaw);

    const rightX = -cosY;
    const rightZ = sinY;

    let desiredX = pivotX - sinY * cosP * dist + rightX * rightOffset;
    let desiredY = pivotY + sinP * dist + (this.isAiming ? 0.15 : 0.75);
    let desiredZ = pivotZ - cosY * cosP * dist + rightZ * rightOffset;

    // Non-recursive camera wall pull-in against simplified invisible collision proxies + terrain
    // (never hits decorative voxel sub-meshes like banners, ivy, shutters, or spinning windmill sails!)
    _v3A.set(pivotX, pivotY, pivotZ);
    _v3B.set(desiredX - pivotX, desiredY - pivotY, desiredZ - pivotZ);
    const desiredLen = _v3B.length();
    if (desiredLen > 0.1) {
      _v3B.divideScalar(desiredLen);
      _ray.set(_v3A, _v3B);
      _ray.far = desiredLen;
      const hits = _ray.intersectObjects(this.world.raycastProxies, false);
      if (hits.length > 0 && hits[0].distance < desiredLen) {
        const pull = Math.max(1.6, hits[0].distance - 0.55);
        desiredX = pivotX + _v3B.x * pull;
        desiredY = pivotY + _v3B.y * pull;
        desiredZ = pivotZ + _v3B.z * pull;
      }
    }

    const minCamY = getTerrainHeight(desiredX, desiredZ) + 0.85;
    if (desiredY < minCamY) desiredY = minCamY;

    this.camPos.x = damp(this.camPos.x, desiredX, 14, dt);
    this.camPos.y = damp(this.camPos.y, desiredY, 14, dt);
    this.camPos.z = damp(this.camPos.z, desiredZ, 14, dt);

    const lookAhead = this.isAiming ? 18 : 5.2;
    const lx = pivotX + sinY * lookAhead + rightX * rightOffset * 0.5;
    const ly = this.isAiming ? pivotY - sinP * 14 : pivotY + 0.85 - sinP * 1.3;
    const lz = pivotZ + cosY * lookAhead + rightZ * rightOffset * 0.5;

    this.camLook.x = damp(this.camLook.x, lx, 16, dt);
    this.camLook.y = damp(this.camLook.y, ly, 16, dt);
    this.camLook.z = damp(this.camLook.z, lz, 16, dt);

    // Trauma-squared impact shake
    const shake = this.trauma * this.trauma * 0.35;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook.x, this.camLook.y, this.camLook.z);
  }

  private emitHud(): void {
    // Project locked enemy to screen space safely (guarded by z in [-1, 1])
    let lockedTargetScreen: HudSnapshot['lockedTargetScreen'] = null;
    if (this.lockedTarget && !this.lockedTarget.dead) {
      _v3C.set(this.lockedTarget.x, this.lockedTarget.y + this.lockedTarget.height * 0.65, this.lockedTarget.z);
      _v3C.project(this.camera);
      if (_v3C.z >= -1 && _v3C.z <= 1) {
        lockedTargetScreen = {
          x: (_v3C.x * 0.5 + 0.5) * 100,
          y: (-_v3C.y * 0.5 + 0.5) * 100,
          name: this.lockedTarget.name,
          hpPct: clamp((this.lockedTarget.hp / this.lockedTarget.maxHp) * 100, 0, 100),
        };
      }
    }

    const boss = this.enemies.getActiveBoss(this.px, this.pz);
    const chDef = getCurrentChapterDef(this.story);

    this.onHudUpdate({
      state: this.gameState,
      victory: this.victory,
      hp: this.inv.hp,
      maxHp: this.inv.maxHp,
      stamina: this.stamina.current,
      staminaMax: this.stamina.max,
      staminaExhausted: this.stamina.exhausted,
      staminaVisible: this.stamina.current < this.stamina.max - 0.5 || this.stamina.exhausted,
      marks: this.inv.marks,
      arrows: this.inv.arrows,
      apples: this.inv.apples,
      meals: this.inv.meals,
      shrinesActivated: [...this.inv.shrinesActivated],
      totalShrines: TOTAL_SHRINES,
      seedsFound: [...this.inv.seedsFound],
      totalSeeds: TOTAL_SEEDS,
      activeRune: this.activeRune,
      runeCooldowns: { ...this.runeCooldowns },
      bombActive: Boolean(this.activeBomb),
      regionName: this.currentRegion,
      regionBannerTimer: this.regionBannerTimer,
      toastText: this.toastText,
      promptLabel: this.promptLabel,
      aiming: this.isAiming,
      aimCharge: this.aimCharge,
      bulletTime: this.isAiming && !this.grounded && !this.climbing && !this.stamina.exhausted,
      flurryRush: this.flurryTimer > 0,
      climbing: this.climbing,
      gliding: this.gliding,
      shieldSurfing: this.shieldSurfing,
      rolling: this.dodgeTimer > 0,
      jumpSlamming: this.jumpSlamming,
      timeOfDay: this.timeOfDay,
      lockedTargetScreen,
      bossBar: boss ? { name: boss.name, hp: boss.hp, maxHp: boss.maxHp } : null,
      activeDevice: this.lastActiveDevice,
      gamepadConnected: this.lastGamepadConnected,
      pointerLocked: this.lastPointerLocked,
      keybinds: this.input.getKeybinds(),
      muted: this.audio.isMuted(),
      mapOpen: this.mapOpen,
      mapTab: this.mapTab,
      story: this.story,
      chapterRoman: chDef.roman,
      chapterTitle: chDef.title,
      activeObjective: getNextObjectiveLabel(this.story),
      sideQuests: this.sideQuests,
      puzzles: this.puzzles,
      dawnLampUnlocked: this.story.dawnLampUnlocked,
      dawnLampOn: this.dawnLampOn,
      playerX: this.px,
      playerZ: this.pz,
      playerYaw: this.pYaw,
      elapsedSeconds: this.elapsedSeconds,
      enemiesDefeated: this.enemiesDefeated,
      chestsOpened: this.inv.chestsOpened.length,
      totalChests: this.world.chests.length,
      dialogue: this.dialogue,
      dialogueRemaining: this.dialogueQueue.length,
    });
  }

  getLandmarks(): typeof LANDMARKS {
    return LANDMARKS;
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResizeBound);
    this.input.detach();
    this.world.dispose();
    this.gfx.dispose();
    this.mats.dispose();
    this.renderer.dispose();
  }
}
