import * as THREE from 'three';
import { getTerrainHeight, WATER_Y, clamp, dampAngle } from './math';
import { AttackTokenPool, computeStillstoneLaunch } from './mechanics';
import { MaterialLibrary, addVoxelBox, createContactShadow } from './voxelBuilder';
import { resolveCircleOverlapXZ, type SolidCollider } from './collision';

export type EnemyKind = 'slime' | 'beetle' | 'wisp' | 'sentinel';

export interface EnemyProjectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  life: number;
  reflected: boolean;
  isBeam: boolean;
  mesh: THREE.Mesh;
}

export type EnemyVariant = 'rat' | 'ratking';

export interface EnemySpawnSpec {
  kind: EnemyKind;
  x: number;
  z: number;
  campId?: string;
  name?: string;
  hp?: number;
  tag?: string;
  variant?: EnemyVariant;
  scale?: number;
}

export interface EnemyEntity {
  id: string;
  kind: EnemyKind;
  name: string;
  /** Set for enemies spawned by the saga (story rooms, dungeons) */
  tag?: string;
  variant?: EnemyVariant;
  campId?: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  homeX: number;
  homeZ: number;
  yaw: number;
  radius: number;
  height: number;
  hp: number;
  maxHp: number;
  state: 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'stunned' | 'ko';
  stateTimer: number;
  animTime: number;
  hitFlash: number;
  stasisTimer: number;
  stasisHits: number;
  stasisDirX: number;
  stasisDirZ: number;
  koTimer: number;
  dead: boolean;
  attackDidHit: boolean;
  root: THREE.Group;
  body: THREE.Group;
  contactShadow: THREE.Mesh;
  telegraphRing: THREE.Mesh;
  laserLine?: THREE.Mesh;
  armL?: THREE.Group;
  armR?: THREE.Group;
  coreMesh?: THREE.Mesh;
  flashMats: THREE.MeshStandardMaterial[];
}

export interface EnemyUpdateCallbacks {
  onPlayerDamaged: (damage: number, fromX: number, fromZ: number, attacker: EnemyEntity, isProjectile: boolean) => void;
  onTelegraph: () => void;
  onEnemyKilled: (enemy: EnemyEntity) => void;
  onExplosion: (x: number, y: number, z: number, radius: number, damage: number) => void;
  spawnParticles: (x: number, y: number, z: number, color: number, count: number, speed?: number) => void;
}

