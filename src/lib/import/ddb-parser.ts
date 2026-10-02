// D&D Beyond character-sheet parser: PDF form fields in, character out.
//
// Pure — no I/O. The upload route and scripts/parse-fixtures.ts both feed it
// the output of extractFormFields (src/lib/import/pdf-form-fields.ts).

import { getSpellProgression, parseClassLine } from '@/data/spell-progression';
import type { ProficiencyLevel } from '@/types';
import type { PdfFormFields } from './pdf-form-fields';

type FormFields = Record<string, string>;

interface SpellAnnotation {
  type: 'header' | 'spell';
  level?: string;
  name?: string;
}

function parseInt2(val: string | undefined, fallback = 0): number {
  if (!val) return fallback;
  const n = parseInt(val.replace(/[^-\d]/g, ''), 10);
  return isNaN(n) ? fallback : n;
}

function getField(fields: FormFields, ...names: string[]): string {
  for (const name of names) {
    if (fields[name]) return fields[name];
  }
  return '';
}

export interface ParsedCharacter {
  name: string;
  player_name: string;
  class_name: string;
  subclass: string;
  level: number;
  is_multiclass: boolean;
  armor_class: number;
  ac_source: string;
  initiative_modifier: number;
  speeds: Record<string, string>;
  hp_max: number;
  hit_dice_total: string;
  proficiency_bonus: number;
  passive_perception: number;
  passive_insight: number | null;
  passive_investigation: number | null;
  senses: string;
  str_score: number;
  dex_score: number;
  con_score: number;
  int_score: number;
  wis_score: number;
  cha_score: number;
  skill_modifiers: Record<string, number>;
  save_modifiers: Record<string, number>;
  skill_proficiencies: Record<string, ProficiencyLevel>;
  save_proficiencies: Record<string, ProficiencyLevel>;
  attacks: { name: string; atk_bonus: string; damage: string; damage_type: string; range: string; notes: string }[];
  damage_resistances: string;
  damage_immunities: string;
  condition_immunities: string;
  armor_proficiencies: Record<string, boolean>;
  weapon_proficiencies: Record<string, boolean>;
  languages: string;
  tool_proficiencies: string;
  is_spellcaster: boolean;
  spellcasting_ability: string | null;
  // Spell DC and attack are calculated by the app from PB + ability mod.
  // Overrides remain null on import; user toggles them on if a magic item changes the value.
  spell_attack_bonus_override: number | null;
  spell_save_dc_override: number | null;
  spell_slots: Record<string, number> | null;
  pact_slot_level: number | null;
  pact_slot_count: number | null;
  spells: Record<string, string[]> | null;
  is_prepared_caster: boolean;
  prepared_spells: string[] | null;
  class_resources: { name: string; uses: number; die: string; recovery: string }[] | null;
  class_features: { name: string; summary: string }[];
  racial_traits: { name: string; summary: string }[] | null;
  feats: { name: string; summary: string }[] | null;
  equipment: { name: string; qty: number; weight: string; notes: string }[];
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

function parseClassLevel(raw: string): {
  class_name: string;
  level: number;
  subclass: string;
  isMulticlass: boolean;
  primaryClass: string;
  primaryLevel: number;
} {
  const parsed = parseClassLine(raw);
  // Multiclass sheets are stored with the per-class breakdown and the total
  // character level ("Ranger 4 / Rogue 1", level 5). The highest-level class
  // still drives the spell-slot lookup.
  return {
    class_name: parsed.isMulticlass
      ? parsed.classes.map((c) => `${c.name} ${c.level}`).join(' / ')
      : parsed.primaryClass,
    level: parsed.isMulticlass
      ? parsed.classes.reduce((sum, c) => sum + c.level, 0)
      : parsed.primaryLevel,
    subclass: parsed.subclass,
    isMulticlass: parsed.isMulticlass,
    primaryClass: parsed.primaryClass,
    primaryLevel: parsed.primaryLevel,
  };
}

function parseSkills(fields: FormFields): Record<string, number> {
  const skillMap: Record<string, string> = {
    'Acrobatics': 'acrobatics',
    'Animal': 'animal_handling',
    'Arcana': 'arcana',
    'Athletics': 'athletics',
    'Deception': 'deception',
    'History': 'history',
    'Insight': 'insight',
    'Intimidation': 'intimidation',
    'Investigation': 'investigation',
    'Medicine': 'medicine',
    'Nature': 'nature',
    'Perception': 'perception',
    'Performance': 'performance',
    'Persuasion': 'persuasion',
    'Religion': 'religion',
    'SleightofHand': 'sleight_of_hand',
    'Stealth ': 'stealth',
    'Stealth': 'stealth',
    'Survival': 'survival',
  };

  const result: Record<string, number> = {};
  for (const [fieldName, skillKey] of Object.entries(skillMap)) {
    const val = fields[fieldName];
    if (val) {
      result[skillKey] = parseInt2(val);
    }
  }
  return result;
}

// Skill → ability mapping (5e SRD). Used for proficiency inference.
const SKILL_ABILITY: Record<string, 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'> = {
  athletics: 'str',
  acrobatics: 'dex',
  sleight_of_hand: 'dex',
  stealth: 'dex',
  arcana: 'int',
  history: 'int',
  investigation: 'int',
  nature: 'int',
  religion: 'int',
  animal_handling: 'wis',
  insight: 'wis',
  medicine: 'wis',
  perception: 'wis',
  survival: 'wis',
  deception: 'cha',
  intimidation: 'cha',
  performance: 'cha',
  persuasion: 'cha',
};

