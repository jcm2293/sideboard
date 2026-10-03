// One-line clauses for core and commonly used features (sheet spec v3 §4): the
// `summary` a feature shows in "Your turn" and on its Features-page heading.
// A short here wins over the clause seeded from the export's text. Shorts that
// carry numbers take the class level and ability modifiers, so Rage reads
// "+2 to Str damage" at level 5 and "+3" at level 9. Paraphrased, not quoted.

import { dice, featureKey, steps, type AbilityMods } from './class-reference';

export interface ShortContext {
  /** Class level for class features; total level for species traits and feats. */
  level: number;
  mods: AbilityMods;
  pb: number;
}

export type Short = string | ((ctx: ShortContext) => string);

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const rageDamage = steps([1, 2], [9, 3], [16, 4]);
const martialArtsDie = dice([1, '1d6'], [5, '1d8'], [11, '1d10'], [17, '1d12']);
const unarmoredMovement = steps([2, 10], [6, 15], [10, 20], [14, 25], [18, 30]);
const bardicDie = dice([1, 'd6'], [5, 'd8'], [10, 'd10'], [15, 'd12']);
const cantripDice = steps([1, 1], [5, 2], [11, 3], [17, 4]);

const CLASS_SHORTS: Record<string, Record<string, Short>> = {
  barbarian: {
    Rage: ({ level }) =>
      `resistance to bludgeoning, piercing, slashing · +${rageDamage(level)} to Str damage · advantage on Str checks and saves`,
    'Unarmored Defense': ({ mods }) => `AC 10 + Dex + Con (${10 + mods.dex + mods.con}) without armor; a shield still counts`,
    'Weapon Mastery': ({ level }) => `use the mastery property of ${steps([1, 2], [4, 3], [10, 4])(level)} chosen kinds of weapon`,
    'Danger Sense': 'advantage on Dex saves unless Incapacitated',
    'Reckless Attack': 'advantage on Str attacks this turn; attacks against you have advantage until your next turn',
    'Primal Knowledge': 'one more skill; while raging, some Dex, Wis, and Cha checks can use Str instead',
    'Fast Movement': '+10 ft speed while not in Heavy armor',
    'Feral Instinct': 'advantage on Initiative rolls',
    'Instinctive Pounce': 'move up to half your speed as part of the Bonus Action that starts a Rage',
    'Brutal Strike': ({ level }) =>
      `trade a Reckless advantage for +${level >= 17 ? '2d10' : '1d10'} damage and a Brutal Strike effect on a hit`,
    'Relentless Rage': ({ level }) => `drop to 0 while raging: Con save (DC 10, +5 per use) to go to ${2 * level} HP instead`,
    'Improved Brutal Strike': 'Staggering Blow and Sundering Blow join your Brutal Strike effects',
    'Persistent Rage': 'regain all Rage uses on Initiative once per long rest; Rage lasts 10 minutes',
    'Indomitable Might': 'a Str check or save below your Strength score uses the score instead',
    'Primal Champion': 'Strength and Constitution +4, to a maximum of 25',
    // Path of the Storm Herald (XGtE)
    'Storm Aura': '10 ft aura while raging; activate it as you rage and as a Bonus Action each turn',
    Desert: ({ level }) => `each other creature in your aura takes ${steps([3, 2], [5, 3], [10, 4], [15, 5], [20, 6])(level)} fire damage`,
    Sea: ({ level, mods, pb }) =>
      `one creature in your aura takes ${steps([3, 1], [10, 2], [15, 3], [20, 4])(level)}d6 lightning; Dex save DC ${8 + pb + mods.con} for half`,
    Tundra: ({ level }) => `each creature of your choice in your aura gains ${steps([3, 2], [5, 3], [10, 4], [15, 5], [20, 6])(level)} temp HP`,
  },

  bard: {
    'Bardic Inspiration': ({ level }) => `give a creature within 60 ft a ${bardicDie(level)} to add to a failed D20 Test`,
    'Jack of All Trades': 'add half your proficiency bonus to ability checks you lack proficiency in',
    'Font of Inspiration': 'Bardic Inspiration returns on a short rest; spend a slot to regain one use',
    Countercharm: 'you or a creature within 30 ft rerolls a failed save against Charmed or Frightened',
    'Magical Secrets': 'prepare spells from the Cleric, Druid, and Wizard lists as well as the Bard list',
    'Superior Inspiration': 'regain Bardic Inspiration up to two uses when you roll Initiative',
    'Words of Creation': 'Power Word Heal and Power Word Kill always prepared; each can target a second creature',
    // College of Glamour
    'Beguiling Magic': 'after an Enchantment or Illusion slot spell, charm or frighten a creature within 60 ft (Wis save)',
    'Mantle of Inspiration': 'spend Bardic Inspiration: allies within 60 ft gain temp HP and can move without provoking',
    'Mantle of Majesty': 'Command without a slot as a Bonus Action each turn for 1 minute',
    'Unbreakable Majesty': 'attackers must succeed on a Cha save or pick a new target',
  },

  cleric: {
    'Divine Order': 'Protector (martial weapons, Heavy armor) or Thaumaturge (extra cantrip, Wis to Arcana and Religion)',
    'Channel Divinity': ({ level }) =>
      `Divine Spark (heal or deal ${steps([1, 1], [7, 2], [13, 3], [18, 4])(level)}d8 + Wis) or Turn Undead, plus your domain's options`,
    'Divine Spark': ({ level }) =>
      `heal or deal ${steps([1, 1], [7, 2], [13, 3], [18, 4])(level)}d8 + Wis radiant or necrotic to a creature within 30 ft`,
    'Turn Undead': 'undead within 30 ft make a Wis save or are Frightened and Incapacitated for 1 minute',
    'Sear Undead': 'undead that fail against Turn Undead also take radiant damage, a d8 per point of Wis',
    'Blessed Strikes': 'Divine Strike (+1d8 on a weapon hit, once per turn) or Potent Spellcasting (+Wis to cantrip damage)',
    'Divine Intervention': 'cast any Cleric spell of 5th level or lower without a slot, once per long rest',
    'Improved Blessed Strikes': 'Divine Strike rises to 2d8, or Potent Spellcasting also grants temp HP',
    'Greater Divine Intervention': 'Divine Intervention can cast Wish',
  },

  druid: {
    Druidic: 'the secret druid language; Speak with Animals always prepared',
    'Primal Order': 'Magician (extra cantrip, Wis to Arcana and Nature) or Warden (martial weapons, Medium armor)',
    'Wild Shape': ({ level }) =>
      `become a known Beast (up to CR ${level >= 8 ? '1' : level >= 4 ? '1/2' : '1/4'}) for ${Math.floor(level / 2)} hours`,
    'Wild Companion': 'spend a slot or Wild Shape use to cast Find Familiar without components',
    'Wild Resurgence': 'trade a spell slot for a Wild Shape use, or Wild Shape for a 1st-level slot once per long rest',
    'Elemental Fury': 'Potent Spellcasting (+Wis to cantrip damage) or Primal Strike (+1d8 elemental on a hit)',
    'Improved Elemental Fury': 'cantrip range +300 ft, or Primal Strike rises to 2d8',
    'Beast Spells': 'cast spells while in Wild Shape',
    Archdruid: 'regain a Wild Shape use on Initiative; convert Wild Shape uses into spell slots',
  },

  fighter: {
    'Second Wind': ({ level }) => `regain 1d10 + ${level} HP`,
    'Weapon Mastery': ({ level }) => `use the mastery property of ${steps([1, 3], [4, 4], [10, 5], [16, 6])(level)} chosen kinds of weapon`,
    'Action Surge': ({ level }) => `take one additional action on your turn${level >= 17 ? '; two uses per rest, one per turn' : ''}`,
    'Tactical Mind': 'spend a Second Wind use to add 1d10 to a failed ability check',
    'Tactical Shift': 'move up to half your speed without provoking when you use Second Wind',
    Indomitable: ({ level }) => `reroll a failed save with a +${level} bonus`,
    'Tactical Master': "swap a weapon's mastery for Push, Sap, or Slow on an attack",
    'Two Extra Attacks': 'attack three times when you take the Attack action',
    'Studied Attacks': 'after you miss a creature, advantage on your next attack against it',
    'Three Extra Attacks': 'attack four times when you take the Attack action',
  },

  monk: {
    'Martial Arts': ({ level }) => `Dex for unarmed and Monk weapons · ${martialArtsDie(level)} damage · Unarmed Strike as a Bonus Action`,
    'Unarmored Defense': ({ mods }) => `AC 10 + Dex + Wis (${10 + mods.dex + mods.wis}) without armor or a shield`,
    "Monk's Focus": 'Focus Points fuel Flurry of Blows, Patient Defense, Step of the Wind, and more',
    'Flurry of Blows': ({ level }) => `make ${level >= 10 ? 'three' : 'two'} Unarmed Strikes`,
    'Patient Defense': 'Disengage, or spend 1 Focus to Disengage and Dodge',
    'Step of the Wind': 'Dash, or spend 1 Focus to Disengage and Dash with your jump doubled',
    'Unarmored Movement': ({ level }) => `+${unarmoredMovement(level)} ft speed without armor or a shield`,
    'Uncanny Metabolism': ({ level }) => `on Initiative, regain all Focus Points and ${martialArtsDie(level)} + ${level} HP, once per long rest`,
    'Deflect Attacks': ({ level, mods }) => `reduce the damage by 1d10+${mods.dex + level}; if reduced to 0, redirect it`,
    'Slow Fall': ({ level }) => `reduce falling damage by ${5 * level}`,
    'Stunning Strike': 'on a hit, the target makes a Con save or is Stunned until your next turn',
    'Empowered Strikes': 'your Unarmed Strikes can deal Force damage',
    'Acrobatic Movement': 'move along vertical surfaces and across liquids on your turn',
    'Heightened Focus': 'Flurry makes three strikes; Patient Defense and Step of the Wind improve',
    'Self-Restoration': 'end Charmed, Frightened, or Poisoned on yourself at the end of each turn',
    'Deflect Energy': 'Deflect Attacks works against any damage type',
    'Disciplined Survivor': 'proficiency in all saves; spend 1 Focus to reroll a failed save',
    'Perfect Focus': 'on Initiative, refill Focus Points to 4 if you have 3 or fewer',
    'Superior Defense': 'spend 3 Focus for resistance to all damage except Force for 1 minute',
    'Body and Mind': 'Dexterity and Wisdom +4, to a maximum of 25',
    // Way of the Sun Soul
    'Radiant Sun Bolt': 'radiant ranged spell attack out to 30 ft; twice as a Bonus Action for 1 Focus',
    'Searing Arc Strike': 'after the Attack action, spend Focus to cast Burning Hands as a Bonus Action',
  },

  paladin: {
    'Lay On Hands': 'touch to heal from the pool, or spend 5 points to end Poisoned',
    "Paladin's Smite": 'Divine Smite always prepared; cast it once per long rest without a slot',
    'Weapon Mastery': 'use the mastery property of 2 chosen kinds of weapon',
    'Channel Divinity': 'Divine Sense or an Oath option; one use returns on a short rest',
    'Divine Sense': 'for 10 minutes, sense Celestials, Fiends, and Undead within 60 ft',
    'Faithful Steed': 'Find Steed always prepared; cast it once per long rest without a slot',
    'Aura of Protection': ({ level, mods }) =>
      `you and allies within ${level >= 18 ? 30 : 10} ft add ${signed(Math.max(1, mods.cha))} to saving throws`,
    'Abjure Foes': 'Channel Divinity: creatures within 60 ft make a Wis save or are Frightened',
    'Radiant Strikes': 'melee weapon and Unarmed Strike hits deal an extra 1d8 radiant',
    'Restoring Touch': 'Lay On Hands can also end Blinded, Charmed, Deafened, Frightened, Paralyzed, or Stunned',
    'Aura Expansion': 'your auras reach 30 ft',
  },

  ranger: {
    'Favored Enemy': ({ level }) =>
      `Hunter's Mark always prepared; cast it ${steps([1, 2], [5, 3], [9, 4], [13, 5], [17, 6])(level)} times per long rest without a slot`,
    'Deft Explorer': 'Expertise in one skill and two more languages',
    'Weapon Mastery': 'use the mastery property of 2 chosen kinds of weapon',
    Roving: '+10 ft speed; climb and swim speeds equal to your speed',
    Tireless: 'gain 1d8 + Wis temp HP; short rests reduce Exhaustion',
    'Relentless Hunter': "taking damage can't break your Concentration on Hunter's Mark",
    "Nature's Veil": 'become Invisible until the end of your next turn',
    'Precise Hunter': "advantage on attacks against your Hunter's Mark target",
    'Feral Senses': 'Blindsight 30 ft',
    'Foe Slayer': "Hunter's Mark's damage die becomes a d10",
  },

  rogue: {
    'Sneak Attack': ({ level }) => `once per turn, +${Math.ceil(level / 2)}d6 with advantage or an ally next to the target`,
    "Thieves' Cant": 'the secret rogue language, plus one more language',
    'Cunning Action': 'Dash, Disengage, or Hide',
    'Weapon Mastery': 'use the mastery property of 2 chosen kinds of weapon',
    'Steady Aim': "advantage on your next attack this turn if you haven't moved; your speed drops to 0",
    'Cunning Strike': 'trade Sneak Attack dice for Poison, Trip, or Withdraw',
    'Uncanny Dodge': 'halve the damage of an attack that hits you',
    'Reliable Talent': 'a d20 of 9 or lower counts as 10 on checks with your proficiencies',
    'Improved Cunning Strike': 'use two Cunning Strike effects on the same hit',
    'Devious Strikes': 'Daze, Knock Out, and Obscure join your Cunning Strike options',
    'Slippery Mind': 'proficiency in Wisdom and Charisma saves',
    Elusive: "attack rolls against you can't have advantage unless you're Incapacitated",
    'Stroke of Luck': 'turn a failed D20 Test into a 20, once per short rest',
    // Thief
    'Fast Hands': 'a Sleight of Hand check, the Utilize action, or a magic item',
    'Second-Story Work': 'climb speed equal to your speed; jump using Dex',
    'Supreme Sneak': 'Stealth Attack: a Cunning Strike that keeps you hidden',
    'Use Magic Device': 'attune to four items; charges and scrolls work better for you',
    "Thief's Reflexes": 'take two turns in the first round of combat',
  },

  sorcerer: {
    'Innate Sorcery': 'for 1 minute, +1 spell save DC and advantage on Sorcerer spell attacks',
    'Font of Magic': ({ level }) => `${level} Sorcery Points per long rest; trade them for spell slots and back`,
    Metamagic: 'reshape spells with Sorcery Points through your chosen Metamagic options',
    'Sorcerous Restoration': ({ level }) => `on a short rest, regain up to ${Math.floor(level / 2)} Sorcery Points, once per long rest`,
    'Sorcery Incarnate': 'Innate Sorcery for 2 Sorcery Points; two Metamagic options per spell while active',
    'Arcane Apotheosis': 'during Innate Sorcery, one Metamagic option per turn costs no points',
  },

  warlock: {
    'Eldritch Invocations': 'chosen magical augmentations; swap one when you gain a level',
    'Magical Cunning': '1-minute rite: regain half your pact slots, once per long rest',
    'Contact Patron': 'Contact Other Plane without a slot once per long rest; you pass its save',
    'Mystic Arcanum': 'one spell each of levels 6 to 9, each castable once per long rest without a slot',
    'Eldritch Master': 'Magical Cunning restores all your pact slots',
    // Fiend Patron
    "Dark One's Blessing": ({ level, mods }) =>
      `${Math.max(1, mods.cha + level)} temp HP when you or someone within 10 ft drops an enemy to 0 HP`,
    "Dark One's Own Luck": 'add 1d10 to an ability check or save, Cha-mod times per long rest',
    'Fiendish Resilience': 'choose a damage type to resist after each rest',
    'Hurl Through Hell': 'on a hit, send the target through the Lower Planes for 8d10 psychic',
  },

  wizard: {
    'Ritual Adept': 'cast any Ritual spell in your spellbook without preparing it',
    'Arcane Recovery': ({ level }) => `on a short rest, recover slots totaling ${Math.ceil(level / 2)} levels (none 6th+), once per day`,
    Scholar: 'Expertise in Arcana, History, Investigation, Medicine, Nature, or Religion',
    'Memorize Spell': 'on a short rest, swap one prepared spell for another in your spellbook',
    'Spell Mastery': 'cast a chosen 1st- and 2nd-level spell at their lowest level without a slot',
    'Signature Spells': 'two 3rd-level spells always prepared, each once per short rest without a slot',
    // Evoker
    'Evocation Savant': 'two free Evocation spells now, and one more with each new spell level',
    'Potent Cantrip': 'your damaging cantrips deal half damage on a miss or a successful save',
    'Sculpt Spells': 'chosen creatures automatically succeed against your Evocation spells and take no damage',
    'Empowered Evocation': 'add Int to one damage roll of your Wizard Evocation spells',
    Overchannel: 'deal maximum damage with a spell of 5th level or lower; later uses cost necrotic damage',
  },

  artificer: {
    "Tinker's Magic": "make a mundane item with Tinker's Tools",
    'Flash of Genius': ({ mods }) => `add ${signed(Math.max(1, mods.int))} to a check or save within 30 ft`,
    'Magical Tinkering': 'give a Tiny object a light, a message, a smell, or a sound',
  },
};

