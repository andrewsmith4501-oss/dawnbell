// Chapter One: The Warden's Trial. Brackenford, its people, the three tokens and the Hall.
import * as THREE from 'three';
import { addVoxelBox, buildCottage } from '../voxelBuilder';
import { getTerrainHeight } from '../math';
import type { SolidCollider } from '../collision';
import { L, type SagaSystem } from './saga';
import { LOOKS } from './people';
import type { RoomDef } from './rooms';

/* ---------------- Brackenford layout (world coordinates) ---------------- */
export const TOWN = {
  hall: { x: 47, z: 31, rot: -Math.PI / 2, w: 10, d: 8 },
  chapel: { x: 10, z: 7, rot: 0, w: 7, d: 9 },
  inn: { x: 35, z: 35.5, rot: Math.PI, w: 7.5, d: 5.6 },
  fenHouse: { x: 20, z: 29.5, rot: 2.75, w: 5.2, d: 4.2 },
};

/** World position just outside a building's front door (and the yaw facing away from it). */
export function doorOf(b: { x: number; z: number; rot: number; d: number }, out = 1.4): { x: number; z: number; yaw: number } {
  const dz = b.d / 2 + out;
  return { x: b.x + dz * Math.sin(b.rot), z: b.z + dz * Math.cos(b.rot), yaw: b.rot };
}

const ROOMS: Record<string, RoomDef> = {
  inn: {
    id: 'inn',
    name: 'The Rusty Kettle',
    floor: '#8a6a4a',
    floor2: '#8a3a32',
    wall: '#b8a688',
    map: [
      '##############',
      '#H...,,,,...K#',
      '#.T..,,,,.T..#',
      '#....,,,,....#',
      '#............#',
      '#RRRR....T...#',
      '#............#',
      '#..........B.#',
      '#S.........BX#',
      '######D#######',
    ],
    doors: {
      D: { to: 'world', label: 'Leave', ...doorOf(TOWN.inn) },
      S: { to: 'cellar', door: 'U', label: 'Cellar', needs: 'cellar_open', lockedText: 'The cellar door is bolted. Marla keeps the key.' },
    },
  },
  cellar: {
    id: 'cellar',
    name: 'Rusty Kettle Cellar',
    floor: '#5a5048',
    wall: '#6a5e52',
    map: [
      '##############',
      '#U....B...X..#',
      '#............#',
      '#.X.......B..#',
      '#.....BB.....#',
      '#............#',
      '#..B.......X.#',
      '#.....X......#',
      '#X..........B#',
      '##############',
    ],
    doors: { U: { to: 'inn', door: 'S', label: 'Upstairs' } },
  },
  chapel: {
    id: 'chapel',
    name: 'Chapel of the Dawn',
    floor: '#cfc6b4',
    floor2: '#7a3a5a',
    wall: '#e8e0d0',
    map: [
      '#############',
      '#K....A....K#',
      '#.....,.....#',
      '#.l...,...l.#',
      '#.PP..,..PP.#',
      '#.....,.....#',
      '#.PP..,..PP.#',
      '#.....,.....#',
      '#.PP..,..PP.#',
      '#.....,.....#',
      '######D######',
    ],
    doors: { D: { to: 'world', label: 'Leave', ...doorOf(TOWN.chapel) } },
  },
  hall: {
    id: 'hall',
    name: 'Hall of Wardens',
    floor: '#7a7a82',
    floor2: '#3a4a6a',
    wall: '#8a8a94',
    map: [
      '################',
      '#K....,,,,....K#',
      '#.....,,,,.....#',
      '#.p...,,,,...p.#',
      '#.....,,,,.....#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#.p..........p.#',
      '#..............#',
      '#..............#',
      '#######DD#######',
    ],
    doors: { D: { to: 'world', label: 'Leave', ...doorOf(TOWN.hall) } },
  },
  fenhouse: {
    id: 'fenhouse',
    name: "Fen and Nell's House",
    floor: '#8a7050',
    floor2: '#6a4a7a',
    wall: '#9a7a5a',
    map: ['##########', '#b.,,,..K#', '#..,,,...#', '#H.....T.#', '#......B.#', '####D#####'],
    doors: { D: { to: 'world', label: 'Leave', ...doorOf(TOWN.fenHouse) } },
  },
};

