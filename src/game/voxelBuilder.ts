import * as THREE from 'three';

export interface MaterialLibrary {
  bumpStone: THREE.CanvasTexture;
  bumpWood: THREE.CanvasTexture;
  texStone: THREE.CanvasTexture;
  texWood: THREE.CanvasTexture;
  texRoof: THREE.CanvasTexture;
  texCloth: THREE.CanvasTexture;
  texGround: THREE.CanvasTexture;
  blobShadowTex: THREE.CanvasTexture;
  softGlowTex: THREE.CanvasTexture;
  getMat: (
    color: number | string,
    opts?: {
      roughness?: number;
      metalness?: number;
      emissive?: number | string;
      emissiveIntensity?: number;
      transparent?: boolean;
      opacity?: number;
      bump?: 'stone' | 'wood' | 'none';
      pattern?: 'stone' | 'wood' | 'roof' | 'cloth' | 'none';
      flatShading?: boolean;
      side?: THREE.Side;
    }
  ) => THREE.MeshStandardMaterial;
  dispose: () => void;
}

function makeSeededRand(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGrainTexture(seed: number, contrast: number, horizontalStreak: boolean): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const rand = makeSeededRand(seed);
  for (let y = 0; y < size; y++) {
    const rowBias = horizontalStreak ? (rand() - 0.5) * contrast * 0.85 : 0;
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cell = (x >> 2) + (y >> 2) * 16;
      const blockTone = ((cell * 37 + seed) % 13) / 13 - 0.5;
      const v = Math.max(
        0,
        Math.min(255, Math.round(128 + rowBias + (rand() - 0.5) * contrast + blockTone * contrast * 0.48))
      );
      img.data[idx] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/**
 * Generates bright, neutral-white-anchored crisp pixel-storybook albedo overlays
 * (mean brightness ~238/255) so multiplying with material.color keeps colors vibrant
 * while adding hand-crafted masonry bricks, wood planks, roof shingles, or woven cloth!
 */
function makeStorybookPatternTexture(
  kind: 'stone' | 'wood' | 'roof' | 'cloth' | 'ground',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const rand = makeSeededRand(
    kind === 'stone' ? 11 : kind === 'wood' ? 29 : kind === 'roof' ? 47 : kind === 'cloth' ? 73 : 97
  );

  // Bright base so vertex/material color never turns muddy
  g.fillStyle = '#f2f2f0';
  g.fillRect(0, 0, size, size);

  if (kind === 'stone') {
    // Running-bond storybook ashlar stone blocks
    const rows = 4;
    const rowH = size / rows;
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * 16;
      for (let col = -1; col < 3; col++) {
        const bx = col * 32 + offset;
        const by = r * rowH;
        const shade = Math.round(228 + (rand() - 0.5) * 26);
        g.fillStyle = `rgb(${shade},${shade},${shade - 2})`;
        g.fillRect(bx + 1, by + 1, 30, rowH - 2);
        // Subtle sunlit top bevel
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(bx + 1, by + 1, 30, 2);
        // Mortar groove
        g.fillStyle = 'rgba(65,70,82,0.24)';
        g.fillRect(bx, by, 32, 1);
        g.fillRect(bx, by, 1, rowH);
      }
    }
    // Fine speckles
    for (let i = 0; i < 90; i++) {
      const px = Math.floor(rand() * 32) * 2;
      const py = Math.floor(rand() * 32) * 2;
      g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(50,55,68,0.12)';
      g.fillRect(px, py, 2, 2);
    }
  } else if (kind === 'wood') {
    // Crisp timber plank seams & grain knots
    const planks = 4;
    const pH = size / planks;
    for (let p = 0; p < planks; p++) {
      const shade = Math.round(234 + (rand() - 0.5) * 22);
      g.fillStyle = `rgb(${shade},${shade - 2},${shade - 5})`;
      g.fillRect(0, p * pH, size, pH);
      // Horizontal wood grain streaks
      for (let s = 0; s < 5; s++) {
        const sy = p * pH + 2 + Math.floor(rand() * (pH - 4));
        g.fillStyle = rand() > 0.45 ? 'rgba(72,48,26,0.12)' : 'rgba(255,250,235,0.14)';
        g.fillRect(0, sy, size, 1);
      }
      // Plank seam
      g.fillStyle = 'rgba(56,36,18,0.28)';
      g.fillRect(0, p * pH, size, 1);
      // Vertical end-butt joint
      const jx = Math.floor(((p * 23 + 12) % 48) + 8);
      g.fillRect(jx, p * pH, 1, pH);
    }
  } else if (kind === 'roof') {
    // Overlapping scalloped storybook roof shingles
    const rows = 4;
    const rowH = size / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 8;
      for (let x = -16; x < size + 16; x += 16) {
        const shade = Math.round(230 + (rand() - 0.5) * 28);
        g.fillStyle = `rgb(${shade},${shade - 2},${shade - 3})`;
        g.fillRect(x + off + 1, r * rowH + 1, 14, rowH - 2);
        g.fillStyle = 'rgba(255,255,255,0.2)';
        g.fillRect(x + off + 2, r * rowH + 1, 12, 2);
        g.fillStyle = 'rgba(40,28,24,0.28)';
        g.fillRect(x + off, (r + 1) * rowH - 2, 16, 2);
        g.fillRect(x + off, r * rowH, 1, rowH);
      }
    }
  } else if (kind === 'cloth') {
    // Crisp woven linen/tunic crosshatch
    for (let y = 0; y < size; y += 4) {
      for (let x = 0; x < size; x += 4) {
        const alt = ((x >> 2) + (y >> 2)) & 1;
        const v = alt ? 244 : 232;
        g.fillStyle = `rgb(${v},${v},${v - 2})`;
        g.fillRect(x, y, 4, 4);
      }
    }
    for (let i = 0; i < 64; i++) {
      const px = Math.floor(rand() * 32) * 2;
      const py = Math.floor(rand() * 32) * 2;
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(px, py, 2, 2);
    }
  } else {
    // Ground micro-pixel turf & pebble detail overlay (tiles smoothly over terrain vertex colors)
    g.fillStyle = '#efefef';
    g.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 4) {
      for (let x = 0; x < size; x += 4) {
        const n = rand();
        if (n < 0.25) {
          g.fillStyle = 'rgba(255,255,240,0.18)';
          g.fillRect(x, y, 4, 4);
        } else if (n > 0.78) {
          g.fillStyle = 'rgba(35,55,28,0.13)';
          g.fillRect(x, y, 4, 4);
        }
      }
    }
    // Crisp tiny blade tufts & pebble flecks
    for (let i = 0; i < 42; i++) {
      const px = Math.floor(rand() * 30) * 2;
      const py = Math.floor(rand() * 30) * 2;
      g.fillStyle = rand() > 0.5 ? 'rgba(255,255,230,0.22)' : 'rgba(24,42,20,0.16)';
      g.fillRect(px, py, 2, 4);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function makeBlobShadowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 3, 32, 32, 30);
  grad.addColorStop(0, 'rgba(12, 18, 28, 0.46)');
  grad.addColorStop(0.55, 'rgba(12, 18, 28, 0.24)');
  grad.addColorStop(1, 'rgba(12, 18, 28, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeSoftGlowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.35, 'rgba(255, 246, 200, 0.72)');
  grad.addColorStop(1, 'rgba(255, 232, 150, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMaterialLibrary(maxAnisotropy: number): MaterialLibrary {
  const bumpStone = makeGrainTexture(42, 72, false);
  bumpStone.anisotropy = maxAnisotropy;
  const bumpWood = makeGrainTexture(109, 58, true);
  bumpWood.anisotropy = maxAnisotropy;
  const texStone = makeStorybookPatternTexture('stone', maxAnisotropy);
  const texWood = makeStorybookPatternTexture('wood', maxAnisotropy);
  const texRoof = makeStorybookPatternTexture('roof', maxAnisotropy);
  const texCloth = makeStorybookPatternTexture('cloth', maxAnisotropy);
  const texGround = makeStorybookPatternTexture('ground', maxAnisotropy);
  texGround.repeat.set(52, 52);
  const blobShadowTex = makeBlobShadowTex();
  const softGlowTex = makeSoftGlowTex();

  const cache = new Map<string, THREE.MeshStandardMaterial>();

  const getMat: MaterialLibrary['getMat'] = (color, opts = {}) => {
    const pattern =
      opts.pattern ??
      (opts.bump === 'stone' ? 'stone' : opts.bump === 'wood' ? 'wood' : 'none');

    const key = [
      color,
      opts.roughness ?? 0.82,
      opts.metalness ?? 0.04,
      opts.emissive ?? 0,
      opts.emissiveIntensity ?? 0,
      opts.transparent ? 1 : 0,
      opts.opacity ?? 1,
      opts.bump ?? 'none',
      pattern,
      opts.side ?? THREE.FrontSide,
    ].join('|');

    const hit = cache.get(key);
    if (hit) return hit;

    const mapTex =
      pattern === 'stone'
        ? texStone
        : pattern === 'wood'
          ? texWood
          : pattern === 'roof'
            ? texRoof
            : pattern === 'cloth'
              ? texCloth
              : null;

    const isTransparent = opts.transparent ?? false;
    const mat = new THREE.MeshStandardMaterial({
      color,
      map: mapTex,
      roughness: opts.roughness ?? 0.82,
      metalness: opts.metalness ?? 0.04,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: isTransparent,
      opacity: opts.opacity ?? 1,
      bumpMap: opts.bump === 'stone' ? bumpStone : opts.bump === 'wood' ? bumpWood : null,
      bumpScale: opts.bump && opts.bump !== 'none' ? 0.045 : 0,
      side: opts.side ?? THREE.FrontSide,
    });

    // Subtle Breath-of-the-Wild stylized Fresnel sky-rim highlight on opaque silhouettes
    if (!isTransparent) {
      mat.customProgramCacheKey = () => 'dawnbell_botw_rim_v1';
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `
          vec3 botwViewDir = normalize(vViewPosition);
          float botwFresnel = pow(1.0 - clamp(dot(botwViewDir, normalize(normal)), 0.0, 1.0), 3.1);
          float botwSkyFactor = smoothstep(-0.2, 0.85, normal.y);
          gl_FragColor.rgb += vec3(0.22, 0.25, 0.20) * botwFresnel * (0.35 + 0.65 * botwSkyFactor) * 0.42;
          #include <dithering_fragment>
          `
        );
      };
    }

    cache.set(key, mat);
    return mat;
  };

  return {
    bumpStone,
    bumpWood,
    texStone,
    texWood,
    texRoof,
    texCloth,
    texGround,
    blobShadowTex,
    softGlowTex,
    getMat,
    dispose() {
      for (const m of cache.values()) m.dispose();
      cache.clear();
      bumpStone.dispose();
      bumpWood.dispose();
      texStone.dispose();
      texWood.dispose();
      texRoof.dispose();
      texCloth.dispose();
      texGround.dispose();
      blobShadowTex.dispose();
      softGlowTex.dispose();
    },
  };
}

// Shared unit box geometry for crisp zero-overhead voxel assemblies
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