function inferProficiency(
  totalMod: number,
  abilityMod: number,
  profBonus: number,
): ProficiencyLevel {
  const delta = totalMod - abilityMod;
  // Use thresholds at midpoints to absorb small bonuses (e.g. +1 from feats).
  // expertise = +2*prof; proficient = +1*prof; half = +floor(prof/2)
  if (delta >= profBonus * 2 - Math.floor(profBonus / 2)) return 'expertise';
  if (delta >= profBonus - Math.floor(profBonus / 2)) return 'proficient';
  if (delta >= 1 && profBonus >= 2) return 'half';
  return 'none';
}

function inferSkillProficiencies(
  skillMods: Record<string, number>,
  abilityMods: Record<string, number>,
  profBonus: number,
): Record<string, ProficiencyLevel> {
  const out: Record<string, ProficiencyLevel> = {};
  for (const skill of Object.keys(SKILL_ABILITY)) {
    const ability = SKILL_ABILITY[skill];
    const mod = skillMods[skill];
    if (mod == null) {
      out[skill] = 'none';
      continue;
    }
    out[skill] = inferProficiency(mod, abilityMods[ability] ?? 0, profBonus);
  }
  return out;
}

function inferSaveProficiencies(
  saveMods: Record<string, number>,
  abilityMods: Record<string, number>,
  profBonus: number,
): Record<string, ProficiencyLevel> {
  const out: Record<string, ProficiencyLevel> = {};
  for (const ab of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
    const mod = saveMods[ab];
    if (mod == null) {
      out[ab] = 'none';
      continue;
    }
    // Saves only have none/proficient in 5e (no half, no expertise).
    out[ab] = mod - (abilityMods[ab] ?? 0) >= profBonus - 1 ? 'proficient' : 'none';
  }
  return out;
}

function parseSaves(fields: FormFields): Record<string, number> {
  return {
    str: parseInt2(getField(fields, 'ST Strength')),
    dex: parseInt2(getField(fields, 'ST Dexterity')),
    con: parseInt2(getField(fields, 'ST Constitution')),
    int: parseInt2(getField(fields, 'ST Intelligence')),
    wis: parseInt2(getField(fields, 'ST Wisdom')),
    cha: parseInt2(getField(fields, 'ST Charisma')),
  };
}

