import * as THREE from 'three';
import {
  WORLD_EXTENT,
  WORLD_PLAY_RADIUS,
  WATER_Y,
  getTerrainHeight,
  getTerrainNormal,
  getBiomeAt,
  getRoadFactor,
  getRiverLumX,
  hash2,
  clamp,
} from './math';
import {
  MaterialLibrary,
  addVoxelBox,
  buildDawnbellSpire,
  buildBellShrine,
  buildCottage,
  buildCampfire,
  buildTreasureChest,
  buildNpcOdo,
  buildNpcVillager,
  buildMonsterWatchtower,
  buildCrackedBoulder,
  buildStillstoneBoulder,
  buildExplosiveBarrel,
  buildSignpost,
  buildWell,
  buildMarketStall,
  buildApplePickup,
  buildMarkPickup,
  buildWindmill,
  buildRoadLantern,
  buildStoneBridge,
  buildPinwheelSecret,
  buildBalloonTarget,
  buildWhisperSprite,
  buildMeadowFox,
  buildMeadowDeer,
  buildLakeDuck,
  buildButterfly,
  buildSkyBird,
  buildChimeBell,
  buildRunicSocket,
  buildDawnBrazier,
  buildArcheryTarget,
  buildOreVein,
  buildLodestonePad,
  buildCastleGatehouse,
  buildGrandFountain,
  buildWizardsTower,
  buildDesertPyramid,
  buildDesertGate,
  buildDruidicStoneCircle,
  buildWildernessObelisk,
  buildPastureSheep,
  buildPastureCow,
  buildSunbeamsGroup,
  buildWindStreaks,
  WindStreakItem,
  ShrineRig,
} from './voxelBuilder';
import type { SolidCollider } from './collision';
import { CollisionProxyRegistry } from './collisionProxies';
import type { ChimeBellColor, PuzzleId } from './puzzles';

export type { SolidCollider };

export interface CampfireProp {
  id: string;
  x: number;
  y: number;
  z: number;
  withPot: boolean;
  flame1: THREE.Mesh;
  flame2: THREE.Mesh;
  light: THREE.PointLight;
}

export interface ChestProp {
  id: string;
  x: number;
  y: number;
  z: number;
  campId?: string;
  puzzleId?: PuzzleId;
  rewardText: string;
  arrows: number;
  marks: number;
  apples: number;
  heartContainer?: boolean;
  opened: boolean;
  openAnim: number;
  group: THREE.Group;
  lid: THREE.Group;
  glow: THREE.Mesh;
  sealRing?: THREE.Mesh;
}

export interface ChimeBellProp {
  id: string;
  color: ChimeBellColor;
  label: string;
  x: number;
  y: number;
  z: number;
  swingVel: number;
  swingAngle: number;
  lit: boolean;
  group: THREE.Group;
  bell: THREE.Group;
  glowMat: THREE.MeshStandardMaterial;
}

export interface RunicSocketProp {
  x: number;
  y: number;
  z: number;
  locked: boolean;
  group: THREE.Group;
  runeMat: THREE.MeshStandardMaterial;
  beacons: THREE.MeshStandardMaterial[];
}

export interface DawnBrazierProp {
  id: string;
  x: number;
  y: number;
  z: number;
  lit: boolean;
  group: THREE.Group;
  flame1: THREE.Mesh;
  flame2: THREE.Mesh;
  light: THREE.PointLight;
}

export interface ArcheryTargetProp {
  id: string;
  x: number;
  y: number;
  z: number;
  hit: boolean;
  hitAnim: number;
  group: THREE.Group;
  board: THREE.Group;
}

export interface OreVeinProp {
  id: string;
  tier: 'copper' | 'gold' | 'mithril';
  marks: number;
  x: number;
  y: number;
  z: number;
  mined: boolean;
  group: THREE.Group;
  crystalGroup: THREE.Group;
}

export interface PastureAnimalProp {
  kind: 'sheep' | 'cow';
  group: THREE.Group;
  head: THREE.Group;
  contactShadow: THREE.Mesh;
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  yaw: number;
  phase: number;
}

export interface CrackedBoulderProp {
  id: string;
  x: number;
  y: number;
  z: number;
  broken: boolean;
  group: THREE.Group;
  collider: SolidCollider;
}

export interface StillstoneBoulderProp {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  stasisTimer: number;
  stasisHits: number;
  chargeDirX: number;
  chargeDirZ: number;
  group: THREE.Group;
  coreMats: THREE.MeshStandardMaterial[];
  arrowIndicator: THREE.Group;
  collider: SolidCollider;
}

export interface ExplosiveBarrelProp {
  id: string;
  x: number;
  y: number;
  z: number;
  exploded: boolean;
  group: THREE.Group;
}

export interface UpdraftZone {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  mesh?: THREE.Group;
}

export interface PickupProp {
  id: string;
  kind: 'apple' | 'mark' | 'arrows';
  x: number;
  y: number;
  z: number;
  amount: number;
  collected: boolean;
  mesh: THREE.Group;
  phase: number;
}

export interface SignProp {
  id: string;
  x: number;
  y: number;
  z: number;
  title: string;
  text: string;
}

export interface NpcProp {
  id: string;
  name: string;
  role: 'warden' | 'herbalist' | 'blacksmith' | 'merchant' | 'wizard' | 'prospector';
  x: number;
  y: number;
  z: number;
  baseYaw: number;
  group: THREE.Group;
}

export interface WhisperSecretProp {
  id: string;
  kind: 'pinwheel' | 'balloon';
  x: number;
  y: number;
  z: number;
  found: boolean;
  group: THREE.Group;
  blades?: THREE.Group;
  balloon?: THREE.Group;
  sprite: THREE.Group;
  phase: number;
}

export interface SkyBirdProp {
  group: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  centerX: number;
  centerZ: number;
  radius: number;
  altitude: number;
  angle: number;
  speed: number;
}

export interface MeadowFoxProp {
  group: THREE.Group;
  tail: THREE.Group;
  legs: THREE.Group[];
  contactShadow: THREE.Mesh;
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  yaw: number;
  angle: number;
  scaredTimer: number;
}

export interface MeadowDeerProp {
  group: THREE.Group;
  headGroup: THREE.Group;
  legs: THREE.Group[];
  contactShadow: THREE.Mesh;
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  yaw: number;
  angle: number;
  scaredTimer: number;
  phase: number;
}

export interface LakeDuckProp {
  group: THREE.Group;
  centerX: number;
  centerZ: number;
  radius: number;
  angle: number;
  speed: number;
}

export interface ButterflyProp {
  group: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  homeX: number;
  homeY: number;
  homeZ: number;
  phase: number;
}

export interface SkyDomeUniforms {
  uZenith: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uSunColor: { value: THREE.Color };
  uSunDir: { value: THREE.Vector3 };
  uPost: { value: number };
}

export interface CuttableBushProp {
  index: number;
  x: number;
  y: number;
  z: number;
  cut: boolean;
}

export interface WorldData {
  group: THREE.Group;
  terrainMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  waterUniforms: { uTime: { value: number } };
  grassUniforms: { uTime: { value: number } };
  skyUniforms: SkyDomeUniforms;
  cloudsGroup: THREE.Group;
  sunbeamsGroup: THREE.Group;
  sunbeamMat: THREE.ShaderMaterial;
  windStreaksMesh: THREE.InstancedMesh;
  windStreaksMat: THREE.MeshBasicMaterial;
  windStreaks: WindStreakItem[];
  bushMeshes: THREE.InstancedMesh[];
  cuttableBushes: CuttableBushProp[];
  starsMesh: THREE.Points;
  firefliesMesh: THREE.Points;
  windmillSails: THREE.Group;
  spireBell: THREE.Group;
  spireBeam: THREE.Mesh;
  spireBanners: THREE.Group[];
  lanternMats: THREE.MeshStandardMaterial[];
  shrines: ShrineRig[];
  campfires: CampfireProp[];
  chests: ChestProp[];
  crackedBoulders: CrackedBoulderProp[];
  stasisBoulders: StillstoneBoulderProp[];
  barrels: ExplosiveBarrelProp[];
  updrafts: UpdraftZone[];
  pickups: PickupProp[];
  signs: SignProp[];
  npcs: NpcProp[];
  whisperSecrets: WhisperSecretProp[];
  birds: SkyBirdProp[];
  foxes: MeadowFoxProp[];
  deer: MeadowDeerProp[];
  ducks: LakeDuckProp[];
  butterflies: ButterflyProp[];
  pastureAnimals: PastureAnimalProp[];
  chimeBells: ChimeBellProp[];
  runicSocket: RunicSocketProp;
  dawnBraziers: DawnBrazierProp[];
  archeryTargets: ArcheryTargetProp[];
  oreVeins: OreVeinProp[];
  wizardsCrystalRing: THREE.Group;
  colliders: SolidCollider[];
  proxyRegistry: CollisionProxyRegistry;
  raycastProxies: THREE.Object3D[];
  raycastSolids: THREE.Object3D[];
  dispose: () => void;
}

function buildSkyDome(): { mesh: THREE.Mesh; uniforms: SkyDomeUniforms } {
  const uniforms: SkyDomeUniforms = {
    uZenith: { value: new THREE.Color('#4d9ee8') },
    uHorizon: { value: new THREE.Color('#b6e0fc') },
    uSunColor: { value: new THREE.Color('#fff1bd') },
    uSunDir: { value: new THREE.Vector3(0.45, 0.7, 0.35).normalize() },
    uPost: { value: 0 },
  };
  const geo = new THREE.SphereGeometry(430, 24, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uPost;
      varying vec3 vWorldDir;
      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y * 1.15 + 0.08, 0.0, 1.0);
        vec3 sky = mix(uHorizon, uZenith, pow(h, 0.62));
        float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
        sky += uSunColor * (pow(sunAmt, 14.0) * 0.32 + pow(sunAmt, 96.0) * 0.45);
        // With post-processing on, the frame is tone mapped and sRGB encoded afterwards,
        // so convert to linear light first to keep the sky's authored colours.
        if (uPost > 0.5) sky = pow(sky, vec3(2.2)) * 1.35;
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  return { mesh, uniforms };
}

function buildTerrainMesh(mats: MaterialLibrary): THREE.Mesh {
  const segs = 192;
  const size = WORLD_EXTENT * 2;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();

  const cGrassA = new THREE.Color('#429232');
  const cGrassB = new THREE.Color('#53a83e');
  const cClover = new THREE.Color('#6ac04c');
  const cRoad = new THREE.Color('#c89a5e');
  const cRoadD = new THREE.Color('#ab7d46');
  const cSand = new THREE.Color('#dec488');
  const cDesertA = new THREE.Color('#e6c478');
  const cDesertB = new THREE.Color('#d6ae62');
  const cSwampA = new THREE.Color('#3b5f42');
  const cSwampB = new THREE.Color('#4b6b46');
  const cWildsA = new THREE.Color('#3c3944');
  const cWildsB = new THREE.Color('#4d4248');
  const cWildsLava = new THREE.Color('#9c4428');
  const cCliff = new THREE.Color('#686e7b');
  const cCliffMoss = new THREE.Color('#4c7a3c');
  const cCanyon = new THREE.Color('#aa764c');
  const cCanyonStone = new THREE.Color('#766056');
  const cLakeBed = new THREE.Color('#22506d');
  const cPeakStone = new THREE.Color('#666d7a');
  const cSnow = new THREE.Color('#eaf2fa');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = getTerrainHeight(x, z);
    pos.setY(i, h);

    const n = getTerrainNormal(x, z);
    const slope = 1 - n.y;
    const road = getRoadFactor(x, z);
    const biome = getBiomeAt(x, z);
    const checker = ((Math.floor(x * 0.5) + Math.floor(z * 0.5)) & 1) === 0;
    const jitter = (hash2(Math.floor(x * 0.5), Math.floor(z * 0.5)) - 0.5) * 0.075;

    if (h < WATER_Y - 0.25) {
      col.copy(cLakeBed);
    } else if (biome === 'desert') {
      col.copy(checker ? cDesertA : cDesertB);
    } else if (biome === 'wilds') {
      const wMix = clamp(1 - (Math.hypot((x - 32) * 0.85, (z + 152) * 0.95) - 34) / 22, 0.28, 1);
      col.copy(cPeakStone).lerp(checker ? cWildsA : cWildsB, wMix);
      if (wMix > 0.45 && hash2(Math.floor(x * 0.22), Math.floor(z * 0.22)) > 0.84) {
        col.lerp(cWildsLava, 0.45 * wMix);
      }
    } else if (biome === 'snow') {
      col.copy(cPeakStone).lerp(cSnow, clamp((h - 11) / 9, 0.32, 1));
    } else if (biome === 'swamp') {
      col.copy(checker ? cSwampA : cSwampB);
    } else if (h < WATER_Y + 0.72) {
      col.copy(cSand);
    } else if (biome === 'peak' || h > 22) {
      col.copy(cPeakStone).lerp(cSnow, clamp((h - 26) / 14, 0, 0.85));
    } else if (biome === 'canyon') {
      col.copy(checker ? cCanyon : cCanyonStone);
    } else {
      col.copy(checker ? cGrassA : cGrassB);
      if (hash2(Math.floor(x * 0.35), Math.floor(z * 0.35)) > 0.7) {
        col.lerp(cClover, 0.52);
      }
    }

    if (slope > 0.22 && h > WATER_Y + 0.3) {
      const cliffMix = clamp((slope - 0.22) * 3.2, 0, 1);
      const rockTarget =
        biome === 'canyon'
          ? cCanyonStone
          : biome === 'desert'
            ? cDesertB
            : biome === 'wilds'
              ? cWildsA
              : checker
                ? cCliff
                : cCliffMoss;
      col.lerp(rockTarget, cliffMix);
    }

    if (road > 0.05 && h > WATER_Y + 0.35) {
      col.lerp(checker ? cRoad : cRoadD, road * 0.88);
    }

    col.offsetHSL(0, 0, jitter);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // Crisp micro-textured storybook ground overlay on top of vertex colors!
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: mats.texGround,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02,
    flatShading: true,
    bumpMap: mats.bumpStone,
    bumpScale: 0.03,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function buildWaterMesh(sky?: SkyDomeUniforms): { mesh: THREE.Mesh; uniforms: { uTime: { value: number } } } {
  const uniforms = {
    uTime: { value: 0 },
    uSkyHorizon: sky ? sky.uHorizon : { value: new THREE.Color('#b6e0fc') },
    uSkyZenith: sky ? sky.uZenith : { value: new THREE.Color('#4d9ee8') },
  };
  const geo = new THREE.PlaneGeometry(WORLD_EXTENT * 2.2, WORLD_EXTENT * 2.2, 96, 96);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x1f7fb8,
    roughness: 0.08,
    metalness: 0.0,
    transparent: true,
    opacity: 0.86,
    envMapIntensity: 0.15,
  });

  // Rolling waves, sparkling sun glints, sky reflection that grows at grazing angles (Fresnel),
  // and clearer water when looking straight down.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSkyHorizon = uniforms.uSkyHorizon;
    shader.uniforms.uSkyZenith = uniforms.uSkyZenith;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWaterPos;\nvarying vec3 vWaterWorld;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed.y += sin(position.x * 0.45 + uTime * 1.8) * 0.026 + cos(position.z * 0.4 - uTime * 1.4) * 0.022
                        + sin((position.x + position.z) * 0.9 + uTime * 2.6) * 0.01;
         vWaterPos = transformed;
         vWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nuniform vec3 uSkyHorizon;\nuniform vec3 uSkyZenith;\nvarying vec3 vWaterPos;\nvarying vec3 vWaterWorld;\nfloat waterFres;\nvec3 waterN;'
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         {
           vec2 p = vWaterPos.xz;
           float t = uTime;
           float dx = cos(p.x * 0.9 + t * 1.3) * 0.08 + cos((p.x + p.y) * 2.1 + t * 2.3) * 0.05
                    + cos(p.x * 4.7 - t * 3.1 + p.y * 1.3) * 0.03 + cos(p.x * 9.1 + p.y * 3.7 + t * 4.2) * 0.016;
           float dz = cos(p.y * 0.8 - t * 1.1) * 0.08 + cos((p.y - p.x) * 2.4 - t * 1.9) * 0.05
                    + cos(p.y * 5.3 + t * 2.7) * 0.03 + cos(p.y * 8.3 - p.x * 2.9 - t * 3.6) * 0.016;
           waterN = normalize(vec3(-dx, 1.0, -dz));
           vec3 V = normalize(cameraPosition - vWaterWorld);
           waterFres = 0.04 + 0.96 * pow(1.0 - max(dot(waterN, V), 0.0), 5.0);
           float crest = smoothstep(0.1, 0.2, dx * dx + dz * dz);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.55, 0.62), 0.25 + 0.2 * sin(p.x * 0.07 + p.y * 0.05));
           diffuseColor.rgb += vec3(0.25, 0.3, 0.3) * crest * 0.35;
           diffuseColor.a = mix(0.72, 0.97, clamp(waterFres * 1.6, 0.0, 1.0));
         }`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         normal = normalize((viewMatrix * vec4(waterN, 0.0)).xyz);`
      )
      .replace(
        '#include <opaque_fragment>',
        `{
           vec3 V = normalize(cameraPosition - vWaterWorld);
           vec3 R = reflect(-V, waterN);
           vec3 skyRef = mix(uSkyHorizon, uSkyZenith, pow(clamp(R.y, 0.0, 1.0), 0.6));
           outgoingLight = mix(outgoingLight, skyRef, clamp(waterFres, 0.0, 0.85));
         }
         #include <opaque_fragment>`
      );
  };
  mat.customProgramCacheKey = () => 'dawnbell-water-v2';

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WATER_Y;
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  return { mesh, uniforms };
}