export function addVoxelBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  castShadow = true,
  receiveShadow = true
): THREE.Mesh {
  const m = new THREE.Mesh(UNIT_BOX, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = castShadow;
  m.receiveShadow = receiveShadow;
  parent.add(m);
  return m;
}

export function createContactShadow(mats: MaterialLibrary, radius: number): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 18);
  const mat = new THREE.MeshBasicMaterial({
    map: mats.blobShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.88,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

export interface HeroRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  hoodTail: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elL: THREE.Group;
  elR: THREE.Group;
  sword: THREE.Group;
  swordGlow: THREE.Mesh;
  slashArc: THREE.Mesh;
  shieldHand: THREE.Group;
  shieldBack: THREE.Group;
  shieldSurf: THREE.Group;
  bowGroup: THREE.Group;
  bowArrow: THREE.Group;
  gliderGroup: THREE.Group;
  dawnLampGroup: THREE.Group;
  dawnLampLight: THREE.PointLight;
  dawnLampFlameMat: THREE.MeshStandardMaterial;
  contactShadow: THREE.Mesh;
  flashMats: THREE.MeshStandardMaterial[];
}

export function buildWrenHero(mats: MaterialLibrary): HeroRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Rich tactile cloth, burnished leather & gilded metal materials for Wren
  const tun = mats.getMat('#3fb452', { roughness: 0.84, pattern: 'cloth' }).clone();
  const tunD = mats.getMat('#287a3a', { roughness: 0.86, pattern: 'cloth' }).clone();
  const hood = mats.getMat('#2d8e48', { roughness: 0.84, pattern: 'cloth' }).clone();
  const cloak = mats.getMat('#236d37', { roughness: 0.88, pattern: 'cloth' }).clone();
  const scarf = mats.getMat('#d8a846', { roughness: 0.72, pattern: 'cloth' }).clone();
  const skin = mats.getMat('#f4c79c', { roughness: 0.7 }).clone();
  const hair = mats.getMat('#cc6a28', { roughness: 0.78 }).clone();
  const hairD = mats.getMat('#7c3814', { roughness: 0.82 }).clone();
  const belt = mats.getMat('#6b411e', { roughness: 0.7, bump: 'wood' }).clone();
  const leather = mats.getMat('#8f5d32', { roughness: 0.72, bump: 'wood' }).clone();
  const boot = mats.getMat('#483222', { roughness: 0.8, bump: 'wood' }).clone();
  const legs = mats.getMat('#dfd3b8', { roughness: 0.86, pattern: 'cloth' }).clone();
  const gold = mats.getMat('#f4ca5c', { roughness: 0.22, metalness: 0.88 }).clone();
  const blade = mats.getMat('#e6edf8', { roughness: 0.16, metalness: 0.92 }).clone();
  const shieldBlue = mats.getMat('#2b5ea8', { roughness: 0.32, metalness: 0.38 }).clone();
  const gemBlue = mats
    .getMat('#44b6ff', { roughness: 0.12, metalness: 0.2, emissive: '#2282ea', emissiveIntensity: 0.55 })
    .clone();
  const eyeMat = mats.getMat('#1b2842', { roughness: 0.18 });
  const whiteMat = mats.getMat('#ffffff', { roughness: 0.28 });
  const mouthMat = mats.getMat('#a84a3c', { roughness: 0.8 });

  const flashMats = [tun, tunD, hood, cloak, skin, hair, legs, boot, shieldBlue];

  const grp = (x: number, y: number, z: number, parent: THREE.Object3D) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  // Articulated legs with cuffed ranger boots, knee pads & toe caps
  const legL = grp(-0.13, 0.82, 0, body);
  const legR = grp(0.13, 0.82, 0, body);
  const shinL = grp(0, -0.38, 0, legL);
  const shinR = grp(0, -0.38, 0, legR);

  for (const [L, S] of [
    [legL, shinL],
    [legR, shinR],
  ]) {
    addVoxelBox(L, 0.18, 0.4, 0.2, legs, 0, -0.2, 0);
    addVoxelBox(L, 0.16, 0.1, 0.05, leather, 0, -0.34, 0.11); // knee guard
    addVoxelBox(S, 0.19, 0.28, 0.21, boot, 0, -0.14, 0);
    addVoxelBox(S, 0.2, 0.13, 0.3, boot, 0, -0.37, 0.045);
    addVoxelBox(S, 0.21, 0.045, 0.31, belt, 0, -0.42, 0.045); // sole
    addVoxelBox(S, 0.22, 0.075, 0.23, leather, 0, -0.01, 0); // folded leather boot cuff
    addVoxelBox(S, 0.06, 0.05, 0.03, gold, 0, -0.01, 0.12); // boot buckle
  }

  // Layered Hero Tunic, stitched gold trim, belt, hip satchel, rune lantern clip & shoulder mantle
  addVoxelBox(body, 0.48, 0.56, 0.28, tun, 0, 1.12, 0);
  addVoxelBox(body, 0.52, 0.25, 0.32, tunD, 0, 0.8, 0);
  addVoxelBox(body, 0.54, 0.04, 0.34, gold, 0, 0.69, 0); // gilded tunic hem
  addVoxelBox(body, 0.46, 0.05, 0.3, tun, 0, 0.92, 0);
  addVoxelBox(body, 0.52, 0.085, 0.31, belt, 0, 0.88, 0);
  addVoxelBox(body, 0.11, 0.09, 0.04, gold, 0, 0.88, 0.165); // ornate belt buckle
  // Embossed adventurer's hip satchel + glowing Dawnbell slate charm on right hip
  addVoxelBox(body, 0.14, 0.15, 0.12, leather, -0.24, 0.81, 0.07);
  addVoxelBox(body, 0.15, 0.05, 0.13, belt, -0.24, 0.86, 0.07);
  addVoxelBox(body, 0.04, 0.04, 0.03, gold, -0.24, 0.82, 0.14);
  addVoxelBox(body, 0.1, 0.14, 0.06, mats.getMat('#3c4454', { roughness: 0.4, metalness: 0.5 }), 0.25, 0.82, 0.06);
  addVoxelBox(body, 0.06, 0.08, 0.02, gemBlue, 0.25, 0.82, 0.095, false); // BotW Sheikah-style rune slate!

  // Golden Dawn Lamp clipped to Wren's left hip (unlocked in Chapter III: The Gloaming Fen, toggleable with G!)
  const dawnLampGroup = grp(-0.29, 0.84, 0.15, body);
  const dawnLampFlameMat = new THREE.MeshStandardMaterial({
    color: 0xffe48a,
    emissive: 0xffa82a,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  addVoxelBox(dawnLampGroup, 0.13, 0.04, 0.13, gold, 0, 0.12, 0, false, false);
  addVoxelBox(dawnLampGroup, 0.13, 0.04, 0.13, gold, 0, -0.08, 0, false, false);
  addVoxelBox(dawnLampGroup, 0.09, 0.16, 0.09, dawnLampFlameMat, 0, 0.02, 0, false, false);
  const dawnLampLight = new THREE.PointLight(0xffb84a, 0, 18, 1.5);
  dawnLampLight.position.set(0, 0.2, 0.2);
  dawnLampGroup.add(dawnLampLight);
  dawnLampGroup.visible = false;

  // Layered ranger shoulder capelet & golden collar clasp (great back-view silhouette!)
  addVoxelBox(body, 0.58, 0.12, 0.34, cloak, 0, 1.38, -0.02);
  addVoxelBox(body, 0.5, 0.24, 0.06, cloak, 0, 1.24, -0.17);
  addVoxelBox(body, 0.44, 0.04, 0.07, scarf, 0, 1.11, -0.17);
  addVoxelBox(body, 0.34, 0.08, 0.26, scarf, 0, 1.43, 0.02); // warm golden neck scarf
  addVoxelBox(body, 0.09, 0.09, 0.04, gold, 0, 1.42, 0.16); // cloak clasp

  // Cross-chest leather baldric straps
  const strapF = addVoxelBox(body, 0.075, 0.62, 0.03, belt, 0, 1.12, 0.15);
  strapF.rotation.z = 0.7;
  const strapB = addVoxelBox(body, 0.075, 0.62, 0.03, belt, 0, 1.12, -0.15);
  strapB.rotation.z = -0.7;

  // Detailed scabbard with chape tip & feathered arrow quiver on back
  const scabbard = addVoxelBox(body, 0.1, 0.68, 0.08, leather, 0.11, 1.14, -0.21);
  scabbard.rotation.z = -0.68;
  const scabTrim = addVoxelBox(body, 0.13, 0.06, 0.1, gold, -0.07, 1.34, -0.21);
  scabTrim.rotation.z = -0.68;
  const scabTip = addVoxelBox(body, 0.11, 0.07, 0.09, gold, 0.3, 0.92, -0.21);
  scabTip.rotation.z = -0.68;

  const quiver = grp(-0.16, 1.16, -0.22, body);
  quiver.rotation.z = 0.32;
  addVoxelBox(quiver, 0.14, 0.46, 0.13, leather, 0, 0, 0);
  addVoxelBox(quiver, 0.16, 0.055, 0.15, gold, 0, 0.21, 0);
  addVoxelBox(quiver, 0.16, 0.045, 0.15, belt, 0, -0.12, 0);
  for (let i = -1; i <= 1; i++) {
    addVoxelBox(quiver, 0.026, 0.2, 0.026, mats.getMat('#d4ac76'), i * 0.034, 0.3, (i === 0 ? 0.02 : -0.01));
    addVoxelBox(quiver, 0.06, 0.07, 0.022, i === 0 ? mats.getMat('#ffdf78') : mats.getMat('#f6eedc'), i * 0.034, 0.39, (i === 0 ? 0.02 : -0.01));
  }

  // Head + Expressive Eyes + Chestnut Hair + Emerald Dawnbell Hood & Flowing Gold-Tasseled Tail
  const head = grp(0, 1.64, 0, body);
  addVoxelBox(head, 0.35, 0.35, 0.33, skin, 0, 0, 0);
  for (const s of [-1, 1]) {
    addVoxelBox(head, 0.07, 0.08, 0.02, eyeMat, s * 0.085, -0.01, 0.17, false);
    addVoxelBox(head, 0.025, 0.025, 0.012, whiteMat, s * 0.085 - 0.015, 0.012, 0.182, false);
    addVoxelBox(head, 0.08, 0.024, 0.022, hairD, s * 0.085, 0.058, 0.17, false);
    // Pointed storybook ears peeking out
    addVoxelBox(head, 0.06, 0.06, 0.06, skin, s * 0.2, -0.02, 0.04);
  }
  addVoxelBox(head, 0.05, 0.05, 0.04, skin, 0, -0.05, 0.18, false);
  addVoxelBox(head, 0.08, 0.022, 0.014, mouthMat, 0, -0.11, 0.168, false);

  // Layered hair fringe & side locks
  addVoxelBox(head, 0.37, 0.1, 0.35, hair, 0, 0.17, 0);
  addVoxelBox(head, 0.37, 0.1, 0.06, hair, 0, 0.12, 0.155);
  for (const [i, x] of [
    [0, -0.13],
    [1, -0.04],
    [2, 0.06],
    [3, 0.14],
  ]) {
    addVoxelBox(head, 0.075, 0.07 + (i % 2) * 0.03, 0.05, i % 2 ? hairD : hair, x, 0.055 - (i % 2) * 0.015, 0.17);
  }
  for (const s of [-1, 1]) {
    addVoxelBox(head, 0.06, 0.22, 0.09, hair, s * 0.175, -0.01, 0.11);
  }

  // Sculpted Hood with gold trim seam + swinging tail with bell tassel
  addVoxelBox(head, 0.44, 0.11, 0.42, hood, 0, 0.21, -0.02);
  addVoxelBox(head, 0.44, 0.4, 0.1, hood, 0, 0.02, -0.195);
  addVoxelBox(head, 0.4, 0.04, 0.04, gold, 0, 0.26, -0.02); // crest stitch
  for (const s of [-1, 1]) {
    addVoxelBox(head, 0.08, 0.36, 0.38, hood, s * 0.205, 0.04, -0.02);
    addVoxelBox(head, 0.045, 0.32, 0.048, scarf, s * 0.21, 0.02, 0.175);
  }
  addVoxelBox(head, 0.45, 0.048, 0.048, scarf, 0, 0.175, 0.185);

  const hoodTail = grp(0, 0.18, -0.22, head);
  addVoxelBox(hoodTail, 0.24, 0.22, 0.18, hood, 0, -0.06, -0.07);
  addVoxelBox(hoodTail, 0.16, 0.2, 0.13, cloak, 0, -0.19, -0.14);
  addVoxelBox(hoodTail, 0.09, 0.13, 0.09, gold, 0, -0.32, -0.18);

  // Arms with leather shoulder pauldrons & stitched ranger bracers
  const buildArm = (side: number) => {
    const sh = grp(side * 0.32, 1.36, 0, body);
    sh.rotation.order = 'YXZ';
    addVoxelBox(sh, 0.19, 0.15, 0.21, leather, side * 0.01, -0.02, 0); // pauldron
    addVoxelBox(sh, 0.2, 0.035, 0.22, gold, side * 0.01, -0.09, 0); // pauldron trim
    addVoxelBox(sh, 0.14, 0.26, 0.16, tun, 0, -0.18, 0);
    const el = grp(0, -0.3, 0, sh);
    addVoxelBox(el, 0.115, 0.24, 0.125, skin, 0, -0.11, 0);
    addVoxelBox(el, 0.145, 0.13, 0.155, leather, 0, -0.16, 0); // bracer
    addVoxelBox(el, 0.15, 0.03, 0.16, gold, 0, -0.1, 0);
    addVoxelBox(el, 0.125, 0.125, 0.125, skin, 0, -0.27, 0);
    return { sh, el };
  };

  const rightArm = buildArm(1);
  const leftArm = buildArm(-1);

  // Dawnbell Master Sword on right hand
  const sword = grp(0, -0.27, 0.04, rightArm.el);
  sword.rotation.x = Math.PI * 0.48;
  addVoxelBox(sword, 0.055, 0.17, 0.055, belt, 0, 0, 0);
  addVoxelBox(sword, 0.09, 0.085, 0.09, gold, 0, -0.105, 0);
  addVoxelBox(sword, 0.28, 0.065, 0.085, gold, 0, 0.1, 0);
  addVoxelBox(sword, 0.075, 0.075, 0.095, gemBlue, 0, 0.1, 0.01, false);
  addVoxelBox(sword, 0.085, 0.74, 0.032, blade, 0, 0.5, 0);
  addVoxelBox(sword, 0.048, 0.1, 0.026, blade, 0, 0.91, 0);
  addVoxelBox(sword, 0.022, 0.68, 0.038, whiteMat, 0, 0.5, 0, false);

  const swordGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.84, 0.085),
    new THREE.MeshBasicMaterial({
      color: 0xffe08a,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  swordGlow.position.y = 0.5;
  swordGlow.visible = false;
  sword.add(swordGlow);

  // Dynamic sword slash arc mesh attached to hero root
  const arcGeo = new THREE.RingGeometry(0.75, 2.05, 18, 1, -Math.PI * 0.45, Math.PI * 0.9);
  const slashArc = new THREE.Mesh(
    arcGeo,
    new THREE.MeshBasicMaterial({
      color: 0xfff6d2,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  slashArc.rotation.x = -Math.PI / 2;
  slashArc.position.y = 1.05;
  slashArc.visible = false;
  root.add(slashArc);

  // Ornate Dawnbell Kite Shield
  const buildShieldMesh = () => {
    const g = new THREE.Group();
    addVoxelBox(g, 0.38, 0.44, 0.06, shieldBlue, 0, 0, 0);
    addVoxelBox(g, 0.28, 0.12, 0.06, shieldBlue, 0, -0.26, 0);
    addVoxelBox(g, 0.14, 0.09, 0.06, shieldBlue, 0, -0.35, 0);
    addVoxelBox(g, 0.43, 0.055, 0.084, gold, 0, 0.22, 0.005);
    for (const s of [-1, 1]) {
      addVoxelBox(g, 0.055, 0.44, 0.072, gold, s * 0.195, -0.03, 0.005);
    }
    addVoxelBox(g, 0.13, 0.13, 0.028, gold, 0, 0.06, 0.04, false);
    addVoxelBox(g, 0.2, 0.048, 0.028, gold, 0, -0.02, 0.04, false);
    addVoxelBox(g, 0.06, 0.06, 0.032, gemBlue, 0, -0.06, 0.042, false);
    return g;
  };

  const shieldHand = buildShieldMesh();
  shieldHand.position.set(-0.08, -0.16, 0.08);
  shieldHand.rotation.y = -Math.PI * 0.45;
  leftArm.el.add(shieldHand);

  const shieldBack = buildShieldMesh();
  shieldBack.position.set(0.02, 1.08, -0.28);
  shieldBack.rotation.y = Math.PI;
  shieldBack.visible = false;
  body.add(shieldBack);

  const shieldSurf = buildShieldMesh();
  shieldSurf.position.set(0, 0.08, 0.04);
  shieldSurf.rotation.set(-Math.PI / 2 + 0.12, 0, 0);
  shieldSurf.scale.set(1.22, 1.38, 1.15);
  shieldSurf.visible = false;
  root.add(shieldSurf);

  // Recurve Shortbow
  const bowGroup = grp(0, -0.24, 0.12, leftArm.el);
  const bowWood = mats.getMat('#8e5a2b', { roughness: 0.72, bump: 'wood' });
  const stringMat = mats.getMat('#f2ead6', { roughness: 0.9 });
  addVoxelBox(bowGroup, 0.06, 0.34, 0.06, bowWood, 0, 0, 0);
  const limbTop = addVoxelBox(bowGroup, 0.05, 0.42, 0.05, bowWood, 0, 0.34, -0.09);
  limbTop.rotation.x = -0.45;
  const limbBot = addVoxelBox(bowGroup, 0.05, 0.42, 0.05, bowWood, 0, -0.34, -0.09);
  limbBot.rotation.x = 0.45;
  addVoxelBox(bowGroup, 0.075, 0.06, 0.075, gold, 0, 0.16, -0.01);
  addVoxelBox(bowGroup, 0.075, 0.06, 0.075, gold, 0, -0.16, -0.01);
  addVoxelBox(bowGroup, 0.015, 0.92, 0.015, stringMat, 0, 0, -0.19, false);

  const bowArrow = grp(0, 0, 0.1, bowGroup);
  addVoxelBox(bowArrow, 0.025, 0.025, 0.78, mats.getMat('#d6b27c'), 0, 0, 0.05, false);
  addVoxelBox(bowArrow, 0.07, 0.07, 0.12, gemBlue, 0, 0, 0.46, false);
  addVoxelBox(bowArrow, 0.08, 0.02, 0.12, whiteMat, 0, 0, -0.3, false);
  bowGroup.visible = false;

  // Unfolding Dawnbell Paraglider with stitched cloth panels & gilded crest
  const gliderGroup = grp(0, 2.08, 0.04, body);
  const sailCloth = mats.getMat('#f6edd8', { roughness: 0.86, pattern: 'cloth', side: THREE.DoubleSide });
  const sailTrim = mats.getMat('#2f8a48', { roughness: 0.82, pattern: 'cloth', side: THREE.DoubleSide });
  const sparWood = mats.getMat('#6b4423', { roughness: 0.78, bump: 'wood' });
  addVoxelBox(gliderGroup, 0.85, 0.06, 0.06, sparWood, 0, -0.28, 0);
  addVoxelBox(gliderGroup, 0.07, 0.34, 0.07, sparWood, 0, -0.1, 0);
  addVoxelBox(gliderGroup, 0.08, 0.08, 0.95, sparWood, 0, 0.08, -0.04);
  for (const s of [-1, 1]) {
    const spar = addVoxelBox(gliderGroup, 1.38, 0.06, 0.06, sparWood, s * 0.66, 0.12, 0.14);
    spar.rotation.z = s * 0.11;
    spar.rotation.y = s * -0.18;

    const wingMain = addVoxelBox(gliderGroup, 1.34, 0.045, 0.8, sailCloth, s * 0.69, 0.1, -0.12);
    wingMain.rotation.z = s * 0.11;
    wingMain.rotation.y = s * -0.14;

    const wingEdge = addVoxelBox(gliderGroup, 1.36, 0.05, 0.18, sailTrim, s * 0.69, 0.1, -0.5);
    wingEdge.rotation.z = s * 0.11;
    wingEdge.rotation.y = s * -0.14;

    const rib = addVoxelBox(gliderGroup, 0.06, 0.065, 0.82, sparWood, s * 0.72, 0.12, -0.16);
    rib.rotation.z = s * 0.11;
  }
  addVoxelBox(gliderGroup, 0.26, 0.075, 0.26, gold, 0, 0.16, -0.05);
  gliderGroup.visible = false;

  const contactShadow = createContactShadow(mats, 0.58);

  return {
    root,
    body,
    head,
    hoodTail,
    legL,
    legR,
    shinL,
    shinR,
    armL: leftArm.sh,
    armR: rightArm.sh,
    elL: leftArm.el,
    elR: rightArm.el,
    sword,
    swordGlow,
    slashArc,
    shieldHand,
    shieldBack,
    shieldSurf,
    bowGroup,
    bowArrow,
    gliderGroup,
    dawnLampGroup,
    dawnLampLight,
    dawnLampFlameMat,
    contactShadow,
    flashMats,
  };
}

export interface PipRig {
  root: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  light: THREE.PointLight;
}

export function buildPipCompanion(mats: MaterialLibrary): PipRig {
  const root = new THREE.Group();
  const coreMat = mats.getMat('#fff6c0', {
    roughness: 0.15,
    emissive: '#ffe878',
    emissiveIntensity: 1.25,
  });
  const haloMat = mats.getMat('#fff2a0', {
    transparent: true,
    opacity: 0.32,
    emissive: '#ffe066',
    emissiveIntensity: 0.65,
  });
  const wingMat = mats.getMat('#cfe8ff', {
    transparent: true,
    opacity: 0.82,
    emissive: '#a8d8ff',
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide,
  });

  addVoxelBox(root, 0.16, 0.16, 0.16, coreMat, 0, 0, 0, false, false);
  addVoxelBox(root, 0.28, 0.28, 0.28, haloMat, 0, 0, 0, false, false);

  const wingL = new THREE.Group();
  wingL.position.set(-0.08, 0.03, 0);
  addVoxelBox(wingL, 0.2, 0.12, 0.02, wingMat, -0.1, 0.03, 0, false, false);
  addVoxelBox(wingL, 0.12, 0.08, 0.02, wingMat, -0.07, -0.05, 0, false, false);
  root.add(wingL);

  const wingR = new THREE.Group();
  wingR.position.set(0.08, 0.03, 0);
  addVoxelBox(wingR, 0.2, 0.12, 0.02, wingMat, 0.1, 0.03, 0, false, false);
  addVoxelBox(wingR, 0.12, 0.08, 0.02, wingMat, 0.07, -0.05, 0, false, false);
  root.add(wingR);

  const light = new THREE.PointLight(0xffe890, 1.2, 6, 1.8);
  root.add(light);

  return { root, wingL, wingR, light };
}

export function buildDawnbellSpire(mats: MaterialLibrary): {
  group: THREE.Group;
  bellGroup: THREE.Group;
  beaconBeam: THREE.Mesh;
  banners: THREE.Group[];
} {
  const group = new THREE.Group();
  const stone = mats.getMat('#96949c', { roughness: 0.84, bump: 'stone', pattern: 'stone' });
  const stoneD = mats.getMat('#626470', { roughness: 0.88, bump: 'stone', pattern: 'stone' });
  const stoneL = mats.getMat('#cbc6b8', { roughness: 0.76, bump: 'stone', pattern: 'stone' });
  const roofSlate = mats.getMat('#2d5d7e', { roughness: 0.62, pattern: 'roof' });
  const roofDark = mats.getMat('#1f4460', { roughness: 0.7, pattern: 'roof' });
  const gold = mats.getMat('#f4ca5c', { roughness: 0.22, metalness: 0.88 });
  const moss = mats.getMat('#4c983c', { roughness: 0.9 });
  const vine = mats.getMat('#3c7e32', { roughness: 0.92 });
  const bannerRed = mats.getMat('#be3a34', { roughness: 0.82, pattern: 'cloth' });
  const bannerTrim = mats.getMat('#f4ca5c', { roughness: 0.4, metalness: 0.65 });
  const runeGlow = mats.getMat('#72f2ff', {
    roughness: 0.15,
    emissive: '#3cd8ff',
    emissiveIntensity: 1.4,
  });

  // Grand stepped stone plinth with deep hillside anchor skirt + approach stairs on all 4 cardinal sides
  addVoxelBox(group, 12.2, 2.2, 12.2, stoneD, 0, -0.9, 0);
  addVoxelBox(group, 11.8, 1.2, 11.8, stoneD, 0, 0.6, 0);
  addVoxelBox(group, 9.6, 1.1, 9.6, stone, 0, 1.75, 0);
  addVoxelBox(group, 8.0, 0.45, 8.0, stoneL, 0, 2.5, 0);
  for (const [dx, dz] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]) {
    addVoxelBox(group, dx === 0 ? 3.2 : 1.5, 0.55, dz === 0 ? 3.2 : 1.5, stoneL, dx * 6.0, 0.28, dz * 6.0);
    addVoxelBox(group, dx === 0 ? 2.6 : 1.1, 0.55, dz === 0 ? 2.6 : 1.1, stoneL, dx * 5.2, 0.85, dz * 5.2);
  }

  // Sculpted corner flying buttresses, stone quoins, lantern plinths & climbing moss vines
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addVoxelBox(group, 2.15, 7.6, 2.15, stoneD, sx * 3.1, 5.9, sz * 3.1);
      addVoxelBox(group, 2.35, 0.45, 2.35, stoneL, sx * 3.1, 9.8, sz * 3.1);
      addVoxelBox(group, 1.65, 0.48, 1.65, moss, sx * 3.1, 10.22, sz * 3.1);
      // Corner spire pinnacles on plinth
      addVoxelBox(group, 1.35, 2.0, 1.35, stoneL, sx * 4.6, 2.2, sz * 4.6);
      addVoxelBox(group, 0.9, 0.55, 0.9, gold, sx * 4.6, 3.45, sz * 4.6);
      // Organic stepped climbing ivy clusters + tiny gold blossoms
      const ivBloom = mats.getMat('#ffe68a', { roughness: 0.72 });
      addVoxelBox(group, 0.56, 0.65, 0.16, vine, sx * 3.02, 7.6, sz * 4.24);
      addVoxelBox(group, 0.74, 0.72, 0.18, moss, sx * 3.18, 6.85, sz * 4.24);
      addVoxelBox(group, 0.48, 0.85, 0.16, vine, sx * 2.94, 5.95, sz * 4.24);
      addVoxelBox(group, 0.62, 0.68, 0.18, moss, sx * 3.22, 5.1, sz * 4.24);
      addVoxelBox(group, 0.36, 0.64, 0.14, vine, sx * 3.05, 4.35, sz * 4.24);
      addVoxelBox(group, 0.16, 0.16, 0.2, ivBloom, sx * 3.28, 6.9, sz * 4.26, false);
      addVoxelBox(group, 0.16, 0.16, 0.2, ivBloom, sx * 2.95, 5.2, sz * 4.26, false);
      // Side buttress ivy
      addVoxelBox(group, 0.18, 0.7, 0.64, moss, sx * 4.24, 6.4, sz * 3.16);
      addVoxelBox(group, 0.16, 0.82, 0.48, vine, sx * 4.24, 5.45, sz * 2.94);
      addVoxelBox(group, 0.18, 0.6, 0.54, moss, sx * 4.24, 4.55, sz * 3.14);
    }
  }

  // Main towering masonry shaft + gothic corner pilasters + carved recessed niches
  addVoxelBox(group, 5.4, 15.0, 5.4, stone, 0, 10.0, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addVoxelBox(group, 0.82, 15.2, 0.82, stoneL, sx * 2.65, 10.1, sz * 2.65);
    }
  }

  // Decorative cornice bands & glowing ancient rune inlays (strictly non-overlapping Y layers)
  for (const y of [5.5, 9.6, 13.6, 17.2]) {
    addVoxelBox(group, 6.2, 0.52, 6.2, stoneD, 0, y, 0);
    addVoxelBox(group, 6.38, 0.16, 6.38, stoneL, 0, y + 0.35, 0);
    addVoxelBox(group, 5.84, 0.2, 5.84, runeGlow, 0, y + 0.54, 0, false);
  }

  // Climbable carved stone ledges + arched lancet windows on all 4 faces
  for (let y = 3.2; y <= 16.5; y += 1.6) {
    addVoxelBox(group, 2.2, 0.34, 0.48, stoneL, 0, y, 2.85);
    addVoxelBox(group, 2.2, 0.34, 0.48, stoneL, 0, y, -2.85);
    addVoxelBox(group, 0.48, 0.34, 2.2, stoneL, 2.85, y, 0);
    addVoxelBox(group, 0.48, 0.34, 2.2, stoneL, -2.85, y, 0);
  }
  // Glowing vertical rune slits between cornices
  for (const [dx, dz] of [
    [0, 2.75],
    [0, -2.75],
    [2.75, 0],
    [-2.75, 0],
  ]) {
    addVoxelBox(group, dx === 0 ? 0.38 : 0.12, 2.5, dz === 0 ? 0.38 : 0.12, runeGlow, dx, 11.6, dz, false);
  }

  // Fluttering Crimson & Gold Royal Banners hanging from the Observation Deck!
  const banners: THREE.Group[] = [];
  const bannerSpecs: Array<[number, number, number]> = [
    [0, 17.3, 4.25],
    [0, 17.3, -4.25],
    [4.25, 17.3, 0],
    [-4.25, 17.3, 0],
  ];
  bannerSpecs.forEach(([bx, by, bz], idx) => {
    const bg = new THREE.Group();
    bg.position.set(bx, by, bz);
    if (idx >= 2) bg.rotation.y = Math.PI / 2;
    addVoxelBox(bg, 1.55, 0.16, 0.16, gold, 0, 0, 0);
    addVoxelBox(bg, 1.25, 2.45, 0.08, bannerRed, 0, -1.28, 0);
    addVoxelBox(bg, 0.72, 0.85, 0.08, bannerRed, 0, -2.85, 0);
    addVoxelBox(bg, 0.24, 2.1, 0.1, bannerTrim, 0, -1.25, 0);
    addVoxelBox(bg, 0.48, 0.48, 0.11, bannerTrim, 0, -1.0, 0);
    group.add(bg);
    banners.push(bg);
  });

  // Observation deck / Launch platform at y = 17.8 with crenellated parapet corners
  addVoxelBox(group, 8.6, 0.68, 8.6, stoneL, 0, 17.8, 0);
  addVoxelBox(group, 8.9, 0.22, 8.9, gold, 0, 18.22, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addVoxelBox(group, 1.25, 0.9, 1.25, stoneD, sx * 3.7, 18.75, sz * 3.7);
      addVoxelBox(group, 0.55, 0.45, 0.55, gold, sx * 3.7, 19.4, sz * 3.7);
    }
  }

  // Belfry open arches with sculpted gothic arch spandrels
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addVoxelBox(group, 0.95, 4.5, 0.95, stoneL, sx * 2.9, 20.5, sz * 2.9);
      addVoxelBox(group, 1.2, 0.36, 1.2, gold, sx * 2.9, 22.75, sz * 2.9);
    }
  }
  // Ornate arch lintels framing the Golden Dawnbell
  for (const s of [-1, 1]) {
    addVoxelBox(group, 5.2, 0.55, 0.65, stoneD, 0, 22.55, s * 2.9);
    addVoxelBox(group, 0.65, 0.55, 5.2, stoneD, s * 2.9, 22.55, 0);
  }

  // Stepped slate-and-gold storybook spire crown roof
  addVoxelBox(group, 7.9, 0.65, 7.9, stoneD, 0, 23.1, 0);
  addVoxelBox(group, 6.2, 0.95, 6.2, roofSlate, 0, 23.85, 0);
  addVoxelBox(group, 4.8, 0.95, 4.8, roofDark, 0, 24.75, 0);
  addVoxelBox(group, 3.4, 1.05, 3.4, roofSlate, 0, 25.68, 0);
  addVoxelBox(group, 2.0, 1.2, 2.0, gold, 0, 26.7, 0);
  addVoxelBox(group, 0.42, 2.6, 0.42, gold, 0, 28.4, 0);
  addVoxelBox(group, 0.9, 0.9, 0.9, runeGlow, 0, 28.9, 0, false);

  // The Great Golden Dawnbell suspended inside the belfry
  const bellGroup = new THREE.Group();
  bellGroup.position.set(0, 22.0, 0);
  addVoxelBox(bellGroup, 2.2, 0.32, 0.32, mats.getMat('#5a391e', { bump: 'wood' }), 0, -0.08, 0); // yoke beam
  addVoxelBox(bellGroup, 0.95, 0.5, 0.95, gold, 0, -0.45, 0);
  addVoxelBox(bellGroup, 1.5, 0.98, 1.5, gold, 0, -1.15, 0);
  addVoxelBox(bellGroup, 1.95, 0.45, 1.95, gold, 0, -1.78, 0);
  addVoxelBox(bellGroup, 0.42, 0.52, 0.42, stoneD, 0, -2.06, 0);
  group.add(bellGroup);

  const beamGeo = new THREE.CylinderGeometry(0.26, 0.82, 36, 8, 1, true);
  const beaconBeam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({
      color: 0xffe078,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  beaconBeam.position.y = 45;
  group.add(beaconBeam);

  return { group, bellGroup, beaconBeam, banners };
}

export interface ShrineRig {
  id: string;
  name: string;
  group: THREE.Group;
  crystal: THREE.Group;
  beam: THREE.Mesh;
  runeMats: THREE.MeshStandardMaterial[];
  x: number;
  y: number;
  z: number;
  activated: boolean;
}

export function buildBellShrine(
  mats: MaterialLibrary,
  id: string,
  name: string,
  accentHex: string,
  x: number,
  y: number,
  z: number
): ShrineRig {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const stone = mats.getMat('#626675', { roughness: 0.82, bump: 'stone', pattern: 'stone' });
  const stoneD = mats.getMat('#3c404c', { roughness: 0.88, bump: 'stone', pattern: 'stone' });
  const stoneL = mats.getMat('#969aa6', { roughness: 0.78, bump: 'stone', pattern: 'stone' });
  const moss = mats.getMat('#488c3a', { roughness: 0.92 });
  const gold = mats.getMat('#f4ca5c', { roughness: 0.22, metalness: 0.88 });
  const runeMat = mats
    .getMat(accentHex, {
      roughness: 0.15,
      emissive: accentHex,
      emissiveIntensity: 1.45,
    })
    .clone();

  // Stepped temple dais with deep hillside foundation skirt + front stairs
  addVoxelBox(group, 7.1, 2.0, 7.1, stoneD, 0, -0.98, 0);
  addVoxelBox(group, 6.8, 0.55, 6.8, stoneD, 0, 0.28, 0);
  addVoxelBox(group, 5.2, 0.42, 5.2, stone, 0, 0.72, 0);
  addVoxelBox(group, 2.8, 0.34, 1.2, stoneL, 0, 0.18, 3.6);
  addVoxelBox(group, 2.3, 0.34, 0.85, stoneL, 0, 0.52, 2.9);

  // Flanking fire braziers on front dais corners
  for (const s of [-1, 1]) {
    addVoxelBox(group, 0.85, 1.35, 0.85, stoneD, s * 2.55, 1.2, 2.35);
    addVoxelBox(group, 1.05, 0.28, 1.05, gold, s * 2.55, 1.98, 2.35);
    addVoxelBox(group, 0.58, 0.45, 0.58, runeMat, s * 2.55, 2.3, 2.35, false);
  }

  // Monumental BotW-inspired carved shrine archway behind altar
  for (const s of [-1, 1]) {
    addVoxelBox(group, 1.15, 5.4, 1.25, stoneD, s * 2.15, 3.3, -1.65);
    addVoxelBox(group, 0.32, 4.3, 1.32, runeMat, s * 2.15, 3.35, -1.65, false);
    addVoxelBox(group, 1.42, 0.58, 1.45, stoneL, s * 2.15, 6.05, -1.65);
    addVoxelBox(group, 0.85, 0.25, 0.9, moss, s * 2.45, 6.45, -1.65);
  }
  addVoxelBox(group, 6.2, 0.98, 1.42, stoneD, 0, 6.55, -1.65);
  addVoxelBox(group, 4.4, 0.78, 1.12, stone, 0, 7.35, -1.65);
  addVoxelBox(group, 2.4, 0.68, 0.9, gold, 0, 8.0, -1.65);
  addVoxelBox(group, 3.6, 0.24, 1.48, runeMat, 0, 6.55, -1.65, false);

  // Ornate central altar pedestal
  addVoxelBox(group, 1.55, 1.15, 1.55, stoneD, 0, 1.45, 0.4);
  addVoxelBox(group, 1.75, 0.2, 1.75, gold, 0, 2.12, 0.4);
  addVoxelBox(group, 1.2, 0.14, 1.2, runeMat, 0, 2.28, 0.4, false);

  // Floating rotating Bell Crystal with gilded halo ring
  const crystal = new THREE.Group();
  crystal.position.set(0, 3.15, 0.4);
  const c1 = addVoxelBox(crystal, 0.64, 0.64, 0.64, runeMat, 0, 0, 0, false);
  c1.rotation.set(Math.PI / 4, Math.PI / 4, 0);
  const c2 = addVoxelBox(crystal, 0.92, 0.14, 0.92, gold, 0, 0, 0, false);
  c2.rotation.y = Math.PI / 4;
  const c3 = addVoxelBox(crystal, 0.14, 0.92, 0.92, gold, 0, 0, 0, false);
  c3.rotation.x = Math.PI / 4;
  group.add(crystal);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.55, 28, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  beam.position.set(0, 15, 0.4);
  group.add(beam);

  return {
    id,
    name,
    group,
    crystal,
    beam,
    runeMats: [runeMat],
    x,
    y,
    z,
    activated: false,
  };
}

export function buildCottage(
  mats: MaterialLibrary,
  opts: { w: number; d: number; roofColor: string; wallColor?: string; hasChimney?: boolean; isSmithy?: boolean }
): THREE.Group {
  const g = new THREE.Group();
  const { w, d, roofColor } = opts;
  const wallH = 2.8;

  const wall = mats.getMat(opts.wallColor ?? '#efe3c8', { roughness: 0.88, bump: 'stone', pattern: 'stone' });
  const stoneBase = mats.getMat('#8e8b82', { roughness: 0.88, bump: 'stone', pattern: 'stone' });
  const beam = mats.getMat('#684121', { roughness: 0.8, bump: 'wood', pattern: 'wood' });
  const shutterWood = mats.getMat('#4f6b4a', { roughness: 0.78, bump: 'wood', pattern: 'wood' });
  const doorWood = mats.getMat('#543419', { roughness: 0.78, bump: 'wood', pattern: 'wood' });
  const roof = mats.getMat(roofColor, { roughness: 0.8, pattern: 'roof' });
  const roofDark = mats.getMat(new THREE.Color(roofColor).multiplyScalar(0.8).getHex(), {
    roughness: 0.84,
    pattern: 'roof',
  });
  const winGlow = mats.getMat('#ffe5a4', { roughness: 0.22, emissive: '#ffba48', emissiveIntensity: 0.65 });
  const gold = mats.getMat('#f4ca5c', { roughness: 0.25, metalness: 0.85 });
  const leaf = mats.getMat('#4ca840', { roughness: 0.86 });
  const flowerR = mats.getMat('#f06464', { roughness: 0.7 });
  const flowerY = mats.getMat('#ffd854', { roughness: 0.7 });

  // Deep stone foundation skirt (anchors solidly on slopes!) & plaster walls
  addVoxelBox(g, w + 0.34, 1.8, d + 0.34, stoneBase, 0, -0.88, 0);
  addVoxelBox(g, w + 0.26, 0.5, d + 0.26, stoneBase, 0, 0.25, 0);
  addVoxelBox(g, w, wallH, d, wall, 0, 0.5 + wallH / 2, 0);

  // Half-timbered oak corner posts, horizontal rails & diagonal cross braces
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addVoxelBox(g, 0.24, wallH + 0.14, 0.24, beam, sx * (w / 2 - 0.02), 0.5 + wallH / 2, sz * (d / 2 - 0.02));
    }
  }
  addVoxelBox(g, w + 0.1, 0.18, d + 0.1, beam, 0, 0.5 + wallH * 0.52, 0);
  addVoxelBox(g, w + 0.16, 0.2, d + 0.16, beam, 0, 0.5 + wallH - 0.05, 0);

  // Recessed arched-lintel front door + wooden porch awning + stone steps + hanging lantern
  const frontZ = d / 2;
  addVoxelBox(g, 1.15, 1.85, 0.14, doorWood, 0, 1.42, frontZ + 0.02);
  addVoxelBox(g, 1.38, 0.2, 0.22, beam, 0, 2.38, frontZ + 0.05);
  addVoxelBox(g, 0.12, 0.12, 0.08, gold, 0.36, 1.35, frontZ + 0.12);
  addVoxelBox(g, 1.55, 0.22, 0.78, stoneBase, 0, 0.11, frontZ + 0.36);
  // Small timber porch canopy over front door
  const awning = addVoxelBox(g, 1.75, 0.14, 0.85, roofDark, 0, 2.62, frontZ + 0.42);
  awning.rotation.x = 0.22;
  addVoxelBox(g, 0.14, 2.2, 0.14, beam, -0.78, 1.45, frontZ + 0.72);
  addVoxelBox(g, 0.14, 2.2, 0.14, beam, 0.78, 1.45, frontZ + 0.72);
  // Warm entry sconce lantern
  addVoxelBox(g, 0.22, 0.28, 0.22, winGlow, 0.88, 2.1, frontZ + 0.22, false);
  addVoxelBox(g, 0.28, 0.08, 0.28, mats.getMat('#383e48', { metalness: 0.7, roughness: 0.4 }), 0.88, 2.28, frontZ + 0.22);

  // Mullioned warm windows with wooden shutters & blooming flowerboxes!
  const addWindow = (wx: number, wy: number, wz: number, rotY: number) => {
    const wg = new THREE.Group();
    wg.position.set(wx, wy, wz);
    wg.rotation.y = rotY;
    addVoxelBox(wg, 0.84, 0.84, 0.12, beam, 0, 0, 0);
    addVoxelBox(wg, 0.64, 0.64, 0.14, winGlow, 0, 0, 0.01, false);
    // Window cross mullions
    addVoxelBox(wg, 0.07, 0.68, 0.16, beam, 0, 0, 0.02);
    addVoxelBox(wg, 0.68, 0.07, 0.16, beam, 0, 0, 0.02);
    // Painted shutters on left & right
    addVoxelBox(wg, 0.26, 0.78, 0.08, shutterWood, -0.55, 0, 0.03);
    addVoxelBox(wg, 0.26, 0.78, 0.08, shutterWood, 0.55, 0, 0.03);
    // Window flowerbox with leafy blooms
    addVoxelBox(wg, 0.94, 0.22, 0.28, doorWood, 0, -0.48, 0.14);
    addVoxelBox(wg, 0.82, 0.16, 0.2, leaf, 0, -0.32, 0.15);
    addVoxelBox(wg, 0.14, 0.14, 0.14, flowerR, -0.24, -0.22, 0.17, false);
    addVoxelBox(wg, 0.14, 0.14, 0.14, flowerY, 0.04, -0.2, 0.18, false);
    addVoxelBox(wg, 0.14, 0.14, 0.14, flowerR, 0.28, -0.23, 0.16, false);
    g.add(wg);
  };

  for (const sx of [-1, 1]) {
    if (w >= 4.8) {
      addWindow(sx * (w * 0.32), 1.85, frontZ + 0.02, 0);
    }
    addWindow(sx * (w / 2 + 0.02), 1.85, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  // Stepped shingled storybook gable roof with ridge beam & decorative gable finials
  const steps = 6;
  const ov = 0.52;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const dd = (d + ov * 2) * (1 - t * 0.86);
    addVoxelBox(g, w + ov * 2, 0.36, dd, i % 2 === 0 ? roof : roofDark, 0, 0.5 + wallH + 0.16 + i * 0.33, 0);
  }
  const ridgeY = 0.5 + wallH + 0.16 + steps * 0.33;
  addVoxelBox(g, w + ov * 2 + 0.2, 0.24, 0.44, beam, 0, ridgeY, 0);
  for (const sx of [-1, 1]) {
    addVoxelBox(g, 0.22, 0.55, 0.22, beam, sx * (w / 2 + ov), ridgeY + 0.24, 0);
  }

  // Stacked firewood rack & rain barrel tucked beside cottage wall
  const barrelWood = mats.getMat('#805028', { roughness: 0.8, bump: 'wood', pattern: 'wood' });
  const iron = mats.getMat('#3c424e', { roughness: 0.38, metalness: 0.78 });
  addVoxelBox(g, 0.66, 0.85, 0.66, barrelWood, -w / 2 - 0.45, 0.42, d * 0.28);
  addVoxelBox(g, 0.7, 0.08, 0.7, iron, -w / 2 - 0.45, 0.22, d * 0.28);
  addVoxelBox(g, 0.7, 0.08, 0.7, iron, -w / 2 - 0.45, 0.66, d * 0.28);
  for (let l = 0; l < 3; l++) {
    addVoxelBox(g, 0.24, 0.22, 0.95, beam, w / 2 + 0.34, 0.14 + l * 0.22, -d * 0.24);
  }

  if (opts.hasChimney || opts.isSmithy) {
    addVoxelBox(g, 1.0, 5.1, 1.0, stoneBase, w * 0.32, 2.9, -d * 0.22);
    addVoxelBox(g, 1.24, 0.26, 1.24, mats.getMat('#5a5854', { bump: 'stone' }), w * 0.32, 5.55, -d * 0.22);
    addVoxelBox(g, 0.58, 0.42, 0.58, mats.getMat('#b85438', { roughness: 0.8 }), w * 0.32, 5.85, -d * 0.22); // terracotta chimney pot
  }

  if (opts.isSmithy) {
    // Detailed outdoor forge hearth, glowing coals, iron anvil & weapon rack!
    const fx = w / 2 + 1.5;
    addVoxelBox(g, 0.72, 0.48, 0.48, iron, fx, 0.24, 0.5);
    addVoxelBox(g, 1.08, 0.26, 0.52, mats.getMat('#808898', { roughness: 0.28, metalness: 0.85 }), fx, 0.58, 0.5);
    addVoxelBox(g, 1.35, 0.9, 1.1, stoneBase, fx, 0.45, -1.05);
    addVoxelBox(
      g,
      0.85,
      0.22,
      0.68,
      mats.getMat('#ff6e24', { emissive: '#ff5210', emissiveIntensity: 1.5 }),
      fx,
      0.95,
      -1.05,
      false
    );
  }

  return g;
}

