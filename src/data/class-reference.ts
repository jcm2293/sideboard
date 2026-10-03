// Class rules the D&D Beyond export omits or truncates (sheet spec v3 §4):
// resource uses by level, rider dice, the feature DC, short canonical text for
// features the export leaves empty, and each class's 2024 PHB feature names
// (which tell class features from subclass ones when attributing spells).
//
// The export wins wherever it has a structured number; this table fills gaps.
// Rule text is paraphrased, not quoted. One-line `short` clauses live in
// feature-shorts.ts.

import type { ActionType } from '@/types';

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type AbilityMods = Record<Ability, number>;

export interface ResourceRule {
  /** Name on the sheet ("Rage", "Focus Points"). */
  name: string;
  /** Feature the resource belongs to, when the names differ ("Monk's Focus"). */
  feature?: string;
  /** Uses at this class level; 0 = not available yet. Pools return the point total. */
  uses: (level: number, mods: AbilityMods) => number;
  recovery: (level: number) => string;
  die?: (level: number) => string;
  pool?: boolean;
  action?: ActionType;
  /** Create the feature from the table even if the export never names it. */
  core?: boolean;
  /** Only for this subclass (Battle Master superiority dice). */
  subclass?: string;
}

export interface RiderRule {
  name: string;
  /** Feature name — or spell name, for Divine Smite — the character must have. */
  requires: string;
  damage: (level: number) => string;
  /** Pulls the die out of the feature's own text when present ("extra 2d6", "roll 1d8"). */
  textDie?: RegExp;
  note: string;
}

/** 'spell' = the spell save DC; 'grapple' = the Grapple/Shove DC. */
export type FeatureDcRule = 'spell' | 'grapple' | { label: string; ability: Ability | 'str-or-dex' };

export interface ClassReference {
  name: string;
  featureDc: FeatureDcRule;
  subclassFeatureDc?: Record<string, FeatureDcRule>;
  resources: ResourceRule[];
  riders: RiderRule[];
  /** Short text for features the export leaves empty (or omits, for `core` resources). */
  canonicalText: Record<string, string>;
  /** 2024 PHB class features, not subclass features. */
  classFeatures: string[];
  /** Weapon Mastery count by class level. */
  weaponMasteries?: (level: number) => number;
  /** Class level of Extra Attack ("attack twice"). */
  extraAttackLevel?: number;
  subclassExtraAttackLevel?: Record<string, number>;
}

/** Value of the highest step at or below `level`; 0 before the first step. */
export function steps(...table: [number, number][]): (level: number) => number {
  return (level) => table.reduce((value, [from, v]) => (level >= from ? v : value), 0);
}

export function dice(...table: [number, string][]): (level: number) => string {
  return (level) => table.reduce((value, [from, v]) => (level >= from ? v : value), table[0][1]);
}

const fixed = (recovery: string) => () => recovery;
const LONG_REGAIN_ONE = fixed('Long Rest (regain 1 on Short Rest)');