function buildEnemyVisual(
  mats: MaterialLibrary,
  kind: EnemyKind,
  variant?: EnemyVariant
): {
  root: THREE.Group;
  body: THREE.Group;
  flashMats: THREE.MeshStandardMaterial[];
  telegraphRing: THREE.Mesh;
  laserLine?: THREE.Mesh;
  armL?: THREE.Group;
  armR?: THREE.Group;
  coreMesh?: THREE.Mesh;
  radius: number;
  height: number;
} {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const flashMats: THREE.MeshStandardMaterial[] = [];

  const own = (c: number | string, opts?: Parameters<MaterialLibrary['getMat']>[1]) => {
    const m = mats.getMat(c, opts).clone();
    flashMats.push(m);
    return m;
  };

  let radius = 0.72;
  let height = 1.1;
  let armL: THREE.Group | undefined;
  let armR: THREE.Group | undefined;
  let coreMesh: THREE.Mesh | undefined;
  let laserLine: THREE.Mesh | undefined;

  if (variant === 'rat' || variant === 'ratking') {
    // Giant cellar rat (behaves like a slime: hop, lunge, bite)
    radius = 0.6;
    height = 0.8;
    const fur = own(variant === 'ratking' ? '#8a7068' : '#7d6a60', { roughness: 0.9, pattern: 'cloth' });
    const belly = own('#c8a8a0', { roughness: 0.9 });
    const pink = mats.getMat('#e8a0a8', { roughness: 0.6 });
    const eye = mats.getMat('#ff4a3a', { emissive: '#ff2a1a', emissiveIntensity: 0.8 });
    addVoxelBox(body, 0.62, 0.5, 1.0, fur, 0, 0.36, -0.05);
    addVoxelBox(body, 0.5, 0.2, 0.8, belly, 0, 0.16, -0.02);
    addVoxelBox(body, 0.42, 0.38, 0.42, fur, 0, 0.46, 0.55);
    addVoxelBox(body, 0.18, 0.16, 0.2, pink, 0, 0.4, 0.82);
    for (const sd of [-1, 1]) {
      addVoxelBox(body, 0.16, 0.2, 0.06, pink, sd * 0.18, 0.72, 0.5, false);
      addVoxelBox(body, 0.07, 0.07, 0.04, eye, sd * 0.12, 0.55, 0.76, false);
      addVoxelBox(body, 0.12, 0.2, 0.14, fur, sd * 0.22, 0.1, 0.32);
      addVoxelBox(body, 0.12, 0.2, 0.14, fur, sd * 0.22, 0.1, -0.4);
    }
    addVoxelBox(body, 0.08, 0.08, 0.8, pink, 0, 0.3, -0.92);
    if (variant === 'ratking') {
      const gold = mats.getMat('#f0c65a', { metalness: 0.85, roughness: 0.25 });
      addVoxelBox(body, 0.34, 0.08, 0.34, gold, 0, 0.7, 0.52);
      for (const [cx, cz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) addVoxelBox(body, 0.07, 0.14, 0.07, gold, cx, 0.8, 0.52 + cz);
    }
  } else if (kind === 'slime') {
    radius = 0.65;
    height = 0.98;
    const jelly = own('#44c83a', { roughness: 0.18, transparent: true, opacity: 0.78 });
    const core = own('#8ef864', { roughness: 0.25, emissive: '#3ca82c', emissiveIntensity: 0.28 });
    const cheek = mats.getMat('#ff8694', { roughness: 0.5 });
    const eye = mats.getMat('#182236', { roughness: 0.15 });
    const gloss = mats.getMat('#ffffff', { roughness: 0.08 });
    const leaf = mats.getMat('#3c9836', { roughness: 0.75 });

    // Translucent bouncy jelly dome + visible floating inner core & bubbles
    addVoxelBox(body, 1.0, 0.72, 1.0, jelly, 0, 0.36, 0);
    addVoxelBox(body, 0.76, 0.22, 0.76, jelly, 0, 0.83, 0);
    addVoxelBox(body, 0.44, 0.38, 0.44, core, 0, 0.38, 0, false);
    addVoxelBox(body, 0.12, 0.12, 0.12, gloss, 0.22, 0.56, -0.14, false);
    addVoxelBox(body, 0.09, 0.09, 0.09, gloss, -0.24, 0.28, -0.18, false);
    // Expressive eyes + sparkle pupils + rosy cheeks + leafy sprout
    for (const s of [-1, 1]) {
      addVoxelBox(body, 0.16, 0.22, 0.04, eye, s * 0.22, 0.44, 0.51, false);
      addVoxelBox(body, 0.055, 0.06, 0.02, gloss, s * 0.22 - 0.03, 0.49, 0.535, false);
      addVoxelBox(body, 0.12, 0.07, 0.03, cheek, s * 0.35, 0.31, 0.51, false);
    }
    addVoxelBox(body, 0.16, 0.14, 0.04, gloss, -0.32, 0.62, 0.51, false);
    addVoxelBox(body, 0.06, 0.18, 0.06, leaf, 0, 1.02, 0, false);
    addVoxelBox(body, 0.18, 0.06, 0.12, leaf, 0.11, 1.1, 0, false);
  } else if (kind === 'beetle') {
    radius = 0.96;
    height = 1.22;
    const shell = own('#286a74', { roughness: 0.28, metalness: 0.35, bump: 'stone' });
    const shellL = own('#64c8be', { roughness: 0.24, metalness: 0.28 });
    const dark = own('#1c2a32', { roughness: 0.72 });
    const gold = own('#f4ca5c', { roughness: 0.22, metalness: 0.86 });
    const horn = own('#efe0b4', { roughness: 0.45 });
    const eyeGlow = mats.getMat('#ffb838', { emissive: '#ff8a18', emissiveIntensity: 1.2 });

    // Layered carapace + elytra ridge + gilded studs
    addVoxelBox(body, 1.36, 0.52, 1.54, shell, 0, 0.42, 0);
    addVoxelBox(body, 1.04, 0.28, 1.16, shellL, 0, 0.82, -0.04);
    addVoxelBox(body, 0.14, 0.34, 1.44, dark, 0, 0.82, -0.02);
    for (const [sx, sz] of [
      [-0.32, 0.26],
      [0.32, -0.26],
      [0.32, 0.34],
      [-0.3, -0.34],
    ]) {
      addVoxelBox(body, 0.18, 0.06, 0.18, gold, sx, 0.99, sz, false);
    }
    // Armored head + glowing amber eyes + curved ivory mandibles
    addVoxelBox(body, 0.74, 0.44, 0.48, dark, 0, 0.4, 0.92);
    for (const s of [-1, 1]) {
      addVoxelBox(body, 0.12, 0.11, 0.08, eyeGlow, s * 0.26, 0.48, 1.16, false);
      addVoxelBox(body, 0.14, 0.14, 0.54, horn, s * 0.24, 0.38, 1.34);
      addVoxelBox(body, 0.18, 0.12, 0.18, horn, s * 0.16, 0.44, 1.62);
    }
    // 6 jointed armored beetle legs
    for (const q of [-1, 1]) {
      for (const lz of [-0.46, 0, 0.46]) {
        addVoxelBox(body, 0.32, 0.13, 0.13, dark, q * 0.8, 0.26, lz);
        addVoxelBox(body, 0.12, 0.26, 0.12, dark, q * 0.94, 0.13, lz);
      }
    }
  } else if (kind === 'wisp') {
    radius = 0.72;
    height = 1.75;
    const robe = own('#543074', { roughness: 0.78, pattern: 'cloth' });
    const robeD = own('#3b1f56', { roughness: 0.84, pattern: 'cloth' });
    const gold = own('#f4ca5c', { roughness: 0.25, metalness: 0.85 });
    const core = own('#ce78ff', { roughness: 0.18, emissive: '#a444ff', emissiveIntensity: 1.3 });
    const leaf = own('#4aa848', { roughness: 0.8, pattern: 'cloth' });
    const leafD = own('#347c38', { roughness: 0.85 });

    // Tattered floating mage robe + gilded mantle + hollow spirit lantern core
    addVoxelBox(body, 0.62, 0.68, 0.62, robe, 0, 1.04, 0);
    addVoxelBox(body, 0.74, 0.16, 0.74, robeD, 0, 0.66, 0);
    addVoxelBox(body, 0.66, 0.06, 0.66, gold, 0, 1.36, 0);
    addVoxelBox(body, 0.44, 0.44, 0.44, core, 0, 1.6, 0, false);
    // Wide leafy witch-brim hat + tilted pointed peak
    addVoxelBox(body, 0.98, 0.14, 0.98, leaf, 0, 1.9, 0);
    addVoxelBox(body, 0.56, 0.26, 0.56, leafD, 0, 2.08, 0);
    const tip = addVoxelBox(body, 0.28, 0.28, 0.28, leaf, 0.08, 2.3, -0.06);
    tip.rotation.z = -0.22;
    for (const q of [-1, 1]) {
      addVoxelBox(body, 0.1, 0.12, 0.04, mats.getMat('#ffec70', { emissive: '#ffd84a', emissiveIntensity: 1.5 }), q * 0.12, 1.6, 0.24, false);
      // Floating arcane shoulder rune shards
      const shard = addVoxelBox(body, 0.14, 0.24, 0.14, core, q * 0.62, 1.32, 0, false);
      shard.rotation.z = q * 0.35;
    }

    laserLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 1),
      new THREE.MeshBasicMaterial({ color: 0xff62d8, transparent: true, opacity: 0.78 })
    );
    laserLine.visible = false;
    root.add(laserLine);
  } else {
    // Iron Sentinel (Colossal Ancient Guardian Mini-Boss!)
    radius = 1.58;
    height = 3.65;
    const metal = own('#788294', { roughness: 0.4, metalness: 0.68, bump: 'stone', pattern: 'stone' });
    const dark = own('#444b5a', { roughness: 0.52, metalness: 0.58, bump: 'stone' });
    const light = own('#b2bccf', { roughness: 0.32, metalness: 0.74 });
    const gold = own('#f4ca5c', { roughness: 0.22, metalness: 0.88 });
    const moss = own('#468a3a', { roughness: 0.9 });
    const coreMat = own('#ff5e3a', { roughness: 0.15, emissive: '#ff4220', emissiveIntensity: 1.75 });

    // Plated legs with knee guards & heavy sabatons
    for (const q of [-1, 1]) {
      addVoxelBox(body, 0.6, 1.22, 0.64, dark, q * 0.56, 0.61, 0);
      addVoxelBox(body, 0.68, 0.26, 0.72, metal, q * 0.56, 0.72, 0.04); // knee guard
      addVoxelBox(body, 0.76, 0.28, 0.92, dark, q * 0.56, 0.14, 0.1);
      addVoxelBox(body, 0.64, 0.1, 0.74, gold, q * 0.56, 0.3, 0.08);
    }
    // Armored torso, waist belt, chest vents & weathered moss shoulder pauldrons
    addVoxelBox(body, 1.94, 1.58, 1.28, metal, 0, 2.0, 0);
    addVoxelBox(body, 1.72, 0.32, 1.1, light, 0, 2.9, 0);
    addVoxelBox(body, 2.08, 0.16, 1.38, gold, 0, 1.36, 0);
    addVoxelBox(body, 2.1, 0.14, 1.36, gold, 0, 2.74, 0);
    // Glowing Guardian weak-point core framed in iron ribs
    addVoxelBox(body, 0.74, 0.74, 0.14, dark, 0, 2.04, 0.66);
    coreMesh = addVoxelBox(body, 0.52, 0.52, 0.18, coreMat, 0, 2.04, 0.72, false);
    // Ancient crested head + crimson scanning visor + moss patch
    addVoxelBox(body, 0.94, 0.64, 0.86, light, 0, 3.34, 0);
    addVoxelBox(body, 0.32, 0.36, 0.92, gold, 0, 3.74, 0);
    addVoxelBox(body, 0.66, 0.16, 0.1, coreMat, 0, 3.34, 0.45, false);
    addVoxelBox(body, 0.65, 0.18, 0.55, moss, -0.58, 3.08, -0.18);

    armL = new THREE.Group();
    armL.position.set(-1.3, 2.66, 0);
    addVoxelBox(armL, 0.74, 0.44, 0.78, light, 0, 0.12, 0); // pauldron
    addVoxelBox(armL, 0.54, 1.05, 0.56, metal, 0, -0.54, 0);
    addVoxelBox(armL, 0.74, 0.66, 0.76, dark, 0, -1.28, 0);
    addVoxelBox(armL, 0.4, 0.14, 0.4, coreMat, 0, -1.62, 0, false);
    body.add(armL);

    armR = new THREE.Group();
    armR.position.set(1.3, 2.66, 0);
    addVoxelBox(armR, 0.74, 0.44, 0.78, light, 0, 0.12, 0);
    addVoxelBox(armR, 0.52, 0.18, 0.52, moss, 0.08, 0.38, 0);
    addVoxelBox(armR, 0.54, 1.05, 0.56, metal, 0, -0.54, 0);
    addVoxelBox(armR, 0.74, 0.66, 0.76, dark, 0, -1.28, 0);
    addVoxelBox(armR, 0.4, 0.14, 0.4, coreMat, 0, -1.62, 0, false);
    body.add(armR);

    laserLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 1),
      new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.88 })
    );
    laserLine.visible = false;
    root.add(laserLine);
  }

  // Visible ground telegraph ring for heavy attacks (polygonOffset prevents terrain Z-fighting)
  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.9, radius * 1.45, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff4c3b,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
  );
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.09;
  telegraphRing.renderOrder = 3;
  telegraphRing.visible = false;
  root.add(telegraphRing);

  return { root, body, flashMats, telegraphRing, laserLine, armL, armR, coreMesh, radius, height };
}