export function buildCampfire(mats: MaterialLibrary, withPot = true): {
  group: THREE.Group;
  flame1: THREE.Mesh;
  flame2: THREE.Mesh;
  light: THREE.PointLight;
} {
  const group = new THREE.Group();
  const stone = mats.getMat('#7c808c', { roughness: 0.88, bump: 'stone', pattern: 'stone' });
  const stoneD = mats.getMat('#585c68', { roughness: 0.9, bump: 'stone' });
  const log = mats.getMat('#684222', { roughness: 0.85, bump: 'wood', pattern: 'wood' });
  const iron = mats.getMat('#363a44', { roughness: 0.38, metalness: 0.8 });
  const embers = mats.getMat('#c43a18', { emissive: '#ff4810', emissiveIntensity: 1.1, roughness: 0.6 });
  const f1Mat = mats.getMat('#ff7a22', { emissive: '#ff6a14', emissiveIntensity: 1.55, roughness: 0.3 });
  const f2Mat = mats.getMat('#ffe872', { emissive: '#ffd84a', emissiveIntensity: 1.85, roughness: 0.2 });

  // Detailed stone hearth ring with alternating sizes
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const h = i % 2 === 0 ? 0.28 : 0.21;
    addVoxelBox(group, 0.36, h, 0.32, i % 2 ? stone : stoneD, Math.cos(a) * 0.82, h / 2, Math.sin(a) * 0.82);
  }
  // Glowing charcoal ember bed
  addVoxelBox(group, 1.15, 0.1, 1.15, embers, 0, 0.06, 0, false);

  // Crossed charred logs + nearby seating log
  for (let i = 0; i < 3; i++) {
    const l = addVoxelBox(group, 1.05, 0.16, 0.18, log, 0, 0.16 + i * 0.03, 0);
    l.rotation.y = i * 1.05 + 0.3;
  }

  const flame1 = addVoxelBox(group, 0.38, 0.54, 0.38, f1Mat, 0, 0.44, 0, false, false);
  const flame2 = addVoxelBox(group, 0.22, 0.44, 0.22, f2Mat, 0, 0.58, 0, false, false);

  if (withPot) {
    // Tripod with iron chain & BotW cooking cauldron filled with simmering veggies
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const pole = addVoxelBox(group, 0.11, 2.1, 0.11, log, Math.cos(a) * 0.66, 0.94, Math.sin(a) * 0.66);
      pole.rotation.z = Math.cos(a) * 0.32;
      pole.rotation.x = -Math.sin(a) * 0.32;
    }
    addVoxelBox(group, 0.16, 0.16, 0.16, iron, 0, 1.85, 0); // apex lash ring
    addVoxelBox(group, 0.06, 0.68, 0.06, iron, 0, 1.48, 0); // suspension chain
    addVoxelBox(group, 0.84, 0.44, 0.84, iron, 0, 0.88, 0);
    addVoxelBox(group, 0.94, 0.09, 0.94, iron, 0, 1.12, 0);
    addVoxelBox(group, 0.68, 0.06, 0.68, mats.getMat('#de7e2c', { emissive: '#a84812', emissiveIntensity: 0.4 }), 0, 1.11, 0, false);
    // Hearty chunks & wooden ladle sticking out of stew
    addVoxelBox(group, 0.14, 0.12, 0.14, mats.getMat('#e84a38'), -0.15, 1.16, 0.1, false);
    addVoxelBox(group, 0.14, 0.12, 0.14, mats.getMat('#5ec248'), 0.16, 1.16, -0.08, false);
    const ladle = addVoxelBox(group, 0.08, 0.62, 0.08, mats.getMat('#a4703c', { bump: 'wood' }), 0.28, 1.32, 0.18);
    ladle.rotation.z = -0.45;
  }

  const light = new THREE.PointLight(0xffa44c, 2.4, 11, 1.6);
  light.position.set(0, 1.0, 0);
  group.add(light);

  return { group, flame1, flame2, light };
}