export const CLASS_REFERENCE: Record<string, ClassReference> = {
  barbarian: {
    name: 'Barbarian',
    featureDc: 'grapple',
    resources: [
      {
        name: 'Rage',
        uses: steps([1, 2], [3, 3], [6, 4], [12, 5], [17, 6]),
        recovery: LONG_REGAIN_ONE,
        action: 'bonus',
        core: true,
      },
    ],
    riders: [
      {
        name: 'Rage damage',
        requires: 'Rage',
        damage: (l) => `+${steps([1, 2], [9, 3], [16, 4])(l)}`,
        note: 'Strength-based attacks while raging',
      },
    ],
    canonicalText: {
      Rage:
        "As a Bonus Action, enter a Rage if you aren't wearing Heavy armor. While raging you have Resistance to Bludgeoning, Piercing, and Slashing damage; add your Rage Damage bonus to damage from attacks that use Strength; and have Advantage on Strength checks and saving throws. You can't cast spells or maintain Concentration.\n\nThe Rage lasts until the end of your next turn and extends each turn you attack an enemy, force an enemy to make a saving throw, or take a Bonus Action to extend it, up to 10 minutes. It ends early if you put on Heavy armor or have the Incapacitated condition. You regain one expended use on a Short Rest and all of them on a Long Rest.",
    },
    classFeatures: [
      'Rage', 'Unarmored Defense', 'Weapon Mastery', 'Danger Sense', 'Reckless Attack', 'Barbarian Subclass',
      'Primal Knowledge', 'Ability Score Improvement', 'Extra Attack', 'Fast Movement', 'Feral Instinct',
      'Instinctive Pounce', 'Brutal Strike', 'Relentless Rage', 'Improved Brutal Strike', 'Persistent Rage',
      'Indomitable Might', 'Epic Boon', 'Primal Champion',
    ],
    weaponMasteries: steps([1, 2], [4, 3], [10, 4]),
    extraAttackLevel: 5,
  },

  bard: {
    name: 'Bard',
    featureDc: 'spell',
    resources: [
      {
        name: 'Bardic Inspiration',
        uses: (_l, mods) => Math.max(1, mods.cha),
        recovery: (l) => (l >= 5 ? 'Short Rest' : 'Long Rest'),
        die: dice([1, 'd6'], [5, 'd8'], [10, 'd10'], [15, 'd12']),
        action: 'bonus',
        core: true,
      },
    ],
    riders: [],
    canonicalText: {
      'Bardic Inspiration':
        'As a Bonus Action, give a creature within 60 feet that can see or hear you a Bardic Inspiration die. Once within the next hour, when it fails a D20 Test, it can roll the die and add the number rolled, potentially turning the failure into a success. Uses equal your Charisma modifier (minimum 1).',
    },
    classFeatures: [
      'Bardic Inspiration', 'Spellcasting', 'Expertise', 'Jack of All Trades', 'Bard Subclass',
      'Ability Score Improvement', 'Font of Inspiration', 'Countercharm', 'Magical Secrets', 'Superior Inspiration',
      'Epic Boon', 'Words of Creation',
    ],
    subclassExtraAttackLevel: { 'College of Valor': 6 },
  },

  cleric: {
    name: 'Cleric',
    featureDc: 'spell',
    resources: [
      { name: 'Channel Divinity', uses: steps([2, 2], [6, 3], [18, 4]), recovery: LONG_REGAIN_ONE },
    ],
    riders: [],
    canonicalText: {},
    classFeatures: [
      'Spellcasting', 'Divine Order', 'Channel Divinity', 'Cleric Subclass', 'Ability Score Improvement',
      'Sear Undead', 'Blessed Strikes', 'Divine Intervention', 'Improved Blessed Strikes', 'Epic Boon',
      'Greater Divine Intervention',
    ],
  },

  druid: {
    name: 'Druid',
    featureDc: 'spell',
    resources: [
      { name: 'Wild Shape', uses: steps([2, 2], [6, 3], [17, 4]), recovery: LONG_REGAIN_ONE, action: 'bonus' },
    ],
    riders: [],
    canonicalText: {},
    classFeatures: [
      'Spellcasting', 'Druidic', 'Primal Order', 'Wild Shape', 'Wild Companion', 'Druid Subclass',
      'Ability Score Improvement', 'Wild Resurgence', 'Elemental Fury', 'Improved Elemental Fury', 'Beast Spells',
      'Epic Boon', 'Archdruid',
    ],
  },

  fighter: {
    name: 'Fighter',
    featureDc: 'grapple',
    subclassFeatureDc: {
      'Battle Master': { label: 'Maneuver DC', ability: 'str-or-dex' },
      'Eldritch Knight': 'spell',
    },
    resources: [
      { name: 'Second Wind', uses: steps([1, 2], [4, 3], [10, 4]), recovery: LONG_REGAIN_ONE, action: 'bonus' },
      { name: 'Action Surge', uses: steps([2, 1], [17, 2]), recovery: fixed('Short Rest'), action: 'special' },
      { name: 'Indomitable', uses: steps([9, 1], [13, 2], [17, 3]), recovery: fixed('Long Rest'), action: 'special' },
      {
        name: 'Superiority Dice',
        feature: 'Combat Superiority',
        uses: steps([3, 4], [7, 5], [15, 6]),
        recovery: fixed('Short Rest'),
        die: dice([3, 'd8'], [10, 'd10'], [18, 'd12']),
        subclass: 'Battle Master',
      },
    ],
    riders: [],
    canonicalText: {},
    classFeatures: [
      'Fighting Style', 'Second Wind', 'Weapon Mastery', 'Action Surge', 'Tactical Mind', 'Fighter Subclass',
      'Ability Score Improvement', 'Extra Attack', 'Tactical Shift', 'Indomitable', 'Tactical Master',
      'Two Extra Attacks', 'Studied Attacks', 'Epic Boon', 'Three Extra Attacks',
    ],
    weaponMasteries: steps([1, 3], [4, 4], [10, 5], [16, 6]),
    extraAttackLevel: 5,
  },

  monk: {
    name: 'Monk',
    featureDc: { label: 'Focus DC', ability: 'wis' },
    resources: [
      { name: 'Focus Points', feature: "Monk's Focus", uses: (l) => (l >= 2 ? l : 0), recovery: fixed('Short Rest') },
      { name: 'Uncanny Metabolism', uses: steps([2, 1]), recovery: fixed('Long Rest'), action: 'special' },
    ],
    riders: [
      {
        name: 'Martial Arts die',
        requires: 'Martial Arts',
        damage: dice([1, '1d6'], [5, '1d8'], [11, '1d10'], [17, '1d12']),
        textDie: /roll (\d+d\d+) in place/i,
        note: 'in place of Unarmed Strike and Monk weapon damage',
      },
    ],
    canonicalText: {
      'Martial Arts':
        "While unarmed or wielding only Monk weapons, and not wearing armor or wielding a Shield: you can make an Unarmed Strike as a Bonus Action, roll your Martial Arts die in place of the normal damage, and use Dexterity instead of Strength for the attack and damage rolls and for the save DC of Grapple and Shove.",
    },
    classFeatures: [
      'Martial Arts', 'Unarmored Defense', "Monk's Focus", 'Unarmored Movement', 'Uncanny Metabolism',
      'Deflect Attacks', 'Monk Subclass', 'Ability Score Improvement', 'Slow Fall', 'Extra Attack',
      'Stunning Strike', 'Empowered Strikes', 'Evasion', 'Acrobatic Movement', 'Heightened Focus',
      'Self-Restoration', 'Deflect Energy', 'Disciplined Survivor', 'Perfect Focus', 'Superior Defense', 'Epic Boon',
      'Body and Mind',
    ],
    extraAttackLevel: 5,
  },

  paladin: {
    name: 'Paladin',
    featureDc: 'spell',
    resources: [
      {
        name: 'Lay On Hands',
        uses: (l) => 5 * l,
        recovery: fixed('Long Rest'),
        pool: true,
        action: 'bonus',
        core: true,
      },
      { name: 'Channel Divinity', uses: steps([3, 2], [11, 3]), recovery: LONG_REGAIN_ONE },
    ],
    riders: [
      {
        name: 'Divine Smite',
        requires: 'Divine Smite',
        damage: () => '2d8',
        note: '+1d8 per slot level above 1st, +1d8 vs Fiends and Undead; Bonus Action after a hit',
      },
    ],
    canonicalText: {
      'Lay On Hands':
        'A pool of healing equal to five times your Paladin level, refilled on a Long Rest. As a Bonus Action, touch a creature to restore any number of Hit Points from the pool, or spend 5 points to remove the Poisoned condition.',
    },
    classFeatures: [
      'Lay On Hands', 'Spellcasting', 'Weapon Mastery', 'Fighting Style', "Paladin's Smite", 'Channel Divinity',
      'Paladin Subclass', 'Ability Score Improvement', 'Extra Attack', 'Faithful Steed', 'Aura of Protection',
      'Abjure Foes', 'Radiant Strikes', 'Restoring Touch', 'Aura Expansion', 'Epic Boon',
    ],
    weaponMasteries: steps([1, 2]),
    extraAttackLevel: 5,
  },

  ranger: {
    name: 'Ranger',
    featureDc: 'spell',
    resources: [
      {
        name: "Favored Enemy (Hunter's Mark)",
        feature: 'Favored Enemy',
        uses: steps([1, 2], [5, 3], [9, 4], [13, 5], [17, 6]),
        recovery: fixed('Long Rest'),
      },
    ],
    riders: [],
    canonicalText: {},
    classFeatures: [
      'Spellcasting', 'Favored Enemy', 'Weapon Mastery', 'Deft Explorer', 'Fighting Style', 'Ranger Subclass',
      'Ability Score Improvement', 'Extra Attack', 'Roving', 'Expertise', 'Tireless', 'Relentless Hunter',
      "Nature's Veil", 'Precise Hunter', 'Feral Senses', 'Epic Boon', 'Foe Slayer',
    ],
    weaponMasteries: steps([1, 2]),
    extraAttackLevel: 5,
  },

  rogue: {
    name: 'Rogue',
    featureDc: 'grapple',
    subclassFeatureDc: { 'Arcane Trickster': 'spell' },
    resources: [],
    riders: [
      {
        name: 'Sneak Attack',
        requires: 'Sneak Attack',
        damage: (l) => `${Math.ceil(l / 2)}d6`,
        textDie: /extra (\d+d\d+)/i,
        note: 'once per turn, with Advantage or an ally within 5 ft. of the target; Finesse or Ranged weapon',
      },
    ],
    canonicalText: {
      'Sneak Attack':
        "Once per turn, deal your Sneak Attack dice as extra damage to one creature you hit with a Finesse or Ranged weapon attack if you have Advantage on the roll, or if an ally that isn't Incapacitated is within 5 feet of the target and you don't have Disadvantage. The extra damage is the weapon's type.",
    },
    classFeatures: [
      'Expertise', 'Sneak Attack', "Thieves' Cant", 'Weapon Mastery', 'Cunning Action', 'Rogue Subclass',
      'Steady Aim', 'Ability Score Improvement', 'Cunning Strike', 'Uncanny Dodge', 'Evasion', 'Reliable Talent',
      'Improved Cunning Strike', 'Devious Strikes', 'Slippery Mind', 'Elusive', 'Epic Boon', 'Stroke of Luck',
    ],
    weaponMasteries: steps([1, 2]),
  },

  sorcerer: {
    name: 'Sorcerer',
    featureDc: 'spell',
    resources: [
      { name: 'Sorcery Points', feature: 'Font of Magic', uses: (l) => (l >= 2 ? l : 0), recovery: fixed('Long Rest') },
      { name: 'Innate Sorcery', uses: steps([1, 2]), recovery: fixed('Long Rest'), action: 'bonus' },
    ],
    riders: [],
    canonicalText: {},
    classFeatures: [
      'Spellcasting', 'Innate Sorcery', 'Font of Magic', 'Metamagic', 'Sorcerer Subclass',
      'Ability Score Improvement', 'Sorcerous Restoration', 'Sorcery Incarnate', 'Epic Boon', 'Arcane Apotheosis',
    ],
  },

  warlock: {
    name: 'Warlock',
    featureDc: 'spell',
    // Pact slots come from the spell-slot progression, not a resource rule.
    resources: [{ name: 'Magical Cunning', uses: steps([2, 1]), recovery: fixed('Long Rest'), action: 'none' }],
    riders: [],
    canonicalText: {},
    classFeatures: [
      'Eldritch Invocations', 'Pact Magic', 'Magical Cunning', 'Warlock Subclass', 'Ability Score Improvement',
      'Contact Patron', 'Mystic Arcanum', 'Epic Boon', 'Eldritch Master',
    ],
  },

  wizard: {
    name: 'Wizard',
    featureDc: 'spell',
    resources: [{ name: 'Arcane Recovery', uses: steps([1, 1]), recovery: fixed('Long Rest'), action: 'special' }],
    riders: [],
    canonicalText: {
      'Ritual Adept':
        "You can cast any spell in your spellbook that has the Ritual tag as a Ritual. You don't need it prepared, but you must read from the book to cast it this way.",
    },
    classFeatures: [
      'Spellcasting', 'Ritual Adept', 'Arcane Recovery', 'Scholar', 'Wizard Subclass', 'Ability Score Improvement',
      'Memorize Spell', 'Spell Mastery', 'Epic Boon', 'Signature Spells',
    ],
    subclassExtraAttackLevel: { Bladesinger: 6 },
  },

  artificer: {
    name: 'Artificer',
    featureDc: 'spell',
    resources: [
      {
        name: 'Flash of Genius',
        uses: (l, mods) => (l >= 7 ? Math.max(1, mods.int) : 0),
        recovery: fixed('Long Rest'),
        action: 'reaction',
      },
    ],
    riders: [],
    canonicalText: {},
    // Eberron: Forge of the Artificer names, plus Tasha's names Beyond may still use.
    classFeatures: [
      "Tinker's Magic", 'Spellcasting', 'Replicate Magic Item', 'Artificer Subclass', 'Ability Score Improvement',
      'Magic Item Tinker', 'Flash of Genius', 'Magic Item Adept', 'Spell-Storing Item', 'Advanced Artifice',
      'Magic Item Master', 'Epic Boon', 'Soul of Artifice', 'Magical Tinkering', 'Infuse Item',
      'The Right Tool for the Job', 'Tool Expertise', 'Magic Item Savant',
    ],
  },
};

/** Normalized key for matching names across Beyond's punctuation (curly vs straight apostrophes, case). */
export function featureKey(name: string): string {
  return name.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}

export function classReferenceFor(className: string): ClassReference | null {
  return CLASS_REFERENCE[className.trim().toLowerCase()] ?? null;
}

/** True when `featureName` is one of the class's own (non-subclass) features. */
export function isClassFeature(ref: ClassReference, featureName: string): boolean {
  const key = featureKey(featureName);
  return ref.classFeatures.some((f) => featureKey(f) === key);
}
