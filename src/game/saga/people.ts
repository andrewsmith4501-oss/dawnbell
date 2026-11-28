// Voxel people for the Gallowmark cast (Brackenford, the Fen, the Coast).
import * as THREE from 'three';
import { MaterialLibrary, addVoxelBox } from '../voxelBuilder';

export interface PersonLook {
  skin: string;
  hair: string;
  hairStyle?: 'short' | 'long' | 'bun' | 'bald' | 'braid';
  beard?: string;
  tunic: string;
  legs: string;
  boots?: string;
  belt?: string;
  apron?: string;
  robe?: boolean;
  hat?: 'none' | 'cap' | 'hood' | 'helmet' | 'tricorn' | 'circlet' | 'kerchief';
  hatColor?: string;
  cloak?: string;
  prop?: 'none' | 'sword' | 'staff' | 'tankard' | 'book' | 'hammer' | 'spear' | 'lantern' | 'net' | 'basket';
  scale?: number;
  /** Child-sized */
  child?: boolean;
  /** Bent old posture */
  stooped?: boolean;
}

export function buildPerson(mats: MaterialLibrary, look: PersonLook): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const cloth = (c: string) => mats.getMat(c, { roughness: 0.86, pattern: 'cloth' });
  const skin = mats.getMat(look.skin, { roughness: 0.7 });
  const hair = mats.getMat(look.hair, { roughness: 0.82 });
  const tunic = cloth(look.tunic);
  const legs = cloth(look.legs);
  const boot = mats.getMat(look.boots ?? '#3a2a20', { roughness: 0.8 });
  const belt = mats.getMat(look.belt ?? '#4a2f1b', { roughness: 0.7 });
  const eye = mats.getMat('#1b2230', { roughness: 0.2 });

  // Legs + boots
  if (!look.robe) {
    for (const s of [-1, 1]) {
      addVoxelBox(body, 0.19, 0.5, 0.21, legs, s * 0.12, 0.52, 0);
      addVoxelBox(body, 0.2, 0.24, 0.27, boot, s * 0.12, 0.13, 0.03);
    }
  } else {
    addVoxelBox(body, 0.5, 0.78, 0.38, tunic, 0, 0.42, 0);
    addVoxelBox(body, 0.56, 0.1, 0.42, tunic, 0, 0.06, 0);
  }
  // Torso
  addVoxelBox(body, 0.5, 0.62, 0.3, tunic, 0, 1.06, 0);
  addVoxelBox(body, 0.52, 0.08, 0.32, belt, 0, 0.8, 0);
  if (look.apron) addVoxelBox(body, 0.4, 0.62, 0.04, cloth(look.apron), 0, 0.82, 0.17);
  if (look.cloak) {
    const ck = cloth(look.cloak);
    addVoxelBox(body, 0.58, 0.95, 0.06, ck, 0, 0.92, -0.19);
    addVoxelBox(body, 0.6, 0.12, 0.36, ck, 0, 1.34, -0.02);
  }
  // Arms
  for (const s of [-1, 1]) {
    addVoxelBox(body, 0.15, 0.52, 0.16, tunic, s * 0.33, 1.06, 0);
    addVoxelBox(body, 0.12, 0.12, 0.12, skin, s * 0.33, 0.76, 0.02);
  }
  // Neck + head (about 1/6 of height, natural proportions)
  addVoxelBox(body, 0.14, 0.1, 0.14, skin, 0, 1.4, 0);
  addVoxelBox(body, 0.32, 0.34, 0.3, skin, 0, 1.6, 0);
  addVoxelBox(body, 0.06, 0.07, 0.05, skin, 0, 1.56, 0.17); // nose
  for (const s of [-1, 1]) {
    addVoxelBox(body, 0.055, 0.06, 0.02, eye, s * 0.075, 1.63, 0.152, false);
    addVoxelBox(body, 0.08, 0.025, 0.02, hair, s * 0.075, 1.685, 0.155, false);
  }
  // Hair
  const style = look.hairStyle ?? 'short';
  if (style !== 'bald') {
    addVoxelBox(body, 0.35, 0.1, 0.33, hair, 0, 1.79, -0.005);
    addVoxelBox(body, 0.35, 0.22, 0.08, hair, 0, 1.66, -0.15);
    for (const s of [-1, 1]) addVoxelBox(body, 0.05, 0.16, 0.26, hair, s * 0.17, 1.69, -0.02);
    if (style === 'long') addVoxelBox(body, 0.36, 0.42, 0.1, hair, 0, 1.44, -0.16);
    if (style === 'bun') addVoxelBox(body, 0.16, 0.16, 0.16, hair, 0, 1.86, -0.12);
    if (style === 'braid') addVoxelBox(body, 0.1, 0.5, 0.1, hair, 0, 1.36, -0.2);
  } else {
    for (const s of [-1, 1]) addVoxelBox(body, 0.05, 0.1, 0.18, hair, s * 0.17, 1.62, -0.04);
  }
  if (look.beard) {
    const bd = mats.getMat(look.beard, { roughness: 0.88 });
    addVoxelBox(body, 0.32, 0.16, 0.08, bd, 0, 1.48, 0.15);
    addVoxelBox(body, 0.2, 0.14, 0.07, bd, 0, 1.36, 0.15);
  }
  // Headwear
  const hc = look.hatColor ?? '#5a4030';
  switch (look.hat) {
    case 'cap':
      addVoxelBox(body, 0.38, 0.1, 0.36, cloth(hc), 0, 1.84, 0);
      addVoxelBox(body, 0.3, 0.04, 0.12, cloth(hc), 0, 1.8, 0.2);
      break;
    case 'hood':
      addVoxelBox(body, 0.4, 0.14, 0.38, cloth(hc), 0, 1.84, -0.01);
      addVoxelBox(body, 0.4, 0.34, 0.08, cloth(hc), 0, 1.66, -0.18);
      for (const s of [-1, 1]) addVoxelBox(body, 0.05, 0.3, 0.32, cloth(hc), s * 0.2, 1.68, -0.02);
      break;
    case 'helmet': {
      const st = mats.getMat(hc, { roughness: 0.35, metalness: 0.7 });
      addVoxelBox(body, 0.38, 0.16, 0.36, st, 0, 1.84, 0);
      addVoxelBox(body, 0.44, 0.04, 0.42, st, 0, 1.77, 0);
      addVoxelBox(body, 0.04, 0.16, 0.04, st, 0, 1.57, 0.18);
      break;
    }
    case 'tricorn':
      addVoxelBox(body, 0.5, 0.06, 0.46, cloth(hc), 0, 1.84, 0);
      addVoxelBox(body, 0.34, 0.14, 0.32, cloth(hc), 0, 1.93, 0);
      break;
    case 'circlet':
      addVoxelBox(body, 0.36, 0.04, 0.34, mats.getMat('#dfe6ee', { roughness: 0.2, metalness: 0.9 }), 0, 1.74, 0);
      break;
    case 'kerchief':
      addVoxelBox(body, 0.37, 0.1, 0.35, cloth(hc), 0, 1.8, -0.01);
      addVoxelBox(body, 0.12, 0.14, 0.04, cloth(hc), 0, 1.62, -0.19);
      break;
    default:
      break;
  }
  // Hand prop (right hand)
  const wood = mats.getMat('#6b4423', { roughness: 0.8, bump: 'wood' });
  const steel = mats.getMat('#c8d0da', { roughness: 0.28, metalness: 0.85 });
  switch (look.prop) {
    case 'sword':
      addVoxelBox(body, 0.06, 0.8, 0.04, steel, 0.42, 1.02, 0.18);
      addVoxelBox(body, 0.22, 0.05, 0.06, mats.getMat('#b8902c', { metalness: 0.7 }), 0.42, 0.62, 0.18);
      break;
    case 'staff':
      addVoxelBox(body, 0.07, 1.9, 0.07, wood, 0.42, 0.95, 0.12);
      break;
    case 'spear':
      addVoxelBox(body, 0.06, 2.1, 0.06, wood, 0.42, 1.05, 0.1);
      addVoxelBox(body, 0.09, 0.22, 0.04, steel, 0.42, 2.15, 0.1);
      break;
    case 'hammer':
      addVoxelBox(body, 0.06, 0.5, 0.06, wood, 0.42, 0.78, 0.12);
      addVoxelBox(body, 0.22, 0.14, 0.14, mats.getMat('#4b5058', { metalness: 0.8, roughness: 0.4 }), 0.42, 1.0, 0.12);
      break;
    case 'tankard':
      addVoxelBox(body, 0.14, 0.18, 0.14, mats.getMat('#9a9fa8', { metalness: 0.6 }), 0.36, 0.84, 0.16);
      break;
    case 'book':
      addVoxelBox(body, 0.22, 0.28, 0.08, mats.getMat('#7a2a2a'), 0.3, 0.92, 0.2);
      break;
    case 'lantern':
      addVoxelBox(body, 0.16, 0.2, 0.16, mats.getMat('#ffe08a', { emissive: '#ffb640', emissiveIntensity: 1.4 }), 0.4, 0.62, 0.12, false);
      break;
    case 'net':
      addVoxelBox(body, 0.5, 0.4, 0.04, mats.getMat('#b8a27a', { roughness: 0.9 }), 0.36, 0.7, 0.22);
      break;
    case 'basket':
      addVoxelBox(body, 0.3, 0.2, 0.24, mats.getMat('#a07a44', { bump: 'wood' }), 0.34, 0.7, 0.18);
      break;
    default:
      break;
  }
  let s = look.scale ?? 1;
  if (look.child) s *= 0.68;
  body.scale.setScalar(s);
  if (look.stooped) body.rotation.x = 0.12;
  return g;
}

