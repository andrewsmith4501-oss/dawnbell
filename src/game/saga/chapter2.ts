// Chapter Two: The Hollow Deep. The broken Warden seal in the Old Quarry, the Grapple Claw,
// the Belfry Key and Grimhide, the Burrow Beetle.
import * as THREE from 'three';
import { addVoxelBox } from '../voxelBuilder';
import { getTerrainHeight } from '../math';
import type { SolidCollider } from '../collision';
import { L, type SagaSystem } from './saga';
import type { RoomDef } from './rooms';
import { DG_STONE, addChest, addCrystal, addDoorSlab, roomEnemies, setupGrapple, smallKey } from './dungeon';

/** The broken seal, cut into the north cliff of the quarry in Emberstone Canyon. */
export const SEAL = { x: 47, z: -21.4 };

const dg = (id: string, name: string, map: string[], doors: RoomDef['doors']): RoomDef => ({
  id,
  name,
  map,
  floor: DG_STONE.floor,
  wall: DG_STONE.wall,
  wallTop: DG_STONE.wallTop,
  fog: DG_STONE.fog,
  doors,
});

const HD = 'the Hollow Deep';

const ROOMS: RoomDef[] = [
  dg(
    'hd1',
    'The Hollow Deep',
    [
      '#########NN#########',
      '#########..#########',
      '#..................#',
      '#..I............I..#',
      '#..................#',
      'W..................E',
      'W..................E',
      '#..................#',
      '#..I............I..#',
      '#..................#',
      '#..B............X..#',
      '#..................#',
      '#########..#########',
      '#########DD#########',
    ],
    {
      D: { to: 'world', label: 'To the quarry', x: SEAL.x, z: SEAL.z + 2.2, yaw: 0 },
      N: { to: 'hd2', door: 'S', label: 'Pillar Hall' },
      W: { to: 'hd3', door: 'E', label: 'Warren' },
      E: { to: 'hd4', door: 'W', label: 'Chasm', needs: 'hd_l1', keyPool: 'hd_keys', lockedText: 'A locked door. You need a small key.' },
    }
  ),
  dg(
    'hd2',
    'The Hollow Deep: Pillar Hall',
    [
      '##########NN##########',
      '##########..##########',
      '#....................#',
      '#..I..I........I..I..#',
      '#....................#',
      '#....................#',
      '#....................E',
      '#.........x..........E',
      '#....................#',
      '#..I..I........I..I..#',
      '#....................#',
      '#....................#',
      '#..B..............X..#',
      '##########..##########',
      '##########SS##########',
    ],
    {
      S: { to: 'hd1', door: 'N', label: 'Entry' },
      N: {
        to: 'hd7',
        door: 'S',
        label: 'The Sunken Belfry',
        needs: 'hd_bl',
        bigKey: 'hd_bk',
        bigKeyText: 'The Belfry Key turns in the great lock with a deep, ringing clunk.',
        lockedText: 'A great door with a bell carved into the lock. You need a special key.',
      },
      E: { to: 'hd5', door: 'W', label: 'Claw Vault', needs: 'hd_bars', lockedText: 'Iron bars block the way. Maybe that crystal does something.' },
    }
  ),
  dg(
    'hd3',
    'The Hollow Deep: Warren',
    [
      '##################',
      '#................#',
      '#..X..........B..#',
      '#................#',
      '#................E',
      '#.......c........E',
      '#................#',
      '#..B..........X..#',
      '#................#',
      '##################',
    ],
    { E: { to: 'hd1', door: 'W', label: 'Entry' } }
  ),
  dg(
    'hd4',
    'The Hollow Deep: Chasm',
    [
      '######################',
      '#.......______.......#',
      '#.......______.......#',
      '#.....v.______.v.....#',
      'W.......______.......E',
      'W.......______.......E',
      '#.....v.______.v.....#',
      '#.......______.......#',
      '#.......______.......#',
      '######################',
    ],
    {
      W: { to: 'hd1', door: 'E', label: 'Entry' },
      E: { to: 'hd6', door: 'W', label: 'Islands' },
    }
  ),
  dg(
    'hd5',
    'The Hollow Deep: Claw Vault',
    [
      '####################',
      '#..................#',
      '#..................#',
      '#.........c........#',
      '#..................#',
      'W..................#',
      'W....v.............#',
      '#__________________#',
      '#__________________#',
      '#.........v........#',
      '#..............c...#',
      '####################',
    ],
    { W: { to: 'hd2', door: 'E', label: 'Pillar Hall' } }
  ),
  dg(
    'hd6',
    'The Hollow Deep: Islands',
    [
      '########################',
      '#....______________....#',
      '#...v____...________.c.#',
      '#....____.v.________...#',
      '#....____...________...#',
      'W....______________....#',
      'W....______________v...#',
      '#....______________....#',
      '#....__________...__...#',
      '#....__________.v.__...#',
      '#....__________...__...#',
      '#....______________....#',
      '#....______________....#',
      '########################',
    ],
    { W: { to: 'hd4', door: 'E', label: 'Chasm' } }
  ),
  dg(
    'hd7',
    'The Sunken Belfry',
    [
      '######################',
      '#....................#',
      '#....................#',
      '#..I..............I..#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#..I..............I..#',
      '#....................#',
      '##########..##########',
      '##########SS##########',
    ],
    { S: { to: 'hd2', door: 'N', label: 'Pillar Hall', blockedBy: 'hd_fight', blockedText: 'The way out is sealed!' } }
  ),
];

