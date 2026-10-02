// Spell text for the sheet: the bundled SRD library plus the campaign's custom
// spells, looked up by name.

import srdSpellsData from '@/data/spells.json';
import type { CustomSpell, SrdSpell } from '@/types';

const SRD_BY_NAME = new Map<string, SrdSpell>();
for (const s of srdSpellsData as SrdSpell[]) {
  SRD_BY_NAME.set(s.name.toLowerCase().trim(), s);
}

/** Custom spells on the SrdSpell shape, so callers don't care which library a spell came from. */
function customToSrdShape(c: CustomSpell): SrdSpell {
  const components: string[] = [];
  if (c.components_v) components.push('V');
  if (c.components_s) components.push('S');
  if (c.components_m) components.push('M');
  return {
    index: c.id,
    name: c.name,
    desc: c.description ? [c.description] : [],
    higher_level: c.higher_levels ? [c.higher_levels] : [],
    range: c.range,
    components,
    material: c.material_description,
    ritual: c.ritual,
    duration: c.duration,
    concentration: c.concentration,
    casting_time: c.casting_time,
    level: c.level,
    school: c.school,
    classes: c.classes || [],
  };
}

export type SpellLookup = (name: string) => SrdSpell | null;

/** Custom spells first, then the SRD; tolerant of "[R]"-style markers, apostrophes, and hyphens. */
export function createSpellLookup(customSpells: CustomSpell[] = []): SpellLookup {
  const custom = new Map<string, SrdSpell>();
  for (const c of customSpells) custom.set(c.name.toLowerCase().trim(), customToSrdShape(c));
  const loose = (s: string) => s.replace(/['’-]/g, '').replace(/\s+/g, ' ');

  return (name) => {
    if (!name) return null;
    const lower = name.replace(/\s*\[[^\]]*\]\s*$/, '').toLowerCase().trim();
    const direct = custom.get(lower) ?? SRD_BY_NAME.get(lower);
    if (direct) return direct;
    const norm = loose(lower);
    for (const [k, v] of custom) if (loose(k) === norm) return v;
    for (const [k, v] of SRD_BY_NAME) if (loose(k) === norm) return v;
    return null;
  };
}