export class EnemyManager {
  readonly enemies: EnemyEntity[] = [];
  readonly projectiles: EnemyProjectile[] = [];
  readonly tokenPool = new AttackTokenPool(3);
  private readonly group = new THREE.Group();
  private readonly mats: MaterialLibrary;

  constructor(scene: THREE.Scene, mats: MaterialLibrary) {
    this.mats = mats;
    scene.add(this.group);
  }

  spawnAll(): void {
    this.clear();
    const roster: Array<{ kind: EnemyKind; x: number; z: number; campId?: string }> = [
      // Friendly approach slime along Whisperwood trail
      { kind: 'slime', x: -5, z: 24 },
      { kind: 'slime', x: 7, z: 18 },

      // Camp 1: Whisperwood Camp (-24, 16)
      { kind: 'slime', x: -21, z: 15, campId: 'camp_whisper' },
      { kind: 'slime', x: -26, z: 18, campId: 'camp_whisper' },
      { kind: 'wisp', x: -25, z: 12, campId: 'camp_whisper' },

      // Camp 2: Canyon Horn-Camp (34, -26)
      { kind: 'beetle', x: 32, z: -24, campId: 'camp_canyon' },
      { kind: 'beetle', x: 36, z: -28, campId: 'camp_canyon' },
      { kind: 'wisp', x: 33, z: -29, campId: 'camp_canyon' },

      // Camp 3: Highland Lookout (-28, -36)
      { kind: 'slime', x: -25, z: -34, campId: 'camp_highland' },
      { kind: 'beetle', x: -30, z: -36, campId: 'camp_highland' },
      { kind: 'wisp', x: -28, z: -40, campId: 'camp_highland' },

      // Windcrest Bluff defenders
      { kind: 'wisp', x: -41, z: -19 },
      { kind: 'slime', x: -49, z: -18 },

      // Emberstone Canyon Beetle
      { kind: 'beetle', x: 43, z: -12 },

      // Field Guardian Boss: Iron Sentinel guarding Mirror Lake Causeway & Shrine of Stillness!
      { kind: 'sentinel', x: 2, z: -40 },
    ];

    roster.forEach((spec) => this.spawn(spec));
  }

