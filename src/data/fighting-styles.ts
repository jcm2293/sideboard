// Fighting style definitions extracted from laserllama's Magus PDF
// (docs/homebrew-references/magus.pdf, base list page 6 + expanded page 15).
//
// Each ClassDefinition declares which IDs are available via allowed_fighting_style_ids.

import type { FightingStyleDefinition } from '@/types/fighting-style';

export const FIGHTING_STYLES: Record<string, FightingStyleDefinition> = {
  // ── Base (Magus core) ────────────────────────────────────────────────
  fs_archery: {
    id: 'fs_archery',
    name: 'Archery',
    prerequisite: 'Dexterity 13+',
    description:
      '+1 to attack rolls with ranged weapons. Your attacks with ranged weapons ignore half-cover and treat three-quarters cover as half-cover.',
  },
  fs_balanced: {
    id: 'fs_balanced',
    name: 'Balanced Fighting',
    description:
      'When wielding a melee weapon in one hand and no other weapons, +2 to weapon damage rolls. You can use a shield and still gain this benefit.',
  },
  fs_classical: {
    id: 'fs_classical',
    name: 'Classical Swordplay',
    prerequisite: 'Dexterity 13+',
    description:
      'While wielding a single finesse weapon, no shield, and not wearing heavy armor, +2 to attack rolls with that weapon and +1 to your Armor Class.',
  },
  fs_defensive: {
    id: 'fs_defensive',
    name: 'Defensive Fighting',
    description: 'When wearing medium armor, heavy armor, or a shield, +1 to your Armor Class.',
  },
  fs_dual: {
    id: 'fs_dual',
    name: 'Dual Wielding',
    prerequisite: 'Strength or Dexterity 13+',
    description:
      "While two-weapon fighting, your off-hand attack is part of your Attack action instead of your bonus action, and you add your ability modifier to the damage of this attack. You cannot also make an attack with your bonus action that turn.",
  },
  fs_hurler: {
    id: 'fs_hurler',
    name: 'Hurler',
    prerequisite: 'Strength or Dexterity 11+',
    description:
      'Draw one thrown weapon as part of a ranged attack with it. The range of your thrown weapon attacks is doubled. While wielding only thrown weapons, you can make a single ranged thrown attack as a bonus action.',
  },
  fs_protection: {
    id: 'fs_protection',
    name: 'Protection',
    description:
      "When a creature you can see hits you, or hits a target within 5 feet with a melee attack, you can use your reaction to add your Proficiency Bonus to the target's AC against that attack. You must be wielding a shield or a melee weapon.",
  },
  fs_versatile: {
    id: 'fs_versatile',
    name: 'Versatile Fighting',
    prerequisite: 'Strength or Dexterity 11+',
    description:
      'While wielding a single versatile weapon and no shield, +1 to your attack rolls with that weapon. You can use your bonus action to make a Grapple or Shove attack, or take the Use an Object action.',
  },

  // ── Expanded (Magus Class: Expanded) ─────────────────────────────────
  fs_arcane_warrior: {
    id: 'fs_arcane_warrior',
    name: 'Arcane Warrior',
    prerequisite: 'Proficiency in Arcana',
    description:
      'Learn two cantrips of your choice from the Wizard spell list. They do not count against your total Cantrips Known. Intelligence is their spellcasting ability; once you gain Spellcasting, they count as Magus spells for you.',
  },
  fs_brawling: {
    id: 'fs_brawling',
    name: 'Brawling',
    prerequisite: 'Proficiency in Athletics',
    description:
      'Your unarmed strikes deal 1d6 + your Strength modifier on hit. With both hands free, you can make a single unarmed strike, Shove, or Grapple as a bonus action on each of your turns.',
  },
  fs_featherweight: {
    id: 'fs_featherweight',
    name: 'Featherweight Fighting',
    prerequisite: 'Dexterity 13+, proficiency in Acrobatics',
    description:
      'While unarmed or wielding only light weapons and not wearing medium or heavy armor, +10 ft. walking speed and +1 damage with light melee weapons and unarmed strikes.',
  },
  fs_great_weapon: {
    id: 'fs_great_weapon',
    name: 'Great Weapon Fighting',
    prerequisite: 'Strength 13+',
    description:
      'When you deal damage with a heavy melee weapon attack, you can treat any damage die that rolls lower than its average as the average roll: d4 becomes 2, d6 becomes 3, d8 becomes 4, d10 becomes 5, d12 becomes 6.',
  },
  fs_heavyweight: {
    id: 'fs_heavyweight',
    name: 'Heavyweight Fighting',
    prerequisite: 'Strength 13+',
    description:
      'You gain +1 damage on damage rolls with heavy melee weapons. When you hit a target with a heavy melee weapon attack, you can use your bonus action that turn to make a Shove against the same target with advantage.',
  },
  fs_mounted: {
    id: 'fs_mounted',
    name: 'Mounted Warrior',
    prerequisite: 'Proficiency in Animal Handling',
    description:
      "While riding a controlled mount, both you and your mount gain +1 AC, and you can use a bonus action on each of your turns to command your mount to take one action from its stat block or another action.",
  },
  fs_polearm: {
    id: 'fs_polearm',
    name: 'Polearm Fighting',
    prerequisite: 'Strength and Dexterity 11+',
    description:
      "+1 damage with glaives, halberds, pikes, quarterstaffs, and spears so long as you wield only that weapon and no shield. Creatures provoke an opportunity attack from you when they enter or move within your reach with that weapon.",
  },
  fs_shield_warrior: {
    id: 'fs_shield_warrior',
    name: 'Shield Warrior',
    prerequisite: 'Strength 13+',
    description:
      'You gain proficiency with shields as martial melee weapons. For you, shields deal 2d4 bludgeoning damage on hit. While wielding a shield and no other weapons, +1 to your Armor Class and to shield attack rolls.',
  },
};

export const ALL_FIGHTING_STYLE_IDS = Object.keys(FIGHTING_STYLES);

export function getFightingStylesById(ids: string[]): FightingStyleDefinition[] {
  return ids.map((id) => FIGHTING_STYLES[id]).filter(Boolean);
}