function buildDistantMountains(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const footMat = mats.getMat('#5a7688', { roughness: 0.94, bump: 'stone' });
  const baseMat = mats.getMat('#688094', { roughness: 0.92, bump: 'stone', pattern: 'stone' });
  const midMat = mats.getMat('#7f93a6', { roughness: 0.88, bump: 'stone' });
  const snowMat = mats.getMat('#f0f6fc', { roughness: 0.82 });

  // Broad, majestic 5-tier stepped alpine mountain range framing the vast 380m kingdom horizon!
  const peakCount = 32;
  for (let i = 0; i < peakCount; i++) {
    const a = (i / peakCount) * Math.PI * 2 + (hash2(i, 41) - 0.5) * 0.12;
    const dist = 252 + hash2(i, 42) * 32;
    const mx = Math.cos(a) * dist;
    const mz = Math.sin(a) * dist;
    const w = 52 + hash2(i, 43) * 28;
    const h = 28 + hash2(i, 44) * 26;

    const mg = new THREE.Group();
    mg.position.set(mx, -2.5, mz);
    mg.rotation.y = a + (hash2(i, 45) - 0.5) * 0.6;

    // 5 terraced pyramidal mountain tiers (broad base -> craggy shoulders -> snow peak)
    addVoxelBox(mg, w, h * 0.3, w * 0.78, footMat, 0, h * 0.14, 0, false, false);
    addVoxelBox(mg, w * 0.78, h * 0.28, w * 0.62, baseMat, w * 0.04, h * 0.4, -w * 0.03, false, false);
    addVoxelBox(mg, w * 0.54, h * 0.24, w * 0.44, midMat, w * 0.06, h * 0.63, -w * 0.04, false, false);
    addVoxelBox(mg, w * 0.32, h * 0.18, w * 0.28, snowMat, w * 0.07, h * 0.82, -w * 0.04, false, false);
    addVoxelBox(mg, w * 0.15, h * 0.12, w * 0.14, snowMat, w * 0.07, h * 0.96, -w * 0.04, false, false);

    // Secondary ridge shoulder for organic alpine silhouette
    if (i % 2 === 0) {
      addVoxelBox(mg, w * 0.42, h * 0.26, w * 0.36, baseMat, -w * 0.28, h * 0.38, w * 0.06, false, false);
      addVoxelBox(mg, w * 0.22, h * 0.16, w * 0.2, snowMat, -w * 0.28, h * 0.58, w * 0.06, false, false);
    }
    g.add(mg);
  }
  return g;
}

function buildVillageFencesAndCobbles(
  mats: MaterialLibrary,
  colliders: SolidCollider[]
): THREE.Group {
  const g = new THREE.Group();
  const wood = mats.getMat('#784c28', { roughness: 0.84, bump: 'wood', pattern: 'wood' });
  const woodL = mats.getMat('#9a683a', { roughness: 0.82, bump: 'wood', pattern: 'wood' });
  const cobble = mats.getMat('#a4a096', { roughness: 0.88, bump: 'stone', pattern: 'stone' });
  const cobbleD = mats.getMat('#827f78', { roughness: 0.9, bump: 'stone', pattern: 'stone' });

  // Split-rail wooden fences along Awakening Overlook edge & Brackenford Outpost lanes
  const fenceRuns: Array<{ x1: number; z1: number; x2: number; z2: number; posts: number }> = [
    { x1: -11.5, z1: 45.2, x2: -6.5, z2: 47.6, posts: 4 },
    { x1: 6.2, z1: 47.4, x2: 11.4, z2: 45.0, posts: 4 },
    { x1: 18.2, z1: 12.2, x2: 20.6, z2: 10.6, posts: 3 },
    { x1: 15.2, z1: 27.6, x2: 16.5, z2: 32.8, posts: 4 },
    { x1: 29.8, z1: 28.4, x2: 34.8, z2: 27.8, posts: 4 },
  ];

  for (const fr of fenceRuns) {
    const dx = fr.x2 - fr.x1;
    const dz = fr.z2 - fr.z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);

    for (let i = 0; i < fr.posts; i++) {
      const t = i / (fr.posts - 1);
      const px = fr.x1 + dx * t;
      const pz = fr.z1 + dz * t;
      const py = getTerrainHeight(px, pz);
      addVoxelBox(g, 0.2, 1.05, 0.2, wood, px, py + 0.42, pz);
    }
    const mx = (fr.x1 + fr.x2) * 0.5;
    const mz = (fr.z1 + fr.z2) * 0.5;
    const my = getTerrainHeight(mx, mz);
    const r1 = addVoxelBox(g, 0.1, 0.12, len, woodL, mx, my + 0.72, mz);
    r1.rotation.y = angle;
    const r2 = addVoxelBox(g, 0.1, 0.12, len, woodL, mx, my + 0.36, mz);
    r2.rotation.y = angle;

    // Simplified oriented collision proxy for wooden fence run so actors never clip through rails
    colliders.push({
      id: `fence_${Math.round(mx)}_${Math.round(mz)}`,
      kind: 'box',
      x: mx,
      z: mz,
      minY: my - 0.3,
      maxY: my + 1.08,
      halfX: 0.24,
      halfZ: len * 0.5 + 0.12,
      rotY: angle,
      blocksCamera: false,
      climbable: false,
      active: true,
    });
  }

  // Hand-laid cobblestone stepping stones around Brackenford Plaza & Awakening Overlook
  const cobbleCenters: Array<[number, number, number]> = [
    [25.6, 22.0, 5.2], // Brackenford well plaza
    [0.0, 44.2, 3.6], // Awakening Overlook stone pad
    [0.0, 9.8, 2.2], // Dawnbell Spire south approach plaza (cleanly outside stairs!)
  ];
  for (let ci = 0; ci < cobbleCenters.length; ci++) {
    const [cx, cz, rad] = cobbleCenters[ci];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + ci * 0.5;
      const r = 1.2 + hash2(i + ci * 31, 14) * (rad - 1.2);
      const sx = cx + Math.cos(a) * r;
      const sz = cz + Math.sin(a) * r;
      const sy = getTerrainHeight(sx, sz);
      // Avoid clipping directly into well or Spire plinth/stair colliders
      let blocked = false;
      for (const col of colliders) {
        if (Math.hypot(sx - col.x, sz - col.z) < Math.max(col.halfX, col.halfZ) + 0.95) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const slab = addVoxelBox(
        g,
        0.58 + hash2(i, 81) * 0.34,
        0.1,
        0.52 + hash2(i, 82) * 0.34,
        i % 2 ? cobble : cobbleD,
        sx,
        sy + 0.02,
        sz,
        false,
        true
      );
      slab.rotation.y = hash2(i, 83) * Math.PI;
    }
  }

  return g;
}

