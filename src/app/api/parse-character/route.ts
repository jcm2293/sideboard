import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Disable worker for server-side usage
GlobalWorkerOptions.workerSrc = '';

async function extractText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join('\n');
    pages.push(text);
  }
  return pages.join('\n');
}

const ABILITY_NAMES = ['STRENGTH', 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA'] as const;
const ABILITY_SHORT = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

const SKILL_TO_ABILITY: Record<string, string> = {
  'Acrobatics': 'DEX', 'Animal Handling': 'WIS', 'Arcana': 'INT',
  'Athletics': 'STR', 'Deception': 'CHA', 'History': 'INT',
  'Insight': 'WIS', 'Intimidation': 'CHA', 'Investigation': 'INT',
  'Medicine': 'WIS', 'Nature': 'INT', 'Perception': 'WIS',
  'Performance': 'CHA', 'Persuasion': 'CHA', 'Religion': 'INT',
  'Sleight of Hand': 'DEX', 'Stealth': 'DEX', 'Survival': 'WIS',
};

const PREPARED_CASTER_CLASSES = ['Cleric', 'Druid', 'Wizard', 'Paladin'];

const SPELL_LEVEL_LABELS: Record<string, string> = {
  'CANTRIPS': '0',
  '1st LEVEL': '1', '1ST LEVEL': '1',
  '2nd LEVEL': '2', '2ND LEVEL': '2',
  '3rd LEVEL': '3', '3RD LEVEL': '3',
  '4th LEVEL': '4', '4TH LEVEL': '4',
  '5th LEVEL': '5', '5TH LEVEL': '5',
  '6th LEVEL': '6', '6TH LEVEL': '6',
  '7th LEVEL': '7', '7TH LEVEL': '7',
  '8th LEVEL': '8', '8TH LEVEL': '8',
  '9th LEVEL': '9', '9TH LEVEL': '9',
};

function parseSignedNumber(s: string): number | null {
  const m = s.match(/^([+-]?\d+)$/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function findLineIndex(lines: string[], pattern: string | RegExp, startFrom = 0): number {
  for (let i = startFrom; i < lines.length; i++) {
    if (typeof pattern === 'string') {
      if (lines[i] === pattern) return i;
    } else {
      if (pattern.test(lines[i])) return i;
    }
  }
  return -1;
}

function findNearbyNumber(lines: string[], anchorIdx: number, searchRange = 3): number | null {
  // Look before and after the anchor for a plain number
  for (let offset = 1; offset <= searchRange; offset++) {
    for (const dir of [-1, 1]) {
      const idx = anchorIdx + dir * offset;
      if (idx >= 0 && idx < lines.length) {
        const n = parseInt(lines[idx], 10);
        if (!isNaN(n)) return n;
      }
    }
  }
  return null;
}

function extractFirstSentence(text: string, maxLen = 200): string {
  const periodIdx = text.indexOf('.');
  if (periodIdx !== -1 && periodIdx < maxLen) {
    return text.substring(0, periodIdx + 1);
  }
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
}

interface ParsedCharacter {
  name: string;
  player_name: string;
  class_name: string;
  subclass: string;
  level: number;
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
  attacks: { name: string; atk_bonus: number; damage: string; damage_type: string; range: string; notes: string }[];
  damage_resistances: string;
  damage_immunities: string;
  condition_immunities: string;
  armor_proficiencies: Record<string, boolean>;
  weapon_proficiencies: Record<string, boolean>;
  languages: string;
  tool_proficiencies: string;
  is_spellcaster: boolean;
  spell_attack_bonus: number | null;
  spell_save_dc: number | null;
  spellcasting_ability: string | null;
  spell_slots: Record<string, number> | null;
  pact_slot_level: number | null;
  pact_slot_count: number | null;
  spells: Record<string, string[]> | null;
  is_prepared_caster: boolean;
  prepared_spells: null;
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

function getDefaults(): ParsedCharacter {
  return {
    name: '',
    player_name: '',
    class_name: '',
    subclass: '',
    level: 0,
    armor_class: 0,
    ac_source: '',
    initiative_modifier: 0,
    speeds: {},
    hp_max: 0,
    hit_dice_total: '',
    proficiency_bonus: 0,
    passive_perception: 0,
    passive_insight: null,
    passive_investigation: null,
    senses: '',
    str_score: 10,
    dex_score: 10,
    con_score: 10,
    int_score: 10,
    wis_score: 10,
    cha_score: 10,
    skill_modifiers: {},
    save_modifiers: {},
    attacks: [],
    damage_resistances: '',
    damage_immunities: '',
    condition_immunities: '',
    armor_proficiencies: {},
    weapon_proficiencies: {},
    languages: '',
    tool_proficiencies: '',
    is_spellcaster: false,
    spell_attack_bonus: null,
    spell_save_dc: null,
    spellcasting_ability: null,
    spell_slots: null,
    pact_slot_level: null,
    pact_slot_count: null,
    spells: null,
    is_prepared_caster: false,
    prepared_spells: null,
    class_resources: null,
    class_features: [],
    racial_traits: null,
    feats: null,
    equipment: [],
    cp: 0,
    sp: 0,
    ep: 0,
    gp: 0,
    pp: 0,
  };
}

function parseCharacterName(lines: string[], char: ParsedCharacter) {
  const idx = findLineIndex(lines, 'CHARACTER NAME');
  if (idx > 0) {
    char.name = lines[idx - 1];
  }
}

function parseClassAndLevel(lines: string[], char: ParsedCharacter) {
  const idx = findLineIndex(lines, 'CLASS & LEVEL');
  if (idx < 0) return;

  // Class/level line is typically 2 lines before "CLASS & LEVEL"
  // But we also need to handle that PLAYER NAME label follows
  const playerNameIdx = findLineIndex(lines, 'PLAYER NAME');

  // The class line is the first non-label line above CLASS & LEVEL
  for (let i = idx - 1; i >= Math.max(0, idx - 4); i--) {
    const line = lines[i];
    // Match patterns like "Warlock 7" or "Fighter 5 / Warlock 2"
    if (/^[A-Z][a-z]+ \d/.test(line)) {
      const classLine = line;
      // Parse multiclass: "Fighter 5 / Warlock 2"
      const parts = classLine.split(/\s*\/\s*/);
      const classes: string[] = [];
      let totalLevel = 0;
      for (const part of parts) {
        const m = part.match(/^(.+?)\s+(\d+)$/);
        if (m) {
          classes.push(m[1].trim());
          totalLevel += parseInt(m[2], 10);
        }
      }
      char.class_name = classes.join(' / ');
      char.level = totalLevel;
      break;
    }
  }

  // Player name is the line before CLASS & LEVEL that isn't the class line
  // Actually, looking at the structure: player name is the line before "PLAYER NAME"
  if (playerNameIdx > 0) {
    const candidate = lines[playerNameIdx - 1];
    if (candidate !== 'CLASS & LEVEL' && !/^[A-Z][a-z]+ \d/.test(candidate)) {
      char.player_name = candidate;
    }
  }
}

function parseAbilityScores(lines: string[], char: ParsedCharacter) {
  // Strategy: find each ability header (STRENGTH, DEXTERITY, etc.)
  // The score is typically a 2-digit number near it, and the modifier is a signed number
  const scores: Record<string, number> = {};

  for (let ai = 0; ai < ABILITY_NAMES.length; ai++) {
    const abilityUpper = ABILITY_NAMES[ai];
    const abilityShort = ABILITY_SHORT[ai];

    // Find the uppercase header
    const headerIdx = findLineIndex(lines, abilityUpper);
    if (headerIdx < 0) continue;

    // Search nearby lines for a score (2-digit number in 1-30 range, not signed)
    for (let offset = -5; offset <= 5; offset++) {
      const idx = headerIdx + offset;
      if (idx < 0 || idx >= lines.length) continue;
      const val = parseInt(lines[idx], 10);
      if (!isNaN(val) && val >= 1 && val <= 30 && !lines[idx].startsWith('+') && !lines[idx].startsWith('-')) {
        // Make sure this looks like just a number
        if (/^\d+$/.test(lines[idx])) {
          scores[abilityShort] = val;
          break;
        }
      }
    }
  }

  char.str_score = scores.str ?? 10;
  char.dex_score = scores.dex ?? 10;
  char.con_score = scores.con ?? 10;
  char.int_score = scores.int ?? 10;
  char.wis_score = scores.wis ?? 10;
  char.cha_score = scores.cha ?? 10;
}

function parseSavingThrows(lines: string[], char: ParsedCharacter) {
  const idx = findLineIndex(lines, 'Saving Throw Modifiers');
  if (idx < 0) return;

  // The six signed numbers before "Saving Throw Modifiers" are saves in order STR-CHA
  const saves: number[] = [];
  for (let i = idx - 1; i >= 0 && saves.length < 6; i--) {
    const val = parseSignedNumber(lines[i]);
    if (val !== null) {
      saves.unshift(val);
    }
    // Stop searching if we've gone too far back
    if (idx - i > 20) break;
  }

  for (let i = 0; i < ABILITY_SHORT.length; i++) {
    if (i < saves.length) {
      char.save_modifiers[ABILITY_SHORT[i]] = saves[i];
    }
  }
}

function parseSkills(lines: string[], char: ParsedCharacter) {
  // Skills match: +N SkillName ABILITY or -N SkillName ABILITY
  // e.g. "+5 Acrobatics DEX", "+1 Animal Handling WIS"
  const skillPattern = /^([+-]\d+)\s+(.+?)\s+(STR|DEX|CON|INT|WIS|CHA)$/;

  for (const line of lines) {
    const m = line.match(skillPattern);
    if (m) {
      const mod = parseInt(m[1], 10);
      const skillName = m[2];
      // Normalize skill name to lowercase key
      const key = skillName.toLowerCase().replace(/\s+/g, '_');
      char.skill_modifiers[key] = mod;
    }
  }
}

function parseACAndHP(lines: string[], char: ParsedCharacter) {
  // ARMOR CLASS
  const armorIdx = findLineIndex(lines, 'ARMOR');
  if (armorIdx >= 0) {
    // Look for AC number nearby - small number (typically 10-25)
    for (let offset = -4; offset <= 4; offset++) {
      const idx = armorIdx + offset;
      if (idx < 0 || idx >= lines.length) continue;
      const val = parseInt(lines[idx], 10);
      if (!isNaN(val) && val >= 5 && val <= 30 && /^\d+$/.test(lines[idx])) {
        char.armor_class = val;
        break;
      }
    }
  }

  // Max HP
  const hpIdx = findLineIndex(lines, 'Max HP');
  if (hpIdx >= 0) {
    const val = findNearbyNumber(lines, hpIdx, 4);
    if (val !== null && val > 0) {
      char.hp_max = val;
    }
  }

  // Initiative
  const initIdx = findLineIndex(lines, 'INITIATIVE');
  if (initIdx >= 0) {
    for (let offset = -3; offset <= 3; offset++) {
      const idx = initIdx + offset;
      if (idx < 0 || idx >= lines.length) continue;
      const val = parseSignedNumber(lines[idx]);
      if (val !== null) {
        char.initiative_modifier = val;
        break;
      }
    }
  }

  // Proficiency bonus
  // Look for a standalone +N near proficiency-related context
  // It usually appears near skills section as a standalone signed number
  const profIdx = findLineIndex(lines, /proficiency/i);
  if (profIdx >= 0) {
    for (let offset = -3; offset <= 3; offset++) {
      const idx = profIdx + offset;
      if (idx < 0 || idx >= lines.length) continue;
      const val = parseSignedNumber(lines[idx]);
      if (val !== null && val > 0 && val <= 10) {
        char.proficiency_bonus = val;
        break;
      }
    }
  }

  // Hit dice
  const hdIdx = findLineIndex(lines, 'HIT DICE');
  if (hdIdx >= 0) {
    for (let offset = -3; offset <= 3; offset++) {
      const idx = hdIdx + offset;
      if (idx < 0 || idx >= lines.length) continue;
      if (/^\d+d\d+/.test(lines[idx])) {
        char.hit_dice_total = lines[idx];
        break;
      }
    }
  }
}

function parseSpeed(lines: string[], char: ParsedCharacter) {
  // Speed lines: "30 ft. (Walking)", "60 ft. (Flying)"
  const speedPattern = /^(\d+)\s*ft\.\s*\((\w+)\)$/;
  for (const line of lines) {
    const m = line.match(speedPattern);
    if (m) {
      char.speeds[m[2].toLowerCase()] = `${m[1]} ft.`;
    }
  }
}

function parsePassives(lines: string[], char: ParsedCharacter) {
  const passives = [
    { label: 'PASSIVE PERCEPTION', field: 'passive_perception' as const },
    { label: 'PASSIVE INSIGHT', field: 'passive_insight' as const },
    { label: 'PASSIVE INVESTIGATION', field: 'passive_investigation' as const },
  ];

  for (const p of passives) {
    const idx = findLineIndex(lines, p.label);
    if (idx >= 0) {
      const val = findNearbyNumber(lines, idx, 3);
      if (val !== null) {
        (char as unknown as Record<string, unknown>)[p.field] = val;
      }
    }
  }
}

function parseSenses(lines: string[], char: ParsedCharacter) {
  const sensesIdx = findLineIndex(lines, 'SENSES');
  if (sensesIdx < 0) return;

  const senseLines: string[] = [];
  for (let i = sensesIdx - 1; i >= Math.max(0, sensesIdx - 5); i--) {
    if (/darkvision|blindsight|tremorsense|truesight/i.test(lines[i])) {
      senseLines.unshift(lines[i]);
    }
  }
  char.senses = senseLines.join(', ');
}

function parseDefenses(lines: string[], char: ParsedCharacter) {
  for (const line of lines) {
    if (line.startsWith('Resistances -')) {
      char.damage_resistances = line.replace('Resistances -', '').trim();
    }
    if (line.startsWith('Immunities -')) {
      // Distinguish damage vs condition immunities
      const val = line.replace('Immunities -', '').trim();
      // "Magical Sleep" is a condition immunity; elemental types are damage immunities
      const damageTypes = ['acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder', 'bludgeoning', 'piercing', 'slashing'];
      const isDamage = damageTypes.some(t => val.toLowerCase().includes(t));
      if (isDamage) {
        char.damage_immunities = val;
      } else {
        char.condition_immunities = val;
      }
    }
  }
}

function parseProficiencies(lines: string[], char: ParsedCharacter) {
  // Armor proficiencies
  const armorSecIdx = findLineIndex(lines, '=== ARMOR ===');
  if (armorSecIdx >= 0) {
    for (let i = armorSecIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('===')) break;
      const armor = lines[i].toLowerCase();
      if (armor.includes('light')) char.armor_proficiencies.light = true;
      if (armor.includes('medium')) char.armor_proficiencies.medium = true;
      if (armor.includes('heavy')) char.armor_proficiencies.heavy = true;
      if (armor.includes('shield')) char.armor_proficiencies.shields = true;
    }
  }

  // Weapon proficiencies
  const weapSecIdx = findLineIndex(lines, '=== WEAPONS ===');
  if (weapSecIdx >= 0) {
    for (let i = weapSecIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('===')) break;
      const wep = lines[i].toLowerCase();
      if (wep.includes('simple')) char.weapon_proficiencies.simple = true;
      if (wep.includes('martial')) char.weapon_proficiencies.martial = true;
      // Specific weapons
      if (!wep.includes('simple') && !wep.includes('martial')) {
        char.weapon_proficiencies[lines[i].trim()] = true;
      }
    }
  }

  // Languages
  const langSecIdx = findLineIndex(lines, '=== LANGUAGES ===');
  if (langSecIdx >= 0) {
    const langLines: string[] = [];
    for (let i = langSecIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('===') || /^\d+ ft\./.test(lines[i])) break;
      langLines.push(lines[i]);
    }
    char.languages = langLines.join(', ');
  }

  // Tool proficiencies
  const toolSecIdx = findLineIndex(lines, '=== TOOLS ===');
  if (toolSecIdx >= 0) {
    const toolLines: string[] = [];
    for (let i = toolSecIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('===')) break;
      toolLines.push(lines[i]);
    }
    char.tool_proficiencies = toolLines.join(', ');
  }
}