function parseAttacks(fields: FormFields): ParsedCharacter['attacks'] {
  const attacks: ParsedCharacter['attacks'] = [];
  for (let i = 1; i <= 8; i++) {
    // Field naming is inconsistent: "Wpn Name", "Wpn Name 2", "Wpn Name 3", etc.
    const nameKey = i === 1 ? 'Wpn Name' : `Wpn Name ${i}`;
    const name = fields[nameKey];
    if (!name) continue;

    // Attack bonus fields have varying trailing spaces
    let atkBonus = '';
    for (const key of Object.keys(fields)) {
      if (key.replace(/\s+/g, '').toLowerCase() === `wpn${i}atkbonus`) {
        atkBonus = fields[key];
        break;
      }
    }

    let damage = '';
    for (const key of Object.keys(fields)) {
      if (key.replace(/\s+/g, '').toLowerCase() === `wpn${i}damage`) {
        damage = fields[key];
        break;
      }
    }

    const notes = fields[`Wpn Notes ${i}`] || fields[`Wpn Notes${i}`] || '';

    // Split damage into value and type
    const dmgMatch = damage.match(/^(.+?)\s+([\w]+)$/);
    const dmgValue = dmgMatch ? dmgMatch[1] : damage;
    const dmgType = dmgMatch ? dmgMatch[2] : '';

    attacks.push({
      name,
      atk_bonus: atkBonus,
      damage: dmgValue,
      damage_type: dmgType,
      range: '',
      notes,
    });
  }
  return attacks;
}

function parseProficiencies(fields: FormFields): {
  armor: Record<string, boolean>;
  weapons: Record<string, boolean>;
  languages: string;
  tools: string;
} {
  const raw = getField(fields, 'ProficienciesLang');
  const armor: Record<string, boolean> = { light: false, medium: false, heavy: false, shields: false };
  const weapons: Record<string, boolean> = { simple: false, martial: false };
  let languages = '';
  let tools = '';

  if (raw) {
    // Split by "=== HEADER ===" pattern, keeping the header name
    const sectionRegex = /===\s*(\w+)\s*===/g;
    const headers: { name: string; start: number }[] = [];
    let match;
    while ((match = sectionRegex.exec(raw)) !== null) {
      headers.push({ name: match[1].toUpperCase(), start: match.index + match[0].length });
    }

    for (let i = 0; i < headers.length; i++) {
      const end = i + 1 < headers.length ? raw.indexOf('===', headers[i].start) : raw.length;
      const content = raw.substring(headers[i].start, end).trim().toLowerCase();
      const name = headers[i].name;

      if (name === 'ARMOR') {
        if (content.includes('light')) armor.light = true;
        if (content.includes('medium')) armor.medium = true;
        if (content.includes('heavy')) armor.heavy = true;
        if (content.includes('shield')) armor.shields = true;
      } else if (name === 'WEAPONS') {
        if (content.includes('simple')) weapons.simple = true;
        if (content.includes('martial')) weapons.martial = true;
      } else if (name === 'LANGUAGES') {
        languages = raw.substring(headers[i].start, end).trim().replace(/\n/g, ' ');
      } else if (name === 'TOOLS') {
        tools = raw.substring(headers[i].start, end).trim().replace(/\n/g, ', ');
      }
    }
  }

  return { armor, weapons, languages, tools };
}

function parseDefenses(fields: FormFields): { resistances: string; immunities: string; conditionImmunities: string } {
  const raw = getField(fields, 'Defenses');
  let resistances = '';
  let immunities = '';
  let conditionImmunities = '';

  if (raw) {
    const lines = raw.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Resistances -')) {
        resistances = trimmed.replace('Resistances -', '').trim();
      } else if (trimmed.startsWith('Immunities -')) {
        const val = trimmed.replace('Immunities -', '').trim();
        // "Magical Sleep" is a condition immunity, not damage
        if (val.toLowerCase().includes('sleep') || val.toLowerCase().includes('charmed') ||
            val.toLowerCase().includes('frightened') || val.toLowerCase().includes('poison')) {
          conditionImmunities = val;
        } else {
          immunities = val;
        }
      }
    }
  }

  return { resistances, immunities, conditionImmunities };
}