function building(
  saga: SagaSystem,
  id: string,
  b: { x: number; z: number; rot: number; w: number; d: number },
  opts: { roof: string; wall?: string; chimney?: boolean; extra?: (g: THREE.Group, y: number) => void }
): void {
  const y = getTerrainHeight(b.x, b.z);
  const g = buildCottage(saga.host.mats, { w: b.w, d: b.d, roofColor: opts.roof, wallColor: opts.wall, hasChimney: opts.chimney });
  g.position.set(b.x, y, b.z);
  g.rotation.y = b.rot;
  opts.extra?.(g, y);
  const col: SolidCollider = {
    id: `saga_bld_${id}`,
    kind: 'box',
    x: b.x,
    z: b.z,
    minY: y - 1.2,
    maxY: y + 6.5,
    halfX: b.w / 2 + 0.24,
    halfZ: b.d / 2 + 0.28,
    rotY: b.rot,
    blocksCamera: true,
    climbable: true,
    active: true,
  };
  saga.addProp(g, () => true, [col]);
}

function sign(saga: SagaSystem, id: string, x: number, z: number, rot: number, speaker: string, lines: string[], label = 'Read the sign'): void {
  const m = saga.host.mats;
  const y = getTerrainHeight(x, z);
  const g = new THREE.Group();
  const wood = m.getMat('#7a4e2a', { bump: 'wood', pattern: 'wood' });
  addVoxelBox(g, 0.14, 1.3, 0.14, wood, 0, 0.65, 0);
  addVoxelBox(g, 1.2, 0.7, 0.1, m.getMat('#a8784a', { bump: 'wood', pattern: 'wood' }), 0, 1.35, 0.04);
  addVoxelBox(g, 0.9, 0.06, 0.02, m.getMat('#3a2a1a'), 0, 1.45, 0.1, false);
  addVoxelBox(g, 0.7, 0.06, 0.02, m.getMat('#3a2a1a'), 0, 1.3, 0.1, false);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  saga.addProp(g);
  saga.addSpot({ id, x, z, radius: 2.0, label: () => label, shown: () => true, act: () => saga.host.say(lines.map((t) => L(speaker, t))) });
}