function buildSeal(saga: SagaSystem): void {
  const m = saga.host.mats;
  const F = saga.F;
  const y = getTerrainHeight(SEAL.x, SEAL.z);
  const stone = m.getMat('#8a8478', { bump: 'stone', pattern: 'stone' });
  const dark = m.getMat('#0a0808', { roughness: 1 });
  const rune = m.getMat('#62c8ff', { emissive: '#2a88d8', emissiveIntensity: 1.2 });
  const frame = new THREE.Group();
  // Arch set into the cliff
  addVoxelBox(frame, 1.0, 4.2, 1.6, stone, -1.9, 2.1, 0);
  addVoxelBox(frame, 1.0, 4.2, 1.6, stone, 1.9, 2.1, 0);
  addVoxelBox(frame, 4.8, 1.0, 1.6, stone, 0, 4.6, 0);
  addVoxelBox(frame, 2.8, 3.6, 0.6, dark, 0, 1.8, -0.4, false);
  addVoxelBox(frame, 6.0, 6.0, 3.0, m.getMat('#6a5a48', { bump: 'stone' }), 0, 2.4, -2.2);
  addVoxelBox(frame, 0.5, 0.5, 0.1, rune, 0, 4.6, 0.82, false);
  // steps going down
  for (let i = 0; i < 3; i++) addVoxelBox(frame, 2.6, 0.2, 0.5, stone, 0, 0.1 - i * 0.18, 0.6 - i * 0.5);
  frame.position.set(SEAL.x, y, SEAL.z);
  const col: SolidCollider[] = [
    { id: 'seal_l', kind: 'box', x: SEAL.x - 1.9, z: SEAL.z, minY: y - 1, maxY: y + 5, halfX: 0.5, halfZ: 0.8, blocksCamera: true, climbable: false, active: true },
    { id: 'seal_r', kind: 'box', x: SEAL.x + 1.9, z: SEAL.z, minY: y - 1, maxY: y + 5, halfX: 0.5, halfZ: 0.8, blocksCamera: true, climbable: false, active: true },
    { id: 'seal_back', kind: 'box', x: SEAL.x, z: SEAL.z - 2.2, minY: y - 1, maxY: y + 5.4, halfX: 3, halfZ: 1.5, blocksCamera: true, climbable: true, active: true },
  ];
  saga.addProp(frame, () => true, col);

  // The seal stone: whole before chapter two, broken after
  const slab = new THREE.Group();
  addVoxelBox(slab, 2.8, 3.6, 0.4, stone, 0, 1.8, 0);
  addVoxelBox(slab, 1.0, 1.0, 0.1, rune, 0, 2.0, 0.22, false);
  slab.position.set(SEAL.x, y, SEAL.z + 0.2);
  const slabCol: SolidCollider = { id: 'seal_slab', kind: 'box', x: SEAL.x, z: SEAL.z + 0.2, minY: y - 1, maxY: y + 4, halfX: 1.4, halfZ: 0.3, blocksCamera: false, climbable: false, active: true };
  saga.addProp(slab, () => !F.ch2, [slabCol]);
  const rubble = new THREE.Group();
  const rs: Array<[number, number, number, number]> = [
    [-1.2, 1.6, 0.7, 0.2],
    [0.9, 2.0, 0.9, -0.4],
    [0.1, 2.6, 0.5, 0.6],
    [-0.4, 1.2, 0.6, 1.0],
  ];
  for (const [dx, dz, s, r] of rs) {
    const b = addVoxelBox(rubble, s * 1.3, s * 0.6, s, stone, dx, s * 0.3, dz);
    b.rotation.y = r;
  }
  rubble.position.set(SEAL.x, y, SEAL.z);
  saga.addProp(rubble, () => Boolean(F.ch2));

  saga.addSpot({
    id: 'seal_enter',
    x: SEAL.x,
    z: SEAL.z + 0.5,
    radius: 1.1,
    auto: true,
    label: () => 'The Hollow Deep',
    shown: () => Boolean(F.ch2),
    act: () => saga.enterRoom('hd1', 'D'),
  });
  saga.addSpot({
    id: 'seal_read',
    x: SEAL.x,
    z: SEAL.z + 1.0,
    radius: 2.2,
    label: () => 'Look at the seal',
    shown: () => !F.ch2,
    act: () =>
      saga.host.say([
        L('', 'A round stone seal, carved with the bell of the first Wardens. It is cracked, but it holds.'),
        L('Pip', 'Something is down there, Wren. I can feel it humming.'),
      ]),
  });
  // Pip notices the smashed seal
  saga.onUpdate(() => {
    if (!F.ch2 || F.q2_seen) return;
    const p = saga.host.player();
    if (Math.hypot(p.x - SEAL.x, p.z - SEAL.z) < 14) {
      F.q2_seen = true;
      saga.host.say([L('Pip', 'Look, Wren! The Warden seal at the north end has been smashed open.'), L('Pip', 'That must be the way down into the Hollow Deep.')]);
    }
  });
}