export function buildTreasureChest(mats: MaterialLibrary): {
  group: THREE.Group;
  lid: THREE.Group;
  glow: THREE.Mesh;
} {
  const group = new THREE.Group();
  const wood = mats.getMat('#7d4f28', { roughness: 0.78, bump: 'wood', pattern: 'wood' });
  const woodL = mats.getMat('#a8703a', { roughness: 0.74, bump: 'wood', pattern: 'wood' });
  const gold = mats.getMat('#f4ca5c', { roughness: 0.22, metalness: 0.88 });
  const gem = mats.getMat('#48c8ff', { emissive: '#2298e8', emissiveIntensity: 0.9, roughness: 0.15 });

  addVoxelBox(group, 1.18, 0.64, 0.8, wood, 0, 0.32, 0);
  addVoxelBox(group, 1.26, 0.1, 0.86, gold, 0, 0.06, 0);
  for (const s of [-1, 1]) {
    addVoxelBox(group, 0.13, 0.58, 0.86, gold, s * 0.48, 0.32, 0);
    // Side iron carrying rings
    addVoxelBox(group, 0.08, 0.18, 0.22, gold, s * 0.62, 0.38, 0);
  }

  const lid = new THREE.Group();
  lid.position.set(0, 0.64, -0.4);
  addVoxelBox(lid, 1.2, 0.26, 0.82, woodL, 0, 0.13, 0.4);
  addVoxelBox(lid, 1.12, 0.16, 0.62, woodL, 0, 0.32, 0.4); // domed top tier
  addVoxelBox(lid, 1.24, 0.1, 0.86, gold, 0, 0.24, 0.4);
  for (const s of [-1, 1]) {
    addVoxelBox(lid, 0.13, 0.34, 0.86, gold, s * 0.48, 0.2, 0.4);
  }
  addVoxelBox(lid, 0.22, 0.26, 0.1, gold, 0, 0.02, 0.84);
  addVoxelBox(lid, 0.1, 0.1, 0.12, gem, 0, 0.04, 0.85, false);
  group.add(lid);

  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.2, 0.58),
    new THREE.MeshBasicMaterial({ color: 0xffe478, transparent: true, opacity: 0.88 })
  );
  glow.position.set(0, 0.64, 0);
  glow.visible = false;
  group.add(glow);

  return { group, lid, glow };
}

export function buildNpcOdo(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const tun = mats.getMat('#7e5232', { roughness: 0.84, pattern: 'cloth' });
  const mantle = mats.getMat('#3f6e4c', { roughness: 0.84, pattern: 'cloth' });
  const skin = mats.getMat('#cc9266', { roughness: 0.72 });
  const beard = mats.getMat('#e0ded8', { roughness: 0.88 });
  const boot = mats.getMat('#3c2d24', { roughness: 0.84, bump: 'wood' });
  const belt = mats.getMat('#442c1a', { roughness: 0.75, bump: 'wood' });
  const gold = mats.getMat('#f4ca5c', { roughness: 0.24, metalness: 0.86 });
  const hat = mats.getMat('#5a422c', { roughness: 0.85, pattern: 'cloth' });

  // Grounded boots & trousers
  for (const s of [-1, 1]) {
    addVoxelBox(g, 0.2, 0.46, 0.22, mats.getMat('#564a3e', { pattern: 'cloth' }), s * 0.14, 0.5, 0);
    addVoxelBox(g, 0.21, 0.28, 0.28, boot, s * 0.14, 0.14, 0.03);
  }
  // Layered Warden coat, forest ranger mantle, satchel & gold clasp
  addVoxelBox(g, 0.56, 0.68, 0.34, tun, 0, 1.02, 0);
  addVoxelBox(g, 0.66, 0.22, 0.4, mantle, 0, 1.28, -0.02);
  addVoxelBox(g, 0.58, 0.1, 0.36, belt, 0, 0.8, 0);
  addVoxelBox(g, 0.12, 0.1, 0.05, gold, 0, 0.8, 0.19);
  addVoxelBox(g, 0.16, 0.18, 0.14, belt, -0.3, 0.76, 0.06); // scroll pouch

  // Head + expressive brows, bushy white beard & weathered ranger hood-cap
  addVoxelBox(g, 0.36, 0.36, 0.34, skin, 0, 1.58, 0);
  addVoxelBox(g, 0.36, 0.22, 0.12, beard, 0, 1.43, 0.15);
  addVoxelBox(g, 0.24, 0.18, 0.1, beard, 0, 1.27, 0.16);
  addVoxelBox(g, 0.08, 0.06, 0.06, skin, 0, 1.54, 0.19); // nose
  addVoxelBox(g, 0.42, 0.12, 0.4, beard, 0, 1.75, 0);
  addVoxelBox(g, 0.48, 0.08, 0.46, hat, 0, 1.82, 0);
  addVoxelBox(g, 0.36, 0.16, 0.34, hat, 0, 1.92, -0.02);
  for (const s of [-1, 1]) {
    addVoxelBox(g, 0.06, 0.065, 0.02, mats.getMat('#1b2230'), s * 0.085, 1.6, 0.175, false);
    addVoxelBox(g, 0.09, 0.035, 0.03, beard, s * 0.085, 1.66, 0.18, false); // bushy brows
    addVoxelBox(g, 0.17, 0.54, 0.17, tun, s * 0.37, 1.04, 0);
    addVoxelBox(g, 0.13, 0.13, 0.13, skin, s * 0.37, 0.74, 0.04);
  }
  // Ornate carved walking staff with hanging iron lantern
  addVoxelBox(g, 0.08, 2.02, 0.08, mats.getMat('#6b4423', { bump: 'wood' }), 0.5, 1.01, 0.15);
  addVoxelBox(g, 0.24, 0.08, 0.08, mats.getMat('#6b4423'), 0.58, 2.0, 0.15);
  addVoxelBox(g, 0.24, 0.06, 0.24, mats.getMat('#383e48', { metalness: 0.7 }), 0.66, 1.92, 0.15);
  addVoxelBox(
    g,
    0.18,
    0.24,
    0.18,
    mats.getMat('#ffe688', { emissive: '#ffbc42', emissiveIntensity: 1.3 }),
    0.66,
    1.76,
    0.15,
    false
  );
  addVoxelBox(g, 0.22, 0.06, 0.22, mats.getMat('#383e48', { metalness: 0.7 }), 0.66, 1.62, 0.15);

  return g;
}