function buildInstancedFlora(
  mats: MaterialLibrary,
  colliders: SolidCollider[],
  occupiedZones: Array<{ x: number; z: number; r: number }>
): {
  group: THREE.Group;
  grassUniforms: { uTime: { value: number } };
  bushMeshes: THREE.InstancedMesh[];
  cuttableBushes: CuttableBushProp[];
} {
  const floraGroup = new THREE.Group();
  const grassUniforms = { uTime: { value: 0 } };

  const isFree = (x: number, z: number, r: number) => {
    if (Math.hypot(x, z) > WORLD_PLAY_RADIUS - 4) return false;
    const h = getTerrainHeight(x, z);
    if (h < WATER_Y + 0.75) return false;
    if (getRoadFactor(x, z) > 0.18) return false;
    const n = getTerrainNormal(x, z);
    if (n.y < 0.84) return false;
    for (let i = 0; i < occupiedZones.length; i++) {
      const o = occupiedZones[i];
      if (Math.hypot(x - o.x, z - o.z) < o.r + r) return false;
    }
    return true;
  };

  // 1. Multi-Bough Storybook Trees across the Vast Kingdom (biome-matched!)
  const treePositions: Array<{
    x: number;
    y: number;
    z: number;
    s: number;
    rot: number;
    kind: 'oak' | 'blossom' | 'birch' | 'willow' | 'snowpine' | 'palm' | 'ashen';
  }> = [];
  for (let i = 0; i < 1250 && treePositions.length < 320; i++) {
    const a = hash2(i * 17, 3) * Math.PI * 2;
    const dist = 12 + Math.sqrt(hash2(i * 23, 19)) * (WORLD_PLAY_RADIUS - 16);
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    if (!isFree(x, z, 3.1)) continue;

    let tooClose = false;
    for (let j = 0; j < treePositions.length; j++) {
      if (Math.hypot(x - treePositions[j].x, z - treePositions[j].z) < 6.8) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const biome = getBiomeAt(x, z);
    if (biome === 'canyon' && hash2(i, 91) > 0.28) continue;
    if (biome === 'desert' && Math.hypot(x - 104, z - 80) > 22 && hash2(i, 92) > 0.14) continue;
    if (biome === 'wilds' && hash2(i, 93) > 0.35) continue;

    const h = getTerrainHeight(x, z);
    const roll = hash2(i * 7, 51);
    let kind: 'oak' | 'blossom' | 'birch' | 'willow' | 'snowpine' | 'palm' | 'ashen' = 'oak';
    if (biome === 'snow') kind = 'snowpine';
    else if (biome === 'desert') kind = 'palm';
    else if (biome === 'wilds') kind = 'ashen';
    else if (biome === 'swamp' || Math.hypot(x - 2, z + 52) < 34) kind = 'willow';
    else if (biome === 'highland' || h > 7.5) kind = 'birch';
    else if (roll < 0.17) kind = 'blossom';

    const s = 0.88 + hash2(i * 11, 77) * 0.42;
    const rot = hash2(i * 5, 13) * Math.PI * 2;
    treePositions.push({ x, y: h, z, s, rot, kind });

    colliders.push({
      id: `tree_${treePositions.length}`,
      kind: 'cylinder',
      x,
      z,
      minY: h - 0.5,
      maxY: h + 3.5 * s,
      halfX: 0.58 * s,
      halfZ: 0.58 * s,
      blocksCamera: false,
      climbable: true,
      active: true,
    });
  }

  const count = treePositions.length;
  const trunkGeo = new THREE.BoxGeometry(0.76, 3.35, 0.76);
  const rootGeo = new THREE.BoxGeometry(1.42, 0.65, 1.42);
  const branchGeo = new THREE.BoxGeometry(0.38, 1.55, 0.38);
  const canopyLowGeo = new THREE.BoxGeometry(2.7, 1.45, 2.7);
  const canopySideAGeo = new THREE.BoxGeometry(2.15, 1.35, 2.15);
  const canopySideBGeo = new THREE.BoxGeometry(1.95, 1.25, 1.95);
  const canopyTopGeo = new THREE.BoxGeometry(1.65, 1.05, 1.65);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: mats.texWood,
    roughness: 0.88,
    bumpMap: mats.bumpWood,
    bumpScale: 0.045,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: mats.texCloth,
    roughness: 0.82,
  });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const roots = new THREE.InstancedMesh(rootGeo, trunkMat, count);
  const branchL = new THREE.InstancedMesh(branchGeo, trunkMat, count);
  const branchR = new THREE.InstancedMesh(branchGeo, trunkMat, count);
  const lowC = new THREE.InstancedMesh(canopyLowGeo, leafMat, count);
  const sideCA = new THREE.InstancedMesh(canopySideAGeo, leafMat, count);
  const sideCB = new THREE.InstancedMesh(canopySideBGeo, leafMat, count);
  const topC = new THREE.InstancedMesh(canopyTopGeo, leafMat, count);

  const treeMeshes = [trunks, roots, branchL, branchR, lowC, sideCA, sideCB, topC];
  for (const m of treeMeshes) {
    m.castShadow = true;
    m.receiveShadow = true;
  }

  const dummy = new THREE.Object3D();
  const c = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const t = treePositions[i];
    const barkHex = t.kind === 'birch' ? '#e0d8c8' : '#6c492a';
    c.set(barkHex).offsetHSL(0, 0, (hash2(i, 1) - 0.5) * 0.06);

    // Trunk grounded slightly below terrain so it never floats on slopes
    dummy.position.set(t.x, t.y + 1.45 * t.s, t.z);
    dummy.rotation.set(0, t.rot, 0);
    dummy.scale.set(t.s, t.s, t.s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    trunks.setColorAt(i, c);

    dummy.position.set(t.x, t.y + 0.12 * t.s, t.z);
    dummy.rotation.set(0, t.rot + Math.PI / 4, 0);
    dummy.updateMatrix();
    roots.setMatrixAt(i, dummy.matrix);
    roots.setColorAt(i, c);

    // Two angled storybook limbs supporting staggered foliage puffs
    const cosR = Math.cos(t.rot);
    const sinR = Math.sin(t.rot);
    dummy.position.set(t.x + cosR * 0.62 * t.s, t.y + 2.75 * t.s, t.z + sinR * 0.62 * t.s);
    dummy.rotation.set(0, t.rot, -0.58);
    dummy.updateMatrix();
    branchL.setMatrixAt(i, dummy.matrix);
    branchL.setColorAt(i, c);

    dummy.position.set(t.x - cosR * 0.55 * t.s, t.y + 2.95 * t.s, t.z - sinR * 0.55 * t.s);
    dummy.rotation.set(0, t.rot, 0.54);
    dummy.updateMatrix();
    branchR.setMatrixAt(i, dummy.matrix);
    branchR.setColorAt(i, c);

    const palette =
      t.kind === 'blossom'
        ? ['#e688b2', '#f8b2d0', '#ffc4de', '#ffd8e8']
        : t.kind === 'birch'
          ? ['#d49228', '#ebb038', '#f6c446', '#ffe072']
          : t.kind === 'willow'
            ? ['#367a52', '#4a9662', '#5ca870', '#76be82']
            : t.kind === 'snowpine'
              ? ['#2a5c4c', '#3c7462', '#d2e4f0', '#eff7fc']
              : t.kind === 'palm'
                ? ['#4e8e38', '#68ab46', '#7ec254', '#94d464']
                : t.kind === 'ashen'
                  ? ['#3a363c', '#4a4244', '#5c4b48', '#7c4c3a']
                  : ['#348230', '#48a03c', '#58b448', '#74cc58'];

    // Asymmetric multi-puff foliage crown
    dummy.position.set(t.x, t.y + 3.55 * t.s, t.z);
    dummy.rotation.set(0, t.rot, 0);
    dummy.scale.set(t.s, t.s, t.s);
    dummy.updateMatrix();
    lowC.setMatrixAt(i, dummy.matrix);
    lowC.setColorAt(i, c.set(palette[0]).offsetHSL(0, 0, (hash2(i, 2) - 0.5) * 0.05));

    dummy.position.set(t.x + cosR * 0.95 * t.s, t.y + 4.15 * t.s, t.z + sinR * 0.95 * t.s);
    dummy.rotation.set(0, t.rot + 0.35, 0);
    dummy.updateMatrix();
    sideCA.setMatrixAt(i, dummy.matrix);
    sideCA.setColorAt(i, c.set(palette[1]).offsetHSL(0, 0, (hash2(i, 3) - 0.5) * 0.05));

    dummy.position.set(t.x - cosR * 0.85 * t.s + sinR * 0.45 * t.s, t.y + 4.45 * t.s, t.z - sinR * 0.85 * t.s - cosR * 0.45 * t.s);
    dummy.rotation.set(0, t.rot - 0.42, 0);
    dummy.updateMatrix();
    sideCB.setMatrixAt(i, dummy.matrix);
    sideCB.setColorAt(i, c.set(palette[2]).offsetHSL(0, 0, (hash2(i, 4) - 0.5) * 0.05));

    dummy.position.set(t.x + sinR * 0.2 * t.s, t.y + 5.25 * t.s, t.z - cosR * 0.2 * t.s);
    dummy.rotation.set(0, t.rot + 0.2, 0);
    dummy.updateMatrix();
    topC.setMatrixAt(i, dummy.matrix);
    topC.setColorAt(i, c.set(palette[3]).offsetHSL(0, 0, (hash2(i, 5) - 0.5) * 0.05));
  }

  for (const m of treeMeshes) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    floraGroup.add(m);
  }

  // 2. Berry Bushes, Layered Mossy Rock Clusters, Wildflowers & Swaying Meadow Grass Tufts!
  const bushPos: Array<[number, number, number, number]> = [];
  const rockPos: Array<[number, number, number, number, number]> = [];
  const flowerPos: Array<[number, number, number, string]> = [];
  const grassPos: Array<[number, number, number, number, number]> = [];
  const flowerColors = ['#fff6e0', '#ffd84a', '#f59ac0', '#a8d4ff'];

  for (let i = 0; i < 2400; i++) {
    const a = hash2(i * 31, 7) * Math.PI * 2;
    const dist = 5 + Math.sqrt(hash2(i * 41, 11)) * (WORLD_PLAY_RADIUS - 8);
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    const h = getTerrainHeight(x, z);
    if (h < WATER_Y + 0.65 || getRoadFactor(x, z) > 0.2) continue;

    // Respect occupiedZones for ALL flora so zero grass/bushes/rocks spawn inside buildings!
    let inZone = false;
    for (let zi = 0; zi < occupiedZones.length; zi++) {
      const o = occupiedZones[zi];
      if (Math.hypot(x - o.x, z - o.z) < o.r + 0.4) {
        inZone = true;
        break;
      }
    }
    if (inZone) continue;

    const biome = getBiomeAt(x, z);
    const roll = hash2(i * 13, 29);
    if (roll < 0.12 && bushPos.length < 165 && biome !== 'desert' && biome !== 'wilds' && isFree(x, z, 1.3)) {
      bushPos.push([x, h, z, 0.8 + hash2(i, 99) * 0.45]);
    } else if (roll < 0.22 && rockPos.length < 120 && isFree(x, z, 1.6)) {
      const rs = 0.78 + hash2(i, 88) * 0.85;
      rockPos.push([x, h, z, rs, hash2(i, 77) * Math.PI]);
      colliders.push({
        id: `rock_${rockPos.length}`,
        kind: 'cylinder',
        x,
        z,
        minY: h - 0.35,
        maxY: h + 0.88 * rs,
        halfX: 0.72 * rs,
        halfZ: 0.72 * rs,
        stepUp: true,
        blocksCamera: false,
        climbable: false,
        active: true,
      });
    } else if (roll < 0.42 && flowerPos.length < 360 && biome !== 'desert' && biome !== 'wilds' && biome !== 'snow') {
      flowerPos.push([x, h, z, flowerColors[i % flowerColors.length]]);
    } else if (grassPos.length < 960 && biome !== 'canyon' && biome !== 'desert' && biome !== 'wilds' && biome !== 'snow') {
      grassPos.push([x, h, z, 0.78 + hash2(i, 61) * 0.65, hash2(i, 62) * Math.PI]);
    }
  }

  // Berry bushes (3-part: dark base + sunlit crown + ripe berries)
  const bushBase = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 0.76, 1.15), leafMat, bushPos.length);
  const bushTop = new THREE.InstancedMesh(new THREE.BoxGeometry(0.76, 0.48, 0.76), leafMat, bushPos.length);
  const berryMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), leafMat, bushPos.length);
  bushBase.castShadow = true;
  bushBase.receiveShadow = true;
  for (let i = 0; i < bushPos.length; i++) {
    const [x, y, z, s] = bushPos[i];
    dummy.position.set(x, y + 0.3 * s, z);
    dummy.rotation.set(0, hash2(i, 3) * 3, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    bushBase.setMatrixAt(i, dummy.matrix);
    bushBase.setColorAt(i, c.set('#3a9236').offsetHSL(0, 0, (hash2(i, 5) - 0.5) * 0.08));

    dummy.position.set(x, y + 0.7 * s, z);
    dummy.updateMatrix();
    bushTop.setMatrixAt(i, dummy.matrix);
    bushTop.setColorAt(i, c.set('#58b848').offsetHSL(0, 0, (hash2(i, 6) - 0.5) * 0.08));

    dummy.position.set(x + 0.32 * s, y + 0.54 * s, z + 0.28 * s);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    berryMesh.setMatrixAt(i, dummy.matrix);
    berryMesh.setColorAt(i, c.set(i % 3 === 0 ? '#eb444c' : i % 3 === 1 ? '#ffd84a' : '#f59ac0'));
  }
  for (const m of [bushBase, bushTop, berryMesh]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    floraGroup.add(m);
  }

  // Layered 3-part Mossy Boulder Clusters (replaces single-cube rocks!)
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: mats.texStone,
    roughness: 0.9,
    bumpMap: mats.bumpStone,
    bumpScale: 0.045,
  });
  const rockMain = new THREE.InstancedMesh(new THREE.BoxGeometry(1.35, 0.9, 1.15), rockMat, rockPos.length);
  const rockSub = new THREE.InstancedMesh(new THREE.BoxGeometry(0.85, 0.62, 0.85), rockMat, rockPos.length);
  const rockMoss = new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, 0.16, 0.78), leafMat, rockPos.length);
  rockMain.castShadow = true;
  rockMain.receiveShadow = true;
  rockSub.castShadow = true;
  for (let i = 0; i < rockPos.length; i++) {
    const [x, y, z, s, rot] = rockPos[i];
    dummy.position.set(x, y + 0.3 * s, z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(s, s * 0.88, s);
    dummy.updateMatrix();
    rockMain.setMatrixAt(i, dummy.matrix);
    rockMain.setColorAt(i, c.set('#808490').offsetHSL(0, 0, (hash2(i, 12) - 0.5) * 0.1));

    dummy.position.set(x + Math.cos(rot) * 0.58 * s, y + 0.18 * s, z + Math.sin(rot) * 0.58 * s);
    dummy.rotation.set(0, rot + 0.6, 0);
    dummy.scale.set(s, s * 0.85, s);
    dummy.updateMatrix();
    rockSub.setMatrixAt(i, dummy.matrix);
    rockSub.setColorAt(i, c.set('#686d78').offsetHSL(0, 0, (hash2(i, 14) - 0.5) * 0.08));

    dummy.position.set(x, y + 0.72 * s, z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    rockMoss.setMatrixAt(i, dummy.matrix);
    rockMoss.setColorAt(i, c.set('#4c983c').offsetHSL(0, 0, (hash2(i, 16) - 0.5) * 0.08));
  }
  for (const m of [rockMain, rockSub, rockMoss]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    floraGroup.add(m);
  }

  // Wildflowers
  const flowerStem = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), leafMat, flowerPos.length);
  const flowerHead = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.14, 0.24), leafMat, flowerPos.length);
  for (let i = 0; i < flowerPos.length; i++) {
    const [x, y, z, fc] = flowerPos[i];
    dummy.position.set(x, y + 0.14, z);
    dummy.rotation.set(0, hash2(i, 4) * 3, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    flowerStem.setMatrixAt(i, dummy.matrix);
    flowerStem.setColorAt(i, c.set('#3f8e34'));

    dummy.position.set(x, y + 0.3, z);
    dummy.updateMatrix();
    flowerHead.setMatrixAt(i, dummy.matrix);
    flowerHead.setColorAt(i, c.set(fc));
  }
  for (const m of [flowerStem, flowerHead]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    floraGroup.add(m);
  }

  // Wind-Swirling Instanced Meadow Grass Blades (BotW sunlit grass carpet!)
  const grassBladeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
  });
  grassBladeMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = grassUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float tip = step(0.05, position.y);
         #ifdef USE_INSTANCING
           vec3 instPos = instanceMatrix[3].xyz;
           float sway = sin(uTime * 2.4 + instPos.x * 0.38 + instPos.z * 0.32) * 0.14 * tip;
           transformed.x += sway;
         #endif`
      );
  };
  const bladeGeoA = new THREE.BoxGeometry(0.08, 0.42, 0.18);
  const bladeGeoB = new THREE.BoxGeometry(0.18, 0.34, 0.08);
  const grassA = new THREE.InstancedMesh(bladeGeoA, grassBladeMat, grassPos.length);
  const grassB = new THREE.InstancedMesh(bladeGeoB, grassBladeMat, grassPos.length);
  for (let i = 0; i < grassPos.length; i++) {
    const [x, y, z, s, rot] = grassPos[i];
    dummy.position.set(x, y + 0.18 * s, z);
    dummy.rotation.set(0.14, rot, 0.1);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    grassA.setMatrixAt(i, dummy.matrix);
    grassA.setColorAt(i, c.set('#4ea63c').offsetHSL(0, 0, (hash2(i, 64) - 0.5) * 0.1));

    dummy.position.set(x + 0.06, y + 0.14 * s, z - 0.05);
    dummy.rotation.set(-0.12, rot + 0.85, -0.1);
    dummy.updateMatrix();
    grassB.setMatrixAt(i, dummy.matrix);
    grassB.setColorAt(i, c.set('#68c04e').offsetHSL(0, 0, (hash2(i, 65) - 0.5) * 0.1));
  }
  for (const m of [grassA, grassB]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    floraGroup.add(m);
  }

  // Shoreline Cattails / Reeds ringing Azure Mirror Lake!
  const reedSpots: Array<[number, number, number]> = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    for (let rad = 16; rad <= 28; rad += 3) {
      const rx = 2 + Math.cos(a) * rad * 1.15;
      const rz = -52 + Math.sin(a) * rad * 0.9;
      const rh = getTerrainHeight(rx, rz);
      if (rh > WATER_Y - 0.35 && rh < WATER_Y + 0.55 && getRoadFactor(rx, rz) < 0.15) {
        reedSpots.push([rx, rh, rz]);
        break;
      }
    }
  }
  if (reedSpots.length > 0) {
    const reedStem = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 1.25, 0.08), leafMat, reedSpots.length);
    const reedHead = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.38, 0.16), trunkMat, reedSpots.length);
    for (let i = 0; i < reedSpots.length; i++) {
      const [rx, ry, rz] = reedSpots[i];
      const s = 0.85 + hash2(i, 92) * 0.4;
      dummy.position.set(rx, ry + 0.58 * s, rz);
      dummy.rotation.set((hash2(i, 93) - 0.5) * 0.16, hash2(i, 94) * 3, (hash2(i, 95) - 0.5) * 0.16);
      dummy.scale.set(1, s, 1);
      dummy.updateMatrix();
      reedStem.setMatrixAt(i, dummy.matrix);
      reedStem.setColorAt(i, c.set('#448c3a'));

      dummy.position.set(rx, ry + 1.05 * s, rz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      reedHead.setMatrixAt(i, dummy.matrix);
      reedHead.setColorAt(i, c.set('#684226'));
    }
    for (const m of [reedStem, reedHead]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      floraGroup.add(m);
    }
  }

  const cuttableBushes: CuttableBushProp[] = bushPos.map(([x, y, z], index) => ({
    index,
    x,
    y,
    z,
    cut: false,
  }));

  return {
    group: floraGroup,
    grassUniforms,
    bushMeshes: [bushBase, bushTop, berryMesh],
    cuttableBushes,
  };
}