export function setupChapterTwo(saga: SagaSystem): void {
  const F = saga.F;
  const host = saga.host;
  for (const def of ROOMS) saga.addRoom({ def });
  const R = (id: string) => saga.rooms.get(id)!;
  buildSeal(saga);
  setupGrapple(saga);

  addDoorSlab(saga, R('hd1'), 'E', 'hd_l1', 'wood');
  addDoorSlab(saga, R('hd2'), 'N', 'hd_bl', 'big');
  addDoorSlab(saga, R('hd2'), 'E', 'hd_bars', 'bars');
  addCrystal(saga, R('hd2'), 10, 7, 'hd_bars', '#62c8ff', () => host.toast('Somewhere, iron bars grind open.', 2.4));

  /* ---- enemies ---- */
  roomEnemies(saga, 'hd1', (r) => [
    { kind: 'slime', ...r.tile(5, 4), name: 'Cave Slime' },
    { kind: 'slime', ...r.tile(14, 9), name: 'Cave Slime' },
    { kind: 'wisp', ...r.tile(10, 6), name: 'Cave Wisp', hp: 30 },
  ]);
  roomEnemies(saga, 'hd2', (r) => [
    { kind: 'wisp', ...r.tile(5, 5), name: 'Cave Wisp', hp: 30 },
    { kind: 'wisp', ...r.tile(16, 8), name: 'Cave Wisp', hp: 30 },
    { kind: 'slime', ...r.tile(6, 11), name: 'Cave Slime' },
    { kind: 'slime', ...r.tile(15, 11), name: 'Cave Slime' },
  ]);
  roomEnemies(
    saga,
    'hd3',
    (r) => [
      { kind: 'slime', variant: 'rat', ...r.tile(4, 3), name: 'Warren Rat', hp: 22 },
      { kind: 'slime', variant: 'rat', ...r.tile(13, 3), name: 'Warren Rat', hp: 22 },
      { kind: 'slime', variant: 'rat', ...r.tile(4, 7), name: 'Warren Rat', hp: 22 },
      { kind: 'slime', variant: 'rat', ...r.tile(13, 7), name: 'Warren Rat', hp: 22 },
      { kind: 'wisp', ...r.tile(9, 2), name: 'Cave Wisp', hp: 30 },
    ],
    {
      clearFlag: 'hd_t3',
      onClear: () => {
        host.sfx('gate');
        host.toast('A chest appears!', 2);
      },
    }
  );
  roomEnemies(saga, 'hd4', (r) => [
    { kind: 'wisp', ...r.tile(3, 7), name: 'Cave Wisp', hp: 30 },
    { kind: 'beetle', ...r.tile(18, 7), name: 'Horn-Beetle' },
  ]);
  roomEnemies(
    saga,
    'hd5',
    (r) => [{ kind: 'slime', ...r.tile(10, 3), name: 'Gloom Slime', hp: 110, scale: 2.4 }],
    {
      clearFlag: 'hd_t5',
      onClear: () => {
        host.sfx('gate');
        host.toast('A chest appears!', 2);
      },
    }
  );
  roomEnemies(saga, 'hd6', (r) => [
    { kind: 'beetle', ...r.tile(21, 5), name: 'Horn-Beetle' },
    { kind: 'beetle', ...r.tile(21, 10), name: 'Horn-Beetle' },
    { kind: 'wisp', ...r.tile(20, 11), name: 'Cave Wisp', hp: 30 },
  ]);

  /* ---- chests ---- */
  addChest(saga, R('hd3'), 8, 5, { flag: 'hd_c3', shown: () => Boolean(F.hd_t3), open: () => smallKey(saga, 'hd_keys', HD) });
  addChest(saga, R('hd5'), 10, 3, {
    flag: 'hd_c5',
    shown: () => Boolean(F.hd_t5),
    open: () => {
      F.hook = true;
      saga.gotItem('Grapple Claw', [
        L('', 'A relic of the first Wardens, on a chain that never seems to run out.'),
        L('Pip', 'Face a wooden post and press the action button to throw it. It grabs the post and pulls you right across.'),
        L('Pip', 'It stuns monsters, too. And I bet it could flip one of those armored beetles onto its back.'),
      ]);
    },
  });
  addChest(saga, R('hd5'), 15, 10, {
    flag: 'hd_c5b',
    open: () => {
      host.inv().marks += 30;
      host.sfx('coin');
      saga.gotItem('30 marks');
    },
  });
  addChest(saga, R('hd6'), 21, 2, {
    flag: 'hd_c6',
    open: () => {
      F.hd_bk = true;
      saga.gotItem('Belfry Key', [
        L('', 'It is heavy, and shaped like a little bell.'),
        L('Pip', 'The great door in the Pillar Hall had a bell on its lock. This has to be the key!'),
      ]);
    },
  });

  /* ---- Pip ---- */
  saga.onEnterRoom('hd1', () => {
    if (F.hd_seen) return;
    F.hd_seen = true;
    host.say([
      L('Pip', "So this is the Hollow Deep. It's freezing down here."),
      L('Pip', "Boot prints in the dust. Morrow's men came this way, but the tracks turn right back around."),
      L('Pip', 'I wonder what scared them off.'),
    ]);
  });
  saga.onEnterRoom('hd2', () => {
    if (F.hd_seen2) return;
    F.hd_seen2 = true;
    host.say([
      L('Pip', "Look at that great door! There's a bell carved into the lock. We'll need a special key."),
      L('Pip', 'And those bars on the east wall... I bet that crystal does something if you hit it.'),
    ]);
  });
  saga.onEnterRoom('hd4', () => {
    if (!F.hook && !F.hd_seen4) {
      F.hd_seen4 = true;
      host.say([L('Pip', 'A chasm! I can see wooden posts on the far side.'), L('Pip', 'If only we had a rope or a hook. We could swing right over.')]);
    } else if (F.hook && !F.hd_seen4b) {
      F.hd_seen4b = true;
      host.say([L('Pip', 'Now we can reach those posts! Face the chasm and throw the Grapple Claw.')]);
    }
  });
  saga.onEnterRoom('hd5', () => {
    if (F.hd_t5) return;
    host.say([L('Pip', 'Something is dripping from the ceiling...'), L('Pip', "Eww! It's a Gloom Slime, and it's enormous!")]);
  });
  saga.onEnterRoom('hd6', () => {
    if (F.hd_seen6) return;
    F.hd_seen6 = true;
    host.say([L('Pip', 'Posts on tiny islands, all the way across. Hop from one to the next.'), L('Pip', 'And Wren? Try not to look down.')]);
  });

  /* ---- Grimhide, the Burrow Beetle ---- */
  const belfry = R('hd7');
  const rocks: Array<{ x: number; z: number; t: number; ring: THREE.Mesh; rock: THREE.Mesh }> = [];
  const ringGeo = new THREE.RingGeometry(0.6, 0.95, 20);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x220a06, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const rockGeo = new THREE.BoxGeometry(0.9, 0.7, 0.9);
  const rockMat = host.mats.getMat('#7a7468', { bump: 'stone' });
  let rockTimer = 0;
  let enraged = false;
  let hinted = false;
  const dropRocks = (n: number) => {
    const p = host.player();
    for (let i = 0; i < n; i++) {
      const x = Math.min(Math.max(p.x + (Math.random() - 0.5) * (i === 0 ? 1 : 9), belfry.ox + 2.4), belfry.ox + belfry.w * 1.6 - 2.4);
      const z = Math.min(Math.max(p.z + (Math.random() - 0.5) * (i === 0 ? 1 : 9), belfry.oz + 2.4), belfry.oz + belfry.h * 1.6 - 4);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.04, z);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, 9, z);
      rock.castShadow = true;
      host.scene.add(ring, rock);
      rocks.push({ x, z, t: 0, ring, rock });
    }
  };
  const startGrim = () => {
    const t = belfry.tile(10, 4);
    host.spawnEnemy({ kind: 'beetle', x: t.x, z: t.z, name: 'Grimhide, the Burrow Beetle', hp: 150, scale: 2.3, tag: 'grim', armored: true, boss: true });
    F.hd_fight = true;
    enraged = false;
    host.shake(0.6);
    host.sfx('boss');
    host.particles(t.x, 0.5, t.z, 0x8a8074, 30, 7);
    host.toast('Grimhide, the Burrow Beetle!', 2.4);
  };
  saga.onEnterRoom('hd7', () => {
    if (F.hd_done || saga.anyTagged('grim')) return;
    host.say([L('Pip', 'Wren... the floor is shaking.'), L('Pip', 'Look out! Something is coming up through the stones!')], startGrim);
  });
  saga.onUpdate((dt) => {
    // falling rocks
    for (let i = rocks.length - 1; i >= 0; i--) {
      const r = rocks[i];
      r.t += dt;
      const k = Math.min(1, r.t / 0.95);
      r.rock.position.y = 9 * (1 - k * k) + 0.35;
      (r.ring.scale as THREE.Vector3).setScalar(0.6 + k * 0.5);
      if (k >= 1 && !r.ring.userData.hit) {
        r.ring.userData.hit = true;
        host.particles(r.x, 0.4, r.z, 0x9a9082, 10, 5);
        const p = host.player();
        if (Math.hypot(p.x - r.x, p.z - r.z) < 1.15 && p.y < 2) host.hurt(2, r.x, r.z);
      }
      if (r.t > 1.6) {
        host.scene.remove(r.ring, r.rock);
        rocks.splice(i, 1);
      }
    }
    if (!F.hd_fight) return;
    const g = host.enemiesTagged('grim')[0];
    if (!g) return;
    if (!hinted && (g.armorPings ?? 0) > 0) {
      hinted = true;
      host.toast(F.hook ? 'Its shell is too hard! Throw the Grapple Claw to flip it over.' : 'Its shell is too hard!', 3);
    }
    if (!enraged && g.hp <= g.maxHp / 2) {
      enraged = true;
      host.toast('Grimhide is furious! Watch for falling rocks!', 2.6);
      dropRocks(4);
    }
    if (enraged) {
      rockTimer -= dt;
      if (rockTimer <= 0) {
        rockTimer = 3.2;
        dropRocks(3);
      }
    }
  });
  saga.onKill((e) => {
    if (e.tag !== 'grim' || F.hd_done) return;
    F.hd_done = true;
    F.hd_fight = false;
    F.shard2 = true;
    F.hd_hc = true;
    host.shake(0.8);
    host.save();
    window.setTimeout(() => {
      host.sfx('win');
      host.inv().maxHp += 2;
      host.heal();
      host.say(
        [
          L('Pip', "Another shard! It was stuck in that beetle's shell the whole time. No wonder it was so grumpy."),
          L('', 'You got a second Dawnbell Shard. When the two shards touch, they ring like a tiny bell.'),
          L('', 'You found a Heartstone! One more heart for Wren.'),
          L('Pip', 'See those stakes in the floor? They have the royal crest on them. Someone from the castle mapped this cave long before us.'),
          L('Pip', "Hear that? They're singing to each other. I think they want to be whole again."),
          L('Pip', "Morrow's men never made it this far. Let's get back to Captain Venn before they try again."),
        ],
        () => {
          host.toast('Chapter Two complete: The Hollow Deep. Report to Captain Venn.', 5);
          host.save();
        }
      );
    }, 900);
  });
}