export function buildNpcVillager(
  mats: MaterialLibrary,
  role: 'herbalist' | 'blacksmith' | 'merchant' | 'wizard' | 'prospector'
): THREE.Group {
  const g = new THREE.Group();
  const isSmith = role === 'blacksmith';
  const isWizard = role === 'wizard';
  const isMerchant = role === 'merchant';
  const isProspector = role === 'prospector';

  const skin = mats.getMat(isSmith || isProspector ? '#d49a70' : '#f2c6a2', { roughness: 0.72 });
  const tunicHex = isSmith
    ? '#5a4e46'
    : isWizard
      ? '#2658b8'
      : isMerchant
        ? '#9c342e'
        : isProspector
          ? '#7c4c28'
          : '#c65848';
  const apronHex = isSmith
    ? '#4a3220'
    : isWizard
      ? '#e8ecf6'
      : isMerchant
        ? '#d8b66c'
        : isProspector
          ? '#464e5c'
          : '#f4ecd8';
  const hairHex = isSmith ? '#2d2420' : isWizard ? '#e6eaf2' : isProspector ? '#c46a28' : '#b8682c';

  const tunic = mats.getMat(tunicHex, { roughness: 0.84, pattern: 'cloth' });
  const apron = mats.getMat(apronHex, { roughness: 0.82, pattern: 'cloth' });
  const hair = mats.getMat(hairHex, { roughness: 0.8 });
  const boot = mats.getMat('#3d2c20', { roughness: 0.84, bump: 'wood' });
  const gold = mats.getMat('#f4ca5c', { roughness: 0.25, metalness: 0.85 });

  for (const s of [-1, 1]) {
    addVoxelBox(g, 0.19, 0.44, 0.2, mats.getMat(isSmith || isProspector ? '#3e3a38' : isWizard ? '#1d3c7a' : '#785a44'), s * 0.13, 0.48, 0);
    addVoxelBox(g, 0.2, 0.26, 0.26, boot, s * 0.13, 0.13, 0.03);
  }
  addVoxelBox(g, 0.52, 0.66, 0.3, tunic, 0, 1.0, 0);
  addVoxelBox(g, 0.4, 0.58, 0.05, apron, 0, 0.92, 0.165);
  addVoxelBox(g, 0.54, 0.08, 0.32, isWizard ? gold : mats.getMat('#5a391e'), 0, 0.82, 0);

  // Head & expressive face
  addVoxelBox(g, 0.35, 0.35, 0.33, skin, 0, 1.54, 0);
  for (const s of [-1, 1]) {
    addVoxelBox(g, 0.06, 0.07, 0.02, mats.getMat('#1c2434'), s * 0.08, 1.55, 0.17, false);
    addVoxelBox(g, 0.02, 0.02, 0.01, mats.getMat('#ffffff'), s * 0.08 - 0.01, 1.57, 0.18, false);
    addVoxelBox(g, 0.15, 0.48, 0.15, tunic, s * 0.34, 1.02, 0);
    addVoxelBox(g, 0.12, 0.12, 0.12, skin, s * 0.34, 0.74, 0.04);
  }

  if (isSmith) {
    // Blacksmith hair, brass forge goggles & heavy iron smithing hammer!
    addVoxelBox(g, 0.38, 0.12, 0.36, hair, 0, 1.72, 0);
    addVoxelBox(g, 0.3, 0.12, 0.08, hair, 0, 1.4, 0.15);
    addVoxelBox(g, 0.39, 0.08, 0.06, gold, 0, 1.66, 0.17);
    addVoxelBox(g, 0.12, 0.1, 0.07, mats.getMat('#72e0ff', { emissive: '#38a8e0', emissiveIntensity: 0.4 }), -0.09, 1.66, 0.19, false);
    addVoxelBox(g, 0.12, 0.1, 0.07, mats.getMat('#72e0ff', { emissive: '#38a8e0', emissiveIntensity: 0.4 }), 0.09, 1.66, 0.19, false);
    addVoxelBox(g, 0.07, 0.56, 0.07, mats.getMat('#7a4e26', { bump: 'wood' }), 0.38, 0.86, 0.24);
    addVoxelBox(g, 0.22, 0.2, 0.34, mats.getMat('#545c6c', { metalness: 0.8, roughness: 0.35 }), 0.38, 1.12, 0.28);
  } else if (isWizard) {
    // Archmage pointed azure hat, silver beard & arcane crystal staff!
    addVoxelBox(g, 0.28, 0.24, 0.08, hair, 0, 1.32, 0.16);
    addVoxelBox(g, 0.66, 0.07, 0.66, tunic, 0, 1.74, 0);
    addVoxelBox(g, 0.42, 0.22, 0.42, tunic, 0, 1.88, 0);
    addVoxelBox(g, 0.26, 0.24, 0.26, tunic, 0, 2.1, 0);
    addVoxelBox(g, 0.14, 0.18, 0.14, gold, 0, 2.28, 0);
    addVoxelBox(g, 0.08, 1.65, 0.08, mats.getMat('#7a4e26', { bump: 'wood' }), 0.42, 0.92, 0.2);
    addVoxelBox(g, 0.22, 0.24, 0.22, mats.getMat('#62e4ff', { emissive: '#3ac8ff', emissiveIntensity: 1.2 }), 0.42, 1.84, 0.2, false);
  } else if (isMerchant) {
    // Valenrock Grand Exchange plumed cap & coin ledger!
    addVoxelBox(g, 0.42, 0.14, 0.42, mats.getMat('#2a3444'), 0, 1.74, 0);
    addVoxelBox(g, 0.1, 0.28, 0.08, gold, 0.22, 1.88, 0.02, false);
    addVoxelBox(g, 0.3, 0.08, 0.24, mats.getMat('#f4ead0'), -0.32, 0.82, 0.22, false);
  } else if (isProspector) {
    // Dwarven Quarry helmet with lantern & iron pickaxe!
    addVoxelBox(g, 0.32, 0.22, 0.09, hair, 0, 1.34, 0.16);
    addVoxelBox(g, 0.44, 0.18, 0.44, mats.getMat('#6a7280', { metalness: 0.7, roughness: 0.4 }), 0, 1.76, 0);
    addVoxelBox(g, 0.14, 0.12, 0.08, mats.getMat('#ffe266', { emissive: '#ffbe32', emissiveIntensity: 1.4 }), 0, 1.78, 0.24, false);
    addVoxelBox(g, 0.07, 0.72, 0.07, mats.getMat('#7a4e26', { bump: 'wood' }), 0.38, 0.94, 0.24);
    addVoxelBox(g, 0.56, 0.1, 0.1, mats.getMat('#5a687c', { metalness: 0.85, roughness: 0.3 }), 0.38, 1.28, 0.26);
  } else {
    // Herbalist straw sun-hat with floral ribbon & wicker apple basket!
    addVoxelBox(g, 0.38, 0.18, 0.36, hair, 0, 1.64, -0.04);
    addVoxelBox(g, 0.64, 0.07, 0.64, mats.getMat('#e8c874', { roughness: 0.88, pattern: 'cloth' }), 0, 1.73, 0);
    addVoxelBox(g, 0.38, 0.16, 0.38, mats.getMat('#e8c874', { roughness: 0.88, pattern: 'cloth' }), 0, 1.84, 0);
    addVoxelBox(g, 0.4, 0.05, 0.4, mats.getMat('#d85050'), 0, 1.78, 0);
    addVoxelBox(g, 0.12, 0.12, 0.08, mats.getMat('#fff080'), 0.2, 1.82, 0.18, false);
    // Wicker harvest basket
    addVoxelBox(g, 0.36, 0.26, 0.28, mats.getMat('#b88448', { bump: 'wood' }), -0.34, 0.72, 0.18);
    addVoxelBox(g, 0.14, 0.14, 0.14, mats.getMat('#e84238'), -0.4, 0.88, 0.18, false);
    addVoxelBox(g, 0.14, 0.14, 0.14, mats.getMat('#5cc248'), -0.27, 0.88, 0.2, false);
  }

  return g;
}

export function buildMonsterWatchtower(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const log = mats.getMat('#6b4524', { roughness: 0.85, bump: 'wood', pattern: 'wood' });
  const plank = mats.getMat('#966638', { roughness: 0.82, bump: 'wood', pattern: 'wood' });
  const cloth = mats.getMat('#c43a34', { roughness: 0.84, pattern: 'cloth' });
  const bone = mats.getMat('#e8e0cc', { roughness: 0.75 });

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addVoxelBox(g, 0.38, 5.4, 0.38, log, sx * 1.45, 2.7, sz * 1.45);
      // Angled wooden cross-braces
      const brace = addVoxelBox(g, 0.18, 2.2, 0.18, log, sx * 1.45, 2.1, sz * 0.72);
      brace.rotation.x = sz * 0.6;
    }
  }
  addVoxelBox(g, 3.7, 0.3, 3.7, plank, 0, 3.4, 0);
  addVoxelBox(g, 3.6, 0.2, 0.18, log, 0, 4.28, 1.65);
  addVoxelBox(g, 3.6, 0.2, 0.18, log, 0, 4.28, -1.65);
  addVoxelBox(g, 0.18, 0.2, 3.6, log, 1.65, 4.28, 0);
  addVoxelBox(g, 0.18, 0.2, 3.6, log, -1.65, 4.28, 0);
  // Horned lookout trophy on front railing
  addVoxelBox(g, 0.52, 0.42, 0.28, bone, 0, 4.35, 1.78);
  addVoxelBox(g, 0.14, 0.32, 0.12, bone, -0.32, 4.62, 1.78);
  addVoxelBox(g, 0.14, 0.32, 0.12, bone, 0.32, 4.62, 1.78);
  for (let y = 0.5; y <= 3.1; y += 0.55) {
    addVoxelBox(g, 0.88, 0.11, 0.12, plank, 0, y, 1.72);
  }
  addVoxelBox(g, 0.12, 2.2, 0.12, log, 1.5, 5.6, 1.5);
  addVoxelBox(g, 1.25, 0.7, 0.08, cloth, 2.12, 6.1, 1.5);
  addVoxelBox(g, 0.45, 0.26, 0.1, mats.getMat('#ffbe40'), 2.0, 6.1, 1.5);
  return g;
}

export function buildCrackedBoulder(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const rock = mats.getMat('#6e6a74', { roughness: 0.9, bump: 'stone', pattern: 'stone' });
  const rockD = mats.getMat('#4a4852', { roughness: 0.92, bump: 'stone', pattern: 'stone' });
  const crack = mats.getMat('#ff8a34', { emissive: '#ff6418', emissiveIntensity: 1.45, roughness: 0.3 });

  addVoxelBox(g, 2.6, 2.2, 2.4, rock, 0, 1.1, 0);
  addVoxelBox(g, 2.1, 1.5, 2.8, rockD, 0.15, 0.85, -0.1);
  addVoxelBox(g, 1.6, 0.95, 1.8, rock, -0.1, 2.35, 0.1);
  addVoxelBox(g, 2.68, 0.16, 0.28, crack, 0, 1.25, 0.4, false);
  addVoxelBox(g, 0.22, 1.65, 2.48, crack, 0.3, 1.15, 0, false);
  return g;
}

export function buildStasisBoulder(mats: MaterialLibrary): {
  group: THREE.Group;
  coreMats: THREE.MeshStandardMaterial[];
  arrowIndicator: THREE.Group;
} {
  const group = new THREE.Group();
  const stone = mats.getMat('#808696', { roughness: 0.76, bump: 'stone', pattern: 'stone' }).clone();
  const trim = mats.getMat('#525868', { roughness: 0.82, bump: 'stone' }).clone();
  const rune = mats.getMat('#5ec8e8', { emissive: '#2ea8d4', emissiveIntensity: 0.65, roughness: 0.25 }).clone();

  addVoxelBox(group, 1.54, 1.54, 1.54, stone, 0, 0.85, 0);
  addVoxelBox(group, 1.86, 1.14, 1.18, trim, 0, 0.85, 0);
  addVoxelBox(group, 1.18, 1.86, 1.14, trim, 0, 0.85, 0);
  addVoxelBox(group, 1.14, 1.18, 1.86, trim, 0, 0.85, 0);
  addVoxelBox(group, 1.68, 0.22, 1.68, rune, 0, 0.85, 0, false);

  const arrowIndicator = new THREE.Group();
  arrowIndicator.position.set(0, 1.0, 0);
  const arrowMat = mats.getMat('#ff4838', { emissive: '#ff3020', emissiveIntensity: 1.5, roughness: 0.2 });
  addVoxelBox(arrowIndicator, 0.24, 0.24, 1.7, arrowMat, 0, 0, 1.2, false, false);
  addVoxelBox(arrowIndicator, 0.65, 0.32, 0.45, arrowMat, 0, 0, 2.15, false, false);
  arrowIndicator.visible = false;
  group.add(arrowIndicator);

  return { group, coreMats: [stone, trim, rune], arrowIndicator };
}

export function buildExplosiveBarrel(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const red = mats.getMat('#c83c2f', { roughness: 0.76, bump: 'wood', pattern: 'wood' });
  const iron = mats.getMat('#3c404a', { roughness: 0.38, metalness: 0.78 });
  const warn = mats.getMat('#ffbe3b', { emissive: '#ff8a18', emissiveIntensity: 0.88, roughness: 0.3 });

  addVoxelBox(g, 0.84, 1.06, 0.84, red, 0, 0.53, 0);
  addVoxelBox(g, 0.9, 0.11, 0.9, iron, 0, 0.2, 0);
  addVoxelBox(g, 0.9, 0.11, 0.9, iron, 0, 0.85, 0);
  addVoxelBox(g, 0.88, 0.24, 0.22, warn, 0, 0.53, 0, false);
  addVoxelBox(g, 0.22, 0.2, 0.9, warn, 0, 0.53, 0, false);
  return g;
}

export function buildSignpost(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const post = mats.getMat('#5a3a1e', { roughness: 0.85, bump: 'wood', pattern: 'wood' });
  const board = mats.getMat('#b88048', { roughness: 0.78, bump: 'wood', pattern: 'wood' });
  const stone = mats.getMat('#82858e', { roughness: 0.9, bump: 'stone' });
  const glow = mats.getMat('#ffe28a', { emissive: '#ffae38', emissiveIntensity: 0.9, roughness: 0.2 });

  // Mossy stone base + framed timber signboard + directional arrow + mini hanging charm
  addVoxelBox(g, 0.48, 0.22, 0.48, stone, 0, 0.11, 0);
  addVoxelBox(g, 0.18, 1.55, 0.18, post, 0, 0.85, 0);
  addVoxelBox(g, 0.26, 0.14, 0.26, post, 0, 1.68, 0);
  addVoxelBox(g, 1.15, 0.66, 0.14, board, 0, 1.24, 0.05);
  addVoxelBox(g, 1.24, 0.08, 0.18, post, 0, 1.58, 0.05);
  addVoxelBox(g, 1.24, 0.08, 0.18, post, 0, 0.9, 0.05);
  for (let i = 0; i < 3; i++) {
    addVoxelBox(g, 0.72 - i * 0.12, 0.05, 0.03, post, -0.05 * i, 1.38 - i * 0.14, 0.13, false);
  }
  // Tiny warm roadside travel lantern hooked to side
  addVoxelBox(g, 0.34, 0.06, 0.06, post, 0.66, 1.5, 0.04);
  addVoxelBox(g, 0.18, 0.22, 0.18, glow, 0.78, 1.32, 0.04, false);
  return g;
}

export function buildWell(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const stone = mats.getMat('#92949c', { roughness: 0.86, bump: 'stone', pattern: 'stone' });
  const stoneL = mats.getMat('#b6b8be', { roughness: 0.82, bump: 'stone', pattern: 'stone' });
  const wood = mats.getMat('#6b4423', { roughness: 0.82, bump: 'wood', pattern: 'wood' });
  const roof = mats.getMat('#a44436', { roughness: 0.78, pattern: 'roof' });
  const rope = mats.getMat('#d8be84', { roughness: 0.9 });
  const water = mats.getMat('#2a76b4', { roughness: 0.16, metalness: 0.24 });

  // Stone wall + deep anchor plinth + coping rim (strictly non-overlapping corners)
  addVoxelBox(g, 1.72, 1.0, 1.72, stone, 0, -0.49, 0);
  addVoxelBox(g, 1.66, 0.86, 0.3, stone, 0, 0.43, -0.68);
  addVoxelBox(g, 1.66, 0.86, 0.3, stone, 0, 0.43, 0.68);
  addVoxelBox(g, 0.3, 0.86, 1.04, stone, -0.68, 0.43, 0);
  addVoxelBox(g, 0.3, 0.86, 1.04, stone, 0.68, 0.43, 0);
  addVoxelBox(g, 1.84, 0.14, 1.84, stoneL, 0, 0.93, 0);
  addVoxelBox(g, 1.16, 0.08, 1.16, water, 0, 0.62, 0, false);

  // Timber uprights, windlass crank, coiled rope & hanging bucket
  addVoxelBox(g, 0.16, 1.8, 0.16, wood, -0.68, 1.75, 0);
  addVoxelBox(g, 0.16, 1.8, 0.16, wood, 0.68, 1.75, 0);
  addVoxelBox(g, 1.56, 0.14, 0.14, wood, 0, 1.82, 0); // windlass axle
  addVoxelBox(g, 0.45, 0.22, 0.22, rope, 0, 1.82, 0); // coiled rope
  addVoxelBox(g, 0.06, 0.68, 0.06, rope, 0, 1.44, 0);
  addVoxelBox(g, 0.34, 0.34, 0.34, wood, 0, 1.12, 0); // wooden water bucket
  // Shingled gable well roof
  addVoxelBox(g, 2.05, 0.2, 1.55, roof, 0, 2.62, 0);
  addVoxelBox(g, 1.65, 0.2, 1.02, roof, 0, 2.82, 0);
  addVoxelBox(g, 1.95, 0.14, 0.24, wood, 0, 3.0, 0);
  return g;
}

export function buildMarketStall(mats: MaterialLibrary, awningColor = '#d64838'): THREE.Group {
  const g = new THREE.Group();
  const wood = mats.getMat('#8a5a30', { roughness: 0.82, bump: 'wood', pattern: 'wood' });
  const woodL = mats.getMat('#b6804a', { roughness: 0.78, bump: 'wood', pattern: 'wood' });
  const awningR = mats.getMat(awningColor, { roughness: 0.82, pattern: 'cloth' });
  const awningW = mats.getMat('#f6eedc', { roughness: 0.84, pattern: 'cloth' });

  addVoxelBox(g, 2.5, 0.85, 1.25, wood, 0, 0.42, 0);
  addVoxelBox(g, 2.66, 0.12, 1.38, woodL, 0, 0.9, 0);
  for (const s of [-1, 1]) {
    addVoxelBox(g, 0.15, 2.38, 0.15, wood, s * 1.15, 1.19, -0.5);
    addVoxelBox(g, 0.15, 2.15, 0.15, wood, s * 1.15, 1.08, 0.5);
  }
  for (let i = 0; i < 5; i++) {
    const strip = addVoxelBox(g, 0.54, 0.14, 1.65, i % 2 ? awningW : awningR, -1.08 + i * 0.54, 2.32, 0.04);
    strip.rotation.x = 0.14;
    // Scalloped front valance drop
    addVoxelBox(g, 0.54, 0.24, 0.06, i % 2 ? awningW : awningR, -1.08 + i * 0.54, 2.08, 0.82);
  }
  // Wicker crates filled with colorful apples, melons, berries & bread loaves
  const fruits = ['#e84a3a', '#f4c852', '#68c448', '#b064e4'];
  for (let i = 0; i < 4; i++) {
    addVoxelBox(g, 0.46, 0.18, 0.46, wood, -0.81 + i * 0.54, 1.04, 0);
    addVoxelBox(g, 0.36, 0.22, 0.36, mats.getMat(fruits[i], { roughness: 0.6 }), -0.81 + i * 0.54, 1.18, 0);
  }
  return g;
}

export function buildApplePickup(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  addVoxelBox(g, 0.3, 0.28, 0.3, mats.getMat('#eb4438', { roughness: 0.4 }), 0, 0.16, 0, false);
  addVoxelBox(g, 0.08, 0.1, 0.04, mats.getMat('#ff9e8e', { roughness: 0.2 }), -0.08, 0.2, 0.14, false);
  addVoxelBox(g, 0.06, 0.11, 0.06, mats.getMat('#5a381e'), 0, 0.34, 0, false);
  addVoxelBox(g, 0.14, 0.06, 0.08, mats.getMat('#4fb83c'), 0.08, 0.35, 0, false);
  return g;
}

export function buildMarkPickup(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const gem = addVoxelBox(
    g,
    0.26,
    0.44,
    0.16,
    mats.getMat('#f4ca5c', { roughness: 0.18, metalness: 0.78, emissive: '#b88218', emissiveIntensity: 0.42 }),
    0,
    0.36,
    0,
    false
  );
  gem.rotation.y = Math.PI / 4;
  return g;
}