// Feature classification: decides how much description to keep.
// "Mechanical" = something the player references mid-turn (preserve full text).
// "Passive" = bookkeeping / always-on senses (one sentence).
// "Excluded" = noise that shouldn't appear on the sheet at all.

const EXCLUDED_NAME_PATTERNS: RegExp[] = [
  /^ability\s+score\s+improvement/i,
  /^proficiency\s+bonus$/i,
  /^proficiencies$/i,
  /^core\s+\w+\s+traits?$/i, // e.g. "Core Warlock Traits"
  /^starting\s+equipment/i,
  /^hit\s+points?$/i,
  /^equipment$/i,
  /^class\s+features?$/i,
  /^species\s+traits?$/i,
  /^age$/i,
  /^size$/i,
  /^creature\s+type$/i,
];

// Any one of these markers in the description means the feature is mid-turn-relevant.
const MECHANICAL_PATTERNS: RegExp[] = [
  /\d+\s*\/\s*(?:long|short)\s*rest/i,            // 3/Long Rest
  /\bper\s+(?:long|short)\s+rest/i,                // "3 luck points per long rest"
  /\b(?:1|one|two|three|\d+)\s+actions?\b/i,       // 1 Action, two actions
  /\bbonus\s+actions?\b/i,
  /\breactions?\b/i,
  /\bonce\s+per\s+(?:turn|round)\b/i,
  /\bd\d+\b/i,                                     // d20, d6, d4 — die without leading digit
  /\d+d\d+/,                                       // 1d6, 4d8
  /\bDC\s*\d+/i,
  /\b(?:saving|ability)\s+throws?\b/i,
  /\b(?:advantage|disadvantage)\s+(?:on|against)\b/i,
  /\b(?:resistance|immunity|immune)\s+to\b/i,
  /\b(?:flying|swimming|climbing|burrow)\s+speed\b/i,
  /\b\d+\s*(?:ft|feet|foot)\b.*\b(?:range|radius|cone|line|cube|sphere)\b/i,
  /\bregain\s+(?:hit\s+points|.*spell\s+slots?|.*pact)/i,
  /\bspell\s+slots?\b/i,
  /\b(?:add|adds|extra|bonus)\b[\s\S]{0,40}\bdamage\b/i,   // "Add CHA mod to ... damage", "extra 3 fire damage"
  /\bspend(?:ing)?\s+\d+/i,                                // "spend 1 luck point"
  /\bregain\s+\d+/i,
];

type FeatureKind = 'mechanical' | 'passive' | 'excluded';

function classifyFeature(name: string, description: string): FeatureKind {
  for (const pat of EXCLUDED_NAME_PATTERNS) {
    if (pat.test(name)) return 'excluded';
  }
  // Header-only entries with no description aren't useful on the sheet.
  if (!description.trim()) return 'excluded';
  for (const pat of MECHANICAL_PATTERNS) {
    if (pat.test(description) || pat.test(name)) return 'mechanical';
  }
  return 'passive';
}

function buildSummary(kind: FeatureKind, description: string): string {
  if (kind === 'excluded') return '';
  const clean = description.replace(/\s+/g, ' ').trim();
  if (kind === 'passive') {
    const firstSentence = clean.match(/^[^.!?]+[.!?]/);
    return (firstSentence ? firstSentence[0] : clean.substring(0, 120)).trim();
  }
  // Mechanical: keep up to ~3 sentences or 320 chars.
  const sentences: string[] = [];
  const sentenceRegex = /[^.!?]+[.!?]+\s*/g;
  let match;
  let charCount = 0;
  while ((match = sentenceRegex.exec(clean)) !== null && sentences.length < 3) {
    const s = match[0].trim();
    if (charCount + s.length > 320 && sentences.length > 0) break;
    sentences.push(s);
    charCount += s.length + 1;
  }
  if (sentences.length === 0) {
    return clean.substring(0, 320).trim();
  }
  return sentences.join(' ').trim();
}