export const LOOKS: Record<string, PersonLook> = {
  venn: { skin: '#c99870', hair: '#3a3530', beard: '#4a4540', tunic: '#2f4a6a', legs: '#2a2a30', cloak: '#6a1f22', hat: 'none', prop: 'sword', scale: 1.06, belt: '#2a1a10' },
  odo: { skin: '#b9825a', hair: '#2a2018', hairStyle: 'bald', beard: '#6a5a4a', tunic: '#5a4e46', legs: '#3a342e', apron: '#3d2a1c', prop: 'hammer', scale: 1.08 },
  marla: { skin: '#f0c8a8', hair: '#b04a2a', hairStyle: 'bun', tunic: '#7a5a8a', legs: '#4a3a4a', apron: '#efe6d6', robe: true },
  aldous: { skin: '#e6c0a0', hair: '#d8d4cc', hairStyle: 'bald', beard: '#e0ddd6', tunic: '#c8b89a', legs: '#8a7a60', robe: true, prop: 'book', stooped: true },
  fen: { skin: '#e0a878', hair: '#2a1f1a', tunic: '#7a4f9a', legs: '#3a2a3a', hat: 'hood', hatColor: '#4a2f63' },
  nell: { skin: '#e8b890', hair: '#2a1f1a', hairStyle: 'braid', tunic: '#c8a0c8', legs: '#7a5a7a', robe: true, child: true },
  tilda: { skin: '#f2c6a2', hair: '#e0b050', hairStyle: 'bun', tunic: '#3a8a6a', legs: '#2a4a3a', apron: '#f0e0c0', robe: true, hat: 'kerchief', hatColor: '#c84a3a' },
  bram: { skin: '#d49a70', hair: '#6a4020', beard: '#6a4020', tunic: '#8a6a2a', legs: '#4a3a24', apron: '#c8b890', prop: 'basket' },
  hilde: { skin: '#f0c4a0', hair: '#9a9088', hairStyle: 'bun', tunic: '#5a6a8a', legs: '#3a3a4a', robe: true, hat: 'kerchief', hatColor: '#d8c8a8', stooped: true },
  tomas: { skin: '#e2b088', hair: '#c88a3a', tunic: '#4a7a3a', legs: '#5a4a34', hat: 'cap', hatColor: '#3a5a2a', child: true },
  patron: { skin: '#d8a880', hair: '#5a3a20', beard: '#5a3a20', tunic: '#6a4a3a', legs: '#3a2a20', prop: 'tankard' },
  guard: { skin: '#d8a880', hair: '#3a2a1a', tunic: '#8a2a2a', legs: '#3a3a40', hat: 'helmet', hatColor: '#9aa2ac', prop: 'spear', belt: '#2a2a2a' },
  soldier: { skin: '#e0b090', hair: '#3a2a1a', tunic: '#1f2a4a', legs: '#2a2a30', hat: 'helmet', hatColor: '#c8a83a', prop: 'spear', belt: '#2a2a2a' },
  morrow: { skin: '#e8d0c0', hair: '#1a1a20', tunic: '#1a1a24', legs: '#1a1a20', cloak: '#3a0f1a', hat: 'none', scale: 1.1, belt: '#8a6a2a' },
  wick: { skin: '#c8a080', hair: '#cfcac0', beard: '#d8d4cc', tunic: '#4a5a3a', legs: '#3a3a2a', cloak: '#3a4a30', prop: 'lantern', stooped: true },
  hobb: { skin: '#c89070', hair: '#6a5a4a', beard: '#7a6a5a', tunic: '#2a4a6a', legs: '#2a3040', hat: 'cap', hatColor: '#1f2f4a', scale: 1.08 },
  pell: { skin: '#e8b890', hair: '#8a5a2a', tunic: '#4a6a9a', legs: '#4a4030', child: true },
  coralie: { skin: '#e0b8a0', hair: '#e8e4dc', hairStyle: 'bun', tunic: '#3a7a8a', legs: '#2a4a5a', robe: true, hat: 'kerchief', hatColor: '#e8d0a0', stooped: true },
  holt: { skin: '#d8a880', hair: '#4a3a2a', tunic: '#1f2a4a', legs: '#2a2a30', hat: 'helmet', hatColor: '#c8a83a', prop: 'spear' },
  brine: { skin: '#e8c0a0', hair: '#6a6a6a', beard: '#8a8a8a', tunic: '#2a3a6a', legs: '#2a2a3a', hat: 'tricorn', hatColor: '#1a2240', prop: 'book' },
  wenna: { skin: '#e8c0a0', hair: '#3a2018', hairStyle: 'long', tunic: '#8a3a3a', legs: '#3a2a2a', apron: '#e0d6c4', robe: true },
  maddox: { skin: '#b88a6a', hair: '#9a9a9a', beard: '#b8b8b8', tunic: '#4a5a6a', legs: '#3a3a3a', hat: 'cap', hatColor: '#2a3a4a', prop: 'tankard', stooped: true },
  fisher: { skin: '#d8a880', hair: '#7a5a3a', tunic: '#5a7a8a', legs: '#3a3a3a', hat: 'cap', hatColor: '#c8a04a', prop: 'net' },
};