export function buildBombMesh(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const shell = mats.getMat('#263248', { roughness: 0.35, metalness: 0.58 });
  const glow = mats.getMat('#3ee8ff', { emissive: '#22c8ff', emissiveIntensity: 1.75, roughness: 0.15 });
  addVoxelBox(g, 0.46, 0.46, 0.46, shell, 0, 0, 0);
  addVoxelBox(g, 0.52, 0.14, 0.52, glow, 0, 0, 0, false);
  addVoxelBox(g, 0.14, 0.52, 0.55, glow, 0, 0, 0, false);
  addVoxelBox(g, 0.2, 0.16, 0.2, mats.getMat('#f0c65a', { metalness: 0.85, roughness: 0.22 }), 0, 0.28, 0);
  return g;
}

export function buildWindmill(mats: MaterialLibrary): { group: THREE.Group; sails: THREE.Group } {
  const group = new THREE.Group();
  const stone = mats.getMat('#92949c', { roughness: 0.86, bump: 'stone', pattern: 'stone' });
  const stoneD = mats.getMat('#686b74', { roughness: 0.9, bump: 'stone', pattern: 'stone' });
  const plaster = mats.getMat('#f0e5cd', { roughness: 0.86, bump: 'stone', pattern: 'stone' });
  const timber = mats.getMat('#6b4423', { roughness: 0.82, bump: 'wood', pattern: 'wood' });
  const roof = mats.getMat('#ad4436', { roughness: 0.78, pattern: 'roof' });
  const roofD = mats.getMat('#8c352a', { roughness: 0.82, pattern: 'roof' });
  const sailCloth = mats.getMat('#f8f0dc', { roughness: 0.84, pattern: 'cloth' });
  const sailTrim = mats.getMat('#388e52', { roughness: 0.82, pattern: 'cloth' });
  const winGlow = mats.getMat('#ffe5a4', { roughness: 0.22, emissive: '#ffba48', emissiveIntensity: 0.65 });
  const sack = mats.getMat('#d8be90', { roughness: 0.9, pattern: 'cloth' });

  // Stone masonry base with deep hillside anchor skirt + timber gallery balcony + half-timbered mill tower
  addVoxelBox(group, 4.9, 1.8, 4.9, stoneD, 0, -0.88, 0);
  addVoxelBox(group, 4.6, 2.7, 4.6, stoneD, 0, 1.35, 0);
  addVoxelBox(group, 5.0, 0.34, 5.0, stone, 0, 2.8, 0);
  addVoxelBox(group, 3.7, 5.2, 3.7, plaster, 0, 5.5, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addVoxelBox(group, 0.32, 5.4, 0.32, timber, sx * 1.8, 5.5, sz * 1.8);
    }
  }
  addVoxelBox(group, 3.95, 0.24, 3.95, timber, 0, 5.3, 0);
  addVoxelBox(group, 3.95, 0.24, 3.95, timber, 0, 8.0, 0);

  // Arched wooden door + stacked flour grain sacks beside entrance
  addVoxelBox(group, 1.15, 1.9, 0.18, timber, 0, 1.0, 2.32);
  addVoxelBox(group, 1.35, 0.2, 0.24, stone, 0, 2.02, 2.34);
  addVoxelBox(group, 0.56, 0.62, 0.45, sack, -1.55, 0.31, 2.55);
  addVoxelBox(group, 0.52, 0.52, 0.42, sack, -1.02, 0.26, 2.65);

  // Mullioned warm windows
  addVoxelBox(group, 0.88, 0.96, 0.14, timber, 0, 4.2, 1.84);
  addVoxelBox(group, 0.66, 0.74, 0.16, winGlow, 0, 4.2, 1.86, false);
  addVoxelBox(group, 0.14, 0.96, 0.88, timber, 1.84, 6.4, 0);
  addVoxelBox(group, 0.16, 0.74, 0.66, winGlow, 1.86, 6.4, 0, false);

  // Stepped shingled terracotta cap + golden weathervane finial
  addVoxelBox(group, 4.4, 0.62, 4.4, roof, 0, 8.38, 0);
  addVoxelBox(group, 3.4, 0.72, 3.4, roofD, 0, 9.04, 0);
  addVoxelBox(group, 2.2, 0.72, 2.2, roof, 0, 9.72, 0);
  addVoxelBox(group, 0.86, 0.95, 0.86, timber, 0, 10.45, 0);
  addVoxelBox(group, 0.16, 0.9, 0.16, mats.getMat('#f4ca5c', { metalness: 0.85, roughness: 0.24 }), 0, 11.3, 0);

  // Detailed 4-blade timber lattice & stitched canvas sails
  const sails = new THREE.Group();
  sails.position.set(0, 7.25, 2.1);
  addVoxelBox(sails, 0.74, 0.74, 0.72, timber, 0, 0, 0);
  addVoxelBox(sails, 0.34, 0.34, 0.8, mats.getMat('#f4ca5c', { metalness: 0.85, roughness: 0.25 }), 0, 0, 0.04);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    addVoxelBox(arm, 0.24, 4.75, 0.2, timber, 0, 2.4, 0);
    addVoxelBox(arm, 1.18, 3.45, 0.08, sailCloth, 0.7, 2.8, 0.04);
    addVoxelBox(arm, 1.22, 0.34, 0.1, sailTrim, 0.7, 4.38, 0.05);
    // Wooden sail lattice cross-battens
    for (const ry of [1.65, 2.5, 3.35, 4.15]) {
      addVoxelBox(arm, 1.22, 0.11, 0.12, timber, 0.7, ry, 0.05);
    }
    sails.add(arm);
  }
  group.add(sails);

  return { group, sails };
}

export function buildRoadLantern(mats: MaterialLibrary): {
  group: THREE.Group;
  glowMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();
  const wood = mats.getMat('#5a391e', { roughness: 0.84, bump: 'wood', pattern: 'wood' });
  const iron = mats.getMat('#363c46', { roughness: 0.38, metalness: 0.78 });
  const stone = mats.getMat('#7c808a', { roughness: 0.9, bump: 'stone', pattern: 'stone' });
  const glowMat = mats
    .getMat('#ffe690', {
      roughness: 0.2,
      emissive: '#ffaa38',
      emissiveIntensity: 0.95,
    })
    .clone();

  addVoxelBox(group, 0.5, 0.42, 0.5, stone, 0, 0.21, 0);
  addVoxelBox(group, 0.22, 3.05, 0.22, wood, 0, 1.72, 0);
  addVoxelBox(group, 0.95, 0.16, 0.18, wood, 0.36, 3.08, 0);
  // Diagonal timber bracket
  const strut = addVoxelBox(group, 0.55, 0.11, 0.12, wood, 0.28, 2.84, 0);
  strut.rotation.z = 0.72;
  // Wrought-iron hanging lantern cage
  addVoxelBox(group, 0.08, 0.26, 0.08, iron, 0.74, 2.88, 0);
  addVoxelBox(group, 0.44, 0.12, 0.44, iron, 0.74, 2.74, 0);
  addVoxelBox(group, 0.3, 0.38, 0.3, glowMat, 0.74, 2.5, 0, false);
  addVoxelBox(group, 0.4, 0.1, 0.4, iron, 0.74, 2.28, 0);

  return { group, glowMat };
}

export function buildStoneBridge(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const stone = mats.getMat('#8e909a', { roughness: 0.86, bump: 'stone', pattern: 'stone' });
  const stoneL = mats.getMat('#b4b6be', { roughness: 0.8, bump: 'stone', pattern: 'stone' });
  const stoneD = mats.getMat('#5f626e', { roughness: 0.9, bump: 'stone', pattern: 'stone' });
  const plank = mats.getMat('#8f6236', { roughness: 0.82, bump: 'wood', pattern: 'wood' });
  const moss = mats.getMat('#48903c', { roughness: 0.92 });

  // Deep stone bridge abutments + planked roadway + carved stone parapets with bollards
  addVoxelBox(g, 5.2, 1.4, 8.6, stoneD, 0, -0.45, 0);
  addVoxelBox(g, 5.2, 0.34, 8.6, stoneD, 0, 0.22, 0);
  addVoxelBox(g, 4.3, 0.16, 8.85, plank, 0, 0.47, 0);
  for (const s of [-1, 1]) {
    addVoxelBox(g, 0.52, 0.95, 8.4, stone, s * 2.38, 0.82, 0);
    addVoxelBox(g, 0.64, 0.16, 8.6, stoneL, s * 2.38, 1.34, 0);
    for (const pz of [-4.0, 0, 4.0]) {
      addVoxelBox(g, 0.78, 1.48, 0.78, stoneD, s * 2.38, 0.92, pz);
      addVoxelBox(g, 0.9, 0.22, 0.9, stoneL, s * 2.38, 1.72, pz);
    }
    addVoxelBox(g, 0.4, 0.16, 1.2, moss, s * 2.55, 1.38, 1.8);
  }
  return g;
}

export function buildCryonisPillar(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const ice = mats.getMat('#78e6ff', {
    roughness: 0.12,
    metalness: 0.12,
    transparent: true,
    opacity: 0.84,
    emissive: '#38c0f0',
    emissiveIntensity: 0.52,
  });
  const frost = mats.getMat('#e0fbff', { roughness: 0.18, emissive: '#9eeaff', emissiveIntensity: 0.42 });
  const core = mats.getMat('#c4f8ff', { emissive: '#6ce2ff', emissiveIntensity: 1.0, roughness: 0.12 });

  addVoxelBox(g, 2.25, 3.6, 2.25, ice, 0, 1.8, 0);
  addVoxelBox(g, 2.55, 0.34, 2.55, frost, 0, 0.17, 0);
  addVoxelBox(g, 2.55, 0.34, 2.55, frost, 0, 3.65, 0);
  addVoxelBox(g, 0.75, 3.25, 0.75, core, 0, 1.8, 0, false);
  // Corner frost facets
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addVoxelBox(g, 0.38, 2.9, 0.38, frost, sx * 1.05, 1.8, sz * 1.05, false);
    }
  }
  return g;
}

export function buildPinwheelSecret(mats: MaterialLibrary): {
  group: THREE.Group;
  blades: THREE.Group;
} {
  const group = new THREE.Group();
  const wood = mats.getMat('#784c26', { roughness: 0.82, bump: 'wood', pattern: 'wood' });
  const gold = mats.getMat('#f4ca5c', { roughness: 0.25, metalness: 0.85 });

  addVoxelBox(group, 0.2, 1.5, 0.2, wood, 0, 0.75, 0);
  addVoxelBox(group, 0.44, 0.24, 0.44, mats.getMat('#4f983c'), 0, 0.12, 0); // grassy tuft around post
  const blades = new THREE.Group();
  blades.position.set(0, 1.48, 0.14);
  addVoxelBox(blades, 0.24, 0.24, 0.18, gold, 0, 0, 0);
  const colors = ['#ff7464', '#ffe268', '#68e284', '#6cc8ff'];
  for (let i = 0; i < 4; i++) {
    const vane = new THREE.Group();
    vane.rotation.z = (i * Math.PI) / 2;
    addVoxelBox(vane, 0.26, 0.68, 0.06, mats.getMat(colors[i], { roughness: 0.55 }), 0.1, 0.42, 0);
    blades.add(vane);
  }
  group.add(blades);
  return { group, blades };
}

export function buildBalloonTarget(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const red = mats.getMat('#eb4a3c', { roughness: 0.48, emissive: '#b42218', emissiveIntensity: 0.28 });
  const cream = mats.getMat('#fff6dc', { roughness: 0.6 });
  const gold = mats.getMat('#f4ca5c', { roughness: 0.25, metalness: 0.78 });

  addVoxelBox(g, 1.02, 1.02, 1.02, red, 0, 0, 0);
  addVoxelBox(g, 1.12, 0.36, 1.12, cream, 0, 0, 0);
  addVoxelBox(g, 0.4, 0.44, 1.18, gold, 0, 0, 0, false);
  addVoxelBox(g, 1.18, 0.4, 0.44, gold, 0, 0, 0, false);
  addVoxelBox(g, 0.26, 0.2, 0.26, red, 0, -0.62, 0);
  return g;
}

export function buildWhisperSprite(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const bark = mats.getMat('#8c6239', { roughness: 0.85, bump: 'wood', pattern: 'wood' });
  const leaf = mats.getMat('#5ee468', { roughness: 0.65, emissive: '#2ea846', emissiveIntensity: 0.45 });
  const leafD = mats.getMat('#3ea84a', { roughness: 0.75 });
  const eye = mats.getMat('#fff4a8', { emissive: '#ffe066', emissiveIntensity: 1.55 });

  addVoxelBox(g, 0.42, 0.54, 0.36, bark, 0, 0.38, 0);
  addVoxelBox(g, 0.12, 0.24, 0.12, bark, -0.26, 0.42, 0);
  addVoxelBox(g, 0.12, 0.24, 0.12, bark, 0.26, 0.42, 0);
  // Leafy mask & sprout cap
  addVoxelBox(g, 0.54, 0.5, 0.08, leaf, 0, 0.52, 0.2, false);
  addVoxelBox(g, 0.24, 0.28, 0.08, leafD, 0, 0.84, 0.18, false);
  addVoxelBox(g, 0.08, 0.08, 0.04, eye, -0.1, 0.54, 0.25, false);
  addVoxelBox(g, 0.08, 0.08, 0.04, eye, 0.1, 0.54, 0.25, false);
  return g;
}

export interface FoxRig {
  group: THREE.Group;
  tail: THREE.Group;
  legs: THREE.Group[];
  contactShadow: THREE.Mesh;
}

export function buildMeadowFox(mats: MaterialLibrary): FoxRig {
  const group = new THREE.Group();
  const fur = mats.getMat('#de6928', { roughness: 0.82, pattern: 'cloth' });
  const furD = mats.getMat('#b84d1a', { roughness: 0.86 });
  const cream = mats.getMat('#f8f0dc', { roughness: 0.84 });
  const paw = mats.getMat('#2d221c', { roughness: 0.88 });
  const earPink = mats.getMat('#f2a898', { roughness: 0.78 });
  const eye = mats.getMat('#181c28', { roughness: 0.15 });

  // Sculpted body, fluffy chest bib & saddle shading
  addVoxelBox(group, 0.44, 0.36, 0.82, fur, 0, 0.46, 0);
  addVoxelBox(group, 0.36, 0.08, 0.56, furD, 0, 0.65, -0.05);
  addVoxelBox(group, 0.38, 0.28, 0.34, cream, 0, 0.38, 0.3);
  // Head + white cheek ruffs + pointed ears + bright eyes + black nose
  addVoxelBox(group, 0.38, 0.32, 0.36, fur, 0, 0.68, 0.48);
  addVoxelBox(group, 0.44, 0.14, 0.24, cream, 0, 0.59, 0.48); // cheek fluff
  addVoxelBox(group, 0.2, 0.15, 0.26, cream, 0, 0.6, 0.71);
  addVoxelBox(group, 0.09, 0.08, 0.07, paw, 0, 0.62, 0.85, false);
  for (const s of [-1, 1]) {
    addVoxelBox(group, 0.11, 0.2, 0.09, fur, s * 0.14, 0.91, 0.45);
    addVoxelBox(group, 0.06, 0.12, 0.04, earPink, s * 0.14, 0.9, 0.5, false);
    addVoxelBox(group, 0.06, 0.07, 0.03, eye, s * 0.12, 0.7, 0.66, false);
    addVoxelBox(group, 0.02, 0.02, 0.02, mats.getMat('#ffffff'), s * 0.12 - 0.01, 0.72, 0.68, false);
  }

  // 4 Articulated trotting legs with dark stockings
  const legs: THREE.Group[] = [];
  const legCoords: Array<[number, number]> = [
    [-0.14, 0.28],
    [0.14, 0.28],
    [-0.14, -0.28],
    [0.14, -0.28],
  ];
  for (const [lx, lz] of legCoords) {
    const lg = new THREE.Group();
    lg.position.set(lx, 0.34, lz);
    addVoxelBox(lg, 0.12, 0.18, 0.12, fur, 0, -0.09, 0);
    addVoxelBox(lg, 0.11, 0.18, 0.12, paw, 0, -0.25, 0.01);
    group.add(lg);
    legs.push(lg);
  }

  // Lush multi-tier white-tipped brush tail
  const tail = new THREE.Group();
  tail.position.set(0, 0.5, -0.38);
  addVoxelBox(tail, 0.24, 0.24, 0.32, fur, 0, 0.04, -0.15);
  addVoxelBox(tail, 0.3, 0.28, 0.34, fur, 0, 0.09, -0.4);
  addVoxelBox(tail, 0.24, 0.22, 0.24, cream, 0, 0.13, -0.66);
  group.add(tail);

  const contactShadow = createContactShadow(mats, 0.52);
  return { group, tail, legs, contactShadow };
}

export interface DeerRig {
  group: THREE.Group;
  headGroup: THREE.Group;
  legs: THREE.Group[];
  contactShadow: THREE.Mesh;
}