function parseFeatures(fields: FormFields): {
  classFeatures: { name: string; summary: string }[];
  racialTraits: { name: string; summary: string }[];
  feats: { name: string; summary: string }[];
} {
  // Combine all FeaturesTraits fields
  const parts: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const val = fields[`FeaturesTraits${i}`];
    if (val) parts.push(val);
  }
  const fullText = parts.join('\n');

  const classFeatures: { name: string; summary: string }[] = [];
  const racialTraits: { name: string; summary: string }[] = [];
  const feats: { name: string; summary: string }[] = [];

  // Split by sections
  const sections = fullText.split(/===\s*(.+?)\s*===/).filter(Boolean);

  let currentTarget = classFeatures;

  for (let i = 0; i < sections.length; i++) {
    const header = sections[i].trim().toUpperCase();

    if (header.includes('FEATURES')) {
      currentTarget = classFeatures;
      continue;
    } else if (header.includes('SPECIES TRAITS') || header.includes('RACIAL')) {
      currentTarget = racialTraits;
      continue;
    } else if (header.includes('FEATS')) {
      currentTarget = feats;
      continue;
    }

    // Parse features from the content block.
    // Bullets can be "*", "•", or "-" depending on the PDF source.
    const content = sections[i];
    const featureBlocks = content.split(/\n\s*[*•\-]\s+/).filter(Boolean);

    for (const block of featureBlocks) {
      const lines = block.trim().split('\n');
      const firstLine = lines[0]?.trim() || '';

      // The first line often has format: "Feature Name • metadata" or "Feature Name | metadata".
      // Name is before the bullet/pipe; the after-bullet portion ("1/Long Rest" etc.) is mechanical metadata
      // that should be preserved at the start of the description.
      const splitMatch = firstLine.match(/^([^•|]+?)\s*[•|]\s*(.+)$/);
      let name: string;
      let titleMeta = '';
      if (splitMatch) {
        name = splitMatch[1].trim().replace(/^\|\s*/, '');
        titleMeta = splitMatch[2].trim();
      } else {
        name = firstLine.replace(/^\|\s*/, '').trim();
      }
      if (!name || name.length < 2) continue;

      const descLines = lines.slice(1).map((l) => l.trim()).filter(Boolean);
      const fullDesc = (titleMeta ? `(${titleMeta}) ` : '') + descLines.join(' ');

      const kind = classifyFeature(name, fullDesc);
      if (kind === 'excluded') continue;

      const summary = buildSummary(kind, fullDesc);
      currentTarget.push({ name, summary });
    }
  }

  return { classFeatures, racialTraits, feats };
}

function parseEquipment(fields: FormFields): ParsedCharacter['equipment'] {
  const equipment: ParsedCharacter['equipment'] = [];
  for (let i = 0; i <= 30; i++) {
    const name = fields[`Eq Name${i}`];
    if (!name) continue;
    equipment.push({
      name,
      qty: parseInt2(fields[`Eq Qty${i}`], 1),
      weight: fields[`Eq Weight${i}`] || '',
      notes: '',
    });
  }
  return equipment;
}


function parseSpells(fields: FormFields): {
  isSpellcaster: boolean;
  spellcastingAbility: string | null;
} {
  // Spell lists come from parseSpellsFromAnnotations; slots from the class+level lookup.
  const ability = getField(fields, 'spellCastingAbility0');
  return { isSpellcaster: Boolean(ability), spellcastingAbility: ability || null };
}

function parseSpellsFromAnnotations(spellOrder: SpellAnnotation[]): { spells: Record<string, string[]> } {
  const spells: Record<string, string[]> = {};
  let currentLevel = '0';

  // Walk through annotations in PDF order — headers mark level transitions.
  // Slot counts (regular and pact) come from the spell-progression lookup, not the PDF.
  for (const entry of spellOrder) {
    if (entry.type === 'header' && entry.level != null) {
      currentLevel = entry.level;
    } else if (entry.type === 'spell' && entry.name) {
      if (!spells[currentLevel]) spells[currentLevel] = [];
      spells[currentLevel].push(entry.name);
    }
  }

  return { spells };
}