function buildClouds(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const mat = mats.getMat('#ffffff', { roughness: 0.95, transparent: true, opacity: 0.9 });
  const matUnder = mats.getMat('#dbe9f8', { roughness: 0.98, transparent: true, opacity: 0.88 });
  for (let i = 0; i < 32; i++) {
    const cg = new THREE.Group();
    const x = (hash2(i, 101) - 0.5) * 440;
    const z = (hash2(i, 202) - 0.5) * 440;
    const y = 52 + hash2(i, 303) * 20;
    cg.position.set(x, y, z);
    const w = 13 + hash2(i, 404) * 18;
    const d = 7 + hash2(i, 505) * 10;
    addVoxelBox(cg, w * 0.92, 0.9, d * 0.9, matUnder, 0, -1.2, 0, false, false);
    addVoxelBox(cg, w, 1.8, d, mat, 0, 0.2, 0, false, false);
    addVoxelBox(cg, w * 0.62, 1.7, d * 0.72, mat, w * 0.14, 1.9, 0.4, false, false);
    addVoxelBox(cg, w * 0.46, 1.4, d * 0.55, mat, -w * 0.24, 1.4, -0.5, false, false);
    g.add(cg);
  }
  return g;
}

function buildUpdraftVisual(mats: MaterialLibrary, height: number): THREE.Group {
  const g = new THREE.Group();
  const mat = mats.getMat('#9af8e2', {
    transparent: true,
    opacity: 0.42,
    emissive: '#4ee6c8',
    emissiveIntensity: 0.8,
  });
  for (let i = 0; i < 6; i++) {
    const ring = addVoxelBox(g, 1.6, 0.14, 0.14, mat, 0, (i / 6) * height, 0, false, false);
    ring.rotation.y = i * 0.8;
  }
  return g;
}