  private spawnSerial = 0;

  spawn(spec: EnemySpawnSpec): EnemyEntity {
    {
      const idx = this.spawnSerial++;
      const y = Math.max(WATER_Y + 0.1, getTerrainHeight(spec.x, spec.z));
      const vis = buildEnemyVisual(this.mats, spec.kind, spec.variant);
      if (spec.scale && spec.scale !== 1) {
        vis.root.scale.setScalar(spec.scale);
        vis.radius *= spec.scale;
        vis.height *= spec.scale;
      }
      vis.root.position.set(spec.x, y, spec.z);
      this.group.add(vis.root);

      const shadow = createContactShadow(this.mats, vis.radius * 1.15);
      shadow.position.set(spec.x, y + 0.04, spec.z);
      this.group.add(shadow);

      const maxHp =
        spec.hp ?? (spec.kind === 'sentinel' ? 220 : spec.kind === 'beetle' ? 76 : spec.kind === 'wisp' ? 52 : 38);
      const name =
        spec.name ??
        (spec.kind === 'sentinel'
          ? 'Mirror Colossus'
          : spec.kind === 'beetle'
            ? 'Horn-Beetle'
            : spec.kind === 'wisp'
              ? 'Bramble Wisp'
              : 'Meadow Slime');

      const ent: EnemyEntity = {
        id: `enemy_${idx}`,
        kind: spec.kind,
        name,
        tag: spec.tag,
        variant: spec.variant,
        campId: spec.campId,
        x: spec.x,
        y,
        z: spec.z,
        vx: 0,
        vy: 0,
        vz: 0,
        homeX: spec.x,
        homeZ: spec.z,
        yaw: 0,
        radius: vis.radius,
        height: vis.height,
        hp: maxHp,
        maxHp,
        state: 'idle',
        stateTimer: 0.4 + (idx % 4) * 0.25,
        animTime: idx * 1.3,
        hitFlash: 0,
        stasisTimer: 0,
        stasisHits: 0,
        stasisDirX: 0,
        stasisDirZ: 1,
        koTimer: 0,
        dead: false,
        attackDidHit: false,
        root: vis.root,
        body: vis.body,
        contactShadow: shadow,
        telegraphRing: vis.telegraphRing,
        laserLine: vis.laserLine,
        armL: vis.armL,
        armR: vis.armR,
        coreMesh: vis.coreMesh,
        flashMats: vis.flashMats,
      };
      this.enemies.push(ent);
      return ent;
    }
  }

