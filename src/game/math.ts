export type BiomeId =
  | 'meadow'
  | 'village'
  | 'highland'
  | 'canyon'
  | 'lake'
  | 'shore'
  | 'peak'
  | 'desert'
  | 'swamp'
  | 'wilds'
  | 'snow';

export interface Landmark {
  id: string;
  name: string;
  kind: 'spire' | 'shrine' | 'village' | 'camp' | 'overlook' | 'city' | 'tower' | 'desert' | 'wilds' | 'quarry';
  x: number;
  z: number;
  radius: number;
  accent: string;
  fastTravel?: boolean;
}

export const WORLD_PLAY_RADIUS = 190;
export const WORLD_EXTENT = 300;
export const WATER_Y = -0.35;

/**
 * Interiors and dungeons are built in a "pocket" area far outside the overworld
 * (x beyond POCKET_X). Terrain there is a flat floor at y = 0, so all ground logic just works.
 */
export const POCKET_X = 600;
export function inPocket(x: number): boolean {
  return x > POCKET_X;
}
let pocketFloorFn: ((x: number, z: number) => number) | null = null;
let pocketNameFn: ((x: number, z: number) => string) | null = null;
export function setPocketHooks(floor: (x: number, z: number) => number, name: (x: number, z: number) => string): void {
  pocketFloorFn = floor;
  pocketNameFn = name;
}

export const LANDMARKS: Landmark[] = [
  { id: 'overlook', name: 'Awakening Overlook', kind: 'overlook', x: 0, z: 46, radius: 12, accent: '#72d266' },
  { id: 'spire', name: 'The Dawnbell Spire', kind: 'spire', x: 0, z: 0, radius: 13, accent: '#f0c65a', fastTravel: true },
  { id: 'village', name: 'Brackenford Keep', kind: 'village', x: 26, z: 22, radius: 19, accent: '#e08a4a', fastTravel: true },
  { id: 'shrine_wind', name: 'Shrine of Wind', kind: 'shrine', x: -46, z: -22, radius: 12, accent: '#62e8c0' },
  { id: 'shrine_embers', name: 'Shrine of Embers', kind: 'shrine', x: 48, z: -10, radius: 12, accent: '#ff9042' },
  { id: 'shrine_stillness', name: 'Shrine of Stillness', kind: 'shrine', x: 2, z: -58, radius: 12, accent: '#78d4ff' },
  { id: 'camp_whisper', name: 'Whisperwood Camp', kind: 'camp', x: -24, z: 16, radius: 10, accent: '#ef6a58' },
  { id: 'camp_canyon', name: 'Canyon Horn-Camp', kind: 'camp', x: 34, z: -26, radius: 10, accent: '#ef6a58' },
  { id: 'camp_highland', name: 'Highland Lookout', kind: 'camp', x: -28, z: -36, radius: 10, accent: '#ef6a58' },
  // Vast classic outer kingdom regions & Lodestones!
  { id: 'valenrock', name: 'Highcrown Square', kind: 'city', x: -6, z: -106, radius: 22, accent: '#e6c86e', fastTravel: true },
  { id: 'wizards_tower', name: "Wizards' Sea Tower", kind: 'tower', x: -96, z: 96, radius: 18, accent: '#62b6ff', fastTravel: true },
  { id: 'sunscorch_oasis', name: 'Sunscorch Oasis', kind: 'desert', x: 112, z: 72, radius: 24, accent: '#f4c45c', fastTravel: true },
  { id: 'dwarven_quarry', name: 'Dwarven Ore Quarry', kind: 'quarry', x: 108, z: -28, radius: 20, accent: '#d89252', fastTravel: true },
  { id: 'stone_circle', name: 'Druidic Stone Circle', kind: 'tower', x: -84, z: 6, radius: 14, accent: '#8ef29e' },
  { id: 'gloaming_fen', name: 'The Gloaming Fen', kind: 'camp', x: -104, z: -76, radius: 22, accent: '#7e9ed8' },
  { id: 'frostpeak', name: 'Frostpeak Ridge', kind: 'overlook', x: -136, z: -24, radius: 20, accent: '#d8f0ff' },
  { id: 'ashen_wilds', name: 'The Ashen Wilds', kind: 'wilds', x: 32, z: -152, radius: 24, accent: '#ff6642', fastTravel: true },
];

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function angleDiff(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + angleDiff(current, target) * (1 - Math.exp(-lambda * dt));
}