function parseAttacks(lines: string[], char: ParsedCharacter) {
  // Look for attack lines: "Name  +N  DamageDice Type  notes"
  // These appear after attack table headers
  const atkPattern = /^(.+?)\s{2,}([+-]\d+)\s{2,}(\S+)\s+(\w+)(?:\s{2,}(.+))?$/;

  // Also try tab-separated or simpler patterns
  const atkSimple = /^(.+?)\t+([+-]\d+)\t+(.+?)\t+(.+?)(?:\t+(.+))?$/;

  for (const line of lines) {
    // Skip header lines
    if (/^NAME\s/i.test(line) || /^WEAPON ATTACKS/i.test(line)) continue;

    let m = line.match(atkPattern) || line.match(atkSimple);
    if (m) {
      const name = m[1].trim();
      const atkBonus = parseInt(m[2], 10);
      let damage = m[3].trim();
      let damageType = m[4]?.trim() ?? '';

      // Sometimes damage and type are combined like "1d6+1 Piercing"
      const dmgMatch = damage.match(/^(\S+)\s+(\w+)$/);
      if (dmgMatch) {
        damage = dmgMatch[1];
        damageType = dmgMatch[2];
      }

      const notes = m[5]?.trim() ?? '';

      // Validate: name shouldn't be a known section header
      if (name && !isNaN(atkBonus) && /\d+d\d+/.test(damage)) {
        char.attacks.push({
          name,
          atk_bonus: atkBonus,
          damage,
          damage_type: damageType,
          range: '',
          notes,
        });
      }
    }
  }

  // Fallback: try line-by-line pattern for D&D Beyond format
  // "Frostburn Spear    +4    1d6+1 Piercing    notes..."
  if (char.attacks.length === 0) {
    const atkFlexible = /^([A-Z][A-Za-z\s']+?)\s{2,}([+-]\d+)\s{2,}(\d+d\d+(?:[+-]\d+)?)\s+([A-Za-z]+)(?:\s{2,}(.+))?$/;
    for (const line of lines) {
      const m = line.match(atkFlexible);
      if (m) {
        char.attacks.push({
          name: m[1].trim(),
          atk_bonus: parseInt(m[2], 10),
          damage: m[3].trim(),
          damage_type: m[4].trim(),
          range: '',
          notes: m[5]?.trim() ?? '',
        });
      }
    }
  }
}

function parseFeatures(lines: string[], char: ParsedCharacter) {
  // Class features: === WARLOCK FEATURES ===, === FIGHTER FEATURES ===, etc.
  // Racial traits: === HIGH HALF-ELF SPECIES TRAITS ===
  // Feats: === FEATS ===

  type FeatureEntry = { name: string; summary: string };

  function extractFeaturesFromSection(startIdx: number, endIdx: number): FeatureEntry[] {
    const features: FeatureEntry[] = [];
    let currentName = '';
    let currentDesc: string[] = [];

    const flush = () => {
      if (currentName) {
        features.push({
          name: currentName,
          summary: extractFirstSentence(currentDesc.join(' ').trim()),
        });
      }
    };

    for (let i = startIdx; i < endIdx && i < lines.length; i++) {
      const line = lines[i];
      // Feature start: "* Feature Name • source" or "| Sub-feature Name • source"
      const featureMatch = line.match(/^[*|]\s+(.+?)(?:\s+[•·]\s+.+)?$/);
      if (featureMatch) {
        flush();
        currentName = featureMatch[1].trim();
        currentDesc = [];
      } else if (currentName && line && !line.startsWith('===')) {
        currentDesc.push(line);
      }
    }
    flush();
    return features;
  }

  // Find class features
  for (let i = 0; i < lines.length; i++) {
    const classFeatureMatch = lines[i].match(/^=== (.+?) FEATURES ===$/);
    if (classFeatureMatch) {
      // Find end of section (next === or end)
      let endIdx = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith('===')) {
          endIdx = j;
          break;
        }
      }
      char.class_features.push(...extractFeaturesFromSection(i + 1, endIdx));
    }

    // Racial/species traits
    const racialMatch = lines[i].match(/^=== (.+?) SPECIES TRAITS ===$/);
    if (racialMatch) {
      let endIdx = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith('===')) {
          endIdx = j;
          break;
        }
      }
      char.racial_traits = extractFeaturesFromSection(i + 1, endIdx);
    }

    // Feats
    if (lines[i] === '=== FEATS ===') {
      let endIdx = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith('===')) {
          endIdx = j;
          break;
        }
      }
      char.feats = extractFeaturesFromSection(i + 1, endIdx);
    }
  }
}

