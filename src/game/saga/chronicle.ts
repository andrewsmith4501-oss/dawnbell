// The Dawnbell Chronicle: objectives, journal, Captain Venn's chapter briefings,
// the Fen family, the opening scene and test skips. Spans every chapter.
import { L, type JournalEntry, type SagaSystem } from './saga';

export const CHAPTER_NAMES = ["The Warden's Trial", 'The Hollow Deep', 'The Gloaming Fen', 'Saltmarrow Coast'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export function sagaChapter(F: SagaSystem['F']): number {
  if (F.shard4) return 5;
  if (F.ch4) return 4;
  if (F.ch3) return 3;
  if (F.ch2) return 2;
  return 1;
}

export function setupChronicle(saga: SagaSystem): void {
  const F = saga.F;
  const host = saga.host;

  saga.chapterFn = () => {
    const c = Math.min(4, sagaChapter(saga.F));
    return { roman: ROMAN[c - 1], title: sagaChapter(saga.F) === 5 ? 'To Be Continued' : CHAPTER_NAMES[c - 1] };
  };

  saga.objectiveFn = () => {
    const F = saga.F;
    if (!F.met_town && !F.quest && !F.ch2) return 'Follow the road east out of Whisperwood to the town of Brackenford';
    if (!F.quest) return 'Speak with Captain Venn outside the Hall of Wardens (east of town)';
    if (!F.boss_done) {
      if (F.courage && F.craft && F.kindness) return F.hall_open ? 'Enter the Hall of Wardens and face the trial' : 'Bring all three tokens to Captain Venn';
      const todo: string[] = [];
      if (!F.courage) todo.push(F.rats_clear ? 'tell Marla the cellar is clear' : F.cellar_open ? "clear the rats from Marla's cellar" : 'ask Marla at the Rusty Kettle');
      if (!F.craft) todo.push(!F.odo_asked ? 'ask Odo the smith' : ((F.ore as number) || 0) >= 3 ? 'bring the ore to Odo' : `mine iron ore at the Old Quarry (${(F.ore as number) || 0}/3)`);
      if (!F.kindness) todo.push(F.bell ? 'return the bell to Brother Aldous' : F.bell_quest ? 'find the bell thief at the Old Quarry' : 'ask Brother Aldous at the chapel');
      return `Earn three tokens: ${todo.join('; ')}`;
    }
    if (!F.ch2) return 'Talk to Captain Venn in the Hall of Wardens';
    if (!F.hd_done) return 'Find the broken Warden seal in the Old Quarry and explore the Hollow Deep';
    if (!F.ch3) return 'Report to Captain Venn in the Hall of Wardens';
    if (!F.mw_done) return 'Cross the Gloaming Fen (far south-west) and climb Mirewatch Tower';
    if (!F.ch4) return 'Report to Captain Venn in the Hall of Wardens';
    if (!F.shard4) return 'Follow the coast road to Port Gullhaven and find out what is in the royal crates';
    return 'Tell Captain Venn about the ship with no lamps';
  };

  saga.journalFn = () => {
    const F = saga.F;
    const cur = sagaChapter(F);
    const ch = (n: number, title: string, text: string, goals: Array<[string, boolean]>): JournalEntry => {
      const done = cur > n;
      const active = cur === n;
      return {
        title: `Chapter ${ROMAN[n - 1]} · ${title}`,
        meta: active ? 'In progress' : done ? 'Complete' : 'Upcoming',
        text,
        status: done ? 'done' : active ? 'active' : 'dim',
        badge: done ? 'Complete' : active ? 'Active' : 'Upcoming',
        goals: active || done ? goals.map(([label, met]) => ({ label, met: met || done })) : undefined,
      };
    };
    const main: JournalEntry[] = [
      ch(1, "The Warden's Trial", 'Wren and Pip fell through a forest pool chasing a falling star, and woke in the realm of Gallowmark. In the market town of Brackenford, Captain Venn keeps the last Hall of Wardens open in secret.', [
        ['Meet Captain Venn at the Hall of Wardens', Boolean(F.quest)],
        ['Token of Courage (Marla, the Rusty Kettle)', Boolean(F.courage)],
        ['Token of Craft (Odo the smith)', Boolean(F.craft)],
        ['Token of Kindness (Brother Aldous, the chapel)', Boolean(F.kindness)],
        ["Pass the Warden's Trial", Boolean(F.boss_done)],
      ]),
      ch(2, 'The Hollow Deep', "Chancellor Morrow's men smashed the old Warden seal in the Old Quarry. Beneath it lies a vault the first Wardens dug to hide something.", [
        ['Enter the Hollow Deep', Boolean(F.hd_seen)],
        ['Find the Grapple Claw', Boolean(F.hook)],
        ['Defeat the guardian and claim the second shard', Boolean(F.hd_done)],
      ]),
      ch(3, 'The Gloaming Fen', 'The shards sing toward the south-west, where the old Warden watchtower Mirewatch sank into the bog the night the Dawnbell shattered.', [
        ['Meet Old Wick in the Fen', Boolean(F.wick_met)],
        ['Claim the Ember Lantern', Boolean(F.lantern)],
        ['Free the guardian of Mirewatch and claim the third shard', Boolean(F.mw_done)],
      ]),
      ch(4, 'Saltmarrow Coast', 'Every week, wagons with the royal seal carry old bells to Port Gullhaven. The Gullrock Light has gone dark, and its keeper has "retired".', [
        ['Reach Port Gullhaven', Boolean(F.coast_seen)],
        ['Find the keeper of the Gullrock Light', Boolean(F.hobb_free)],
        ['Relight the lamp and claim the fourth shard', Boolean(F.shard4)],
      ]),
    ];
    const side: JournalEntry[] = [];
    const sq = (title: string, meta: string, text: string, started: boolean, done: boolean, progress?: string): void => {
      if (!started && !done) return;
      side.push({ title, meta, text, status: done ? 'done' : 'active', badge: done ? 'Complete' : progress ?? 'Active' });
    };
    sq("Nell's Fever", 'Fen · Brackenford', 'Only a Moonlily from the Gloaming Fen can break Nell\'s fever for good.', Boolean(F.lily_q), Boolean(F.lily_done));
    sq("Old Wick's Glowcaps", 'Old Wick · Gloaming Fen', 'Bring five glowcaps for the old Warden\'s lamp.', Boolean(F.wick_q), Boolean(F.wick_done), `${(F.caps as number) || 0}/5`);
    sq("Coralie's Sea Glass", 'Coralie · Port Gullhaven', 'Find five pieces of sea glass along the beach.', Boolean(F.glass_q), Boolean(F.glass_done), `${(F.glass as number) || 0}/5`);
    return { main, side };
  };

  /* ---------------- Captain Venn, after the trial ---------------- */
  saga.talkVennHall = () => {
    const F = saga.F;
    if (!F.boss_done) return [L('Captain Venn', "Show me what you've learned.")];
    if (!F.ch2)
      return {
        lines: [
          L('Captain Venn', "You've earned a rest, Warden. I'm sorry to say you won't get one."),
          L('Captain Venn', "Last night Morrow's men smashed the old Warden seal at the north end of the Old Quarry. Beneath it lies the Hollow Deep."),
          L('Captain Venn', "The first Wardens dug that vault to hide something. If it's another shard, Morrow must not have it."),
          L('Captain Venn', 'Something old still guards the place. His men ran out of there screaming. Be careful.'),
          L('Pip', "The Old Quarry is up in Emberstone Canyon. Let's go, Wren!"),
        ],
        after: () => {
          F.ch2 = true;
          F.morrow_scene = 2;
          host.toast('New goal: explore the Hollow Deep beneath the Old Quarry', 3.2);
          host.save();
        },
      };
    if (!F.hd_done) return [L('Captain Venn', 'The broken seal is at the north end of the Old Quarry. Find what lies below before Morrow does.')];
    if (!F.ch3)
      return {
        lines: [
          L('Captain Venn', "Two shards, and the Grapple Claw of the first Wardens. Gallowmark hasn't seen your like in an age."),
          L('Captain Venn', 'Brother Aldous has been listening to the shards. He says their song points south-west, to the Gloaming Fen.'),
          L('Captain Venn', "An old Warden watchtower, Mirewatch, sank into that bog the night the Dawnbell shattered. And Morrow's carriage took the fen road at dawn."),
          L('Captain Venn', 'One more thing. Every Warden learns the Whirl. Hold your blade, let the strength gather, then let it fly. No shield can stop it.'),
          L('Pip', "Let's go, Wren!"),
        ],
        after: () => {
          F.ch3 = true;
          host.toast('New goal: find Mirewatch Tower in the Gloaming Fen', 3.4);
          host.save();
        },
      };
    if (!F.mw_done) return [L('Captain Venn', "Mirewatch lies somewhere in the Gloaming Fen. And Wren? Watch Morrow's soldiers.")];
    if (!F.ch4)
      return {
        lines: [
          L('Captain Venn', "Three shards... and Morrow sending you to fetch them like a hunting dog. He's playing a long game."),
          L('Captain Venn', "I'll tell you something I've told no one. The King closed every Hall of Wardens twenty years ago. I kept this one open in secret."),
          L('Captain Venn', "Corwin, Wick, your friend Fen's mother... everyone who looks too closely at the castle seems to disappear."),
          L('Captain Venn', 'Brother Aldous says the shards sing toward the sea now. To the Saltmarrow Coast.'),
          L('Captain Venn', 'And every week, wagons with the royal seal roll out to Port Gullhaven, loaded with old bells. Go and see what they\'re shipping.'),
          L('Pip', "The sea! I've never seen the sea. ...Well, not this one."),
        ],
        after: () => {
          F.ch4 = true;
          host.toast('New goal: take the coast road to Port Gullhaven', 3.4);
          host.save();
        },
      };
    if (!F.shard4) return [L('Captain Venn', 'Port Gullhaven lies at the end of the coast road. Keep your head down around the royal crates.')];
    const first = !F.ch4_venn;
    F.ch4_venn = true;
    host.save();
    return [
      L('Captain Venn', "Four shards. And a girl in a silver circlet carried onto the King's own ship, the night the green star fell."),
      L('Captain Venn', 'Princess Rosalind had black hair. Everyone in Gallowmark knows that. So who is up in that castle?'),
      L('Captain Venn', "There's a rumor in Thornmoor of someone who relights the lamps the soldiers put out. When the road opens, we should find them."),
    ].concat(first ? [L('Pip', "Wren... I think we already know who it is. We just don't want to say it yet.")] : []);
  };

  /* ---------------- Fen and Nell ---------------- */
  saga.talkFenHome = () => {
    const F = saga.F;
    if (F.lily_done) return [L('Fen', "Nell's up and bossing me around again. Best thing I've ever heard."), L('Fen', "I owe you twice now, Wren. I won't forget it.")];
    if (F.lily) return [L('Fen', 'Is that... a Moonlily? Give it to Nell, quick!')];
    if (!F.ch3) return [L('Fen', "The chapel's medicine is helping. Nell can sit up now."), L('Fen', "I'm not used to people being decent to me. Don't make it weird.")];
    if (!F.lily_q)
      return {
        lines: [
          L('Fen', "Wren. Good. Nell's fever came back, worse than before."),
          L('Fen', "The chapel's medicine helped, but Brother Aldous says only a Moonlily can break it for good."),
          L('Fen', "They grow on an islet in the Gloaming Fen. I can't get across the water."),
          L('Pip', "We're heading that way anyway. We'll find one, Fen!"),
        ],
        after: () => {
          F.lily_q = true;
          host.toast('Side quest: bring a Moonlily for Nell', 3);
          host.save();
        },
      };
    return [L('Fen', 'Old Wick in the fen knows every plant out there. Ask him where the Moonlilies grow.')];
  };
  saga.talkNell = () => {
    const F = saga.F;
    if (F.lily && !F.lily_done)
      return {
        lines: [
          L('Nell', 'A Moonlily! It smells like rain.'),
          L('', 'Nell breathes in the glowing petals. The color comes back to her cheeks.'),
          L('Nell', 'I feel... better! Fen, I feel better!'),
          L('Fen', 'Wren, take this. Mum sewed it before she left. And these marks, for the trouble.'),
        ],
        after: () => {
          F.lily = false;
          F.lily_done = true;
          host.inv().marks += 30;
          host.inv().meals += 3;
          saga.gotItem("Mum's Travel Pack (3 meat pies) and 30 marks");
        },
      };
    if (F.lily_done) return [L('Nell', "When I'm bigger, I'm going to be a Warden too. Fen says I'm too bossy. Wardens should be bossy.")];
    return [
      L('Nell', '*cough* Hello... are you the one who brought back the chapel bell? Fen talks about you all the time.'),
      L('Nell', 'Mum went to work at the castle when I was little. A special job for the princess, the letter said. She never wrote back.'),
      L('Nell', 'The fever started when the soldiers began digging by the south road. Fen says that\'s silly.'),
    ];
  };

  /* ---------------- arriving in town ---------------- */
  saga.onUpdate(() => {
    if (F.met_town) return;
    const p = host.player();
    if (Math.hypot(p.x - 26, p.z - 22) < 16) {
      F.met_town = true;
      host.say([L('Pip', 'Chimney smoke! That must be Brackenford.'), L('Pip', 'Those guards look grumpy, though. And look at all the royal banners...')]);
      host.save();
    }
  });
}

export const OPENING = [
  L('Pip', 'Wren! Wren, wake up!'),
  L('Pip', 'We fell through the forest pool chasing that falling star. This is nowhere near Hollowmere.'),
  L('Pip', 'You were talking in your sleep. Something about a garden, and a girl humming a song.'),
  L('Pip', 'Look at that great tower with the silent bell. And the woods are crawling with slimes. Good thing you brought your practice blade.'),
  L('Pip', "There's chimney smoke to the east. Let's find a town and ask where on earth we are. I'll stay close."),
];

/** Test skips: put the save at the start of a chapter. */
export function applySkip(F: SagaSystem['F'], ch: number): void {
  const set = (keys: string[]) => keys.forEach((k) => (F[k] = true));
  if (ch >= 2) set(['met_town', 'met_fen', 'met_guard', 'quest', 'courage', 'craft', 'kindness', 'cellar_open', 'rats_clear', 'odo_asked', 'bell_quest', 'bell_returned', 'hall_open', 'boss_done', 'shard1', 'ch2', 'shrine_lore']);
  if (ch >= 2) {
    F.sword = 2;
    F.morrow_scene = 2;
  }
  if (ch >= 3) set(['hd_seen', 'hook', 'hd_done', 'shard2', 'ch3']);
  if (ch >= 4) set(['wick_met', 'lantern', 'mw_done', 'shard3', 'ch4']);
}