export function hash2(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function hash3(x: number, y: number, z: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm2(x: number, y: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return Math.hypot(px - ax, pz - az);
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / lenSq, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

const ROAD_SEGMENTS: Array<[number, number, number, number]> = [
  // Core Dawnbell Heartland Roads
  [0, 44, -2, 28],
  [-2, 28, 0, 11],
  [-2, 28, 12, 24],
  [12, 24, 24, 22],
  [26, 20, 36, 6],
  [36, 6, 46, -8],
  [0, -10, 2, -32],
  [2, -32, 2, -52],
  [-9, 0, -24, 12],
  [-24, 12, -34, -8],
  // Great North Road: Azure Mirror Island -> Highcrown Square -> Ashen Wilds Ditch
  [2, -66, -4, -86],
  [-4, -86, -6, -104],
  [-6, -118, 18, -132],
  [18, -132, 32, -148],
  // Eastern King's Highway: Brackenford Keep -> River Bridge -> Desert Border Gate -> Sunscorch Oasis
  [32, 26, 56, 36],
  [56, 36, 76, 48],
  [76, 48, 108, 70],
  // Canyon -> Dwarven Ore Quarry
  [58, -12, 84, -20],
  [84, -20, 106, -28],
  // Western Road: Whisperwood -> Druidic Stone Circle -> Frostpeak Pass & Gloaming Fen
  [-24, 14, -56, 10],
  [-56, 10, -82, 6],
  [-84, -4, -96, -44],
  [-96, -44, -104, -72],
  // Southwest Coastal Trail -> Sea Causeway -> Wizards' Sea Tower
  [-2, 46, -34, 58],
  [-34, 58, -56, 66],
  [-56, 66, -96, 96],
];

export function getRoadFactor(x: number, z: number): number {
  let minD = 999;
  for (let i = 0; i < ROAD_SEGMENTS.length; i++) {
    const s = ROAD_SEGMENTS[i];
    const d = distToSegment(x, z, s[0], s[1], s[2], s[3]);
    if (d < minD) minD = d;
  }
  return 1 - smoothstep(1.9, 4.4, minD);
}

/**
 * Winding River Bracken centerline X coordinate for a given Z (south of Azure Mirror Lake).
 */
export function getRiverLumX(z: number): number {
  return 56 + Math.sin(z * 0.042 + 0.5) * 9.5;
}

/**
 * Deterministic, sculpted vast Gielinor + Dawnbell open-world heightfield.
 */
export function getTerrainHeight(x: number, z: number): number {
  if (x > POCKET_X) return pocketFloorFn ? pocketFloorFn(x, z) : 0;
  const nLarge = (fbm2(x * 0.014 + 11.3, z * 0.014 + 7.1, 3) - 0.5) * 6.8;
  const nDetail = (valueNoise2(x * 0.075 - 4.2, z * 0.075 + 9.4) - 0.5) * 1.1;

  // Base rolling Whisperwood kingdom
  let h = 2.0 + nLarge + nDetail;

  // Gentle highland terracing
  if (h > 4.4) {
    const step = 1.6;
    const raw = (h - 4.4) / step;
    const stepped = Math.floor(raw) + smoothstep(0.18, 0.82, raw - Math.floor(raw));
    h = 4.4 + stepped * step;
  }

  // Awakening Overlook (South ridge facing north toward Dawnbell Spire)
  const dOverlook = Math.hypot(x - 0, z - 47);
  const overlookBlend = 1 - smoothstep(8, 22, dOverlook);
  h = lerp(h, 6.0, overlookBlend);

  // Smooth natural ramp from Overlook down into Whisperwood road
  const dRamp = distToSegment(x, z, 0, 38, -2, 24);
  const rampBlend = 1 - smoothstep(4.5, 11, dRamp);
  const rampTarget = lerp(6.0, 2.0, smoothstep(39, 24, z));
  if (z > 22 && z < 41) {
    h = lerp(h, rampTarget, rampBlend * 0.85);
  }

  // Central Dawnbell Spire Plaza
  const dSpire = Math.hypot(x, z);
  const spireBlend = 1 - smoothstep(9.5, 19, dSpire);
  h = lerp(h, 3.4, spireBlend);

  // Brackenford Keep & Pasture (classic meadow shelf)
  const dVillage = Math.hypot(x - 26, z - 22);
  const villageBlend = 1 - smoothstep(14, 26, dVillage);
  h = lerp(h, 2.1, villageBlend);

  // Windcrest Bluff (climbable highland plateau)
  const dWind = Math.hypot((x + 46) * 0.92, (z + 22) * 1.05);
  const windPeak = 1 - smoothstep(11, 27, dWind);
  if (windPeak > 0.001) {
    const cliffCurve = smoothstep(0.05, 0.58, windPeak);
    h = lerp(h, 14.2, cliffCurve);
  }

  // Emberstone Canyon
  const dEmber = Math.hypot(x - 48, z + 10);
  const emberRim = Math.exp(-Math.pow((dEmber - 17) / 6.5, 2)) * 6.4;
  h += emberRim * smoothstep(2, 10, Math.hypot(x - 36, z - 2));
  const emberFloor = 1 - smoothstep(8.5, 15, dEmber);
  h = lerp(h, 3.0, emberFloor);

  // Azure Mirror Lake basin
  const dLake = Math.hypot((x - 2) * 0.78, (z + 52) * 1.05);
  const lakeCarve = 1 - smoothstep(16, 30, dLake);
  h = lerp(h, -2.5, lakeCarve);

  // Shrine of Stillness Island inside Mirror Lake
  const dIsland = Math.hypot(x - 2, z + 58);
  const islandLift = 1 - smoothstep(8.5, 15, dIsland);
  h = lerp(h, 2.6, islandLift);

  // Stone Causeway connecting Spire north shore -> Lake Island -> Highcrown North Shore
  if (z < -26 && z > -86) {
    const dCauseway = distToSegment(x, z, 2, -26, -4, -86);
    const causewayBlend = 1 - smoothstep(2.8, 5.4, dCauseway);
    h = Math.max(h, lerp(h, 0.9, causewayBlend));
  }

  // ---- VAST RUNESCAPE-INSPIRED OUTER REGIONS ----

  // 1. Highcrown Square (old-world walled market city north of Azure Mirror Lake)
  const dValen = Math.hypot(x + 6, z + 106);
  const valenBlend = 1 - smoothstep(19, 32, dValen);
  h = lerp(h, 3.2, valenBlend);

  // 2. River Bracken carving south from z = 14 to z = 145 between Brackenford & Sunscorch Desert
  if (z > 14 && z < 152) {
    const rx = getRiverLumX(z);
    const dRiver = Math.abs(x - rx);
    const riverFade = smoothstep(14, 24, z);
    const riverCarve = (1 - smoothstep(3.4, 7.6, dRiver)) * riverFade;
    h = lerp(h, -1.65, riverCarve);
    // Keep road crossing bridge approach level
    const dBridge = Math.hypot(x - getRiverLumX(36), z - 36);
    if (dBridge < 5.2) {
      h = Math.max(h, lerp(h, 1.35, 1 - smoothstep(2.6, 5.2, dBridge)));
    }
  }

  // 3. Sunscorch Desert (Al-Kharid rolling dunes + Oasis Pool + Pyramid plateau in SE)
  const dDesert = Math.hypot((x - 116) * 0.85, (z - 76) * 0.92);
  const desertBlend = 1 - smoothstep(36, 56, dDesert);
  if (desertBlend > 0.001) {
    const dunes = 2.8 + Math.sin(x * 0.09 + z * 0.05) * 1.45 + Math.cos(z * 0.08 - x * 0.04) * 1.1;
    h = lerp(h, dunes, desertBlend * 0.85);
  }
  const dOasis = Math.hypot(x - 104, z - 80);
  if (dOasis < 16) {
    h = lerp(h, -1.45, 1 - smoothstep(6.2, 13.5, dOasis));
  }
  const dPyramid = Math.hypot(x - 130, z - 60);
  if (dPyramid < 22) {
    h = lerp(h, 3.4, 1 - smoothstep(12, 22, dPyramid));
  }
  const dGate = Math.hypot(x - 74, z - 48);
  if (dGate < 14) {
    h = lerp(h, 2.3, 1 - smoothstep(7, 14, dGate));
  }

  // 4. Dwarven Ore Quarry (Terraced mining basin in far East)
  const dQuarry = Math.hypot(x - 108, z + 28);
  const quarryBlend = 1 - smoothstep(15, 28, dQuarry);
  if (quarryBlend > 0.001) {
    const rim = Math.exp(-Math.pow((dQuarry - 21) / 5.5, 2)) * 5.8;
    h = lerp(h, 2.4, quarryBlend) + rim * smoothstep(4, 12, Math.hypot(x - 88, z + 22));
  }

  // 5. Wizards' Sea Tower Bay & Island + Sea Causeway in SW
  const dWizBay = Math.hypot(x + 94, z - 96);
  const wizBayCarve = 1 - smoothstep(26, 44, dWizBay);
  h = lerp(h, -2.5, wizBayCarve);
  const dWizIsle = Math.hypot(x + 96, z - 96);
  const wizIsleLift = 1 - smoothstep(11, 18, dWizIsle);
  h = lerp(h, 2.8, wizIsleLift);
  const dSeaCauseway = distToSegment(x, z, -56, 66, -96, 96);
  if (dSeaCauseway < 6.5) {
    h = Math.max(h, lerp(h, 1.15, 1 - smoothstep(2.6, 5.6, dSeaCauseway)));
  }

  // 6. Druidic Stone Circle glade (West)
  const dCircle = Math.hypot(x + 84, z - 6);
  if (dCircle < 18) {
    h = lerp(h, 3.0, 1 - smoothstep(10, 18, dCircle));
  }

  // 7. The Gloaming Fen (Misty mossy swamp in NW)
  const dFen = Math.hypot((x + 104) * 0.9, (z + 76) * 0.9);
  const fenBlend = 1 - smoothstep(22, 38, dFen);
  if (fenBlend > 0.001) {
    const bog = 0.55 + (valueNoise2(x * 0.09, z * 0.09) - 0.45) * 1.4;
    h = lerp(h, bog, fenBlend);
  }

  // 8. Frostpeak Ridge (White Wolf Mountain-inspired alpine pass in far West)
  const dFrost = Math.hypot((x + 138) * 0.85, (z + 22) * 0.95);
  const frostBlend = 1 - smoothstep(18, 42, dFrost);
  if (frostBlend > 0.001) {
    const alpine = 17.5 + fbm2(x * 0.05, z * 0.05, 3) * 8.5;
    h = lerp(h, alpine, smoothstep(0.06, 0.72, frostBlend));
  }

  // 9. The Ashen Wilds (Wilderness-inspired dark volcanic basin in Far North)
  const dWilds = Math.hypot((x - 32) * 0.82, (z + 150) * 0.95);
  const wildsBlend = 1 - smoothstep(24, 42, dWilds);
  if (wildsBlend > 0.001) {
    const crags = 2.6 + (fbm2(x * 0.045 + 3, z * 0.045 - 2, 3) - 0.5) * 5.2;
    h = lerp(h, crags, wildsBlend);
  }
  const dWildsKeep = Math.hypot(x - 32, z + 152);
  if (dWildsKeep < 16) {
    h = lerp(h, 3.0, 1 - smoothstep(9, 16, dWildsKeep));
  }

  // Flatten monster camp pads gently
  const camps: Array<[number, number, number]> = [
    [-24, 16, 2.2],
    [34, -26, 3.2],
    [-28, -36, 5.4],
  ];
  for (let i = 0; i < camps.length; i++) {
    const [cx, cz, ch] = camps[i];
    const dc = Math.hypot(x - cx, z - cz);
    const cb = 1 - smoothstep(6, 13, dc);
    h = lerp(h, ch, cb * 0.8);
  }

  // Natural outer realm rim: towering snow-dusted mountain wall on W/E/N-W and sparkling ocean on South & Far NE
  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter > WORLD_PLAY_RADIUS - 12) {
    const rimT = smoothstep(WORLD_PLAY_RADIUS - 12, WORLD_PLAY_RADIUS + 62, distFromCenter);
    const angle = Math.atan2(z, x);
    // Open sparkling sea along the southern bay (-SW to SE) and far NE coast; mountain ranges elsewhere
    const seaArc = smoothstep(0.28, 0.9, Math.sin(angle) * 0.85 - 0.05);
    const ridgeNoise = 20 + fbm2(x * 0.024, z * 0.024, 3) * 34;
    const outerTarget = lerp(ridgeNoise, -3.5, seaArc);
    h = lerp(h, outerTarget, rimT);
  }

  return h;
}

export function getTerrainNormal(x: number, z: number): { x: number; y: number; z: number } {
  const eps = 0.55;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  const nx = hL - hR;
  const ny = 2 * eps;
  const nz = hD - hU;
  const inv = 1 / Math.hypot(nx, ny, nz);
  return { x: nx * inv, y: ny * inv, z: nz * inv };
}

export function getBiomeAt(x: number, z: number): BiomeId {
  if (x > POCKET_X) return 'village';
  const h = getTerrainHeight(x, z);
  if (h < WATER_Y + 0.08) return 'lake';
  const warp = (valueNoise2(x * 0.035 + 4, z * 0.035 - 7) - 0.5) * 22;
  if (Math.hypot((x - 114) * 0.85, (z - 72) * 0.9) < 48 + warp * 0.4 || (x > 74 + warp * 0.35 && z > 32 + warp * 0.3)) {
    return 'desert';
  }
  const dWilds = Math.hypot((x - 32) * 0.85, (z + 152) * 0.95);
  if (dWilds < 46 + warp * 0.5 || (z < -128 + warp * 0.4 && x > 4 + warp * 0.8)) {
    return 'wilds';
  }
  if (Math.hypot((x + 138) * 0.85, (z + 22) * 0.95) < 38 + warp * 0.45 || (h > 26 && x < -48 + warp)) {
    return 'snow';
  }
  if (Math.hypot((x + 104) * 0.9, (z + 76) * 0.9) < 34 + warp * 0.35) return 'swamp';
  if (h < WATER_Y + 0.72) return 'shore';
  if (Math.hypot(x - 26, z - 22) < 20 || Math.hypot(x + 6, z + 106) < 24) return 'village';
  if (Math.hypot(x - 48, z + 10) < 23 || Math.hypot(x - 108, z + 28) < 26) return 'canyon';
  if (h > 14.0) return 'peak';
  if (h > 8.2 || Math.hypot(x + 46, z + 22) < 23) return 'highland';
  return 'meadow';
}

export function getRegionName(x: number, z: number): string {
  if (x > POCKET_X) return pocketNameFn ? pocketNameFn(x, z) : 'Indoors';
  for (let i = 0; i < LANDMARKS.length; i++) {
    const lm = LANDMARKS[i];
    if (Math.hypot(x - lm.x, z - lm.z) <= lm.radius + 4) {
      return lm.name;
    }
  }
  const biome = getBiomeAt(x, z);
  switch (biome) {
    case 'desert':
      return 'Sunscorch Desert';
    case 'wilds':
      return 'The Ashen Wilds';
    case 'snow':
      return 'Frostpeak Ridge';
    case 'swamp':
      return 'The Gloaming Fen';
    case 'lake':
    case 'shore':
      return z > 30 ? 'Southern Sea Coast' : 'Azure Mirror Lake';
    case 'canyon':
      return x > 76 ? 'Dwarven Ore Quarry' : 'Emberstone Canyon';
    case 'highland':
    case 'peak':
      return 'Windcrest Highlands';
    case 'village':
      return z < -50 ? 'Highcrown Square' : 'Brackenford Keep';
    default:
      return 'The Whisperwood';
  }
}