function parseSpeed(raw: string): Record<string, string> {
  const speeds: Record<string, string> = {};
  const parts = raw.split(',').map(s => s.trim());
  for (const part of parts) {
    const match = part.match(/([\d]+\s*ft\.?)\s*\((\w+)\)/i);
    if (match) {
      speeds[match[2].toLowerCase()] = match[1];
    } else if (part.match(/\d+\s*ft/)) {
      speeds['walking'] = part;
    }
  }
  if (Object.keys(speeds).length === 0) {
    speeds['walking'] = raw || '30 ft.';
  }
  return speeds;
}

function parseClassResources(fields: FormFields): { name: string; uses: number; die: string; recovery: string }[] | null {
  const resources: { name: string; uses: number; die: string; recovery: string }[] = [];

  // Check Actions fields for resources with "X / Long Rest" or "X / Short Rest" patterns
  for (let i = 1; i <= 5; i++) {
    const key = `Actions${i}`;
    const val = fields[key];
    if (!val) continue;

    const resourcePattern = /([^•\n]+?):\s*(\d+)\s*\/\s*(Long Rest|Short Rest)/gi;
    let match;
    while ((match = resourcePattern.exec(val)) !== null) {
      resources.push({
        name: match[1].trim(),
        uses: parseInt(match[2]),
        die: '',
        recovery: match[3],
      });
    }
  }

  // Also check features text for resources
  for (let i = 1; i <= 10; i++) {
    const val = fields[`FeaturesTraits${i}`];
    if (!val) continue;

    const resourcePattern = /(\d+)\s*\/\s*(Long Rest|Short Rest)/gi;
    let match;
    while ((match = resourcePattern.exec(val)) !== null) {
      // Try to get the feature name from the line
      const lineStart = val.lastIndexOf('\n', match.index);
      const line = val.substring(lineStart + 1, match.index + match[0].length);
      const nameMatch = line.match(/\|\s*(.+?):/);
      if (nameMatch && !resources.some(r => r.name === nameMatch[1].trim())) {
        resources.push({
          name: nameMatch[1].trim(),
          uses: parseInt(match[1]),
          die: '',
          recovery: match[2],
        });
      }
    }
  }

  return resources.length > 0 ? resources : null;
}


/** Spell headers and names in PDF order — level boundaries come from the headers. */
function spellOrderOf({ fields, order }: PdfFormFields): SpellAnnotation[] {
  const out: SpellAnnotation[] = [];
  for (const name of order) {
    const val = fields[name];
    if (/^spellHeader\d+$/.test(name)) {
      const match = val.match(/(\d+)(?:st|nd|rd|th)/i);
      out.push({ type: 'header', level: val.toUpperCase().includes('CANTRIP') ? '0' : match ? match[1] : '0' });
    } else if (/^spellName\d+$/.test(name)) {
      out.push({ type: 'spell', name: val });
    }
  }
  return out;
}