function parseCurrency(lines: string[], char: ParsedCharacter) {
  // Look for "CP    SP    EP    GP    PP" header, values on next line
  for (let i = 0; i < lines.length; i++) {
    if (/^CP\s+SP\s+EP\s+GP\s+PP$/i.test(lines[i]) && i + 1 < lines.length) {
      const vals = lines[i + 1].split(/\s+/).map(v => parseInt(v, 10));
      if (vals.length >= 5) {
        char.cp = vals[0] || 0;
        char.sp = vals[1] || 0;
        char.ep = vals[2] || 0;
        char.gp = vals[3] || 0;
        char.pp = vals[4] || 0;
      }
      break;
    }
  }
}

function parseEquipment(lines: string[], char: ParsedCharacter) {
  // Look for equipment header "NAME    QTY    WEIGHT"
  for (let i = 0; i < lines.length; i++) {
    if (/^NAME\s+QTY\s+WEIGHT$/i.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j];
        // Stop at next section
        if (line.startsWith('===') || /^(CP|NAME)\s/i.test(line)) break;

        // Match "ItemName  N  Weight"
        const m = line.match(/^(.+?)\s{2,}(\d+)\s{2,}(.+)$/);
        if (m) {
          char.equipment.push({
            name: m[1].trim(),
            qty: parseInt(m[2], 10) || 1,
            weight: m[3].trim(),
            notes: '',
          });
        }
      }
      break;
    }
  }
}