export function setupChapterOne(saga: SagaSystem): void {
  const F = saga.F;
  const host = saga.host;
  const m = host.mats;

  /* ---------------- buildings ---------------- */
  building(saga, 'hall', TOWN.hall, {
    roof: '#3a4a6a',
    wall: '#a8a8b0',
    extra: (g) => {
      const stone = m.getMat('#7a7a84', { bump: 'stone', pattern: 'stone' });
      const banner = m.getMat('#2f4a6a', { pattern: 'cloth' });
      const gold = m.getMat('#f0c65a', { metalness: 0.8, roughness: 0.3 });
      for (const sx of [-1, 1]) {
        addVoxelBox(g, 1.2, 6.2, 1.2, stone, sx * (TOWN.hall.w / 2 + 0.2), 3.1, TOWN.hall.d / 2);
        addVoxelBox(g, 1.5, 0.4, 1.5, stone, sx * (TOWN.hall.w / 2 + 0.2), 6.3, TOWN.hall.d / 2);
        addVoxelBox(g, 0.9, 2.2, 0.08, banner, sx * 1.8, 2.4, TOWN.hall.d / 2 + 0.08);
        addVoxelBox(g, 0.4, 0.4, 0.06, gold, sx * 1.8, 2.8, TOWN.hall.d / 2 + 0.14, false);
      }
      addVoxelBox(g, 1.0, 1.0, 0.1, gold, 0, 3.0, TOWN.hall.d / 2 + 0.1, false);
    },
  });
  building(saga, 'chapel', TOWN.chapel, {
    roof: '#7a3a5a',
    wall: '#f0ead8',
    extra: (g) => {
      const stone = m.getMat('#e0d8c4', { bump: 'stone', pattern: 'stone' });
      addVoxelBox(g, 2.2, 3.0, 2.2, stone, 0, 5.2, TOWN.chapel.d / 2 - 1.2);
      addVoxelBox(g, 2.6, 0.3, 2.6, m.getMat('#7a3a5a', { pattern: 'roof' }), 0, 6.85, TOWN.chapel.d / 2 - 1.2);
      addVoxelBox(g, 0.8, 0.9, 0.8, m.getMat('#c8ccd4', { metalness: 0.9, roughness: 0.2 }), 0, 5.4, TOWN.chapel.d / 2 - 1.2, false);
    },
  });
  building(saga, 'inn', TOWN.inn, {
    roof: '#9a5a2a',
    chimney: true,
    extra: (g) => {
      const wood = m.getMat('#5a3820', { bump: 'wood' });
      addVoxelBox(g, 0.12, 0.12, 1.2, wood, 1.6, 2.6, TOWN.inn.d / 2 + 0.6);
      addVoxelBox(g, 0.9, 0.7, 0.08, m.getMat('#b87a3a', { pattern: 'wood' }), 1.6, 2.1, TOWN.inn.d / 2 + 1.1);
      addVoxelBox(g, 0.4, 0.3, 0.12, m.getMat('#6a6e78', { metalness: 0.7 }), 1.6, 2.15, TOWN.inn.d / 2 + 1.16, false);
    },
  });

  /* ---------------- rooms ---------------- */
  for (const id of ['inn', 'cellar', 'chapel', 'hall', 'fenhouse']) saga.addRoom({ def: ROOMS[id] });

  const enterSpot = (id: string, b: { x: number; z: number; rot: number; d: number }, roomId: string, name: string, needs?: () => boolean, locked?: string) => {
    const d = doorOf(b, 0.45);
    saga.addSpot({
      id,
      x: d.x,
      z: d.z,
      radius: 0.95,
      auto: true,
      label: () => name,
      shown: () => true,
      act: () => {
        if (needs && !needs()) {
          if (locked) host.toast(locked, 2.6);
          return;
        }
        saga.enterRoom(roomId, 'D');
      },
    });
  };
  enterSpot('door_inn', TOWN.inn, 'inn', 'The Rusty Kettle');
  enterSpot('door_chapel', TOWN.chapel, 'chapel', 'Chapel of the Dawn');
  enterSpot('door_hall', TOWN.hall, 'hall', 'Hall of Wardens', () => Boolean(F.hall_open), 'The great doors are barred. Only the proven may enter.');
  enterSpot('door_fen', TOWN.fenHouse, 'fenhouse', "Fen and Nell's House", () => Boolean(F.bell_returned), 'Nobody answers. Someone inside is coughing.');

  const inn = saga.rooms.get('inn')!;
  const cellar = saga.rooms.get('cellar')!;
  const chapel = saga.rooms.get('chapel')!;
  const hall = saga.rooms.get('hall')!;
  const fenhouse = saga.rooms.get('fenhouse')!;

  /* ---------------- signs & lore ---------------- */
  sign(saga, 'sign_town', 12.5, 24.5, Math.PI / 2, 'Sign', ['BRACKENFORD. Market town of the river crossing. Founded long enough ago that nobody remembers when.']);
  sign(saga, 'sign_quarry', 37, 8, Math.PI, 'Sign', ['North-east: the Old Quarry. Mind the beetles.']);
  {
    const d = doorOf(TOWN.hall, 3.2);
    sign(saga, 'sign_hall', d.x + 0.5, d.z - 3.2, -Math.PI / 2, 'Notice', [
      'RECRUITS WANTED. The Hall of Wardens seeks the brave. Speak with Captain Venn outside the hall.',
      'Also: whoever keeps stealing pies from the Rusty Kettle, Marla knows it was you.',
    ], 'Read the notice');
  }
  saga.addSpot({
    id: 'gazette',
    ...inn.tile(12, 7),
    radius: 1.6,
    label: () => 'Read the Gazette',
    shown: () => true,
    act: () =>
      host.say([
        L('Gazette', 'THE GALLOWMARK GAZETTE, Spring 1903. His Majesty King Edric the Kind reports that Her Highness Princess Rosalind is well, and hard at work on her great project at Highcrown Castle.'),
        L('', 'Under the notice, someone has scratched three words: WHERE IS SHE?'),
      ]),
  });
  saga.addSpot({
    id: 'altar',
    ...chapel.tile(6, 2),
    radius: 1.5,
    label: () => 'Kneel at the altar',
    shown: () => true,
    act: () => {
      host.heal();
      host.sfx('heal');
      host.save();
      host.say([L('', 'You kneel at the altar. Your hearts are restored and your journey is saved.')]);
    },
  });

  /* ---------------- people ---------------- */
  const hallDoor = doorOf(TOWN.hall, 2.4);
  saga.addNpc({
    id: 'venn',
    name: 'Captain Venn',
    look: LOOKS.venn,
    x: hallDoor.x - 0.6,
    z: hallDoor.z + 2.2,
    yaw: -Math.PI / 2,
    shown: () => !F.boss_done,
    talk: () => {
      if (!F.quest)
        return {
          lines: [
            L('Captain Venn', 'A child with a practice blade, standing at the Hall of Wardens. Bold.'),
            L('Captain Venn', 'The Hall takes only the proven. Bring me three tokens: courage, craft and kindness.'),
            L('Captain Venn', 'Marla at the Rusty Kettle, Odo the smith and Brother Aldous at the chapel can each vouch for you, if you earn it.'),
            L('Pip', "Courage, craft and kindness. Let's ask around town, Wren."),
          ],
          after: () => {
            F.quest = true;
            host.toast('New goal: earn three tokens. Check your Quest Journal any time.', 3.2);
            host.save();
          },
        };
      if (F.courage && F.craft && F.kindness) {
        if (F.hall_open) return [L('Captain Venn', "The doors are open. Go in when you're ready.")];
        return {
          lines: [L('Captain Venn', 'Courage, craft and kindness. All three, and in so few days.'), L('Captain Venn', 'Then the trial awaits. The doors are open to you.')],
          after: () => {
            F.hall_open = true;
            host.sfx('gate');
            host.save();
          },
        };
      }
      const have = [F.courage && 'courage', F.craft && 'craft', F.kindness && 'kindness'].filter(Boolean);
      return [L('Captain Venn', have.length ? `You carry the token of ${have.join(' and ')}. Come back with all three.` : 'No tokens yet? Marla, Odo and Brother Aldous. Go.')];
    },
  });

  saga.addNpc({
    id: 'marla',
    name: 'Marla',
    look: LOOKS.marla,
    ...inn.tile(2, 4),
    yaw: 0,
    shown: () => true,
    talk: () => {
      if (!F.quest) return [L('Marla', "Welcome to the Rusty Kettle! Sit anywhere that isn't sticky."), L('Marla', "Just don't go near the cellar. The rats down there are the size of dogs.")];
      if (F.courage) return [L('Marla', 'My hero! Your next pie is on the house. Just the one, mind.')];
      if (F.rats_clear)
        return {
          lines: [L('Marla', 'You cleared them out? Even the big one with the crown?'), L('Marla', "That's real courage. Here, take this. Captain Venn will know what it means.")],
          after: () => {
            F.courage = true;
            saga.gotItem('Token of Courage');
          },
        };
      if (F.cellar_open) return [L('Marla', 'The cellar stairs are in the back corner. Do be careful, love.')];
      return {
        lines: [L('Marla', 'A token of courage for Captain Venn? Hmm.'), L('Marla', "Clear the giant rats out of my cellar, and I'll vouch for you myself. Stairs are in the back corner.")],
        after: () => {
          F.cellar_open = true;
          host.toast('The cellar is unlocked', 2);
          host.save();
        },
      };
    },
  });
  saga.addNpc({
    id: 'patron',
    name: 'Patron',
    look: LOOKS.patron,
    ...inn.tile(9, 6),
    yaw: Math.PI,
    shown: () => true,
    talk: () =>
      F.mw_done
        ? [L('Patron', "Morrow's soldiers drink twice as much since you came back from the fen. Nervous lot.")]
        : [L('Patron', "The envoy's men drink here every night. They ask a lot of questions about old bells."), L('Patron', 'Odd thing to care about, if you ask me.')],
  });

  saga.addNpc({
    id: 'odo',
    name: 'Odo the Smith',
    look: LOOKS.odo,
    x: 31.4,
    z: 25.4,
    yaw: -2.1,
    shown: () => true,
    talk: () => {
      if (F.craft) return saga.legacy('blacksmith');
      if (!F.quest) return [L('Odo the Smith', 'Hmph. Need something forged? Then bring me iron, not small talk.')];
      if (!F.odo_asked)
        return {
          lines: [L('Odo the Smith', "A token of craft? You don't earn craft by asking for it."), L('Odo the Smith', 'Bring me three lumps of iron ore from the Old Quarry, up in Emberstone Canyon north-east of town. Then we\'ll see.')],
          after: () => {
            F.odo_asked = true;
            host.save();
          },
        };
      const ore = (F.ore as number) || 0;
      if (ore < 3) return [L('Odo the Smith', `That's ${ore} lump${ore === 1 ? '' : 's'}. I said three.`)];
      return {
        lines: [
          L('Odo the Smith', 'Good iron. Now stand back.'),
          L('', 'CLANG. CLANG. CLANG.'),
          L('Odo the Smith', 'There. An iron sword, made for your arm. It bites deeper than that practice blade.'),
          L('Odo the Smith', "And a token of craft. You fetched good ore without whining. That's craft enough."),
        ],
        after: () => {
          F.craft = true;
          F.sword = 2;
          F.ore = ore - 3;
          host.shake(0.4);
          saga.gotItem('Iron Sword and Token of Craft');
        },
      };
    },
  });

  saga.addNpc({
    id: 'aldous',
    name: 'Brother Aldous',
    look: LOOKS.aldous,
    ...chapel.tile(6, 3),
    yaw: Math.PI,
    shown: () => true,
    talk: () => {
      const legend = [
        L('Brother Aldous', 'Long ago the Dawnbell rang over Gallowmark, and its song kept the door between worlds shut.'),
        L('Brother Aldous', 'Then it shattered. Its shards were scattered across the land, and the door has been creaking ever since.'),
        L('Brother Aldous', "The Crown says the old song is only a fairy tale. Odd, then, how many of the King's men ask me about it."),
        L('Pip', 'Wren... the falling star we chased. Could it have been one of those shards?'),
      ];
      const shrineLore = [
        L('Brother Aldous', 'The first Wardens built three Bell Shrines across the valley, to hold the Dawnbell\'s song while it was whole: Wind, Embers and Stillness.'),
        L('Brother Aldous', 'They have slept since the bell broke. Wake them, if you can. Every note we save is one the King cannot steal.'),
      ];
      if (F.kindness) return saga.withShrineLore([L('Brother Aldous', 'The bell rings sweeter for its journey. Thank you, Wren.')], shrineLore);
      if (F.bell)
        return {
          lines: [
            L('Brother Aldous', 'Our silver bell! And the youth who took it?'),
            L('', 'You tell him about Fen and the sick sister.'),
            L('Brother Aldous', 'Then the chapel will send medicine. Kindness answered with kindness.'),
            L('Brother Aldous', 'Take this token. Captain Venn will understand.'),
          ],
          after: () => {
            F.bell = false;
            F.bell_returned = true;
            F.kindness = true;
            saga.gotItem('Token of Kindness');
          },
        };
      if (!F.quest) return saga.withShrineLore(legend.concat([L('Brother Aldous', 'Kneel at the altar whenever you need rest. The Dawn keeps watch.')]), shrineLore);
      if (!F.bell_quest)
        return {
          lines: [
            L('Brother Aldous', 'A token of kindness? Then perhaps you can help an old man.'),
            L('Brother Aldous', 'Our silver bell was stolen from the altar. A quick-fingered youth in purple was seen running toward the Old Quarry.'),
            L('Brother Aldous', "Please don't hurt them. Just bring the bell home."),
          ],
          after: () => {
            F.bell_quest = true;
            host.save();
          },
        };
      return [L('Brother Aldous', 'The quarry is up in Emberstone Canyon, north-east of town. I pray the youth is unharmed.')];
    },
  });

  // Tilda's stall (the market stall by the well)
  saga.addNpc({
    id: 'tilda',
    name: 'Tilda',
    look: LOOKS.tilda,
    x: 30.3,
    z: 19.3,
    yaw: -0.45 + Math.PI,
    shown: () => true,
    talk: () => ({
      lines: [L('Tilda', 'Fresh goods for brave folk! Pies to mend you, and something rarer for the well-off.')],
      after: () => saga.openShop(),
    }),
  });
  saga.addNpc({
    id: 'bram',
    name: 'Bram',
    look: LOOKS.bram,
    x: 23.2,
    z: 19.6,
    yaw: 0.6,
    shown: () => true,
    talk: () =>
      F.ch3
        ? [L('Bram', "The south road's open again? Bring me back some fen turnips. They're purple and they scream a bit.")]
        : [L('Bram', 'Apples, pears, turnips! No? Suit yourself.'), L('Bram', "Did you hear? A royal envoy rode in last week. Chancellor Morrow. Hasn't smiled once.")],
  });
  saga.addNpc({
    id: 'hilde',
    name: 'Hilde',
    look: LOOKS.hilde,
    x: 22.4,
    z: 25.2,
    yaw: 2.4,
    shown: () => true,
    talk: () => {
      if (F.ch3 && !F.lily_done) return [L('Hilde', "Poor little Nell, Fen's sister. Her fever came back. They live in the house by the south road.")];
      return F.quest ? [L('Hilde', "Marla's been shrieking about rats in her cellar all week. Poor woman.")] : [L('Hilde', 'The Hall of Wardens is out past the sheep fields to the east. Captain Venn tests anyone brave enough to ask.')];
    },
  });
  saga.addNpc({
    id: 'tomas',
    name: 'Tomas',
    look: LOOKS.tomas,
    x: 28.5,
    z: 27,
    yaw: 0.3,
    shown: () => true,
    talk: () =>
      F.craft
        ? [L('Tomas', "Is that Odo's iron on your belt? You must have impressed the old grump.")]
        : [L('Tomas', "Odo the smith is gruff, but there's no better blade in all of Gallowmark.")],
  });
  saga.addNpc({
    id: 'guard',
    name: 'Town Guard',
    look: LOOKS.guard,
    x: 36.2,
    z: 18.8,
    yaw: -Math.PI / 2,
    shown: () => true,
    talk: () => {
      F.met_guard = true;
      if (F.quest) return [L('Town Guard', 'Captain Venn vouched for you. Behave yourself.')];
      return [L('Town Guard', 'Brackenford is on its best behaviour while the royal envoy is visiting.'), L('Town Guard', 'Keep your blade sheathed in town, and stay out of the envoy\'s way.')];
    },
  });

  // Fen: first met in town, then at the quarry with the stolen bell, then at home
  saga.addNpc({
    id: 'fen_town',
    name: 'Fen',
    look: LOOKS.fen,
    x: 15.6,
    z: 26.5,
    yaw: Math.PI / 2,
    shown: () => !F.met_fen,
    talk: () => ({
      lines: [
        L('Fen', 'Psst. Over here. New in town?'),
        L('Fen', "Word of advice, stranger. The envoy's men are watching everyone. Keep your head down and your purse closer."),
        L('Fen', "Don't thank me. You owe me one."),
      ],
      after: () => {
        F.met_fen = true;
        host.particles(15.6, getTerrainHeight(15.6, 26.5) + 1, 26.5, 0x9c72bd, 12);
        host.toast('Fen darts off between the houses.', 2.4);
        host.save();
      },
    }),
  });
  saga.addNpc({
    id: 'fen_quarry',
    name: 'Fen',
    look: LOOKS.fen,
    x: 38.5,
    z: -7,
    yaw: 1.2,
    shown: () => Boolean(F.bell_quest && !F.bell && !F.bell_returned),
    talk: () => ({
      lines: [
        L('Fen', F.met_fen ? 'You again? Come to drag me back to the guards?' : 'Who are you? Come to drag me back to the guards?'),
        L('Fen', "Fine. I took the bell. The envoy's men pay good coin for silver, and my sister's sick."),
        L('Fen', "They don't even want the silver. They crack every bell open and look inside, like they're hunting for something."),
        L('Pip', 'Wren, maybe we can help instead of fighting.'),
      ],
      after: () => {
        const done = (lines: ReturnType<typeof L>[]) =>
          host.say(lines, () => {
            F.bell = true;
            F.met_fen = true;
            host.particles(38.5, getTerrainHeight(38.5, -7) + 1, -7, 0x9c72bd, 14);
            saga.gotItem('Silver Bell');
          });
        const marks = host.inv().marks;
        host.choose('Fen', "Fen clutches the silver bell and won't meet your eyes. What will you do?", [
          {
            label: `Give Fen 15 marks for medicine${marks < 15 ? ' (not enough marks)' : ''}`,
            disabled: marks < 15,
            pick: () => {
              host.inv().marks -= 15;
              host.sfx('coin');
              done([
                L('Fen', "You'd really... thank you. Here. Take the bell back to the old man."),
                L('Fen', "And Wren? Watch the envoy's men. They're hunting for something, and it isn't silver."),
              ]);
            },
          },
          {
            label: 'Promise to ask the chapel for help',
            pick: () => done([L('Fen', "The chapel? They'd help someone like me?"), L('Fen', "...Fine. Take it. But if you're lying, I'm stealing it right back.")]),
          },
        ]);
      },
    }),
  });
  saga.addNpc({
    id: 'fen_home',
    name: 'Fen',
    look: LOOKS.fen,
    ...fenhouse.tile(4, 3),
    yaw: 0,
    shown: () => Boolean(F.bell_returned),
    talk: () => saga.talkFenHome(),
  });
  saga.addNpc({
    id: 'nell',
    name: 'Nell',
    look: LOOKS.nell,
    ...fenhouse.tile(2, 2),
    yaw: 0,
    shown: () => true,
    talk: () => saga.talkNell(),
  });

  /* ---------------- the Old Quarry: iron ore ---------------- */
  const oreSpots: Array<[number, number]> = [
    [37.5, -2.5],
    [55, -4.5],
    [42, -19],
  ];
  oreSpots.forEach(([x, z], i) => {
    const y = getTerrainHeight(x, z);
    const g = new THREE.Group();
    addVoxelBox(g, 1.6, 1.1, 1.4, m.getMat('#6a6468', { bump: 'stone', pattern: 'stone' }), 0, 0.5, 0);
    addVoxelBox(g, 1.1, 0.6, 1.0, m.getMat('#7a7478', { bump: 'stone' }), 0.2, 1.2, -0.1);
    addVoxelBox(g, 0.4, 0.3, 0.35, m.getMat('#c8642a', { metalness: 0.5, roughness: 0.4 }), 0.5, 0.9, 0.55, false);
    addVoxelBox(g, 0.3, 0.25, 0.3, m.getMat('#d87a3a', { metalness: 0.5, roughness: 0.4 }), -0.4, 1.3, 0.3, false);
    g.position.set(x, y - 0.1, z);
    g.rotation.y = i * 1.7;
    const key = `ore_${i}`;
    saga.addProp(g, () => !F[key]);
    saga.addSpot({
      id: key,
      x,
      z,
      radius: 2.2,
      label: () => 'Strike the iron ore',
      shown: () => Boolean(F.odo_asked && !F.craft && !F[key]),
      act: () => {
        F[key] = true;
        F.ore = ((F.ore as number) || 0) + 1;
        host.particles(x, y + 1, z, 0xd87a3a, 16, 5);
        host.shake(0.25);
        host.sfx('item');
        host.toast(`Iron ore (${F.ore}/3)`, 2);
        host.save();
      },
    });
  });

  /* ---------------- the cellar rats (Token of Courage) ---------------- */
  saga.onEnterRoom('cellar', () => {
    if (F.rats_clear) return;
    host.removeEnemies('cellar');
    const spots: Array<[number, number]> = [
      [4, 3],
      [9, 2],
      [3, 6],
      [10, 6],
      [7, 7],
    ];
    for (const [c, r] of spots) {
      const t = cellar.tile(c, r);
      host.spawnEnemy({ kind: 'slime', variant: 'rat', x: t.x, z: t.z, name: 'Cellar Rat', hp: 26, tag: 'cellar' });
    }
    const k = cellar.tile(9, 4);
    host.spawnEnemy({ kind: 'slime', variant: 'ratking', x: k.x, z: k.z, name: 'Rat King', hp: 70, tag: 'cellar', scale: 1.5 });
    if (!F.cellar_seen) {
      F.cellar_seen = true;
      host.say([L('Pip', 'Ugh, it smells like old cheese down here.'), L('Pip', 'Those rats are huge. And is that one wearing a crown?')]);
    }
  });
  saga.onKill((e) => {
    if (e.tag === 'cellar' && !F.rats_clear && !saga.anyTagged('cellar')) {
      F.rats_clear = true;
      host.save();
      host.say([L('Pip', "That's the last of them, crown and all!"), L('Pip', "Let's go tell Marla.")]);
    }
  });

  /* ---------------- the Hall: the Warden's Trial ---------------- */
  saga.addNpc({
    id: 'venn_hall',
    name: 'Captain Venn',
    look: LOOKS.venn,
    ...hall.tile(7, 9),
    yaw: Math.PI,
    shown: () => Boolean(F.hall_open),
    talk: () => saga.talkVennHall(),
  });
  saga.addNpc({
    id: 'morrow_hall',
    name: 'Chancellor Morrow',
    look: LOOKS.morrow,
    ...hall.tile(8, 2),
    yaw: 0,
    shown: () => F.morrow_scene === 1,
    talk: () => [L('Chancellor Morrow', 'Run along, little Warden.')],
  });
  saga.onEnterRoom('hall', () => {
    if (F.boss_done || saga.anyTagged('trial')) return;
    host.say([L('Captain Venn', "Show me what you've learned."), L('Pip', 'Here it comes!')], () => {
      const t = hall.tile(8, 4);
      host.spawnEnemy({ kind: 'sentinel', x: t.x, z: t.z, name: 'Iron Sentinel', hp: 170, tag: 'trial' });
      host.sfx('boss');
    });
  });
  saga.onKill((e) => {
    if (e.tag !== 'trial' || F.boss_done) return;
    F.boss_done = true;
    F.shard1 = true;
    F.morrow_scene = 1;
    host.save();
    window.setTimeout(() => {
      host.sfx('win');
      host.say(
        [
          L('Pip', 'Wren! It was glowing inside the Sentinel. Is that a shard of the Dawnbell?'),
          L('', 'You got a Dawnbell Shard. It hums softly, warm in your hand.'),
          L('Captain Venn', 'Well fought. By the old oaths, you are a Warden of Brackenford.'),
          L('Chancellor Morrow', 'What a remarkable child. Do take good care of that shard.'),
          L('Chancellor Morrow', "I'll be needing it. His Majesty sends his warmest regards."),
          L('Pip', "Wren, look at the Sentinel's back plate. It has a maker's mark: a crown. The castle built that thing."),
          L('Pip', "Who was THAT? Wren, I don't like him one bit."),
        ],
        () => {
          const t = hall.tile(8, 2);
          host.particles(t.x, 1.2, t.z, 0x8a6ac8, 24, 6);
          F.morrow_scene = 2;
          host.toast('Chapter One complete: The Warden\'s Trial. Talk to Captain Venn.', 5);
          host.inv().maxHp += 2;
          host.heal();
          host.save();
        }
      );
    }, 900);
  });
}
