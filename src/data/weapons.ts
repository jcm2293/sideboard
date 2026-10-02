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