function parseSpells(lines: string[], char: ParsedCharacter) {
  // Spellcasting ability, save DC, attack bonus
  const scAbilIdx = findLineIndex(lines, 'SPELLCASTING ABILITY');
  if (scAbilIdx < 0) return; // Not a caster

  char.is_spellcaster = true;

  // Spellcasting ability is a short label (CHA, INT, WIS) near the header
  for (let offset = -3; offset <= 0; offset++) {
    const idx = scAbilIdx + offset;
    if (idx < 0) continue;
    if (/^(CHA|INT|WIS|STR|DEX|CON)$/i.test(lines[idx])) {
      char.spellcasting_ability = lines[idx].toUpperCase();
      break;
    }
  }

  // Spell save DC
  const dcIdx = findLineIndex(lines, 'SPELL SAVE DC');
  if (dcIdx >= 0) {
    for (let offset = -3; offset <= 0; offset++) {
      const idx = dcIdx + offset;
      if (idx < 0) continue;
      const val = parseInt(lines[idx], 10);
      if (!isNaN(val) && val >= 8 && val <= 30 && /^\d+$/.test(lines[idx])) {
        char.spell_save_dc = val;
        break;
      }
    }
  }

  // Spell attack bonus
  const atkIdx = findLineIndex(lines, 'SPELL ATTACK BONUS');
  if (atkIdx >= 0) {
    for (let offset = -3; offset <= 0; offset++) {
      const idx = atkIdx + offset;
      if (idx < 0) continue;
      const val = parseSignedNumber(lines[idx]);
      if (val !== null) {
        char.spell_attack_bonus = val;
        break;
      }
    }
  }

  // Parse spell lists by level sections
  const spells: Record<string, string[]> = {};
  let currentLevel: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for level headers: "=== CANTRIPS ===" or "=== 1st LEVEL ==="
    const levelMatch = line.match(/^=== (.+?) ===$/);
    if (levelMatch) {
      const label = levelMatch[1].trim();
      const mappedLevel = SPELL_LEVEL_LABELS[label] ?? SPELL_LEVEL_LABELS[label.toUpperCase()];
      if (mappedLevel !== undefined) {
        currentLevel = mappedLevel;
        if (!spells[currentLevel]) spells[currentLevel] = [];
        continue;
      } else {
        // Non-spell section header, stop collecting spells
        currentLevel = null;
        continue;
      }
    }

    // Collect spells under current level
    if (currentLevel !== null) {
      // Skip meta lines
      if (/^\(At Will\)$/i.test(line)) continue;
      if (/^\(Pact Magic\)$/i.test(line)) continue;
      if (/^(O|●|○)\s*/.test(line)) {
        // Strip checkbox markers
        const spellName = line.replace(/^(O|●|○)\s*/, '').trim();
        if (spellName) spells[currentLevel].push(spellName);
        continue;
      }
      // Plain spell name line (capital letter start, no special patterns)
      if (/^[A-Z]/.test(line) && !line.startsWith('===') && line.length < 60) {
        spells[currentLevel].push(line);
      }
    }
  }

  if (Object.keys(spells).length > 0) {
    char.spells = spells;
  }

  // Detect prepared caster
  const className = char.class_name.toLowerCase();
  char.is_prepared_caster = PREPARED_CASTER_CLASSES.some(c => className.includes(c.toLowerCase()));

  // Detect warlock pact magic
  if (className.includes('warlock')) {
    // Find the highest non-cantrip spell level in the warlock's list
    const spellLevels = Object.keys(spells)
      .map(Number)
      .filter(l => l > 0)
      .sort((a, b) => b - a);

    if (spellLevels.length > 0) {
      char.pact_slot_level = spellLevels[0];

      // Pact slot count by warlock level: approximate
      // Level 1: 1 slot, 2: 2, 3-10: 2, 11-16: 3, 17+: 4
      const warlockLevel = char.level; // Simplified; multiclass would need refinement
      if (warlockLevel >= 17) char.pact_slot_count = 4;
      else if (warlockLevel >= 11) char.pact_slot_count = 3;
      else if (warlockLevel >= 2) char.pact_slot_count = 2;
      else char.pact_slot_count = 1;
    }
  }

  // Build spell_slots for non-warlock casters (standard slot progression)
  // For now, extract from PDF if available; otherwise leave null
  // D&D Beyond PDFs don't always include slot counts explicitly
  if (!className.includes('warlock') && char.spells) {
    const slots: Record<string, number> = {};
    // Use standard 5e slot table based on level for full casters
    const fullCasterSlots: Record<number, number[]> = {
      1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2],
      6: [4, 3, 3], 7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1],
      10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1],
      13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
      15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1],
      17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
      19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
    };
    const slotArr = fullCasterSlots[char.level];
    if (slotArr) {
      for (let i = 0; i < slotArr.length; i++) {
        slots[String(i + 1)] = slotArr[i];
      }
      char.spell_slots = slots;
    }
  }
}