export function parseDdbCharacter(input: PdfFormFields): ParsedCharacter {
  const { fields } = input;
  const spellOrder = spellOrderOf(input);

  // Parse all sections from form fields
  const classLevel = parseClassLevel(getField(fields, 'CLASS  LEVEL', 'CLASS  LEVEL2'));
  const proficiencies = parseProficiencies(fields);
  const defenses = parseDefenses(fields);
  const features = parseFeatures(fields);
  const spellInfo = parseSpells(fields);

  // Spell-slot lookup overrides anything the PDF says about slot counts.
  // Multiclass: callers pick highest-level class for primary; user verifies in edit view.
  const progression = getSpellProgression(classLevel.primaryClass, classLevel.primaryLevel, classLevel.subclass);
  const isCaster = spellInfo.isSpellcaster || progression.casterType !== 'none';
  const spellList = isCaster ? parseSpellsFromAnnotations(spellOrder).spells : null;

  const classResources = parseClassResources(fields);
  const isPreparedCaster = /cleric|druid|wizard|paladin/i.test(classLevel.primaryClass);

  // Proficiency level (none/half/proficient/expertise) inferred per skill/save
  // by comparing the modifier delta against the proficiency bonus.
  const profBonus = parseInt2(fields['ProfBonus'], 2);
  const skillMods = parseSkills(fields);
  const saveMods = parseSaves(fields);
  const abilityMods: Record<string, number> = {
    str: Math.floor((parseInt2(fields['STR'], 10) - 10) / 2),
    dex: Math.floor((parseInt2(fields['DEX'], 10) - 10) / 2),
    con: Math.floor((parseInt2(fields['CON'], 10) - 10) / 2),
    int: Math.floor((parseInt2(fields['INT'], 10) - 10) / 2),
    wis: Math.floor((parseInt2(fields['WIS'], 10) - 10) / 2),
    cha: Math.floor((parseInt2(fields['CHA'], 10) - 10) / 2),
  };
  const skillProficiencies = inferSkillProficiencies(skillMods, abilityMods, profBonus);
  const saveProficiencies = inferSaveProficiencies(saveMods, abilityMods, profBonus);

  const character: ParsedCharacter = {
    name: getField(fields, 'CharacterName', 'CharacterName2'),
    player_name: getField(fields, 'PLAYER NAME', 'PLAYER NAME2'),
    class_name: classLevel.class_name,
    subclass: classLevel.subclass,
    level: classLevel.level,
    is_multiclass: classLevel.isMulticlass,

    armor_class: parseInt2(fields['AC']),
    ac_source: '',
    initiative_modifier: parseInt2(fields['Init']),
    speeds: parseSpeed(getField(fields, 'Speed')),
    hp_max: parseInt2(fields['MaxHP']),
    hit_dice_total: getField(fields, 'Total'),
    proficiency_bonus: profBonus,

    passive_perception: parseInt2(fields['Passive1'], 10),
    passive_insight: fields['Passive2'] ? parseInt2(fields['Passive2']) : null,
    passive_investigation: fields['Passive3'] ? parseInt2(fields['Passive3']) : null,
    senses: getField(fields, 'AdditionalSenses'),

    str_score: parseInt2(fields['STR'], 10),
    dex_score: parseInt2(fields['DEX'], 10),
    con_score: parseInt2(fields['CON'], 10),
    int_score: parseInt2(fields['INT'], 10),
    wis_score: parseInt2(fields['WIS'], 10),
    cha_score: parseInt2(fields['CHA'], 10),

    skill_modifiers: skillMods,
    save_modifiers: saveMods,
    skill_proficiencies: skillProficiencies,
    save_proficiencies: saveProficiencies,
    attacks: parseAttacks(fields),

    damage_resistances: defenses.resistances,
    damage_immunities: defenses.immunities,
    condition_immunities: defenses.conditionImmunities,

    armor_proficiencies: proficiencies.armor,
    weapon_proficiencies: proficiencies.weapons,
    languages: proficiencies.languages,
    tool_proficiencies: proficiencies.tools,

    is_spellcaster: isCaster,
    spellcasting_ability: spellInfo.spellcastingAbility,
    spell_attack_bonus_override: null,
    spell_save_dc_override: null,
    spell_slots: progression.spellSlots,
    pact_slot_level: progression.pactSlotLevel,
    pact_slot_count: progression.pactSlotCount,
    spells: spellList,
    is_prepared_caster: isPreparedCaster,
    prepared_spells: null,

    class_resources: classResources,
    class_features: features.classFeatures,
    racial_traits: features.racialTraits.length > 0 ? features.racialTraits : null,
    feats: features.feats.length > 0 ? features.feats : null,

    equipment: parseEquipment(fields),

    cp: parseInt2(fields['CP']),
    sp: parseInt2(fields['SP']),
    ep: parseInt2(fields['EP']),
    gp: parseInt2(fields['GP']),
    pp: parseInt2(fields['PP']),
  };

  return character;
}