export function buildMeadowDeer(mats: MaterialLibrary, hasAntlers: boolean): DeerRig {
  const group = new THREE.Group();
  const coat = mats.getMat(hasAntlers ? '#96643a' : '#b27a48', { roughness: 0.84, pattern: 'cloth' });
  const coatL = mats.getMat('#d8b688', { roughness: 0.86 });
  const cream = mats.getMat('#f5eedc', { roughness: 0.86 });
  const hoof = mats.getMat('#2d231c', { roughness: 0.85 });
  const antler = mats.getMat('#dfd2b8', { roughness: 0.72 });
  const eye = mats.getMat('#181c28', { roughness: 0.15 });

  // Graceful torso + pale underbelly + dappled forest spots + white scut tail
  addVoxelBox(group, 0.58, 0.58, 1.28, coat, 0, 1.06, 0);
  addVoxelBox(group, 0.48, 0.16, 1.08, cream, 0, 0.78, 0);
  for (const [sx, sz] of [
    [-0.29, -0.25],
    [0.29, -0.1],
    [-0.29, 0.18],
    [0.29, 0.28],
  ]) {
    addVoxelBox(group, 0.04, 0.1, 0.1, coatL, sx, 1.16, sz, false);
  }
  addVoxelBox(group, 0.22, 0.24, 0.2, cream, 0, 1.14, -0.68); // white tail

  // Slender neck + expressive head + optional branching stag antlers
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.32, 0.56);
  const neck = addVoxelBox(headGroup, 0.28, 0.62, 0.3, coat, 0, 0.22, 0.06);
  neck.rotation.x = 0.24;
  addVoxelBox(headGroup, 0.34, 0.32, 0.42, coat, 0, 0.56, 0.24);
  addVoxelBox(headGroup, 0.22, 0.18, 0.24, coatL, 0, 0.48, 0.5);
  addVoxelBox(headGroup, 0.1, 0.09, 0.06, hoof, 0, 0.5, 0.63, false);
  for (const s of [-1, 1]) {
    addVoxelBox(headGroup, 0.05, 0.07, 0.05, eye, s * 0.17, 0.59, 0.34, false);
    addVoxelBox(headGroup, 0.12, 0.22, 0.08, coat, s * 0.22, 0.74, 0.12);
    if (hasAntlers) {
      addVoxelBox(headGroup, 0.07, 0.42, 0.07, antler, s * 0.14, 0.88, 0.2);
      addVoxelBox(headGroup, 0.28, 0.07, 0.07, antler, s * 0.28, 1.02, 0.2);
      addVoxelBox(headGroup, 0.06, 0.26, 0.06, antler, s * 0.4, 1.16, 0.22);
      addVoxelBox(headGroup, 0.06, 0.22, 0.06, antler, s * 0.24, 1.14, 0.32);
    }
  }
  group.add(headGroup);

  // 4 Articulated legs with hooves
  const legs: THREE.Group[] = [];
  for (const [lx, lz] of [
    [-0.18, 0.44],
    [0.18, 0.44],
    [-0.18, -0.44],
    [0.18, -0.44],
  ]) {
    const lg = new THREE.Group();
    lg.position.set(lx, 0.82, lz);
    addVoxelBox(lg, 0.14, 0.66, 0.14, coat, 0, -0.33, 0);
    addVoxelBox(lg, 0.15, 0.16, 0.17, hoof, 0, -0.74, 0.02);
    group.add(lg);
    legs.push(lg);
  }

  const contactShadow = createContactShadow(mats, 0.82);
  return { group, headGroup, legs, contactShadow };
}

export function buildLakeDuck(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const body = mats.getMat('#f5f2e6', { roughness: 0.76 });
  const head = mats.getMat('#2a7a54', { roughness: 0.65 });
  const beak = mats.getMat('#f0a832', { roughness: 0.55 });
  const wing = mats.getMat('#d4ccb8', { roughness: 0.82 });

  addVoxelBox(g, 0.42, 0.28, 0.62, body, 0, 0.14, 0, false);
  addVoxelBox(g, 0.48, 0.16, 0.38, wing, 0, 0.18, -0.02, false);
  addVoxelBox(g, 0.24, 0.24, 0.24, head, 0, 0.36, 0.24, false);
  addVoxelBox(g, 0.14, 0.08, 0.18, beak, 0, 0.32, 0.42, false);
  addVoxelBox(g, 0.04, 0.05, 0.04, mats.getMat('#181c28'), -0.12, 0.39, 0.3, false);
  addVoxelBox(g, 0.04, 0.05, 0.04, mats.getMat('#181c28'), 0.12, 0.39, 0.3, false);
  return g;
}