function parseSpecies(lines: string[], char: ParsedCharacter) {
  // Species is typically after PLAYER NAME section, before ARMOR CLASS area
  // Look for the line before species-related labels
  // In D&D Beyond: appears after player name, before AC/HP
  // The spec says species line appears after PLAYER NAME
  const playerNameIdx = findLineIndex(lines, 'PLAYER NAME');
  if (playerNameIdx >= 0) {
    // Species is typically the next non-empty, non-header line after PLAYER NAME
    for (let i = playerNameIdx + 1; i < Math.min(playerNameIdx + 5, lines.length); i++) {
      const line = lines[i];
      if (line && !line.startsWith('===') && !/^[A-Z\s]+$/.test(line) && !/^[+-]?\d+$/.test(line)) {
        // This is likely the species line - we don't have a field for it but it's used elsewhere
        break;
      }
    }
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buffer);
    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);

    const char = getDefaults();

    // Parse each section independently so one failure doesn't break everything
    const sections = [
      () => parseCharacterName(lines, char),
      () => parseClassAndLevel(lines, char),
      () => parseAbilityScores(lines, char),
      () => parseSavingThrows(lines, char),
      () => parseSkills(lines, char),
      () => parseACAndHP(lines, char),
      () => parseSpeed(lines, char),
      () => parsePassives(lines, char),
      () => parseSenses(lines, char),
      () => parseDefenses(lines, char),
      () => parseProficiencies(lines, char),
      () => parseAttacks(lines, char),
      () => parseFeatures(lines, char),
      () => parseCurrency(lines, char),
      () => parseEquipment(lines, char),
      () => parseSpells(lines, char),
      () => parseSpecies(lines, char),
    ];

    const errors: string[] = [];
    for (const section of sections) {
      try {
        section();
      } catch (e) {
        errors.push(`${section.name || 'unknown'}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return Response.json({
      character: char,
      raw_text: text,
      ...(errors.length > 0 ? { parse_warnings: errors } : {}),
    });
  } catch (e) {
    return Response.json(
      { error: `Failed to parse PDF: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
