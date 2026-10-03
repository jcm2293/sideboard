// 2024 PHB weapons and their mastery properties.

export const MASTERY_PROPERTIES = ['Cleave', 'Graze', 'Nick', 'Push', 'Sap', 'Slow', 'Topple', 'Vex'] as const;

const WEAPON_MASTERY: Record<string, string> = {
  // Simple melee
  club: 'Slow', dagger: 'Nick', greatclub: 'Push', handaxe: 'Vex', javelin: 'Slow',
  'light hammer': 'Nick', mace: 'Sap', quarterstaff: 'Topple', sickle: 'Nick', spear: 'Sap',
  // Simple ranged
  dart: 'Vex', 'light crossbow': 'Slow', shortbow: 'Vex', sling: 'Slow',
  // Martial melee
  battleaxe: 'Topple', flail: 'Sap', glaive: 'Graze', greataxe: 'Cleave', greatsword: 'Graze',
  halberd: 'Cleave', lance: 'Topple', longsword: 'Sap', maul: 'Topple', morningstar: 'Sap', pike: 'Push',
  rapier: 'Vex', scimitar: 'Nick', shortsword: 'Vex', trident: 'Topple', warhammer: 'Push', 'war pick': 'Sap',
  whip: 'Slow',
  // Martial ranged
  blowgun: 'Vex', 'hand crossbow': 'Vex', 'heavy crossbow': 'Push', longbow: 'Slow', musket: 'Slow', pistol: 'Vex',
};

/**
 * Base PHB weapon for a Beyond weapon name, or null for anything else:
 * "Shortsword, +1" → "shortsword", "Crossbow, Hand" → "hand crossbow".
 */
export function standardWeapon(name: string): string | null {
  let key = name.toLowerCase().replace(/,?\s*\+\d+/g, '').trim();
  const crossbow = key.match(/^crossbow,\s*(hand|light|heavy)$/);
  if (crossbow) key = `${crossbow[1]} crossbow`;
  return key in WEAPON_MASTERY ? key : null;
}

export function weaponMastery(name: string): string | null {
  const key = standardWeapon(name);
  return key ? WEAPON_MASTERY[key] : null;
}

/** One-line effect of each mastery property, for the attacks table notes. */
export const MASTERY_EFFECTS: Record<string, string> = {
  Cleave: 'on a melee hit, attack a second creature within 5 ft of the first, once per turn',
  Graze: 'on a miss, deal damage equal to your ability modifier',
  Nick: "make the Light weapon's extra attack as part of the Attack action, once per turn",
  Push: 'on a hit, push a Large or smaller target up to 10 ft away',
  Sap: 'on a hit, the target has Disadvantage on its next attack roll',
  Slow: "on a hit, reduce the target's Speed by 10 ft until your next turn",
  Topple: 'on a hit, the target makes a Con save or falls Prone',
  Vex: 'on a hit, Advantage on your next attack against that target',
};