  removeTagged(tag: string): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.tag !== tag) continue;
      this.tokenPool.release(e.id);
      this.group.remove(e.root);
      this.group.remove(e.contactShadow);
      e.flashMats.forEach((m) => m.dispose());
      this.enemies.splice(i, 1);
    }
  }

  clear(): void {
    this.tokenPool.clear();
    for (const e of this.enemies) {
      this.group.remove(e.root);
      this.group.remove(e.contactShadow);
      e.flashMats.forEach((m) => m.dispose());
    }
    this.enemies.length = 0;
    for (const p of this.projectiles) {
      this.group.remove(p.mesh);
    }
    this.projectiles.length = 0;
  }

  isCampCleared(campId: string): boolean {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.campId === campId && !e.dead) return false;
    }
    return true;
  }

  getActiveBoss(px: number, pz: number): EnemyEntity | null {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.kind === 'sentinel' && !e.dead && Math.hypot(e.x - px, e.z - pz) < 34) {
        return e;
      }
    }
    return null;
  }

  damageEnemy(
    e: EnemyEntity,
    damage: number,
    kbX: number,
    kbZ: number,
    cb: EnemyUpdateCallbacks,
    opts?: { stunDuration?: number; fromStillstoneHit?: boolean; isCrit?: boolean }
  ): boolean {
    if (e.dead || e.state === 'ko') return false;

    if (e.stasisTimer > 0 && !opts?.fromStillstoneHit) {
      e.stasisHits = Math.min(6, e.stasisHits + 1);
      const len = Math.hypot(kbX, kbZ) || 1;
      e.stasisDirX = kbX / len;
      e.stasisDirZ = kbZ / len;
      e.hitFlash = 0.1;
      cb.spawnParticles(e.x, e.y + e.height * 0.5, e.z, 0xffe466, 8, 5);
      return true;
    }

    const mult = e.state === 'stunned' || opts?.isCrit ? 1.8 : 1;
    e.hp = Math.max(0, e.hp - Math.round(damage * mult));
    e.hitFlash = 0.1;
    const kbScale = e.kind === 'sentinel' ? 0.25 : 1;
    e.vx += kbX * kbScale;
    e.vz += kbZ * kbScale;

    if (opts?.stunDuration && opts.stunDuration > 0 && e.hp > 0) {
      e.state = 'stunned';
      e.stateTimer = opts.stunDuration;
      this.tokenPool.release(e.id);
      if (e.laserLine) e.laserLine.visible = false;
      e.telegraphRing.visible = false;
    }

    cb.spawnParticles(e.x, e.y + e.height * 0.55, e.z, opts?.isCrit ? 0xffe870 : 0xffffff, 10, 5.5);

    if (e.hp <= 0) {
      e.state = 'ko';
      e.koTimer = 0.42;
      e.vy = 4.2;
      this.tokenPool.release(e.id);
      if (e.laserLine) e.laserLine.visible = false;
      e.telegraphRing.visible = false;
      cb.onEnemyKilled(e);
    }
    return true;
  }

  freezeEnemy(e: EnemyEntity, duration = 5.0): void {
    if (e.dead || e.state === 'ko') return;
    e.stasisTimer = duration;
    e.stasisHits = 0;
    this.tokenPool.release(e.id);
    if (e.laserLine) e.laserLine.visible = false;
    e.telegraphRing.visible = false;
  }

  private spawnProjectile(
    x: number,
    y: number,
    z: number,
    tx: number,
    ty: number,
    tz: number,
    speed: number,
    damage: number,
    isBeam: boolean
  ): void {
    const dx = tx - x;
    const dy = ty - y;
    const dz = tz - z;
    const dist = Math.hypot(dx, dy, dz) || 1;

    const geo = new THREE.BoxGeometry(isBeam ? 0.42 : 0.26, isBeam ? 0.42 : 0.26, isBeam ? 0.95 : 0.26);
    const mat = new THREE.MeshBasicMaterial({
      color: isBeam ? 0xff5a36 : 0xe86eff,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.lookAt(tx, ty, tz);
    this.group.add(mesh);

    this.projectiles.push({
      x,
      y,
      z,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      vz: (dz / dist) * speed,
      damage,
      life: 3.0,
      reflected: false,
      isBeam,
      mesh,
    });
  }

  update(
    simDt: number,
    realDt: number,
    px: number,
    py: number,
    pz: number,
    cb: EnemyUpdateCallbacks,
    colliders?: SolidCollider[]
  ): { anyAggro: boolean; imminentThreat: EnemyEntity | null } {
    let anyAggro = false;
    let imminentThreat: EnemyEntity | null = null;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;

      // Hit flash ticks in real time
      if (e.hitFlash > 0) {
        e.hitFlash = Math.max(0, e.hitFlash - realDt);
      }

      // KO topple & dissolve animation
      if (e.state === 'ko') {
        e.koTimer -= realDt;
        e.x += e.vx * simDt;
        e.z += e.vz * simDt;
        e.vy -= 18 * simDt;
        e.y = Math.max(getTerrainHeight(e.x, e.z), e.y + e.vy * simDt);
        e.body.rotation.z = lerpAngleSimple(e.body.rotation.z, Math.PI * 0.55, realDt * 9);
        const s = clamp(e.koTimer / 0.42, 0.02, 1);
        e.root.scale.setScalar(s);
        e.root.position.set(e.x, e.y, e.z);
        e.contactShadow.scale.setScalar(s);
        if (e.koTimer <= 0) {
          e.dead = true;
          e.root.visible = false;
          e.contactShadow.visible = false;
          cb.spawnParticles(e.x, e.y + 0.6, e.z, 0xffe478, 16, 6);
        }
        continue;
      }

      // Stillstone freeze state!
      if (e.stasisTimer > 0) {
        e.stasisTimer -= simDt;
        const pulse = e.stasisTimer < 1.2 ? Math.sin(e.stasisTimer * 26) * 0.5 + 0.5 : 0.7;
        for (const m of e.flashMats) {
          m.emissive.setHex(0xffd23a);
          m.emissiveIntensity = 0.45 + pulse * 0.55;
        }
        if (e.stasisTimer <= 0) {
          for (const m of e.flashMats) {
            m.emissive.setHex(0x000000);
            m.emissiveIntensity = 0;
          }
          if (e.stasisHits > 0) {
            const launch = computeStillstoneLaunch({
              hits: e.stasisHits,
              dirX: e.stasisDirX,
              dirZ: e.stasisDirZ,
            });
            e.vx += launch.vx;
            e.vy += launch.vy;
            e.vz += launch.vz;
            this.damageEnemy(e, e.stasisHits * 10, 0, 0, cb, { fromStillstoneHit: true, stunDuration: 1.8 });
          }
        }
        continue;
      }

      // Normal flash material update
      for (const m of e.flashMats) {
        if (m === e.coreMesh?.material) {
          m.emissive.setHex(e.hitFlash > 0 ? 0xffffff : 0xff4220);
          m.emissiveIntensity = e.hitFlash > 0 ? 2.2 : 1.5;
        } else if (e.hitFlash > 0) {
          m.emissive.setHex(0xffffff);
          m.emissiveIntensity = 0.9;
        } else {
          m.emissive.setHex(0x000000);
          m.emissiveIntensity = 0;
        }
      }

      e.animTime += simDt;
      const dx = px - e.x;
      const dz = pz - e.z;
      const dist = Math.hypot(dx, dz);
      const toPlayerYaw = Math.atan2(dx, dz);
      const aggroRange = e.kind === 'sentinel' ? 28 : e.kind === 'wisp' ? 21 : 17;

      if (dist < aggroRange) anyAggro = true;
      if (e.state === 'windup' || e.state === 'attack') {
        if (dist < 6.2) imminentThreat = e;
      }

      // Friction & gravity
      e.vx *= Math.exp(-7 * simDt);
      e.vz *= Math.exp(-7 * simDt);
      e.vy -= 22 * simDt;

      e.stateTimer -= simDt;

      // Per-archetype AI state machine
      if (e.state === 'stunned') {
        e.body.rotation.z = e.kind === 'beetle' ? Math.PI : Math.sin(e.animTime * 16) * 0.14;
        e.body.position.y = e.kind === 'beetle' ? 0.95 : 0;
        if (e.stateTimer <= 0) {
          e.state = 'chase';
          e.body.rotation.z = 0;
          e.body.position.y = 0;
        }
      } else if (e.kind === 'slime') {
        // Policy 1: Bouncy Chaser with squash telegraph lunge
        if (e.state === 'idle') {
          if (dist < aggroRange) {
            e.state = 'chase';
            e.stateTimer = 0.6;
          }
        } else if (e.state === 'chase') {
          e.yaw = dampAngle(e.yaw, toPlayerYaw, 7, simDt);
          if (dist > aggroRange + 7) {
            e.state = 'idle';
          } else if (dist < 3.6 && this.tokenPool.request(e.id)) {
            e.state = 'windup';
            e.stateTimer = 0.48;
            e.attackDidHit = false;
            cb.onTelegraph();
          } else if (e.stateTimer <= 0) {
            // Hop forward
            const hopSpd = 5.4;
            e.vx += Math.sin(e.yaw) * hopSpd;
            e.vz += Math.cos(e.yaw) * hopSpd;
            e.vy = 5.6;
            e.stateTimer = 1.05;
          }
        } else if (e.state === 'windup') {
          e.yaw = dampAngle(e.yaw, toPlayerYaw, 10, simDt);
          e.telegraphRing.visible = true;
          const sq = 0.35 * (1 - clamp(e.stateTimer / 0.48, 0, 1));
          e.body.scale.set(1 + sq, 1 - sq * 0.9, 1 + sq);
          if (e.stateTimer <= 0) {
            e.state = 'attack';
            e.stateTimer = 0.42;
            e.vx = Math.sin(e.yaw) * 11.5;
            e.vz = Math.cos(e.yaw) * 11.5;
            e.vy = 6.2;
            e.telegraphRing.visible = false;
            e.body.scale.set(0.84, 1.24, 0.84);
          }
        } else if (e.state === 'attack') {
          if (!e.attackDidHit && dist < 1.35 && Math.abs(py - e.y) < 1.4) {
            e.attackDidHit = true;
            cb.onPlayerDamaged(1, e.x, e.z, e, false);
          }
          if (e.stateTimer <= 0) {
            e.state = 'recover';
            e.stateTimer = 0.7;
            this.tokenPool.release(e.id);
          }
        } else if (e.state === 'recover') {
          e.body.scale.set(1, 1, 1);
          if (e.stateTimer <= 0) e.state = 'chase';
        }
      } else if (e.kind === 'beetle') {
        // Policy 2: Line-of-Sight Charger (paw ground telegraph -> fast bull rush)
        if (e.state === 'idle') {
          if (dist < aggroRange) e.state = 'chase';
        } else if (e.state === 'chase') {
          e.yaw = dampAngle(e.yaw, toPlayerYaw, 5.5, simDt);
          e.vx += Math.sin(e.yaw) * 14 * simDt;
          e.vz += Math.cos(e.yaw) * 14 * simDt;
          if (dist > aggroRange + 8) {
            e.state = 'idle';
          } else if (dist < 10.5 && this.tokenPool.request(e.id)) {
            e.state = 'windup';
            e.stateTimer = 0.65;
            e.attackDidHit = false;
            cb.onTelegraph();
          }
        } else if (e.state === 'windup') {
          e.yaw = dampAngle(e.yaw, toPlayerYaw, 8, simDt);
          e.telegraphRing.visible = true;
          e.body.position.x = Math.sin(e.animTime * 48) * 0.08;
          if (e.stateTimer <= 0) {
            e.body.position.x = 0;
            e.telegraphRing.visible = false;
            e.state = 'attack';
            e.stateTimer = 0.85;
          }
        } else if (e.state === 'attack') {
          const rushSpeed = 13.5;
          e.vx = Math.sin(e.yaw) * rushSpeed;
          e.vz = Math.cos(e.yaw) * rushSpeed;
          e.body.position.y = Math.abs(Math.sin(e.animTime * 22)) * 0.1;
          if (!e.attackDidHit && dist < 1.6 && Math.abs(py - e.y) < 1.5) {
            e.attackDidHit = true;
            cb.onPlayerDamaged(2, e.x, e.z, e, false);
          }
          if (e.stateTimer <= 0) {
            e.state = 'recover';
            e.stateTimer = 0.95;
            this.tokenPool.release(e.id);
          }
        } else if (e.state === 'recover') {
          e.body.position.y = 0;
          if (e.stateTimer <= 0) e.state = 'chase';
        }
      } else if (e.kind === 'wisp') {
        // Policy 3: Ranged Kiter / Orbiter with magenta aim sightline telegraph
        e.body.position.y = Math.sin(e.animTime * 3.2) * 0.22;
        if (e.state === 'idle') {
          if (dist < aggroRange) e.state = 'chase';
        } else if (e.state === 'chase') {
          e.yaw = dampAngle(e.yaw, toPlayerYaw, 6, simDt);
          const idealDist = 12.5;
          const radial = dist < idealDist - 2 ? -1 : dist > idealDist + 3 ? 1 : 0;
          const strafe = Math.sin(e.animTime * 0.9) >= 0 ? 1 : -1;
          const fwdX = Math.sin(e.yaw);
          const fwdZ = Math.cos(e.yaw);
          e.vx += (fwdX * radial * 4.5 + fwdZ * strafe * 3.5) * 4 * simDt;
          e.vz += (fwdZ * radial * 4.5 - fwdX * strafe * 3.5) * 4 * simDt;

          if (dist > aggroRange + 8) {
            e.state = 'idle';
          } else if (e.stateTimer <= 0 && dist < 19 && this.tokenPool.request(e.id)) {
            e.state = 'windup';
            e.stateTimer = 0.78;
            cb.onTelegraph();
          }
        } else if (e.state === 'windup') {
          e.yaw = dampAngle(e.yaw, toPlayerYaw, 8, simDt);
          if (e.laserLine) {
            e.laserLine.visible = true;
            const aimLen = Math.min(20, dist);
            e.laserLine.scale.set(1, 1, aimLen);
            e.laserLine.position.set(0, 1.55, aimLen * 0.5);
          }
          if (e.stateTimer <= 0) {
            if (e.laserLine) e.laserLine.visible = false;
            this.spawnProjectile(e.x, e.y + 1.55, e.z, px, py + 1.0, pz, 17, 1, false);
            e.state = 'recover';
            e.stateTimer = 1.35;
            this.tokenPool.release(e.id);
          }
        } else if (e.state === 'recover') {
          if (e.stateTimer <= 0) {
            e.state = 'chase';
            e.stateTimer = 0.9;
          }
        }
      } else if (e.kind === 'sentinel') {
        // Policy 4: Field Guardian Boss (Laser Beam Sightline + Quake Slam Shockwave)
        if (e.state === 'idle') {
          if (dist < aggroRange) e.state = 'chase';
        } else if (e.state === 'chase') {
          e.yaw = dampAngle(e.yaw, toPlayerYaw, 3.8, simDt);
          if (dist > 6.5) {
            e.vx += Math.sin(e.yaw) * 11 * simDt;
            e.vz += Math.cos(e.yaw) * 11 * simDt;
            e.body.position.y = Math.abs(Math.sin(e.animTime * 6)) * 0.14;
          }
          if (e.armL && e.armR) {
            e.armL.rotation.x = Math.sin(e.animTime * 6) * 0.35;
            e.armR.rotation.x = -Math.sin(e.animTime * 6) * 0.35;
          }
          if (e.stateTimer <= 0) {
            e.state = 'windup';
            e.attackDidHit = false;
            // Close range = Quake Slam; Mid/Long = Guardian Beam!
            e.stateTimer = dist < 7.2 ? 0.78 : 1.15;
            e.body.userData.attackType = dist < 7.2 ? 'slam' : 'beam';
            cb.onTelegraph();
          }
        } else if (e.state === 'windup') {
          const atype = e.body.userData.attackType as 'slam' | 'beam';
          e.yaw = dampAngle(e.yaw, toPlayerYaw, atype === 'beam' ? 5.2 : 3.5, simDt);
          if (atype === 'slam') {
            e.telegraphRing.visible = true;
            e.telegraphRing.scale.setScalar(2.4);
            if (e.armL && e.armR) {
              e.armL.rotation.x = -2.5;
              e.armR.rotation.x = -2.5;
            }
          } else if (e.laserLine) {
            e.laserLine.visible = true;
            const aimLen = Math.min(28, dist + 1);
            e.laserLine.scale.set(1, 1, aimLen);
            e.laserLine.position.set(0, 2.05, aimLen * 0.5);
          }
          if (e.stateTimer <= 0) {
            if (e.laserLine) e.laserLine.visible = false;
            e.telegraphRing.visible = false;
            e.telegraphRing.scale.setScalar(1);
            e.state = 'attack';
            e.stateTimer = 0.5;
            if (atype === 'beam') {
              this.spawnProjectile(e.x, e.y + 2.05, e.z, px, py + 1.05, pz, 28, 3, true);
            } else {
              if (e.armL && e.armR) {
                e.armL.rotation.x = -0.8;
                e.armR.rotation.x = -0.8;
              }
              cb.onExplosion(e.x, e.y + 0.4, e.z, 5.8, 0);
              if (dist < 5.6 && py < e.y + 1.6) {
                cb.onPlayerDamaged(2, e.x, e.z, e, false);
              }
            }
          }
        } else if (e.state === 'attack') {
          if (e.stateTimer <= 0) {
            e.state = 'recover';
            e.stateTimer = 1.4;
          }
        } else if (e.state === 'recover') {
          if (e.armL && e.armR) {
            e.armL.rotation.x = -0.2;
            e.armR.rotation.x = -0.2;
          }
          if (e.stateTimer <= 0) {
            e.state = 'chase';
            e.stateTimer = 1.1;
          }
        }
      }

      // Apply movement & leash softly to home territory + stay above water
      const nx = e.x + e.vx * simDt;
      const nz = e.z + e.vz * simDt;
      const groundH = getTerrainHeight(nx, nz);
      const homeDist = Math.hypot(nx - e.homeX, nz - e.homeZ);
      if ((e.kind === 'wisp' || groundH > WATER_Y + 0.05) && homeDist < 28) {
        e.x = nx;
        e.z = nz;
      } else {
        e.vx *= -0.4;
        e.vz *= -0.4;
      }

      const curGround = Math.max(WATER_Y + 0.1, getTerrainHeight(e.x, e.z));
      e.y += e.vy * simDt;
      if (e.y <= curGround) {
        e.y = curGround;
        e.vy = 0;
        if (e.kind === 'slime' && e.state === 'chase') {
          e.body.scale.set(1, 1, 1);
        }
      }

      // Resolve enemy vs simplified invisible collision volumes (OBBs, cylinders, fences, boulders, structures)
      if (colliders) {
        const res = resolveCircleOverlapXZ(e.x, e.z, e.y, e.height, e.radius, colliders);
        e.x = res.x;
        e.z = res.z;
      }

      // Soft separation from player so enemies never walk inside Wren's body during melee!
      const pdx = e.x - px;
      const pdz = e.z - pz;
      const pMin = e.radius + 0.56;
      const pDist = Math.hypot(pdx, pdz);
      if (pDist < pMin && Math.abs(e.y - py) < 1.6) {
        const push = (pMin - pDist) * 0.85;
        const nxP = pDist > 0.001 ? pdx / pDist : 1;
        const nzP = pDist > 0.001 ? pdz / pDist : 0;
        e.x += nxP * push;
        e.z += nzP * push;
      }

      e.root.position.set(e.x, e.y, e.z);
      e.root.rotation.y = e.yaw;
      e.contactShadow.position.set(e.x, curGround + 0.05, e.z);
      const shScale = clamp(1 - (e.y - curGround) * 0.12, 0.35, 1);
      e.contactShadow.scale.setScalar(shScale);
    }

    // Pairwise Enemy-to-Enemy separation so monsters flank cleanly instead of clipping into each other!
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      if (a.dead || a.state === 'ko') continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        if (b.dead || b.state === 'ko') continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const minD = a.radius + b.radius + 0.12;
        const dSq = dx * dx + dz * dz;
        if (dSq < minD * minD) {
          const d = Math.sqrt(dSq) || 0.001;
          const overlap = (minD - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.z += nz * overlap;
          a.root.position.x = a.x;
          a.root.position.z = a.z;
          a.contactShadow.position.x = a.x;
          a.contactShadow.position.z = a.z;
          b.root.position.x = b.x;
          b.root.position.z = b.z;
          b.contactShadow.position.x = b.x;
          b.contactShadow.position.z = b.z;
        }
      }
    }

    // Update enemy projectiles (can be Perfect Parried back!)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= simDt;
      p.x += p.vx * simDt;
      p.y += p.vy * simDt;
      p.z += p.vz * simDt;
      p.mesh.position.set(p.x, p.y, p.z);

      let remove = p.life <= 0 || p.y < getTerrainHeight(p.x, p.z);

      if (!remove && !p.reflected) {
        if (Math.hypot(p.x - px, p.z - pz) < 0.9 && Math.abs(p.y - (py + 1.0)) < 1.1) {
          // Check if parried inside callback via engine!
          cb.onPlayerDamaged(p.damage, p.x, p.z, this.enemies[0], true);
          if (p.isBeam) cb.onExplosion(p.x, p.y, p.z, 3.5, 0);
          remove = true;
        }
      } else if (!remove && p.reflected) {
        for (let j = 0; j < this.enemies.length; j++) {
          const e = this.enemies[j];
          if (e.dead || e.state === 'ko') continue;
          if (Math.hypot(p.x - e.x, p.z - e.z) < e.radius + 0.8) {
            this.damageEnemy(e, p.isBeam ? 75 : 35, p.vx * 0.35, p.vz * 0.35, cb, {
              stunDuration: 3.0,
              isCrit: true,
            });
            if (p.isBeam) cb.onExplosion(p.x, p.y, p.z, 4.0, 0);
            remove = true;
            break;
          }
        }
      }

      if (remove) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }

    return { anyAggro, imminentThreat };
  }
}

function lerpAngleSimple(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}