// Not tied to one class: shared class features, feats, fighting styles,
// invocations, Metamagic options, species traits.
const GENERAL_SHORTS: Record<string, Short> = {
  'Extra Attack': 'attack twice when you take the Attack action',
  Evasion: 'Dex saves for half damage: none on a success, half on a failure',
  Expertise: 'double your proficiency bonus with two chosen skills',
  'Weapon Mastery': 'use the mastery properties of your chosen weapons',
  'Fighting Style': 'a Fighting Style feat of your choice',
  'Epic Boon': 'an Epic Boon feat of your choice',

  // Origin feats
  Alert: 'add your proficiency bonus to Initiative; swap Initiative with a willing ally',
  Crafter: 'three tool proficiencies, a 20% discount on gear, and faster crafting',
  Healer: "a Healer's Kit lets a creature spend a Hit Die to heal; reroll 1s on healing dice",
  Lucky: 'spend a point for advantage on your d20, or disadvantage on an attack against you',
  'Magic Initiate': 'two cantrips and a 1st-level spell, castable once per long rest without a slot',
  Musician: 'after a rest, give Heroic Inspiration to allies who hear you play',
  'Savage Attacker': 'once per turn, roll weapon damage twice and use either roll',
  Skilled: 'proficiency in three skills or tools',
  'Tavern Brawler': 'Unarmed Strikes deal 1d4 + Str; reroll 1s; once per turn, push 5 ft on a hit',
  Tough: '+2 HP per level',

  // General feats
  Actor: 'advantage on Deception and Performance to pass as someone else; mimic voices',
  Athlete: 'climb speed equal to your speed; stand from Prone with 5 ft; running jumps after 5 ft',
  Charger: 'Dash adds 10 ft; a straight 10 ft rush adds 1d8 damage or a 10 ft push',
  Chef: 'cook to heal an extra 1d8 on short rests; treats grant temp HP',
  'Crossbow Expert': "ignore Loading; no disadvantage in melee; add your modifier to the Light crossbow's extra attack",
  Crusher: 'once per turn, a bludgeoning hit moves the target 5 ft; crits grant advantage against it',
  'Defensive Duelist': 'add your proficiency bonus to AC against a melee hit while wielding a Finesse weapon',
  'Dual Wielder': 'extra Bonus Action attack with a non-Light weapon; draw or stow two weapons at once',
  Durable: 'advantage on death saves; Bonus Action: spend a Hit Die to heal',
  'Elemental Adept': "your spells ignore resistance to the chosen damage type; treat 1s as 2s",
  'Fey Touched': 'Misty Step and a 1st-level Divination or Enchantment spell, each free once per long rest',
  Grappler: 'grapple with an Unarmed Strike hit; advantage on attacks against creatures you grapple',
  'Great Weapon Master': 'add your proficiency bonus to Heavy weapon damage; Bonus Action attack after a crit or kill',
  'Heavily Armored': 'Heavy armor training',
  'Heavy Armor Master': 'in Heavy armor, reduce bludgeoning, piercing, and slashing damage by your proficiency bonus',
  'Inspiring Leader': 'after a rest, allies gain temp HP equal to your level plus Wis or Cha',
  'Keen Mind': 'one Int skill with Expertise; Study as a Bonus Action',
  'Lightly Armored': 'Light armor and Shield training',
  'Mage Slayer': 'advantage on saves against spells you can see cast nearby; a hit breaks Concentration on a failed save',
  'Martial Weapon Training': 'martial weapon proficiency',
  'Medium Armor Master': 'add up to +3 Dex to AC in Medium armor',
  'Moderately Armored': 'Medium armor training',
  'Mounted Combatant': 'advantage against unmounted foes smaller than your mount; redirect attacks to you',
  Observant: 'Expertise in one of Insight, Investigation, or Perception; Search as a Bonus Action',
  Piercer: 'once per turn, reroll a piercing damage die; crits add one more die',
  Poisoner: 'your poison damage ignores resistance; brew potent poisons',
  'Polearm Master': 'Bonus Action butt-end attack; opportunity attack when a creature enters your reach',
  Resilient: 'proficiency in saves of the chosen ability',
  'Ritual Caster': 'cast chosen ritual spells; one ritual once per long rest at normal speed',
  Sentinel: "opportunity attacks stop movement and hit Disengaging foes; react when an ally's attacker strikes",
  'Shadow Touched': 'Invisibility and a 1st-level Illusion or Necromancy spell, each free once per long rest',
  Sharpshooter: 'ignore half and three-quarters cover; no disadvantage at long range or in melee',
  'Shield Master': 'once per turn, shove or push with your Shield after a hit; take no damage on a successful Dex save',
  'Skill Expert': 'one more skill proficiency and Expertise in a skill',
  Skulker: 'Blindsight 10 ft; advantage on Stealth in combat; a missed attack doesn\'t reveal you',
  Slasher: "once per turn, a slashing hit reduces the target's Speed by 10 ft; crits impose disadvantage",
  Speedy: '+10 ft speed; Dash ignores difficult terrain; opportunity attacks have disadvantage against you',
  'Spell Sniper': 'spells ignore half and three-quarters cover; attack-roll spells reach 60 ft farther',
  Telekinetic: 'invisible Mage Hand; Bonus Action: shove a creature 5 ft (Str save)',
  Telepathic: 'speak telepathically within 60 ft; Detect Thoughts once per long rest without a slot',
  'War Caster': 'advantage on Concentration saves; cast a spell as an opportunity attack',
  'Weapon Master': 'mastery property of one more kind of weapon',

  // Fighting Style feats
  Archery: '+2 to ranged weapon attack rolls',
  'Blind Fighting': 'Blindsight 10 ft',
  Defense: '+1 AC while wearing armor',
  Dueling: '+2 damage with a one-handed melee weapon and no other weapon',
  'Great Weapon Fighting': 'treat 1s and 2s as 3s on damage dice of two-handed melee weapons',
  Interception: 'reduce damage to an ally within 5 ft by 1d10 + your proficiency bonus',
  Protection: 'impose disadvantage on attacks against an ally within 5 ft (needs a Shield)',
  'Thrown Weapon Fighting': '+2 damage with thrown weapons; draw one as part of the attack',
  'Two-Weapon Fighting': "add your ability modifier to the extra Light weapon attack's damage",
  'Unarmed Fighting': 'Unarmed Strikes deal 1d6 + Str (1d8 with both hands free); 1d4 to creatures you grapple',
  'Blessed Warrior': 'two Cleric cantrips',
  'Druidic Warrior': 'two Druid cantrips',

  // Eldritch Invocations
  'Agonizing Blast': ({ mods }) => `add ${signed(mods.cha)} (Cha) to the damage of your chosen cantrip`,
  'Armor of Shadows': 'Mage Armor at will',
  'Ascendant Step': 'Levitate on yourself at will',
  "Devil's Sight": 'see normally in magical and nonmagical darkness within 120 ft',
  'Devouring Blade': 'Thirsting Blade grants three attacks',
  'Eldritch Mind': 'advantage on Con saves to keep Concentration',
  'Eldritch Smite': 'expend a pact slot on a pact-weapon hit: +1d8 force per slot level plus 1d8, and knock Prone',
  'Eldritch Spear': ({ level }) => `your chosen cantrip reaches ${30 * level} ft farther`,
  'Fiendish Vigor': 'False Life at will for maximum temp HP',
  'Gaze of Two Minds': "perceive through a willing creature's senses",
  'Gift of the Depths': 'breathe underwater and swim at your speed; Water Breathing once per long rest',
  'Investment of the Chain Master': 'your familiar gains a fly or swim speed, Bonus Action attacks, and your save DC',
  'Lessons of the First Ones': 'an Origin feat',
  Lifedrinker: 'once per turn, +1d6 necrotic, psychic, or radiant on a pact-weapon hit; spend a Hit Die to heal',
  'Mask of Many Faces': 'Disguise Self at will',
  'Master of Myriad Forms': 'Alter Self at will',
  'Misty Visions': 'Silent Image at will',
  'One with Shadows': 'in dim light or darkness, become Invisible until you act',
  'Otherworldly Leap': 'Jump on yourself at will',
  'Pact of the Blade': 'conjure or bond a pact weapon; use Cha to hit; necrotic, psychic, or radiant damage',
  'Pact of the Chain': 'Find Familiar with special forms; your familiar can attack with its Reaction',
  'Pact of the Tome': 'a Book of Shadows with three cantrips and two 1st-level rituals, always prepared',
  'Repelling Blast': 'push a Large or smaller target 10 ft on a hit with your chosen cantrip',
  'Thirsting Blade': 'attack twice with your pact weapon when you take the Attack action',
  'Visions of Distant Realms': 'Arcane Eye at will',
  'Whispers of the Grave': 'Speak with Dead at will',
  'Witch Sight': 'Truesight 30 ft',

  // Metamagic
  'Careful Spell': 'chosen creatures automatically succeed on the save and take no damage on a success',
  'Distant Spell': 'double the range, or give a touch spell 30 ft',
  'Empowered Spell': 'reroll damage dice up to your Cha modifier',
  'Extended Spell': 'double the duration; advantage on Concentration saves',
  'Heightened Spell': 'one target has disadvantage on saves against the spell',
  'Quickened Spell': 'cast an action spell as a Bonus Action',
  'Seeking Spell': 'reroll a missed spell attack',
  'Subtle Spell': 'cast without verbal, somatic, or material components',
  'Transmuted Spell': 'swap the damage type among acid, cold, fire, lightning, poison, and thunder',
  'Twinned Spell': 'target one more creature as if cast one level higher',

  // Species traits (2024 PHB, plus fixture species)
  'Celestial Resistance': 'resistance to necrotic and radiant damage',
  'Healing Hands': ({ pb }) => `touch to heal ${pb}d4 HP, once per long rest`,
  'Light Bearer': 'the Light cantrip',
  'Celestial Revelation': 'a 1-minute celestial form with wings, radiance, or a shroud',
  'Breath Weapon': ({ level }) => `replace an attack: 15 ft cone or 30 ft line, Dex save, ${cantripDice(level)}d10 damage`,
  'Damage Resistance': "resistance to your ancestry's damage type",
  'Draconic Flight': 'spectral wings give a fly speed for 10 minutes, once per long rest',
  'Dwarven Resilience': 'resistance to poison damage; advantage on saves against Poisoned',
  'Dwarven Toughness': '+1 HP per level',
  Stonecunning: 'Tremorsense 60 ft for 10 minutes',
  'Elven Lineage': 'lineage spells and traits from your elven heritage',
  'Fey Ancestry': 'advantage on saves to avoid or end Charmed',
  'Keen Senses': 'proficiency in Insight, Perception, or Survival',
  Trance: "4 hours of trance count as a long rest; magic can't put you to sleep",
  'Gnomish Cunning': 'advantage on Int, Wis, and Cha saves',
  'Gnomish Lineage': 'lineage spells from your gnomish heritage',
  'Giant Ancestry': 'a giant boon, usable proficiency-bonus times per long rest',
  'Large Form': 'become Large for 10 minutes, once per long rest',
  'Powerful Build': 'advantage on checks to end Grappled; count as one size larger for carrying',
  Brave: 'advantage on saves against Frightened',
  'Halfling Nimbleness': "move through the space of any creature larger than you",
  Luck: 'reroll a 1 on a D20 Test',
  'Naturally Stealthy': 'hide behind creatures larger than you',
  Resourceful: 'Heroic Inspiration after each long rest',
  Skillful: 'one more skill proficiency',
  Versatile: 'an Origin feat',
  'Adrenaline Rush': ({ pb }) => `Dash and gain ${pb} temp HP`,
  'Relentless Endurance': 'drop to 1 HP instead of 0, once per long rest',
  'Fiendish Legacy': 'resistance and spells from your fiendish legacy',
  'Otherworldly Presence': 'the Thaumaturgy cantrip',
  Aggressive: 'move up to your speed toward an enemy you can see',
  'Spider Climb': 'climb speed equal to your speed; from 3rd level, walls and ceilings hands-free',
  'Vampiric Bite': ({ mods }) =>
    `replaces an Unarmed Strike: 1d4${signed(mods.con)} piercing; heal that much or bank it for a check or attack`,
  'Deathless Nature': "you don't need to breathe",
  'Trace of Undeath': 'resistance to necrotic damage',
};

/** "Agonizing Blast (Eldritch Blast)" → "agonizing blast". */
const lookupKey = (name: string) => featureKey(name.replace(/\s*\([^)]*\)\s*$/, ''));

const index = (table: Record<string, Short>) => new Map(Object.entries(table).map(([k, v]) => [lookupKey(k), v]));
const CLASS_INDEX = new Map(Object.entries(CLASS_SHORTS).map(([cls, table]) => [cls, index(table)]));
const GENERAL_INDEX = index(GENERAL_SHORTS);

/** The short for a feature or activation name: the class's own table first, then the shared one. */
export function shortFor(name: string, group: string | undefined, ctx: ShortContext): string | null {
  const key = lookupKey(name);
  const short = CLASS_INDEX.get((group ?? '').trim().toLowerCase())?.get(key) ?? GENERAL_INDEX.get(key);
  if (!short) return null;
  return typeof short === 'function' ? short(ctx) : short;
}