export function buildOpenWorld(mats: MaterialLibrary): WorldData {
  const group = new THREE.Group();
  const colliders: SolidCollider[] = [];
  const proxyRegistry = new CollisionProxyRegistry();
  // Comprehensive no-flora clearance zones covering EVERY landmark, cottage, windmill, bridge, campfire & puzzle prop!
  const occupiedZones: Array<{ x: number; z: number; r: number }> = [
    { x: 0, z: 46, r: 10.5 }, // Awakening Overlook
    { x: 0, z: 0, r: 14 }, // Dawnbell Spire
    { x: 26, z: 22, r: 19 }, // Brackenford Outpost
    { x: 16.5, z: 18.5, r: 6.5 }, // Brackenford Windmill
    { x: -11.5, z: 19.5, r: 6.5 }, // Stone Arch Bridge
    { x: -46, z: -22, r: 11.5 }, // Shrine of Wind
    { x: 48, z: -10, r: 11.5 }, // Shrine of Embers
    { x: 2, z: -58, r: 11.5 }, // Shrine of Stillness
    { x: -24, z: 16, r: 10.5 }, // Camp 1
    { x: 34, z: -26, r: 10.5 }, // Camp 2
    { x: -28, z: -36, r: 10.5 }, // Camp 3
    { x: 11.5, z: 42.0, r: 4.5 }, // Cracked rock stash
    { x: 42.5, z: -6.5, r: 4.5 }, // Canyon cracked rock
    { x: -41.5, z: -16.2, r: 3.5 }, // Windcrest pinwheel
    // Puzzles & Archery Targets
    { x: -5.2, z: 22.8, r: 5.5 }, // Resonance Chime Bells
    { x: 13.2, z: 29.0, r: 5.2 }, // Heavy Stone Runic Socket
    { x: 34.5, z: 29.5, r: 3.0 }, // Bram Archery Target 1
    { x: 37.5, z: 16.0, r: 3.0 }, // Bram Archery Target 2
    { x: 18.5, z: 30.2, r: 3.0 }, // Bram Archery Target 3
    // Vast classic MMO-Inspired Outer Regions
    { x: 38.0, z: 22.0, r: 9.0 }, // Brackenford Keep Gatehouse
    { x: 19.0, z: 36.0, r: 9.5 }, // Brackenford Livestock Pasture
    { x: -6.0, z: -106.0, r: 24.0 }, // Highcrown Square (old-world walled city)
    { x: -96.0, z: 96.0, r: 16.0 }, // Wizards' Sea Tower Island
    { x: 74.0, z: 48.0, r: 9.5 }, // Sunscorch Desert Border Gate
    { x: 104.0, z: 72.0, r: 12.0 }, // Sunscorch Oasis Bazaar
    { x: 130.0, z: 60.0, r: 16.5 }, // Sunscorch Stepped Pyramid
    { x: 108.0, z: -28.0, r: 14.0 }, // Dwarven Ore Quarry
    { x: -84.0, z: 6.0, r: 13.5 }, // Druidic Stone Circle
    { x: 32.0, z: -152.0, r: 15.0 }, // Ashen Wilds Obsidian Sanctuary
  ];

  // 0. Atmospheric Gradient Sky Dome & Distant Snow-Capped Mountain Rim
  const skyDome = buildSkyDome();
  group.add(skyDome.mesh);
  const mountainRim = buildDistantMountains(mats);
  group.add(mountainRim);

  // 1. Textured Storybook Terrain & Shimmering Water
  const terrainMesh = buildTerrainMesh(mats);
  group.add(terrainMesh);
  proxyRegistry.registerTerrain(terrainMesh);

  const { mesh: waterMesh, uniforms: waterUniforms } = buildWaterMesh(skyDome.uniforms);
  group.add(waterMesh);

  // Floating lily pads on Azure Mirror Lake (y = WATER_Y + 0.08 stays cleanly above 0.06 max wave crest!)
  const lilyMat = mats.getMat('#44a248', { roughness: 0.78 });
  const lilyPink = mats.getMat('#f8b4d0', { roughness: 0.65 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rad = 11 + hash2(i, 71) * 12;
    const lx = 2 + Math.cos(a) * rad * 1.2;
    const lz = -52 + Math.sin(a) * rad * 0.9;
    if (getTerrainHeight(lx, lz) < WATER_Y - 0.35) {
      const pad = addVoxelBox(group, 1.15, 0.08, 1.15, lilyMat, lx, WATER_Y + 0.08, lz, false, true);
      pad.rotation.y = hash2(i, 72) * Math.PI;
      if (i % 3 === 0) {
        addVoxelBox(group, 0.32, 0.16, 0.32, lilyPink, lx + 0.15, WATER_Y + 0.2, lz, false, false);
      }
    }
  }

  // 2. Central Landmark: The Great Dawnbell Spire (0, 0)
  // Uses simplified invisible stepped plinths, smooth cardinal stair ramps, and clean buttress/shaft hulls!
  const spireY = getTerrainHeight(0, 0);
  const spire = buildDawnbellSpire(mats);
  spire.group.position.set(0, spireY, 0);
  group.add(spire.group);

  colliders.push(
    // Stepped plinth tiers (walkable & smoothly steppable)
    {
      id: 'spire_plinth_base',
      kind: 'box',
      x: 0,
      z: 0,
      minY: spireY - 1.2,
      maxY: spireY + 1.22,
      halfX: 5.95,
      halfZ: 5.95,
      stepUp: true,
      blocksCamera: true,
      climbable: true,
      active: true,
    },
    {
      id: 'spire_plinth_mid',
      kind: 'box',
      x: 0,
      z: 0,
      minY: spireY + 1.1,
      maxY: spireY + 2.32,
      halfX: 4.85,
      halfZ: 4.85,
      stepUp: true,
      blocksCamera: true,
      climbable: true,
      active: true,
    },
    {
      id: 'spire_plinth_top',
      kind: 'box',
      x: 0,
      z: 0,
      minY: spireY + 2.2,
      maxY: spireY + 2.74,
      halfX: 4.05,
      halfZ: 4.05,
      stepUp: true,
      blocksCamera: true,
      climbable: true,
      active: true,
    },
    // Smooth invisible stair ramps on all 4 cardinal approaches — flush with spire_plinth_base (1.22)!
    {
      id: 'spire_stair_s',
      kind: 'box',
      x: 0,
      z: 6.75,
      minY: spireY,
      maxY: spireY + 1.22,
      halfX: 1.75,
      halfZ: 0.9,
      ramp: { axis: 'z', dir: -1, lowY: spireY, highY: spireY + 1.22 },
      blocksCamera: false,
      climbable: false,
      active: true,
    },
    {
      id: 'spire_stair_n',
      kind: 'box',
      x: 0,
      z: -6.75,
      minY: spireY,
      maxY: spireY + 1.22,
      halfX: 1.75,
      halfZ: 0.9,
      ramp: { axis: 'z', dir: 1, lowY: spireY, highY: spireY + 1.22 },
      blocksCamera: false,
      climbable: false,
      active: true,
    },
    {
      id: 'spire_stair_e',
      kind: 'box',
      x: 6.75,
      z: 0,
      minY: spireY,
      maxY: spireY + 1.22,
      halfX: 0.9,
      halfZ: 1.75,
      ramp: { axis: 'x', dir: -1, lowY: spireY, highY: spireY + 1.22 },
      blocksCamera: false,
      climbable: false,
      active: true,
    },
    {
      id: 'spire_stair_w',
      kind: 'box',
      x: -6.75,
      z: 0,
      minY: spireY,
      maxY: spireY + 1.22,
      halfX: 0.9,
      halfZ: 1.75,
      ramp: { axis: 'x', dir: 1, lowY: spireY, highY: spireY + 1.22 },
      blocksCamera: false,
      climbable: false,
      active: true,
    },
    // Clean simplified hull enclosing irregular corner flying buttresses, quoins & ivy clusters
    {
      id: 'spire_buttress_hull',
      kind: 'box',
      x: 0,
      z: 0,
      minY: spireY + 2.6,
      maxY: spireY + 10.2,
      halfX: 4.18,
      halfZ: 4.18,
      blocksCamera: true,
      climbable: true,
      active: true,
    },
    // Clean climbable upper masonry shaft up to the observation deck
    {
      id: 'spire_shaft',
      kind: 'box',
      x: 0,
      z: 0,
      minY: spireY + 10.0,
      maxY: spireY + 18.3,
      halfX: 3.15,
      halfZ: 3.15,
      blocksCamera: true,
      climbable: true,
      active: true,
    }
  );

  // 3. Three Ancient Bell Shrines (simplified walkable dais, front stair ramp, braziers & archway proxy)
  const shrineSpecs = [
    { id: 'shrine_wind', name: 'Shrine of Wind', accent: '#5ef2cc', x: -46, z: -22 },
    { id: 'shrine_embers', name: 'Shrine of Embers', accent: '#ff9640', x: 48, z: -10 },
    { id: 'shrine_stillness', name: 'Shrine of Stillness', accent: '#6cd4ff', x: 2, z: -58 },
  ];
  const shrines: ShrineRig[] = [];
  for (const s of shrineSpecs) {
    const sy = getTerrainHeight(s.x, s.z);
    const rig = buildBellShrine(mats, s.id, s.name, s.accent, s.x, sy, s.z);
    group.add(rig.group);
    shrines.push(rig);
    colliders.push(
      {
        id: `${s.id}_dais_low`,
        kind: 'box',
        x: s.x,
        z: s.z,
        minY: sy - 1.2,
        maxY: sy + 0.56,
        halfX: 3.45,
        halfZ: 3.45,
        stepUp: true,
        blocksCamera: false,
        climbable: false,
        active: true,
      },
      {
        id: `${s.id}_dais_top`,
        kind: 'box',
        x: s.x,
        z: s.z,
        minY: sy + 0.45,
        maxY: sy + 0.94,
        halfX: 2.62,
        halfZ: 2.62,
        stepUp: true,
        blocksCamera: false,
        climbable: false,
        active: true,
      },
      {
        id: `${s.id}_stair_ramp`,
        kind: 'box',
        x: s.x,
        z: s.z + 3.95,
        minY: sy,
        maxY: sy + 0.94,
        halfX: 1.5,
        halfZ: 0.85,
        ramp: { axis: 'z', dir: -1, lowY: sy, highY: sy + 0.94 },
        blocksCamera: false,
        climbable: false,
        active: true,
      },
      {
        id: `${s.id}_altar`,
        kind: 'cylinder',
        x: s.x,
        z: s.z + 0.4,
        minY: sy + 0.8,
        maxY: sy + 2.35,
        halfX: 0.92,
        halfZ: 0.92,
        blocksCamera: false,
        climbable: false,
        active: true,
      },
      {
        id: `${s.id}_brazier_l`,
        kind: 'cylinder',
        x: s.x - 2.55,
        z: s.z + 2.35,
        minY: sy + 0.4,
        maxY: sy + 2.4,
        halfX: 0.56,
        halfZ: 0.56,
        blocksCamera: false,
        climbable: false,
        active: true,
      },
      {
        id: `${s.id}_brazier_r`,
        kind: 'cylinder',
        x: s.x + 2.55,
        z: s.z + 2.35,
        minY: sy + 0.4,
        maxY: sy + 2.4,
        halfX: 0.56,
        halfZ: 0.56,
        blocksCamera: false,
        climbable: false,
        active: true,
      },
      {
        id: `${s.id}_arch`,
        kind: 'box',
        x: s.x,
        z: s.z - 1.65,
        minY: sy,
        maxY: sy + 8.1,
        halfX: 3.1,
        halfZ: 0.8,
        blocksCamera: true,
        climbable: true,
        active: true,
      }
    );
  }

  // Ancient causeway stone pillars leading across Azure Mirror Lake (with deep water footings!)
  const pillarMat = mats.getMat('#92949e', { roughness: 0.85, bump: 'stone', pattern: 'stone' });
  const pillarDark = mats.getMat('#626572', { roughness: 0.88, bump: 'stone', pattern: 'stone' });
  for (let pz = -30; pz >= -48; pz -= 6) {
    for (const sx of [-1, 1]) {
      const px = 2 + sx * 3.1;
      const py = Math.max(WATER_Y, getTerrainHeight(px, pz));
      const h = pz === -36 ? 2.4 : 3.8;
      const pg = new THREE.Group();
      pg.position.set(px, py, pz);
      addVoxelBox(pg, 1.25, 1.5, 1.25, pillarDark, 0, -0.74, 0); // submerged footing
      addVoxelBox(pg, 1.18, 0.35, 1.18, pillarDark, 0, 0.18, 0);
      addVoxelBox(pg, 0.86, h, 0.86, pillarMat, 0, 0.35 + h / 2, 0);
      addVoxelBox(pg, 1.12, 0.3, 1.12, pillarDark, 0, 0.35 + h + 0.15, 0);
      group.add(pg);
      colliders.push({
        id: `causeway_pillar_${pz}_${sx}`,
        kind: 'box',
        x: px,
        z: pz,
        minY: py,
        maxY: py + h + 0.65,
        halfX: 0.64,
        halfZ: 0.64,
        blocksCamera: true,
        climbable: true,
        active: true,
      });
    }
  }

  // 4. Brackenford Outpost Village (SE Meadow) — exact rotated OBB collision proxies!
  const cottages = [
    { x: 24, z: 14, rot: 0.15, w: 6.2, d: 4.8, roof: '#ab4436', hasChimney: true },
    { x: 34.5, z: 22, rot: -1.1, w: 5.4, d: 4.4, roof: '#466a8c', isSmithy: true },
    { x: 20, z: 29.5, rot: 2.75, w: 5.2, d: 4.2, roof: '#8c5e34', hasChimney: true },
  ];
  for (let i = 0; i < cottages.length; i++) {
    const ct = cottages[i];
    const cy = getTerrainHeight(ct.x, ct.z);
    const mesh = buildCottage(mats, {
      w: ct.w,
      d: ct.d,
      roofColor: ct.roof,
      hasChimney: ct.hasChimney,
      isSmithy: ct.isSmithy,
    });
    mesh.position.set(ct.x, cy, ct.z);
    mesh.rotation.y = ct.rot;
    group.add(mesh);
    // Simplified rotated OBB enclosing cottage walls, shutters, flowerboxes, porch & eaves cleanly
    colliders.push({
      id: `cottage_${i}`,
      kind: 'box',
      x: ct.x,
      z: ct.z,
      minY: cy - 1.2,
      maxY: cy + 5.3,
      halfX: ct.w * 0.5 + 0.24,
      halfZ: ct.d * 0.5 + 0.28,
      rotY: ct.rot,
      blocksCamera: true,
      climbable: true,
      active: true,
    });
  }

  // Village Well & Rotated Market Stall
  const wellY = getTerrainHeight(26, 22);
  const well = buildWell(mats);
  well.position.set(26, wellY, 22);
  group.add(well);
  colliders.push({
    id: 'well',
    kind: 'cylinder',
    x: 26,
    z: 22,
    minY: wellY - 0.8,
    maxY: wellY + 3.0,
    halfX: 1.18,
    halfZ: 1.18,
    blocksCamera: true,
    climbable: false,
    active: true,
  });

  const stallX = 29.4;
  const stallZ = 17.6;
  const stallY = getTerrainHeight(stallX, stallZ);
  const stall = buildMarketStall(mats);
  stall.position.set(stallX, stallY, stallZ);
  stall.rotation.y = -0.45;
  group.add(stall);
  colliders.push({
    id: 'market_stall',
    kind: 'box',
    x: stallX,
    z: stallZ,
    minY: stallY - 0.5,
    maxY: stallY + 2.55,
    halfX: 1.52,
    halfZ: 1.0,
    rotY: -0.45,
    blocksCamera: true,
    climbable: false,
    active: true,
  });

  // Iconic Brackenford Wooden Windmill (2 clean rotated OBB proxies excluding spinning canvas sails!)
  const wmX = 16.5;
  const wmZ = 18.5;
  const wmY = getTerrainHeight(wmX, wmZ);
  const windmill = buildWindmill(mats);
  windmill.group.position.set(wmX, wmY, wmZ);
  windmill.group.rotation.y = -0.62;
  group.add(windmill.group);
  colliders.push(
    {
      id: 'hearthbrook_windmill_base',
      kind: 'box',
      x: wmX,
      z: wmZ,
      minY: wmY - 1.2,
      maxY: wmY + 2.98,
      halfX: 2.52,
      halfZ: 2.52,
      rotY: -0.62,
      blocksCamera: true,
      climbable: true,
      active: true,
    },
    {
      id: 'hearthbrook_windmill_tower',
      kind: 'box',
      x: wmX,
      z: wmZ,
      minY: wmY + 2.9,
      maxY: wmY + 9.4,
      halfX: 2.02,
      halfZ: 2.02,
      rotY: -0.62,
      blocksCamera: true,
      climbable: true,
      active: true,
    }
  );

  // Stone Arch Bridge along the Whisperwood west road (walkable rotated deck + ramps + stone parapets!)
  const brX = -11.5;
  const brZ = 19.5;
  const brRot = 1.28;
  const brY = getTerrainHeight(brX, brZ);
  const bridge = buildStoneBridge(mats);
  bridge.position.set(brX, brY, brZ);
  bridge.rotation.y = brRot;
  group.add(bridge);
  const brCos = Math.cos(brRot);
  const brSin = Math.sin(brRot);
  colliders.push(
    // Walkable planked roadway deck
    {
      id: 'stone_bridge_deck',
      kind: 'box',
      x: brX,
      z: brZ,
      minY: brY - 0.8,
      maxY: brY + 0.56,
      halfX: 2.15,
      halfZ: 4.45,
      rotY: brRot,
      stepUp: true,
      blocksCamera: false,
      climbable: false,
      active: true,
    },
    // Smooth entry/exit ramp skirts at both bridge ends
    {
      id: 'stone_bridge_ramp_pos',
      kind: 'box',
      x: brX + 4.7 * brSin,
      z: brZ + 4.7 * brCos,
      minY: brY - 0.4,
      maxY: brY + 0.56,
      halfX: 2.1,
      halfZ: 0.75,
      rotY: brRot,
      ramp: { axis: 'z', dir: -1, lowY: brY - 0.15, highY: brY + 0.56 },
      blocksCamera: false,
      climbable: false,
      active: true,
    },
    {
      id: 'stone_bridge_ramp_neg',
      kind: 'box',
      x: brX - 4.7 * brSin,
      z: brZ - 4.7 * brCos,
      minY: brY - 0.4,
      maxY: brY + 0.56,
      halfX: 2.1,
      halfZ: 0.75,
      rotY: brRot,
      ramp: { axis: 'z', dir: 1, lowY: brY - 0.15, highY: brY + 0.56 },
      blocksCamera: false,
      climbable: false,
      active: true,
    },
    // Left & right carved stone parapet side walls
    {
      id: 'stone_bridge_parapet_l',
      kind: 'box',
      x: brX - 2.38 * brCos,
      z: brZ + 2.38 * brSin,
      minY: brY + 0.35,
      maxY: brY + 1.72,
      halfX: 0.36,
      halfZ: 4.38,
      rotY: brRot,
      blocksCamera: false,
      climbable: false,
      active: true,
    },
    {
      id: 'stone_bridge_parapet_r',
      kind: 'box',
      x: brX + 2.38 * brCos,
      z: brZ - 2.38 * brSin,
      minY: brY + 0.35,
      maxY: brY + 1.72,
      halfX: 0.36,
      halfZ: 4.38,
      rotY: brRot,
      blocksCamera: false,
      climbable: false,
      active: true,
    }
  );

  // Warm Road Lantern Posts lining the valley trails (with slim post collision cylinders)
  const lanternMats: THREE.MeshStandardMaterial[] = [];
  const lanternSpots: Array<[number, number, number]> = [
    [-3.1, 36.2, 0.25],
    [3.1, 28.5, -0.35],
    [-3.1, 16.0, 0.2],
    [10.2, 23.8, -0.8],
    [20.6, 24.4, 2.3],
    [2.8, -15.5, -0.2],
  ];
  for (let li = 0; li < lanternSpots.length; li++) {
    const [lx, lz, lrot] = lanternSpots[li];
    const ly = getTerrainHeight(lx, lz);
    const lan = buildRoadLantern(mats);
    lan.group.position.set(lx, ly, lz);
    lan.group.rotation.y = lrot;
    group.add(lan.group);
    lanternMats.push(lan.glowMat);
    occupiedZones.push({ x: lx, z: lz, r: 1.6 });
    colliders.push({
      id: `lantern_post_${li}`,
      kind: 'cylinder',
      x: lx,
      z: lz,
      minY: ly - 0.3,
      maxY: ly + 3.2,
      halfX: 0.34,
      halfZ: 0.34,
      blocksCamera: false,
      climbable: false,
      active: true,
    });
  }

  // Friendly Brackenford Villagers (with solid colliders so Wren never clips inside them!)
  const npcs: NpcProp[] = [];
  const npcSpecs: Array<{
    id: string;
    name: string;
    role: 'warden' | 'herbalist' | 'blacksmith';
    x: number;
    z: number;
    yaw: number;
  }> = [
    { id: 'mira', name: 'Mira the Herbalist', role: 'herbalist', x: 28.8, z: 19.6, yaw: -0.5 },
  ];
  for (const ns of npcSpecs) {
    const ny = getTerrainHeight(ns.x, ns.z);
    const mesh =
      ns.role === 'warden'
        ? buildNpcOdo(mats)
        : buildNpcVillager(mats, ns.role);
    mesh.position.set(ns.x, ny, ns.z);
    mesh.rotation.y = ns.yaw;
    group.add(mesh);
    npcs.push({ id: ns.id, name: ns.name, role: ns.role, x: ns.x, y: ny, z: ns.z, baseYaw: ns.yaw, group: mesh });
    colliders.push({
      id: `npc_${ns.id}`,
      kind: 'cylinder',
      x: ns.x,
      z: ns.z,
      minY: ny,
      maxY: ny + 2.0,
      halfX: 0.55,
      halfZ: 0.55,
      blocksCamera: false,
      climbable: false,
      active: true,
    });
  }

  // Village Fences & Hand-Laid Cobblestone Plazas
  const villageDecor = buildVillageFencesAndCobbles(mats, colliders);
  group.add(villageDecor);

  // 5. Campfires (Cooking + Thermal Updrafts!)
  const campfireSpecs = [
    { id: 'camp_overlook', x: -4.2, z: 42.2, withPot: true },
    { id: 'camp_village', x: 23.4, z: 24.6, withPot: true },
    { id: 'camp_whisper_fire', x: -24, z: 16, withPot: false },
    { id: 'camp_highland_fire', x: -28, z: -36, withPot: false },
  ];
  const campfires: CampfireProp[] = [];
  const updrafts: UpdraftZone[] = [];

  for (const cf of campfireSpecs) {
    const cy = getTerrainHeight(cf.x, cf.z);
    const built = buildCampfire(mats, cf.withPot);
    built.group.position.set(cf.x, cy, cf.z);
    group.add(built.group);
    campfires.push({
      id: cf.id,
      x: cf.x,
      y: cy,
      z: cf.z,
      withPot: cf.withPot,
      flame1: built.flame1,
      flame2: built.flame2,
      light: built.light,
    });
    updrafts.push({ x: cf.x, y: cy, z: cf.z, radius: 2.8, height: 11 });
    occupiedZones.push({ x: cf.x, z: cf.z, r: 3.8 });
    // Compact simplified collision ring around campfire stones/tripod so actors never stand inside the fire!
    colliders.push({
      id: `col_${cf.id}`,
      kind: 'cylinder',
      x: cf.x,
      z: cf.z,
      minY: cy - 0.2,
      maxY: cy + (cf.withPot ? 1.85 : 0.85),
      halfX: cf.withPot ? 0.96 : 0.78,
      halfZ: cf.withPot ? 0.96 : 0.78,
      blocksCamera: false,
      climbable: false,
      active: true,
    });
  }

  // Natural Wind Geysers
  const geyserSpots = [
    { x: -10, z: 8, height: 22 },
    { x: -33, z: -15, height: 20 },
    { x: 16, z: -26, height: 18 },
  ];
  for (const gs of geyserSpots) {
    const gy = getTerrainHeight(gs.x, gs.z);
    const vis = buildUpdraftVisual(mats, gs.height);
    vis.position.set(gs.x, gy + 0.4, gs.z);
    group.add(vis);
    updrafts.push({ x: gs.x, y: gy, z: gs.z, radius: 3.4, height: gs.height, mesh: vis });
  }

  // 6. Monster Watchtowers & Explosive Ember Barrels (exact rotated OBB proxies!)
  const towerSpots = [
    { x: -28, z: 13, rot: 0.5 },
    { x: 38, z: -30, rot: -0.9 },
    { x: -32, z: -39, rot: 0.8 },
  ];
  for (let i = 0; i < towerSpots.length; i++) {
    const ts = towerSpots[i];
    const ty = getTerrainHeight(ts.x, ts.z);
    const tw = buildMonsterWatchtower(mats);
    tw.position.set(ts.x, ty, ts.z);
    tw.rotation.y = ts.rot;
    group.add(tw);
    colliders.push({
      id: `watchtower_${i}`,
      kind: 'box',
      x: ts.x,
      z: ts.z,
      minY: ty - 0.4,
      maxY: ty + 3.58,
      halfX: 1.85,
      halfZ: 1.85,
      rotY: ts.rot,
      blocksCamera: true,
      climbable: true,
      active: true,
    });
    occupiedZones.push({ x: ts.x, z: ts.z, r: 3.5 });
  }

  const barrels: ExplosiveBarrelProp[] = [];
  const barrelSpots: Array<[number, number]> = [
    [-22.2, 17.6],
    [-25.8, 14.5],
    [32.5, -24.5],
    [35.4, -27.2],
    [-26.5, -34.2],
    [-29.6, -37.5],
  ];
  barrelSpots.forEach(([bx, bz], i) => {
    const by = getTerrainHeight(bx, bz);
    const mesh = buildExplosiveBarrel(mats);
    mesh.position.set(bx, by, bz);
    group.add(mesh);
    barrels.push({ id: `barrel_${i}`, x: bx, y: by, z: bz, exploded: false, group: mesh });
  });

  // 7. Cracked Blast Boulders
  const crackedBoulders: CrackedBoulderProp[] = [];
  const crackedSpots: Array<[string, number, number]> = [
    ['crack_canyon', 42.5, -6.5],
    ['crack_overlook_stash', 11.5, 42.0],
  ];
  for (const [id, cx, cz] of crackedSpots) {
    const cy = getTerrainHeight(cx, cz);
    const mesh = buildCrackedBoulder(mats);
    mesh.position.set(cx, cy, cz);
    group.add(mesh);
    const collider: SolidCollider = {
      id: `col_${id}`,
      kind: 'cylinder',
      x: cx,
      z: cz,
      minY: cy,
      maxY: cy + 2.6,
      halfX: 1.48,
      halfZ: 1.48,
      climbable: true,
      active: true,
    };
    colliders.push(collider);
    crackedBoulders.push({ id, x: cx, y: cy, z: cz, broken: false, group: mesh, collider });
  }

  // 8. Ancient Stillstone Boulders
  const stasisBoulders: StillstoneBoulderProp[] = [];
  const stasisSpots: Array<[string, number, number]> = [
    ['stasis_overlook', 8.8, 36.2],
    ['stasis_causeway', 5.4, -26.5],
    ['stasis_canyon', 38.2, -16.5],
  ];
  for (const [id, sx, sz] of stasisSpots) {
    const sy = getTerrainHeight(sx, sz);
    const built = buildStillstoneBoulder(mats);
    built.group.position.set(sx, sy, sz);
    group.add(built.group);
    const collider: SolidCollider = {
      id: `col_${id}`,
      kind: 'cylinder',
      x: sx,
      z: sz,
      minY: sy,
      maxY: sy + 1.85,
      halfX: 0.98,
      halfZ: 0.98,
      climbable: false,
      active: true,
    };
    colliders.push(collider);
    occupiedZones.push({ x: sx, z: sz, r: 2.2 });
    stasisBoulders.push({
      id,
      x: sx,
      y: sy,
      z: sz,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 0.98,
      stasisTimer: 0,
      stasisHits: 0,
      chargeDirX: 0,
      chargeDirZ: -1,
      group: built.group,
      coreMats: built.coreMats,
      arrowIndicator: built.arrowIndicator,
      collider,
    });
  }

  // 9. Treasure Chests (polygonOffset on sealRing prevents Z-fighting!)
  const chestSpecs: Array<{
    id: string;
    x: number;
    z: number;
    yOverride?: number;
    campId?: string;
    puzzleId?: PuzzleId;
    rewardText: string;
    arrows: number;
    marks: number;
    apples: number;
    heartContainer?: boolean;
  }> = [
    {
      id: 'chest_whisper',
      x: -24,
      z: 13.5,
      campId: 'camp_whisper',
      rewardText: '+10 Arrows · +30 Marks · +2 Apples',
      arrows: 10,
      marks: 30,
      apples: 2,
    },
    {
      id: 'chest_canyon',
      x: 34,
      z: -28.5,
      campId: 'camp_canyon',
      rewardText: '+12 Arrows · +40 Marks · +2 Apples',
      arrows: 12,
      marks: 40,
      apples: 2,
    },
    {
      id: 'chest_highland',
      x: -28,
      z: -38.5,
      campId: 'camp_highland',
      rewardText: '+1 Heartstone · +15 Arrows · +50 Marks',
      arrows: 15,
      marks: 50,
      apples: 1,
      heartContainer: true,
    },
    {
      id: 'chest_spire_summit',
      x: 0,
      z: 2.3,
      yOverride: spireY + 18.3,
      rewardText: 'Spire Stash: +15 Arrows · +60 Marks',
      arrows: 15,
      marks: 60,
      apples: 2,
    },
    {
      id: 'chest_overlook_secret',
      x: 13.4,
      z: 42.0,
      rewardText: 'Hidden Cache: +8 Arrows · +35 Marks',
      arrows: 8,
      marks: 35,
      apples: 2,
    },
    {
      id: 'chest_puzzle_chimes',
      x: -5.2,
      z: 20.4,
      puzzleId: 'chime_bells',
      rewardText: 'Resonance Relic Chest: +10 Arrows · +45 Marks · +1 Apple',
      arrows: 10,
      marks: 45,
      apples: 1,
    },
    {
      id: 'chest_puzzle_stasis',
      x: 16.6,
      z: 29.0,
      puzzleId: 'stasis_socket',
      rewardText: 'Stillstone Vault Chest: +1 Heartstone · +40 Marks',
      arrows: 6,
      marks: 40,
      apples: 1,
      heartContainer: true,
    },
    {
      id: 'chest_puzzle_braziers',
      x: 3.8,
      z: 9.6,
      puzzleId: 'dawn_braziers',
      rewardText: 'Spire Brazier Chest: +15 Arrows · +55 Marks · +2 Apples',
      arrows: 15,
      marks: 55,
      apples: 2,
    },
    {
      id: 'chest_ashen_wilds',
      x: 32.0,
      z: -146.5,
      rewardText: 'Ashen Wilds Hoard: +1 Heartstone · +120 Marks · +15 Arrows',
      arrows: 15,
      marks: 120,
      apples: 2,
      heartContainer: true,
    },
    {
      id: 'chest_sunscorch_pyramid',
      x: 118.2,
      z: 60.0,
      rewardText: 'Pharaoh Cache: +85 Marks · +12 Arrows · +2 Apples',
      arrows: 12,
      marks: 85,
      apples: 2,
    },
  ];

  const chests: ChestProp[] = [];
  for (const cs of chestSpecs) {
    const cy = cs.yOverride ?? getTerrainHeight(cs.x, cs.z);
    const built = buildTreasureChest(mats);
    built.group.position.set(cs.x, cy, cs.z);
    group.add(built.group);

    let sealRing: THREE.Mesh | undefined;
    if (cs.campId || cs.puzzleId) {
      sealRing = new THREE.Mesh(
        new THREE.RingGeometry(0.95, 1.18, 16),
        new THREE.MeshBasicMaterial({
          color: cs.puzzleId ? 0x5ef2e6 : 0xff5a4a,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        })
      );
      sealRing.rotation.x = -Math.PI / 2;
      sealRing.position.y = 0.08;
      sealRing.renderOrder = 3;
      built.group.add(sealRing);
    }

    chests.push({
      id: cs.id,
      x: cs.x,
      y: cy,
      z: cs.z,
      campId: cs.campId,
      puzzleId: cs.puzzleId,
      rewardText: cs.rewardText,
      arrows: cs.arrows,
      marks: cs.marks,
      apples: cs.apples,
      heartContainer: cs.heartContainer,
      opened: false,
      openAnim: 0,
      group: built.group,
      lid: built.lid,
      glow: built.glow,
      sealRing,
    });
    colliders.push({
      id: `col_${cs.id}`,
      kind: 'box',
      x: cs.x,
      z: cs.z,
      minY: cy,
      maxY: cy + 0.95,
      halfX: 0.68,
      halfZ: 0.52,
      blocksCamera: false,
      climbable: false,
      active: true,
    });
  }

  // 10. Signposts
  const signs: SignProp[] = [
    {
      id: 'sign_overlook',
      x: 3.4,
      y: getTerrainHeight(3.4, 42.4),
      z: 42.4,
      title: 'Awakening Overlook',
      text: 'North: The Dawnbell Spire & Azure Mirror Lake. East: Brackenford Outpost & Shrine of Embers. West: Windcrest Bluff & Shrine of Wind. Leap & tap Space mid-air to Paraglide!',
    },
    {
      id: 'sign_crossroads',
      x: 3.8,
      y: getTerrainHeight(3.8, 25.5),
      z: 25.5,
      title: 'Kingdom Crossroads',
      text: 'North: Dawnbell Spire, Azure Mirror Lake & Highcrown Square. East: Brackenford Keep, River Bracken & Sunscorch Desert. West: Whisperwood, Druidic Stone Circle & Frostpeak. Southwest: Wizards’ Sea Tower.',
    },
    {
      id: 'sign_chimes_hint',
      x: -5.2,
      y: getTerrainHeight(-5.2, 25.2),
      z: 25.2,
      title: 'Resonance Bell Stele',
      text: 'Ancient Inscription: "Sound the three Bells from bright dawn to ember dusk — first GOLD, then TEAL, then CORAL — by blade, arrow, or hand to unseal the Bell-Keeper’s vault."',
    },
    {
      id: 'sign_wilds_ditch',
      x: 16.5,
      y: getTerrainHeight(16.5, -124.0),
      z: -124.0,
      title: 'Wilderness Warning!',
      text: 'HEED THIS WARNING: Beyond this stone ditch lie The Ashen Wilds. Ancient volcanic obelisks, rich mithril veins, and perilous treasure await brave adventurers!',
    },
  ];
  for (const sg of signs) {
    const m = buildSignpost(mats);
    m.position.set(sg.x, sg.y, sg.z);
    m.rotation.y = sg.id === 'sign_overlook' ? 0.35 : -0.4;
    group.add(m);
    occupiedZones.push({ x: sg.x, z: sg.z, r: 1.5 });
    colliders.push({
      id: `col_${sg.id}`,
      kind: 'cylinder',
      x: sg.x,
      z: sg.z,
      minY: sg.y - 0.2,
      maxY: sg.y + 1.9,
      halfX: 0.36,
      halfZ: 0.36,
      blocksCamera: false,
      climbable: false,
      active: true,
    });
  }

  // 11. Collectible Wild Apples & Golden Marks
  const pickups: PickupProp[] = [];
  const pickupSpots: Array<{ kind: 'apple' | 'mark'; x: number; z: number; amount: number }> = [
    { kind: 'apple', x: -5.4, z: 43.2, amount: 1 },
    { kind: 'apple', x: -3.2, z: 40.6, amount: 1 },
    { kind: 'apple', x: 26.2, z: 24.5, amount: 1 },
    { kind: 'apple', x: 27.6, z: 16.5, amount: 1 },
    { kind: 'apple', x: -14, z: 22, amount: 1 },
    { kind: 'apple', x: -38, z: -18, amount: 1 },
    { kind: 'mark', x: -1.5, z: 32, amount: 5 },
    { kind: 'mark', x: 0.5, z: 18, amount: 5 },
    { kind: 'mark', x: 14, z: 23, amount: 5 },
    { kind: 'mark', x: 38, z: 4, amount: 10 },
    { kind: 'mark', x: 2, z: -34, amount: 10 },
    { kind: 'mark', x: -42, z: -24, amount: 10 },
  ];
  pickupSpots.forEach((p, idx) => {
    const py = getTerrainHeight(p.x, p.z);
    const mesh = p.kind === 'apple' ? buildApplePickup(mats) : buildMarkPickup(mats);
    mesh.position.set(p.x, py + 0.16, p.z);
    group.add(mesh);
    pickups.push({
      id: `pick_${idx}`,
      kind: p.kind,
      x: p.x,
      y: py + 0.16,
      z: p.z,
      amount: p.amount,
      collected: false,
      mesh,
      phase: idx * 0.9,
    });
  });

  // 12. Hidden Whisper-Sprite Secrets
  const whisperSecrets: WhisperSecretProp[] = [];
  const secretSpecs: Array<{
    id: string;
    kind: 'pinwheel' | 'balloon';
    x: number;
    z: number;
    yOffset?: number;
    yOverride?: number;
  }> = [
    { id: 'seed_overlook_pinwheel', kind: 'pinwheel', x: -7.4, z: 43.2 },
    { id: 'seed_spire_pinwheel', kind: 'pinwheel', x: 1.9, z: -1.9, yOverride: spireY + 18.3 },
    { id: 'seed_windcrest_pinwheel', kind: 'pinwheel', x: -41.5, z: -16.2 },
    { id: 'seed_meadow_balloon', kind: 'balloon', x: -9.5, z: 29.0, yOffset: 5.2 },
    { id: 'seed_lake_balloon', kind: 'balloon', x: 13.5, z: -41.5, yOffset: 5.6 },
    { id: 'seed_canyon_balloon', kind: 'balloon', x: 35.5, z: -5.5, yOffset: 5.8 },
  ];

  secretSpecs.forEach((sp, idx) => {
    const baseY = sp.yOverride ?? Math.max(WATER_Y + 0.3, getTerrainHeight(sp.x, sp.z));
    const y = baseY + (sp.yOffset ?? 0);
    const holder = new THREE.Group();
    holder.position.set(sp.x, y, sp.z);
    group.add(holder);

    const sprite = buildWhisperSprite(mats);
    sprite.visible = false;
    sprite.position.set(0, sp.kind === 'balloon' ? 0 : 0.25, 0);
    holder.add(sprite);

    if (sp.kind === 'pinwheel') {
      const pw = buildPinwheelSecret(mats);
      holder.add(pw.group);
      whisperSecrets.push({
        id: sp.id,
        kind: 'pinwheel',
        x: sp.x,
        y,
        z: sp.z,
        found: false,
        group: holder,
        blades: pw.blades,
        sprite,
        phase: idx * 1.1,
      });
    } else {
      const balloon = buildBalloonTarget(mats);
      holder.add(balloon);
      whisperSecrets.push({
        id: sp.id,
        kind: 'balloon',
        x: sp.x,
        y,
        z: sp.z,
        found: false,
        group: holder,
        balloon,
        sprite,
        phase: idx * 1.3,
      });
    }
  });

  // 13. Rich Living Wildlife: Sky-Birds, Articulated Woodland Foxes, Meadow Deer, Lake Ducks & Butterflies!
  const birds: SkyBirdProp[] = [];
  const birdSpecs = [
    { cx: 0, cz: 0, r: 16, alt: 24, speed: 0.42 },
    { cx: 2, cz: -4, r: 22, alt: 27, speed: -0.35 },
    { cx: -28, cz: -14, r: 15, alt: 26, speed: 0.48 },
    { cx: 24, cz: 16, r: 14, alt: 20, speed: 0.38 },
    { cx: 4, cz: -46, r: 18, alt: 19, speed: -0.44 },
  ];
  birdSpecs.forEach((bs, idx) => {
    const built = buildSkyBird(mats);
    group.add(built.group);
    birds.push({
      group: built.group,
      wingL: built.wingL,
      wingR: built.wingR,
      centerX: bs.cx,
      centerZ: bs.cz,
      radius: bs.r,
      altitude: bs.alt,
      angle: idx * 1.25,
      speed: bs.speed,
    });
  });

  const foxes: MeadowFoxProp[] = [];
  const foxHomes: Array<[number, number]> = [
    [8.8, 33.5],
    [-9.2, 31.2],
    [15.0, 6.0],
    [-18.5, -8.0],
  ];
  foxHomes.forEach(([fx, fz], idx) => {
    const built = buildMeadowFox(mats);
    const fy = getTerrainHeight(fx, fz);
    built.group.position.set(fx, fy, fz);
    built.contactShadow.position.set(fx, fy + 0.05, fz);
    group.add(built.group);
    group.add(built.contactShadow);
    foxes.push({
      group: built.group,
      tail: built.tail,
      legs: built.legs,
      contactShadow: built.contactShadow,
      homeX: fx,
      homeZ: fz,
      x: fx,
      z: fz,
      yaw: idx * 1.4,
      angle: idx * 1.7,
      scaredTimer: 0,
    });
  });

  const deer: MeadowDeerProp[] = [];
  const deerSpecs: Array<{ x: number; z: number; antlers: boolean }> = [
    { x: -11.5, z: 27.0, antlers: true }, // Majestic Stag visible from Awakening Overlook!
    { x: -14.2, z: 24.5, antlers: false }, // Doe companion
    { x: 14.5, z: -7.5, antlers: true }, // East glade Stag
    { x: -20.0, z: -22.5, antlers: false }, // Highland Doe
  ];
  deerSpecs.forEach((ds, idx) => {
    const built = buildMeadowDeer(mats, ds.antlers);
    const dy = getTerrainHeight(ds.x, ds.z);
    built.group.position.set(ds.x, dy, ds.z);
    built.contactShadow.position.set(ds.x, dy + 0.05, ds.z);
    group.add(built.group);
    group.add(built.contactShadow);
    deer.push({
      group: built.group,
      headGroup: built.headGroup,
      legs: built.legs,
      contactShadow: built.contactShadow,
      homeX: ds.x,
      homeZ: ds.z,
      x: ds.x,
      z: ds.z,
      yaw: idx * 1.6,
      angle: idx * 2.1,
      scaredTimer: 0,
      phase: idx * 1.3,
    });
  });

  const ducks: LakeDuckProp[] = [];
  const duckSpecs = [
    { cx: -6, cz: -48, r: 4.5, speed: 0.36 },
    { cx: 11, cz: -52, r: 5.2, speed: -0.32 },
    { cx: -3, cz: -62, r: 4.0, speed: 0.4 },
    { cx: 12, cz: -42, r: 3.6, speed: -0.38 },
  ];
  duckSpecs.forEach((dk, idx) => {
    const mesh = buildLakeDuck(mats);
    group.add(mesh);
    ducks.push({
      group: mesh,
      centerX: dk.cx,
      centerZ: dk.cz,
      radius: dk.r,
      angle: idx * 1.5,
      speed: dk.speed,
    });
  });

  const butterflies: ButterflyProp[] = [];
  const bfColors = ['#ffe066', '#ff8cb8', '#78dcff', '#a8f278'];
  const bfSpots: Array<[number, number]> = [
    [-5.2, 41.2],
    [4.4, 37.0],
    [19.5, 22.5],
    [27.2, 16.2],
    [-8.0, 26.5],
    [6.5, 16.5],
    [-16.0, 12.0],
    [12.0, -10.5],
  ];
  bfSpots.forEach(([bx, bz], idx) => {
    const built = buildButterfly(mats, bfColors[idx % bfColors.length]);
    const by = getTerrainHeight(bx, bz) + 1.15;
    built.group.position.set(bx, by, bz);
    group.add(built.group);
    butterflies.push({
      group: built.group,
      wingL: built.wingL,
      wingR: built.wingR,
      homeX: bx,
      homeY: by,
      homeZ: bz,
      phase: idx * 1.15,
    });
  });

  // 14. Starlight Dome & Drifting Sunlit Pollen / Twilight Fireflies!
  const starCount = 260;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = hash2(i, 501) * Math.PI * 2;
    const phi = 0.2 + hash2(i, 607) * 1.12;
    const r = 175;
    starPositions[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
    starPositions[i * 3 + 1] = Math.sin(phi) * r;
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xfff5d4,
    size: 2.0,
    transparent: true,
    opacity: 0,
    fog: false,
  });
  const starsMesh = new THREE.Points(starGeo, starMat);
  group.add(starsMesh);

  const fireflyCount = 110;
  const ffPositions = new Float32Array(fireflyCount * 3);
  for (let i = 0; i < fireflyCount; i++) {
    const a = hash2(i, 701) * Math.PI * 2;
    const d = 5 + Math.sqrt(hash2(i, 702)) * 58;
    const fx = Math.cos(a) * d;
    const fz = Math.sin(a) * d + 8;
    const fy = Math.max(WATER_Y + 0.8, getTerrainHeight(fx, fz)) + 1.0 + hash2(i, 703) * 4.5;
    ffPositions[i * 3] = fx;
    ffPositions[i * 3 + 1] = fy;
    ffPositions[i * 3 + 2] = fz;
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPositions, 3));
  const ffMat = new THREE.PointsMaterial({
    color: 0xfff3b2,
    map: mats.softGlowTex,
    size: 0.72,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const firefliesMesh = new THREE.Points(ffGeo, ffMat);
  group.add(firefliesMesh);

  // 14B. Interactive 3D Environmental Puzzles, Bram's Archery Targets & Mineable Ore Veins
  const chimeSpecs: Array<{ id: string; color: ChimeBellColor; label: string; hex: string; x: number; z: number }> = [
    { id: 'bell_gold', color: 'gold', label: 'Dawn Gold Bell', hex: '#f4ca4c', x: -7.4, z: 22.8 },
    { id: 'bell_teal', color: 'teal', label: 'Wind Teal Bell', hex: '#52e8ce', x: -5.2, z: 22.8 },
    { id: 'bell_coral', color: 'coral', label: 'Ember Coral Bell', hex: '#f2725c', x: -3.0, z: 22.8 },
  ];
  const chimeBells: ChimeBellProp[] = [];
  for (const bs of chimeSpecs) {
    const by = getTerrainHeight(bs.x, bs.z);
    const built = buildChimeBell(mats, bs.hex);
    built.group.position.set(bs.x, by, bs.z);
    group.add(built.group);
    chimeBells.push({
      id: bs.id,
      color: bs.color,
      label: bs.label,
      x: bs.x,
      y: by,
      z: bs.z,
      swingVel: 0,
      swingAngle: 0,
      lit: false,
      group: built.group,
      bell: built.bell,
      glowMat: built.glowMat,
    });
    colliders.push({
      id: `col_${bs.id}`,
      kind: 'box',
      x: bs.x,
      z: bs.z,
      minY: by - 0.2,
      maxY: by + 2.9,
      halfX: 0.72,
      halfZ: 0.72,
      blocksCamera: false,
      climbable: false,
      active: true,
    });
  }

  // Puzzle 2: Heavy Stone Runic Socket downslope from stasis_overlook (8.8, 36.2)
  const sockX = 13.2;
  const sockZ = 29.0;
  const sockY = getTerrainHeight(sockX, sockZ);
  const builtSocket = buildRunicSocket(mats);
  builtSocket.group.position.set(sockX, sockY, sockZ);
  group.add(builtSocket.group);
  const runicSocket: RunicSocketProp = {
    x: sockX,
    y: sockY,
    z: sockZ,
    locked: false,
    group: builtSocket.group,
    runeMat: builtSocket.runeMat,
    beacons: builtSocket.beacons,
  };

  // Puzzle 3: The Three Unlit Dawn Braziers ringing Dawnbell Spire Plaza
  const brazierSpecs: Array<{ id: string; x: number; z: number }> = [
    { id: 'brazier_spire_sw', x: -8.8, z: 7.6 },
    { id: 'brazier_spire_se', x: 8.8, z: 7.6 },
    { id: 'brazier_spire_n', x: 0.0, z: -9.8 },
  ];
  const dawnBraziers: DawnBrazierProp[] = [];
  for (const br of brazierSpecs) {
    const by = getTerrainHeight(br.x, br.z);
    const built = buildDawnBrazier(mats);
    built.group.position.set(br.x, by, br.z);
    group.add(built.group);
    dawnBraziers.push({
      id: br.id,
      x: br.x,
      y: by,
      z: br.z,
      lit: false,
      group: built.group,
      flame1: built.flame1,
      flame2: built.flame2,
      light: built.light,
    });
    colliders.push({
      id: `col_${br.id}`,
      kind: 'cylinder',
      x: br.x,
      z: br.z,
      minY: by - 0.2,
      maxY: by + 2.1,
      halfX: 0.72,
      halfZ: 0.72,
      blocksCamera: false,
      climbable: false,
      active: true,
    });
  }

  // Side Quest: Bram's 3 Crimson Archery Targets around Brackenford Keep
  const targetSpecs: Array<{ id: string; x: number; z: number; rotY: number }> = [
    { id: 'target_1', x: 34.5, z: 29.5, rotY: -2.4 },
    { id: 'target_2', x: 37.5, z: 16.0, rotY: -1.6 },
    { id: 'target_3', x: 18.5, z: 30.2, rotY: 2.3 },
  ];
  const archeryTargets: ArcheryTargetProp[] = [];
  for (const ts of targetSpecs) {
    const ty = getTerrainHeight(ts.x, ts.z);
    const built = buildArcheryTarget(mats);
    built.group.position.set(ts.x, ty, ts.z);
    built.group.rotation.y = ts.rotY;
    group.add(built.group);
    archeryTargets.push({
      id: ts.id,
      x: ts.x,
      y: ty,
      z: ts.z,
      hit: false,
      hitAnim: 0,
      group: built.group,
      board: built.board,
    });
    colliders.push({
      id: `col_${ts.id}`,
      kind: 'cylinder',
      x: ts.x,
      z: ts.z,
      minY: ty - 0.2,
      maxY: ty + 2.4,
      halfX: 0.72,
      halfZ: 0.72,
      blocksCamera: false,
      climbable: false,
      active: true,
    });
  }

  // classic MMO-Style Mineable Ore Veins across Quarry, Canyon & Ashen Wilds
  const oreSpecs: Array<{ id: string; tier: 'copper' | 'gold' | 'mithril'; marks: number; x: number; z: number }> = [
    { id: 'ore_canyon_copper', tier: 'copper', marks: 15, x: 54.0, z: -14.5 },
    { id: 'ore_quarry_copper', tier: 'copper', marks: 15, x: 101.5, z: -24.0 },
    { id: 'ore_quarry_gold1', tier: 'gold', marks: 25, x: 109.0, z: -32.5 },
    { id: 'ore_quarry_gold2', tier: 'gold', marks: 25, x: 114.5, z: -24.5 },
    { id: 'ore_quarry_mithril', tier: 'mithril', marks: 40, x: 105.5, z: -35.0 },
    { id: 'ore_wilds_mithril1', tier: 'mithril', marks: 45, x: 25.5, z: -144.0 },
    { id: 'ore_wilds_mithril2', tier: 'mithril', marks: 45, x: 39.5, z: -149.0 },
  ];
  const oreVeins: OreVeinProp[] = [];
  for (const os of oreSpecs) {
    const oy = getTerrainHeight(os.x, os.z);
    const built = buildOreVein(mats, os.tier);
    built.group.position.set(os.x, oy, os.z);
    built.group.rotation.y = hash2(os.x, os.z) * Math.PI * 2;
    group.add(built.group);
    oreVeins.push({
      id: os.id,
      tier: os.tier,
      marks: os.marks,
      x: os.x,
      y: oy,
      z: os.z,
      mined: false,
      group: built.group,
      crystalGroup: built.crystalGroup,
    });
    colliders.push({
      id: `col_${os.id}`,
      kind: 'cylinder',
      x: os.x,
      z: os.z,
      minY: oy - 0.2,
      maxY: oy + 1.8,
      halfX: 1.05,
      halfZ: 1.05,
      blocksCamera: false,
      climbable: false,
      active: true,
    });
  }

  // 14C. VAST RUNESCAPE-INSPIRED LANDMARKS & LIVING KINGDOM
  // 1) Brackenford Keep Gatehouse (old castle feel) & River Bracken Stone Bridge
  const keepX = 38.0;
  const keepZ = 22.0;
  const keepY = getTerrainHeight(keepX, keepZ);
  const keepGate = buildCastleGatehouse(mats, '#2b66c2', '#9ea5b0');
  keepGate.position.set(keepX, keepY, keepZ);
  keepGate.rotation.y = -Math.PI / 2;
  group.add(keepGate);
  for (const s of [-1, 1]) {
    colliders.push({
      id: `hearthbrook_keep_tower_${s}`,
      kind: 'box',
      x: keepX,
      z: keepZ + s * 4.4,
      minY: keepY - 0.5,
      maxY: keepY + 11.2,
      halfX: 2.1,
      halfZ: 2.1,
      blocksCamera: true,
      climbable: true,
      active: true,
    });
  }

  // River Bracken Stone Arch Bridge connecting Brackenford Keep to Sunscorch Desert Gate
  const lumBridgeX = getRiverLumX(36);
  const lumBridgeY = WATER_Y + 0.65;
  const lumBridge = buildStoneBridge(mats);
  lumBridge.position.set(lumBridgeX, lumBridgeY, 36);
  lumBridge.rotation.y = 0.22;
  group.add(lumBridge);
  colliders.push({
    id: 'river_lum_bridge_deck',
    kind: 'box',
    x: lumBridgeX,
    z: 36,
    minY: lumBridgeY - 0.6,
    maxY: lumBridgeY + 0.72,
    halfX: 4.8,
    halfZ: 2.2,
    rotY: 0.22,
    stepUp: true,
    blocksCamera: false,
    climbable: false,
    active: true,
  });

  // classic Livestock Pasture (fluffy Sheep & Dairy Cows south of Brackenford Windmill!)
  const pastureAnimals: PastureAnimalProp[] = [];
  const pastureSpecs: Array<{ kind: 'sheep' | 'cow'; x: number; z: number }> = [
    { kind: 'sheep', x: 16.5, z: 34.5 },
    { kind: 'sheep', x: 20.2, z: 36.8 },
    { kind: 'sheep', x: 17.8, z: 38.6 },
    { kind: 'sheep', x: 22.8, z: 35.2 },
    { kind: 'cow', x: 31.0, z: 34.0 },
    { kind: 'cow', x: 35.2, z: 36.2 },
    { kind: 'cow', x: 28.5, z: 38.0 },
  ];
  pastureSpecs.forEach((ps, idx) => {
    const py = getTerrainHeight(ps.x, ps.z);
    const built = ps.kind === 'sheep' ? buildPastureSheep(mats) : buildPastureCow(mats);
    built.group.position.set(ps.x, py, ps.z);
    built.contactShadow.position.set(ps.x, py + 0.05, ps.z);
    group.add(built.group);
    group.add(built.contactShadow);
    pastureAnimals.push({
      kind: ps.kind,
      group: built.group,
      head: built.head,
      contactShadow: built.contactShadow,
      homeX: ps.x,
      homeZ: ps.z,
      x: ps.x,
      z: ps.z,
      yaw: idx * 1.1,
      phase: idx * 1.35,
    });
  });

  // 2) Highcrown Square (old-world Walled Market City north of Azure Mirror Lake!)
  const valX = -6;
  const valZ = -106;
  const valY = getTerrainHeight(valX, valZ);
  const valFountain = buildGrandFountain(mats);
  valFountain.position.set(valX, valY, valZ);
  group.add(valFountain);
  colliders.push({
    id: 'valenrock_fountain',
    kind: 'box',
    x: valX,
    z: valZ,
    minY: valY - 0.3,
    maxY: valY + 1.4,
    halfX: 2.75,
    halfZ: 2.75,
    blocksCamera: false,
    climbable: false,
    active: true,
  });

  // Highcrown South Castle Gatehouse facing the lake causeway
  const valGate = buildCastleGatehouse(mats, '#b83232', '#9ea2aa');
  valGate.position.set(valX, getTerrainHeight(valX, valZ + 17), valZ + 17);
  group.add(valGate);
  for (const s of [-1, 1]) {
    const gx = valX + s * 4.4;
    const gz = valZ + 17;
    const gy = getTerrainHeight(gx, gz);
    colliders.push({
      id: `valenrock_gate_tower_${s}`,
      kind: 'box',
      x: gx,
      z: gz,
      minY: gy - 0.5,
      maxY: gy + 11.2,
      halfX: 2.1,
      halfZ: 2.1,
      blocksCamera: true,
      climbable: true,
      active: true,
    });
  }

  // Timbered Highcrown Townhouses & Great Market Market Stalls ringing Highcrown Square!
  const valHouses: Array<{ x: number; z: number; rot: number; roof: string }> = [
    { x: valX - 15.5, z: valZ - 6, rot: Math.PI / 2, roof: '#8c3b2e' },
    { x: valX + 15.5, z: valZ - 6, rot: -Math.PI / 2, roof: '#3c6896' },
    { x: valX - 10.5, z: valZ - 16, rot: 0, roof: '#a86b32' },
    { x: valX + 10.5, z: valZ - 16, rot: 0, roof: '#467c46' },
  ];
  valHouses.forEach((vh, idx) => {
    const hy = getTerrainHeight(vh.x, vh.z);
    const cot = buildCottage(mats, { w: 5.8, d: 4.8, roofColor: vh.roof, hasChimney: idx % 2 === 0 });
    cot.position.set(vh.x, hy, vh.z);
    cot.rotation.y = vh.rot;
    group.add(cot);
    colliders.push({
      id: `valenrock_house_${idx}`,
      kind: 'box',
      x: vh.x,
      z: vh.z,
      minY: hy - 0.4,
      maxY: hy + 4.4,
      halfX: 3.3,
      halfZ: 2.8,
      rotY: vh.rot,
      blocksCamera: true,
      climbable: true,
      active: true,
    });
  });

  const valStalls: Array<[number, number, number, string]> = [
    [valX - 8.5, valZ + 5.5, 0.5, '#c84236'],
    [valX + 8.5, valZ + 5.5, -0.5, '#3478c6'],
    [valX + 9.5, valZ - 6.0, -1.8, '#e0a232'],
  ];
  valStalls.forEach(([sx, sz, rot, col], idx) => {
    const sy = getTerrainHeight(sx, sz);
    const stall = buildMarketStall(mats, col);
    stall.position.set(sx, sy, sz);
    stall.rotation.y = rot;
    group.add(stall);
    colliders.push({
      id: `valenrock_stall_${idx}`,
      kind: 'box',
      x: sx,
      z: sz,
      minY: sy - 0.2,
      maxY: sy + 2.5,
      halfX: 1.55,
      halfZ: 1.05,
      rotY: rot,
      blocksCamera: false,
      climbable: false,
      active: true,
    });
  });

  // Highcrown Great Market Merchant NPC
  const merchX = valX - 4.2;
  const merchZ = valZ + 5.2;
  const merchBuilt = buildNpcVillager(mats, 'merchant');
  merchBuilt.position.set(merchX, getTerrainHeight(merchX, merchZ), merchZ);
  merchBuilt.rotation.y = 0.6;
  group.add(merchBuilt);
  npcs.push({
    id: 'npc_merchant_rowan',
    name: 'Merchant Rowan',
    role: 'merchant',
    x: merchX,
    y: getTerrainHeight(merchX, merchZ),
    z: merchZ,
    baseYaw: 0.6,
    group: merchBuilt,
  });

  // 3) Wizards' Sea Tower (SW Island + Sea Causeway Lanterns!)
  const wizX = -96;
  const wizZ = 96;
  const wizY = getTerrainHeight(wizX, wizZ);
  const wizTower = buildWizardsTower(mats);
  wizTower.group.position.set(wizX, wizY, wizZ);
  group.add(wizTower.group);
  colliders.push({
    id: 'wizards_tower_core',
    kind: 'box',
    x: wizX,
    z: wizZ,
    minY: wizY - 0.5,
    maxY: wizY + 17.0,
    halfX: 4.5,
    halfZ: 4.5,
    blocksCamera: true,
    climbable: true,
    active: true,
  });

  // Archmage NPC outside Wizards' Sea Tower
  const mageX = wizX + 7.2;
  const mageZ = wizZ - 5.5;
  const mageBuilt = buildNpcVillager(mats, 'wizard');
  mageBuilt.position.set(mageX, getTerrainHeight(mageX, mageZ), mageZ);
  mageBuilt.rotation.y = 2.4;
  group.add(mageBuilt);
  npcs.push({
    id: 'npc_archmage_sedric',
    name: 'Archmage Sedric',
    role: 'wizard',
    x: mageX,
    y: getTerrainHeight(mageX, mageZ),
    z: mageZ,
    baseYaw: 2.4,
    group: mageBuilt,
  });

  // 4) Sunscorch Desert Border Gate, Oasis Bazaar & Stepped Sandstone Pyramid (Al-Kharid!)
  const dGateX = 74;
  const dGateZ = 48;
  const dGateY = getTerrainHeight(dGateX, dGateZ);
  const desertGate = buildDesertGate(mats);
  desertGate.position.set(dGateX, dGateY, dGateZ);
  desertGate.rotation.y = -0.98;
  group.add(desertGate);
  for (const s of [-1, 1]) {
    const px = dGateX + Math.cos(-0.98) * s * 4.0;
    const pz = dGateZ - Math.sin(-0.98) * s * 4.0;
    colliders.push({
      id: `desert_gate_pillar_${s}`,
      kind: 'box',
      x: px,
      z: pz,
      minY: dGateY - 0.4,
      maxY: dGateY + 7.2,
      halfX: 1.5,
      halfZ: 1.5,
      blocksCamera: true,
      climbable: true,
      active: true,
    });
  }

  const pyrX = 130;
  const pyrZ = 60;
  const pyrY = getTerrainHeight(pyrX, pyrZ);
  const pyramid = buildDesertPyramid(mats);
  pyramid.position.set(pyrX, pyrY, pyrZ);
  group.add(pyramid);
  const pyrTiers = [
    { half: 9.0, maxY: 2.2 },
    { half: 7.3, maxY: 4.4 },
    { half: 5.7, maxY: 6.6 },
    { half: 4.1, maxY: 8.8 },
    { half: 2.6, maxY: 11.0 },
    { half: 1.3, maxY: 12.8 },
  ];
  pyrTiers.forEach((pt, idx) => {
    colliders.push({
      id: `pyramid_tier_${idx}`,
      kind: 'box',
      x: pyrX,
      z: pyrZ,
      minY: pyrY + idx * 2.2 - 0.3,
      maxY: pyrY + pt.maxY,
      halfX: pt.half,
      halfZ: pt.half,
      blocksCamera: true,
      climbable: true,
      active: true,
    });
  });

  // Oasis Market Stall
  const oasisStall = buildMarketStall(mats, '#d84a38');
  oasisStall.position.set(112, getTerrainHeight(112, 70), 70);
  oasisStall.rotation.y = -0.7;
  group.add(oasisStall);

  // 5) Dwarven Quarry Guildmaster Keldor
  const keldorX = 104.5;
  const keldorZ = -26.5;
  const keldorBuilt = buildNpcVillager(mats, 'prospector');
  keldorBuilt.position.set(keldorX, getTerrainHeight(keldorX, keldorZ), keldorZ);
  keldorBuilt.rotation.y = -1.4;
  group.add(keldorBuilt);
  npcs.push({
    id: 'npc_guildmaster_keldor',
    name: 'Guildmaster Keldor',
    role: 'prospector',
    x: keldorX,
    y: getTerrainHeight(keldorX, keldorZ),
    z: keldorZ,
    baseYaw: -1.4,
    group: keldorBuilt,
  });

  // 6) Druidic Stone Circle (West Glade)
  const scX = -84;
  const scZ = 6;
  const scY = getTerrainHeight(scX, scZ);
  const stoneCircle = buildDruidicStoneCircle(mats);
  stoneCircle.position.set(scX, scY, scZ);
  group.add(stoneCircle);
  colliders.push({
    id: 'stone_circle_altar',
    kind: 'box',
    x: scX,
    z: scZ,
    minY: scY - 0.2,
    maxY: scY + 1.8,
    halfX: 1.85,
    halfZ: 1.85,
    blocksCamera: false,
    climbable: false,
    active: true,
  });

  // 7) The Ashen Wilds Obsidian Obelisk & Wilderness Border Ditch Stones
  const obX = 32;
  const obZ = -152;
  const obY = getTerrainHeight(obX, obZ);
  const wildsObelisk = buildWildernessObelisk(mats);
  wildsObelisk.position.set(obX, obY, obZ);
  group.add(wildsObelisk);
  colliders.push({
    id: 'ashen_wilds_obelisk',
    kind: 'box',
    x: obX,
    z: obZ,
    minY: obY - 0.3,
    maxY: obY + 12.2,
    halfX: 2.2,
    halfZ: 2.2,
    blocksCamera: true,
    climbable: true,
    active: true,
  });

  // Low stone Wilderness Border Ditch along z = -124 (classic classic MMO Wilderness boundary!)
  const ditchStone = mats.getMat('#4c4a52', { roughness: 0.94, bump: 'stone' });
  const lavaWarn = mats.getMat('#ff5e28', { emissive: '#ff3c10', emissiveIntensity: 1.4 });
  for (let dx = -12; dx <= 52; dx += 8) {
    if (Math.abs(dx - 18) < 5) continue; // road opening
    const dy = getTerrainHeight(dx, -124);
    addVoxelBox(group, 6.2, 0.9, 1.4, ditchStone, dx, dy + 0.35, -124);
    if (dx % 16 === 0) {
      addVoxelBox(group, 0.5, 1.5, 0.5, ditchStone, dx, dy + 1.1, -124);
      addVoxelBox(group, 0.4, 0.4, 0.4, lavaWarn, dx, dy + 2.0, -124, false, false);
    }
  }

  // 8) classic MMO-Style Home-Teleport Lodestone Pads at every Fast-Travel Hub!
  const lodestoneSpots: Array<[number, number, string]> = [
    [22.0, 26.5, '#62e8ff'], // Brackenford Keep Lodestone
    [-6.0, -96.5, '#f2ca58'], // Highcrown Square Lodestone
    [-86.0, 91.5, '#62b6ff'], // Wizards' Sea Tower Lodestone
    [108.5, 73.5, '#f4c45c'], // Sunscorch Oasis Lodestone
    [101.0, -28.0, '#e09248'], // Dwarven Quarry Lodestone
    [22.0, -138.0, '#ff6a42'], // Ashen Wilds Lodestone
  ];
  for (const [lx, lz, col] of lodestoneSpots) {
    const pad = buildLodestonePad(mats, col);
    pad.position.set(lx, getTerrainHeight(lx, lz), lz);
    group.add(pad);
  }

  // 15. Instanced Forests, Grass Tufts, Bushes, Mossy Boulders, Cattails & Clouds
  const flora = buildInstancedFlora(mats, colliders, occupiedZones);
  group.add(flora.group);

  const cloudsGroup = buildClouds(mats);
  group.add(cloudsGroup);

  const sunbeams = buildSunbeamsGroup();
  group.add(sunbeams.group);

  const wind = buildWindStreaks(54);
  group.add(wind.mesh);

  // 16. Build Simplified Invisible Collision Proxy Geometry for Camera & Line-of-Sight Raycasting
  for (let i = 0; i < colliders.length; i++) {
    proxyRegistry.register(colliders[i]);
  }
  group.add(proxyRegistry.group);

  return {
    group,
    terrainMesh,
    waterMesh,
    waterUniforms,
    grassUniforms: flora.grassUniforms,
    skyUniforms: skyDome.uniforms,
    cloudsGroup,
    sunbeamsGroup: sunbeams.group,
    sunbeamMat: sunbeams.mat,
    windStreaksMesh: wind.mesh,
    windStreaksMat: wind.mat,
    windStreaks: wind.items,
    bushMeshes: flora.bushMeshes,
    cuttableBushes: flora.cuttableBushes,
    starsMesh,
    firefliesMesh,
    windmillSails: windmill.sails,
    spireBell: spire.bellGroup,
    spireBeam: spire.beaconBeam,
    spireBanners: spire.banners,
    lanternMats,
    shrines,
    campfires,
    chests,
    crackedBoulders,
    stasisBoulders,
    barrels,
    updrafts,
    pickups,
    signs,
    npcs,
    whisperSecrets,
    birds,
    foxes,
    deer,
    ducks,
    butterflies,
    pastureAnimals,
    chimeBells,
    runicSocket,
    dawnBraziers,
    archeryTargets,
    oreVeins,
    wizardsCrystalRing: wizTower.crystalRing,
    colliders,
    proxyRegistry,
    raycastProxies: proxyRegistry.raycastTargets,
    raycastSolids: proxyRegistry.raycastTargets,
    dispose() {
      proxyRegistry.dispose();
      terrainMesh.geometry.dispose();
      (terrainMesh.material as THREE.Material).dispose();
      waterMesh.geometry.dispose();
      (waterMesh.material as THREE.Material).dispose();
      skyDome.mesh.geometry.dispose();
      (skyDome.mesh.material as THREE.Material).dispose();
      sunbeams.mat.dispose();
      wind.mesh.geometry.dispose();
      wind.mat.dispose();
      starGeo.dispose();
      starMat.dispose();
      ffGeo.dispose();
      ffMat.dispose();
    },
  };
}