export function buildButterfly(mats: MaterialLibrary, colorHex: string): {
  group: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
} {
  const group = new THREE.Group();
  const body = mats.getMat('#2a2630', { roughness: 0.7 });
  const wing = mats.getMat(colorHex, { roughness: 0.45, emissive: colorHex, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  addVoxelBox(group, 0.04, 0.04, 0.18, body, 0, 0, 0, false, false);

  const wingL = new THREE.Group();
  addVoxelBox(wingL, 0.18, 0.02, 0.16, wing, -0.1, 0, 0.02, false, false);
  addVoxelBox(wingL, 0.12, 0.02, 0.1, wing, -0.08, 0, -0.09, false, false);
  group.add(wingL);

  const wingR = new THREE.Group();
  addVoxelBox(wingR, 0.18, 0.02, 0.16, wing, 0.1, 0, 0.02, false, false);
  addVoxelBox(wingR, 0.12, 0.02, 0.1, wing, 0.08, 0, -0.09, false, false);
  group.add(wingR);

  return { group, wingL, wingR };
}

export function buildSkyBird(mats: MaterialLibrary): {
  group: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
} {
  const group = new THREE.Group();
  const body = mats.getMat('#f8f4e6', { roughness: 0.78 });
  const wing = mats.getMat('#4e7eb8', { roughness: 0.74 });
  const wingTip = mats.getMat('#2a486e', { roughness: 0.8 });
  const beak = mats.getMat('#f2b83e', { roughness: 0.55 });

  addVoxelBox(group, 0.28, 0.24, 0.66, body, 0, 0, 0, false, false);
  addVoxelBox(group, 0.22, 0.2, 0.24, body, 0, 0.08, 0.34, false, false);
  addVoxelBox(group, 0.11, 0.09, 0.22, beak, 0, 0.06, 0.52, false, false);
  addVoxelBox(group, 0.34, 0.06, 0.26, wingTip, 0, 0.02, -0.42, false, false); // tail fan

  const wingL = new THREE.Group();
  wingL.position.set(-0.14, 0.05, 0);
  addVoxelBox(wingL, 0.56, 0.07, 0.36, wing, -0.28, 0, 0, false, false);
  addVoxelBox(wingL, 0.38, 0.05, 0.24, wingTip, -0.72, 0, -0.05, false, false);
  group.add(wingL);

  const wingR = new THREE.Group();
  wingR.position.set(0.14, 0.05, 0);
  addVoxelBox(wingR, 0.56, 0.07, 0.36, wing, 0.28, 0, 0, false, false);
  addVoxelBox(wingR, 0.38, 0.05, 0.24, wingTip, 0.72, 0, -0.05, false, false);
  group.add(wingR);

  return { group, wingL, wingR };
}

// ================= PUZZLE, SIDE-QUEST & RUNESCAPE-INSPIRED LANDMARK BUILDERS =================

export function buildChimeBell(
  mats: MaterialLibrary,
  accentHex: string
): { group: THREE.Group; bell: THREE.Group; glowMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  const stone = mats.getMat('#8e939e', { roughness: 0.9, bump: 'stone' });
  const stoneDark = mats.getMat('#626874', { roughness: 0.92, bump: 'stone' });
  const wood = mats.getMat('#6e4824', { roughness: 0.82, bump: 'wood' });
  const bellMetal = mats.getMat(accentHex, { roughness: 0.28, metalness: 0.72 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.35,
    roughness: 0.35,
  });

  // Carved pedestal & timber belfry frame
  addVoxelBox(group, 1.35, 0.38, 1.35, stoneDark, 0, 0.19, 0);
  addVoxelBox(group, 1.05, 0.42, 1.05, stone, 0, 0.59, 0);
  addVoxelBox(group, 0.18, 2.05, 0.18, wood, -0.46, 1.8, 0);
  addVoxelBox(group, 0.18, 2.05, 0.18, wood, 0.46, 1.8, 0);
  addVoxelBox(group, 1.28, 0.2, 0.28, wood, 0, 2.86, 0);
  addVoxelBox(group, 0.95, 0.12, 0.95, glowMat, 0, 0.82, 0, false, false);

  const bell = new THREE.Group();
  bell.position.set(0, 2.74, 0);
  addVoxelBox(bell, 0.14, 0.22, 0.14, stoneDark, 0, -0.1, 0);
  addVoxelBox(bell, 0.42, 0.46, 0.42, bellMetal, 0, -0.42, 0);
  addVoxelBox(bell, 0.58, 0.22, 0.58, bellMetal, 0, -0.74, 0);
  addVoxelBox(bell, 0.16, 0.18, 0.16, glowMat, 0, -0.92, 0, false, false);
  group.add(bell);

  return { group, bell, glowMat };
}

export function buildRunicSocket(mats: MaterialLibrary): {
  group: THREE.Group;
  runeMat: THREE.MeshStandardMaterial;
  beacons: THREE.MeshStandardMaterial[];
} {
  const group = new THREE.Group();
  const stone = mats.getMat('#7c828f', { roughness: 0.9, bump: 'stone' });
  const stoneDark = mats.getMat('#4f5562', { roughness: 0.94, bump: 'stone' });
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0x5ef2e6,
    emissive: 0x3ad8e8,
    emissiveIntensity: 0.85,
    roughness: 0.3,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  // Recessed octagonal floor socket rim
  addVoxelBox(group, 3.6, 0.22, 3.6, stoneDark, 0, 0.11, 0);
  addVoxelBox(group, 2.6, 0.08, 2.6, runeMat, 0, 0.24, 0, false, true);

  const beacons: THREE.MeshStandardMaterial[] = [];
  for (const [ox, oz] of [
    [-1.65, -1.65],
    [1.65, -1.65],
    [-1.65, 1.65],
    [1.65, 1.65],
  ]) {
    addVoxelBox(group, 0.48, 0.95, 0.48, stone, ox, 0.48, oz);
    const bm = runeMat.clone();
    beacons.push(bm);
    addVoxelBox(group, 0.34, 0.24, 0.34, bm, ox, 1.06, oz, false, false);
  }

  return { group, runeMat, beacons };
}

export function buildDawnBrazier(mats: MaterialLibrary): {
  group: THREE.Group;
  flame1: THREE.Mesh;
  flame2: THREE.Mesh;
  light: THREE.PointLight;
} {
  const group = new THREE.Group();
  const stone = mats.getMat('#8e939e', { roughness: 0.9, bump: 'stone' });
  const iron = mats.getMat('#343942', { roughness: 0.55, metalness: 0.65 });
  const gold = mats.getMat('#e8bc54', { roughness: 0.32, metalness: 0.72 });

  addVoxelBox(group, 1.35, 0.36, 1.35, stone, 0, 0.18, 0);
  addVoxelBox(group, 0.92, 1.15, 0.92, stone, 0, 0.92, 0);
  addVoxelBox(group, 1.08, 0.14, 1.08, gold, 0, 1.54, 0);
  addVoxelBox(group, 1.18, 0.42, 1.18, iron, 0, 1.82, 0);
  addVoxelBox(group, 0.92, 0.14, 0.92, mats.getMat('#2a221d', { roughness: 0.95 }), 0, 2.02, 0);

  const flameMat1 = mats.getMat('#ff8628', { emissive: '#ff5e12', emissiveIntensity: 2.2 });
  const flameMat2 = mats.getMat('#ffe668', { emissive: '#ffd23a', emissiveIntensity: 2.4 });
  const flame1 = addVoxelBox(group, 0.56, 0.78, 0.56, flameMat1, 0, 2.42, 0, false, false);
  const flame2 = addVoxelBox(group, 0.32, 0.56, 0.32, flameMat2, 0, 2.66, 0, false, false);
  flame1.visible = false;
  flame2.visible = false;

  const light = new THREE.PointLight(0xffa438, 0, 15, 1.5);
  light.position.set(0, 2.7, 0);
  group.add(light);

  return { group, flame1, flame2, light };
}

export function buildArcheryTarget(mats: MaterialLibrary): {
  group: THREE.Group;
  board: THREE.Group;
} {
  const group = new THREE.Group();
  const wood = mats.getMat('#7c5228', { roughness: 0.82, bump: 'wood' });
  const straw = mats.getMat('#e5c878', { roughness: 0.9 });
  const red = mats.getMat('#d63d34', { roughness: 0.72 });
  const cream = mats.getMat('#f6eed8', { roughness: 0.78 });
  const gold = mats.getMat('#f6c94c', { roughness: 0.3, metalness: 0.7 });

  // Rustic wooden tripod stand
  const legL = addVoxelBox(group, 0.14, 2.1, 0.14, wood, -0.52, 1.0, 0);
  legL.rotation.z = -0.14;
  const legR = addVoxelBox(group, 0.14, 2.1, 0.14, wood, 0.52, 1.0, 0);
  legR.rotation.z = 0.14;
  const legB = addVoxelBox(group, 0.14, 2.1, 0.14, wood, 0, 0.98, -0.62);
  legB.rotation.x = 0.34;
  addVoxelBox(group, 1.25, 0.14, 0.16, wood, 0, 1.05, 0.04);

  const board = new THREE.Group();
  board.position.set(0, 1.72, 0.1);
  addVoxelBox(board, 1.38, 1.38, 0.24, straw, 0, 0, 0);
  // Concentric bull's-eye layers stepped strictly in Z so zero Z-fighting!
  addVoxelBox(board, 1.22, 1.22, 0.06, red, 0, 0, 0.14);
  addVoxelBox(board, 0.86, 0.86, 0.06, cream, 0, 0, 0.19);
  addVoxelBox(board, 0.52, 0.52, 0.06, red, 0, 0, 0.24);
  addVoxelBox(board, 0.24, 0.24, 0.06, gold, 0, 0, 0.29);
  group.add(board);

  return { group, board };
}

export function buildOreVein(
  mats: MaterialLibrary,
  tier: 'copper' | 'gold' | 'mithril'
): { group: THREE.Group; crystalGroup: THREE.Group } {
  const group = new THREE.Group();
  const rock = mats.getMat('#5a5f6c', { roughness: 0.92, bump: 'stone' });
  const rockDark = mats.getMat('#424752', { roughness: 0.95, bump: 'stone' });
  const oreCol = tier === 'mithril' ? '#4f7be8' : tier === 'gold' ? '#f6ca45' : '#d67c44';
  const oreMat = mats.getMat(oreCol, {
    roughness: 0.24,
    metalness: 0.78,
    emissive: oreCol,
    emissiveIntensity: 0.26,
  });

  addVoxelBox(group, 1.85, 1.05, 1.75, rockDark, 0, 0.5, 0);
  addVoxelBox(group, 1.38, 0.78, 1.32, rock, 0.08, 1.25, -0.06);
  addVoxelBox(group, 0.85, 0.45, 0.88, rock, -0.2, 1.75, 0.1);

  const crystalGroup = new THREE.Group();
  const veins: Array<[number, number, number, number]> = [
    [-0.55, 0.95, 0.72, 0.32],
    [0.62, 0.82, 0.58, 0.28],
    [0.12, 1.55, 0.52, 0.34],
    [-0.42, 1.48, -0.45, 0.3],
    [0.52, 1.28, -0.58, 0.28],
  ];
  for (const [vx, vy, vz, vs] of veins) {
    const m = addVoxelBox(crystalGroup, vs, vs * 1.15, vs, oreMat, vx, vy, vz, false, false);
    m.rotation.set(0.3, 0.5, 0.2);
  }
  group.add(crystalGroup);
  return { group, crystalGroup };
}

export function buildLodestonePad(mats: MaterialLibrary, accentHex = '#62e8ff'): THREE.Group {
  const group = new THREE.Group();
  const stone = mats.getMat('#8e94a0', { roughness: 0.88, bump: 'stone' });
  const rune = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 1.1,
    roughness: 0.25,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  addVoxelBox(group, 3.2, 0.18, 3.2, stone, 0, 0.09, 0);
  addVoxelBox(group, 2.2, 0.08, 2.2, rune, 0, 0.2, 0, false, true);
  // Four mini carved corner glyphs
  for (const [ox, oz] of [
    [-1.4, -1.4],
    [1.4, -1.4],
    [-1.4, 1.4],
    [1.4, 1.4],
  ]) {
    addVoxelBox(group, 0.36, 0.55, 0.36, stone, ox, 0.35, oz);
    addVoxelBox(group, 0.22, 0.16, 0.22, rune, ox, 0.68, oz, false, false);
  }
  return group;
}

export function buildCastleGatehouse(
  mats: MaterialLibrary,
  bannerHex = '#2a64b8',
  stoneHex = '#9ca2ad'
): THREE.Group {
  const group = new THREE.Group();
  const stone = mats.getMat(stoneHex, { roughness: 0.88, bump: 'stone' });
  const stoneDark = mats.getMat('#6d7380', { roughness: 0.92, bump: 'stone' });
  const roof = mats.getMat('#365e94', { roughness: 0.72, pattern: 'roof' });
  const gold = mats.getMat('#f0c65a', { roughness: 0.28, metalness: 0.76 });
  const banner = mats.getMat(bannerHex, { roughness: 0.84, pattern: 'cloth' });
  const iron = mats.getMat('#2a2e36', { roughness: 0.5, metalness: 0.7 });
  const torchGlow = mats.getMat('#ffca64', { emissive: '#ff9624', emissiveIntensity: 1.8 });

  // Twin crenelated gate towers (left & right of wide archway)
  for (const side of [-1, 1]) {
    const tx = side * 4.4;
    addVoxelBox(group, 4.0, 1.4, 4.0, stoneDark, tx, 0.7, 0);
    addVoxelBox(group, 3.6, 8.2, 3.6, stone, tx, 5.5, 0);
    // Battlement corbel collar & merlons
    addVoxelBox(group, 4.1, 0.6, 4.1, stoneDark, tx, 9.8, 0);
    for (const [mx, mz] of [
      [-1.55, -1.55],
      [0, -1.55],
      [1.55, -1.55],
      [-1.55, 1.55],
      [0, 1.55],
      [1.55, 1.55],
      [-1.55, 0],
      [1.55, 0],
    ]) {
      addVoxelBox(group, 0.72, 0.85, 0.72, stone, tx + mx, 10.52, mz);
    }
    // Conical blue castle turret cap + golden finial
    addVoxelBox(group, 2.8, 1.2, 2.8, roof, tx, 11.1, 0);
    addVoxelBox(group, 1.9, 1.2, 1.9, roof, tx, 12.25, 0);
    addVoxelBox(group, 1.0, 1.1, 1.0, roof, tx, 13.3, 0);
    addVoxelBox(group, 0.26, 0.9, 0.26, gold, tx, 14.25, 0);

    // Heraldic royal banners on front face
    addVoxelBox(group, 1.15, 3.4, 0.12, banner, tx, 5.8, 1.9);
    addVoxelBox(group, 1.25, 0.22, 0.16, gold, tx, 7.55, 1.9);
    addVoxelBox(group, 0.42, 0.42, 0.14, gold, tx, 5.9, 1.94, false, false);

    // Wall sconces
    addVoxelBox(group, 0.24, 0.45, 0.24, iron, tx - side * 1.45, 3.2, 1.92);
    addVoxelBox(group, 0.26, 0.34, 0.26, torchGlow, tx - side * 1.45, 3.62, 1.92, false, false);
  }

  // Overhead stone bridge & portcullis teeth spanning the open gate archway (walkable underneath!)
  addVoxelBox(group, 5.4, 2.8, 3.2, stone, 0, 6.4, 0);
  addVoxelBox(group, 5.6, 0.48, 3.5, stoneDark, 0, 7.95, 0);
  for (let i = -2; i <= 2; i++) {
    addVoxelBox(group, 0.65, 0.78, 0.55, stone, i * 1.15, 8.56, 1.4);
    addVoxelBox(group, 0.65, 0.78, 0.55, stone, i * 1.15, 8.56, -1.4);
  }
  // Raised iron portcullis grate bars
  for (let i = -2; i <= 2; i++) {
    addVoxelBox(group, 0.12, 1.15, 0.12, iron, i * 0.75, 4.65, 0.4);
  }
  addVoxelBox(group, 4.2, 0.16, 0.18, iron, 0, 4.35, 0.4);

  return group;
}

export function buildGrandFountain(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const stone = mats.getMat('#adb4bf', { roughness: 0.85, bump: 'stone' });
  const trim = mats.getMat('#dce2ec', { roughness: 0.75, bump: 'stone' });
  const water = mats.getMat('#48c8f2', {
    roughness: 0.16,
    metalness: 0.1,
    emissive: '#2288c8',
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.88,
  });
  const gold = mats.getMat('#f2c858', { roughness: 0.26, metalness: 0.82 });

  addVoxelBox(group, 5.4, 0.42, 5.4, stone, 0, 0.21, 0);
  addVoxelBox(group, 4.6, 0.72, 4.6, trim, 0, 0.78, 0);
  addVoxelBox(group, 4.1, 0.25, 4.1, water, 0, 1.05, 0, false, true);
  // Central tiered column & golden crown statue
  addVoxelBox(group, 1.25, 2.2, 1.25, stone, 0, 2.1, 0);
  addVoxelBox(group, 2.4, 0.36, 2.4, trim, 0, 2.7, 0);
  addVoxelBox(group, 2.0, 0.16, 2.0, water, 0, 2.9, 0, false, false);
  addVoxelBox(group, 0.78, 1.3, 0.78, stone, 0, 3.6, 0);
  addVoxelBox(group, 0.65, 0.75, 0.65, gold, 0, 4.6, 0);
  // Sparkling water jets
  for (const [ox, oz] of [
    [0.8, 0],
    [-0.8, 0],
    [0, 0.8],
    [0, -0.8],
  ]) {
    addVoxelBox(group, 0.16, 1.5, 0.16, water, ox, 1.95, oz, false, false);
  }
  return group;
}

export function buildWizardsTower(mats: MaterialLibrary): {
  group: THREE.Group;
  crystalRing: THREE.Group;
} {
  const group = new THREE.Group();
  const stone = mats.getMat('#8c96a8', { roughness: 0.86, bump: 'stone' });
  const stoneDark = mats.getMat('#5a6476', { roughness: 0.9, bump: 'stone' });
  const azure = mats.getMat('#2864c4', { roughness: 0.68, pattern: 'roof' });
  const azureBright = mats.getMat('#3a7ee0', { roughness: 0.64, pattern: 'roof' });
  const gold = mats.getMat('#f4cc5e', { roughness: 0.24, metalness: 0.84 });
  const glow = mats.getMat('#6eeaff', { emissive: '#38c8ff', emissiveIntensity: 1.65 });

  // Stepped circular-voxel stone base & three rising mage-tower tiers
  addVoxelBox(group, 9.2, 1.2, 9.2, stoneDark, 0, 0.6, 0);
  addVoxelBox(group, 7.4, 7.6, 7.4, stone, 0, 5.0, 0);
  addVoxelBox(group, 8.0, 0.55, 8.0, stoneDark, 0, 9.0, 0);
  addVoxelBox(group, 6.2, 6.8, 6.2, stone, 0, 12.6, 0);
  addVoxelBox(group, 6.9, 0.6, 6.9, stoneDark, 0, 16.2, 0);

  // Glowing arcane arched windows on all 4 faces
  for (const [wx, wz, rotY] of [
    [0, 3.74, 0],
    [0, -3.74, Math.PI],
    [3.74, 0, Math.PI / 2],
    [-3.74, 0, -Math.PI / 2],
  ]) {
    const win = new THREE.Group();
    win.position.set(wx, 5.6, wz);
    win.rotation.y = rotY;
    addVoxelBox(win, 1.4, 2.8, 0.16, stoneDark, 0, 0, 0);
    addVoxelBox(win, 0.95, 2.35, 0.2, glow, 0, 0.05, 0.04, false, false);
    group.add(win);
  }

  // Tall Wizards' Tower peaked azure spire roof + gilded star finial
  const roofSteps: Array<[number, number, number]> = [
    [7.4, 1.4, 17.2],
    [6.1, 1.5, 18.6],
    [4.7, 1.6, 20.1],
    [3.3, 1.6, 21.6],
    [2.0, 1.6, 23.1],
    [1.0, 1.5, 24.5],
  ];
  roofSteps.forEach(([w, h, y], idx) => {
    addVoxelBox(group, w, h, w, idx % 2 === 0 ? azure : azureBright, 0, y, 0);
  });
  addVoxelBox(group, 0.35, 1.6, 0.35, gold, 0, 26.0, 0);
  addVoxelBox(group, 1.05, 1.05, 1.05, glow, 0, 27.1, 0, false, false);

  // Orbiting arcane crystals high around the observatory tier
  const crystalRing = new THREE.Group();
  crystalRing.position.set(0, 14.5, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const cr = addVoxelBox(crystalRing, 0.52, 1.25, 0.52, glow, Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2, false, false);
    cr.rotation.y = a;
  }
  group.add(crystalRing);

  return { group, crystalRing };
}

export function buildDesertPyramid(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const sand = mats.getMat('#dfb974', { roughness: 0.9, bump: 'stone' });
  const sandDark = mats.getMat('#c49854', { roughness: 0.92, bump: 'stone' });
  const gold = mats.getMat('#f5cb52', { roughness: 0.25, metalness: 0.85 });
  const door = mats.getMat('#2c2116', { roughness: 0.95 });

  // Stepped Al-Kharid style sandstone ziggurat pyramid (walkable & climbable tiers!)
  const tiers = [
    { w: 18.0, h: 2.2, y: 1.1 },
    { w: 14.6, h: 2.2, y: 3.3 },
    { w: 11.4, h: 2.2, y: 5.5 },
    { w: 8.2, h: 2.2, y: 7.7 },
    { w: 5.2, h: 2.2, y: 9.9 },
    { w: 2.6, h: 1.8, y: 11.9 },
  ];
  tiers.forEach((t, idx) => {
    addVoxelBox(group, t.w, t.h, t.w, idx % 2 === 0 ? sand : sandDark, 0, t.y, 0);
  });
  addVoxelBox(group, 1.5, 1.4, 1.5, gold, 0, 13.4, 0);

  // Monumental doorway & twin sandstone obelisks facing west toward Sunscorch Oasis
  addVoxelBox(group, 0.9, 3.8, 3.8, sandDark, -9.2, 1.9, 0);
  addVoxelBox(group, 0.4, 2.9, 2.2, door, -9.55, 1.45, 0);
  for (const oz of [-4.2, 4.2]) {
    addVoxelBox(group, 1.4, 5.2, 1.4, sand, -11.4, 2.6, oz);
    addVoxelBox(group, 1.1, 1.0, 1.1, gold, -11.4, 5.65, oz);
  }
  return group;
}

export function buildDesertGate(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const sand = mats.getMat('#e2bd7a', { roughness: 0.88, bump: 'stone' });
  const sandDark = mats.getMat('#be924e', { roughness: 0.92, bump: 'stone' });
  const crimson = mats.getMat('#c43e34', { roughness: 0.82, pattern: 'cloth' });
  const cream = mats.getMat('#f6ebd2', { roughness: 0.84, pattern: 'cloth' });
  const gold = mats.getMat('#f2c856', { roughness: 0.28, metalness: 0.8 });

  // Al-Kharid Desert Border Toll Gate Arch
  for (const s of [-1, 1]) {
    addVoxelBox(group, 2.8, 6.4, 2.8, sand, s * 4.0, 3.2, 0);
    addVoxelBox(group, 3.2, 0.55, 3.2, sandDark, s * 4.0, 6.6, 0);
    addVoxelBox(group, 2.1, 1.25, 2.1, gold, s * 4.0, 7.45, 0);
  }
  addVoxelBox(group, 10.6, 1.6, 2.4, sandDark, 0, 5.6, 0);
  // Striped bazaar awning banner
  for (let i = -3; i <= 3; i++) {
    addVoxelBox(group, 1.15, 0.3, 1.5, i % 2 === 0 ? crimson : cream, i * 1.15, 4.65, 1.55);
  }
  return group;
}

export function buildDruidicStoneCircle(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const stone = mats.getMat('#7f8690', { roughness: 0.92, bump: 'stone' });
  const moss = mats.getMat('#4a9840', { roughness: 0.88 });
  const rune = mats.getMat('#7cf49e', { emissive: '#3ee074', emissiveIntensity: 1.35 });

  // 8 towering standing monoliths + lintel trilithons + glowing Runecrafting Altar in center
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sx = Math.cos(a) * 8.2;
    const sz = Math.sin(a) * 8.2;
    const h = 4.2 + (i % 2) * 1.4;
    const pillar = new THREE.Group();
    pillar.position.set(sx, 0, sz);
    pillar.rotation.y = -a;
    addVoxelBox(pillar, 1.25, h, 1.65, stone, 0, h * 0.5, 0);
    addVoxelBox(pillar, 1.32, 0.24, 1.72, moss, 0, h + 0.1, 0);
    addVoxelBox(pillar, 0.18, 1.4, 0.35, rune, -0.62, h * 0.52, 0, false, false);
    group.add(pillar);
  }
  // Central Runecrafting Altar dais
  addVoxelBox(group, 3.6, 0.45, 3.6, stone, 0, 0.22, 0);
  addVoxelBox(group, 1.8, 1.25, 1.8, stone, 0, 1.05, 0);
  addVoxelBox(group, 1.1, 0.26, 1.1, rune, 0, 1.78, 0, false, false);
  return group;
}

export function buildWildernessObelisk(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const obsidian = mats.getMat('#2a2834', { roughness: 0.62, metalness: 0.32, bump: 'stone' });
  const lava = mats.getMat('#ff5a22', { emissive: '#ff3c0c', emissiveIntensity: 1.9 });

  addVoxelBox(group, 4.4, 0.6, 4.4, obsidian, 0, 0.3, 0);
  addVoxelBox(group, 2.2, 8.8, 2.2, obsidian, 0, 4.9, 0);
  addVoxelBox(group, 1.4, 2.2, 1.4, obsidian, 0, 10.3, 0);
  // Glowing lava rune fissures up the obelisk
  addVoxelBox(group, 0.28, 6.2, 2.34, lava, 0, 5.1, 0, false, false);
  addVoxelBox(group, 2.34, 6.2, 0.28, lava, 0, 5.1, 0, false, false);
  addVoxelBox(group, 1.05, 1.05, 1.05, lava, 0, 11.95, 0, false, false);
  return group;
}

export function buildPastureSheep(mats: MaterialLibrary): {
  group: THREE.Group;
  head: THREE.Group;
  contactShadow: THREE.Mesh;
} {
  const group = new THREE.Group();
  const wool = mats.getMat('#f5f1e4', { roughness: 0.95 });
  const face = mats.getMat('#2e2a28', { roughness: 0.85 });
  const eye = mats.getMat('#ffffff', { roughness: 0.3 });

  addVoxelBox(group, 0.72, 0.62, 1.02, wool, 0, 0.68, 0);
  addVoxelBox(group, 0.78, 0.5, 0.86, wool, 0, 0.72, -0.02);
  for (const [lx, lz] of [
    [-0.22, 0.32],
    [0.22, 0.32],
    [-0.22, -0.32],
    [0.22, -0.32],
  ]) {
    addVoxelBox(group, 0.14, 0.42, 0.14, face, lx, 0.21, lz);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.78, 0.54);
  addVoxelBox(head, 0.36, 0.34, 0.42, face, 0, 0, 0.12);
  addVoxelBox(head, 0.32, 0.16, 0.26, wool, 0, 0.2, 0.04); // fluffy tuft
  addVoxelBox(head, 0.06, 0.06, 0.04, eye, -0.1, 0.04, 0.34, false, false);
  addVoxelBox(head, 0.06, 0.06, 0.04, eye, 0.1, 0.04, 0.34, false, false);
  group.add(head);

  return { group, head, contactShadow: createContactShadow(mats, 0.62) };
}

export function buildPastureCow(mats: MaterialLibrary): {
  group: THREE.Group;
  head: THREE.Group;
  contactShadow: THREE.Mesh;
} {
  const group = new THREE.Group();
  const white = mats.getMat('#f2ece0', { roughness: 0.88 });
  const spot = mats.getMat('#332c28', { roughness: 0.9 });
  const snout = mats.getMat('#e8a4a0', { roughness: 0.78 });
  const horn = mats.getMat('#e2d2a8', { roughness: 0.6 });

  addVoxelBox(group, 0.82, 0.78, 1.38, white, 0, 0.94, 0);
  addVoxelBox(group, 0.86, 0.42, 0.52, spot, 0, 1.02, 0.18);
  addVoxelBox(group, 0.86, 0.38, 0.44, spot, 0, 0.88, -0.44);
  for (const [lx, lz] of [
    [-0.28, 0.48],
    [0.28, 0.48],
    [-0.28, -0.48],
    [0.28, -0.48],
  ]) {
    addVoxelBox(group, 0.17, 0.58, 0.17, spot, lx, 0.29, lz);
  }
  const head = new THREE.Group();
  head.position.set(0, 1.08, 0.74);
  addVoxelBox(head, 0.48, 0.46, 0.46, white, 0, 0, 0.14);
  addVoxelBox(head, 0.44, 0.24, 0.22, snout, 0, -0.1, 0.42);
  addVoxelBox(head, 0.1, 0.22, 0.1, horn, -0.26, 0.24, 0.08);
  addVoxelBox(head, 0.1, 0.22, 0.1, horn, 0.26, 0.24, 0.08);
  group.add(head);

  return { group, head, contactShadow: createContactShadow(mats, 0.82) };
}

/**
 * Volumetric sunlit god-ray shafts slanting diagonally through Dawnbell's iconic vistas
 * (Awakening Overlook, Whisperwood, Dawnbell Spire, and Hearthbrook).
 */
export function buildSunbeamsGroup(): {
  group: THREE.Group;
  mat: THREE.ShaderMaterial;
} {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xfff1be) },
      uOpacity: { value: 0.085 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        float edge = pow(abs(dot(normalize(vNormalWorld), normalize(vViewDir))), 2.6);
        float vFade = smoothstep(0.0, 0.32, vUv.y) * smoothstep(1.0, 0.22, vUv.y);
        float shimmer = 0.84 + 0.16 * sin(vUv.x * 12.56637 + uTime * 0.45);
        float alpha = edge * vFade * shimmer * uOpacity;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const shaftGeo = new THREE.CylinderGeometry(2.2, 6.2, 42, 16, 1, true);
  const spots: Array<[number, number, number, number]> = [
    [-12, 23, 30, 1.05],
    [16, 21, 22, 0.95],
    [0, 27, 2, 1.35],
    [-28, 20, -10, 1.1],
    [22, 19, -20, 0.95],
  ];

  for (let i = 0; i < spots.length; i++) {
    const [x, y, z, scale] = spots[i];
    const shaft = new THREE.Mesh(shaftGeo, mat);
    shaft.position.set(x, y, z);
    shaft.rotation.set(0.22, 0.25 + i * 0.35, -0.34);
    shaft.scale.set(scale, 1, scale);
    shaft.renderOrder = 2;
    group.add(shaft);
  }

  return { group, mat };
}

export interface WindStreakItem {
  x: number;
  y: number;
  z: number;
  speed: number;
  phase: number;
  len: number;
}

/**
 * Breath-of-the-Wild style translucent drifting wind ribbons sweeping across the sunlit valley.
 */
export function buildWindStreaks(count = 54): {
  mesh: THREE.InstancedMesh;
  items: WindStreakItem[];
  mat: THREE.MeshBasicMaterial;
} {
  const geo = new THREE.BoxGeometry(0.06, 0.045, 2.4);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf7fbff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;

  const items: WindStreakItem[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (i % 7) * 0.37;
    const rad = 8 + ((i * 19) % 130);
    items.push({
      x: Math.cos(angle) * rad,
      y: 2.0 + (i % 5) * 1.4,
      z: Math.sin(angle) * rad,
      speed: 7.5 + (i % 4) * 2.2,
      phase: i * 1.13,
      len: 0.75 + (i % 5) * 0.22,
    });
  }

  return { mesh, items, mat };
}


