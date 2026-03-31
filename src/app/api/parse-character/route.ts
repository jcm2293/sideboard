import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'path';

// Point worker to actual file for server-side usage
GlobalWorkerOptions.workerSrc = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

interface FormFields {
  [key: string]: string;
}

interface SpellAnnotation {
  type: 'header' | 'spell';
  level?: string;
  name?: string;
}

async function extractFormFields(buffer: Buffer): Promise<{ fields: FormFields; textByPage: string[]; spellOrder: SpellAnnotation[] }> {
  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const fields: FormFields = {};
  const textByPage: string[] = [];
  const spellOrder: SpellAnnotation[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);

    // Extract form field annotations (where D&D Beyond stores all values)
    const annotations = await page.getAnnotations();
    for (const a of annotations) {
      if (a.fieldName && a.fieldValue != null) {
        const val = a.fieldValue.toString().trim();
        if (val && val !== 'Off') {
          fields[a.fieldName.trim()] = val;
        }

        // Track spell annotation order for level grouping
        const fn = a.fieldName.trim();
        if (fn.match(/^spellHeader\d+$/) && val) {
          const match = val.match(/(\d+)(?:st|nd|rd|th)/i);
          const level = val.toUpperCase().includes('CANTRIP') ? '0' : (match ? match[1] : '0');
          spellOrder.push({ type: 'header', level });
        } else if (fn.match(/^spellName\d+$/) && val) {
          spellOrder.push({ type: 'spell', name: val });
        }
      }
    }

    // Also extract text content as fallback
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join('\n');
    textByPage.push(text);
  }

  return { fields, textByPage, spellOrder };
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
  attacks: { name: string; atk_bonus: string; damage: string; damage_type: string; range: string; notes: string }[];
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

function parseClassLevel(raw: string): { class_name: string; level: number; subclass: string } {
  // "Warlock 7" or "Fighter 5 / Warlock 2"
  const match = raw.match(/^(.+?)\s+(\d+)/);
  if (match) {
    return { class_name: match[1].trim(), level: parseInt(match[2], 10), subclass: '' };
  }
  return { class_name: raw, level: 1, subclass: '' };
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

    // Parse features from the content block
    const content = sections[i];
    const featureBlocks = content.split(/\n\s*\*\s+/).filter(Boolean);

    for (const block of featureBlocks) {
      const lines = block.trim().split('\n');
      const firstLine = lines[0]?.trim() || '';

      // Extract feature name (before • or end of line)
      const nameMatch = firstLine.match(/^([^•]+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim().replace(/^\|\s*/, '');
      if (!name || name.length < 2) continue;

      // Extract summary: first sentence of description
      const descLines = lines.slice(1).map(l => l.trim()).filter(Boolean);
      let summary = '';
      if (descLines.length > 0) {
        const fullDesc = descLines.join(' ');
        const firstSentence = fullDesc.match(/^[^.!]+[.!]/);
        summary = firstSentence ? firstSentence[0].trim() : fullDesc.substring(0, 120);
      }

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
  spellAttackBonus: number | null;
  spellSaveDC: number | null;
  spellcastingAbility: string | null;
  spells: Record<string, string[]> | null;
  pactSlotLevel: number | null;
  pactSlotCount: number | null;
} {
  const ability = getField(fields, 'spellCastingAbility0');
  if (!ability) {
    return {
      isSpellcaster: false, spellAttackBonus: null, spellSaveDC: null,
      spellcastingAbility: null, spells: null, pactSlotLevel: null, pactSlotCount: null,
    };
  }

  const spellAttackBonus = parseInt2(getField(fields, 'spellAtkBonus0'));
  const spellSaveDC = parseInt2(getField(fields, 'spellSaveDC0'));

  // Parse spell headers to determine level boundaries
  const headers: { index: number; level: string }[] = [];
  for (let i = 0; i <= 20; i++) {
    const header = fields[`spellHeader${i}`];
    if (header) {
      const match = header.match(/(\d+)(?:st|nd|rd|th)/i);
      const level = header.toUpperCase().includes('CANTRIP') ? '0' : (match ? match[1] : '0');
      headers.push({ index: i, level });
    }
  }

  // Collect all spell names, grouped by level
  const spells: Record<string, string[]> = {};
  let currentLevel = '0';

  for (let i = 0; i <= 50; i++) {
    // Check if this index has a header that changes the level
    const headerAtI = headers.find(h => {
      // Header N appears before spell N+headerOffset
      // We need to check spellHeader fields and their relation to spell indices
      return false; // We'll use a different approach
    });

    // Check all headers
    for (const h of headers) {
      const hKey = `spellHeader${h.index}`;
      if (fields[hKey]) {
        // Find the first spell index after this header
        // Headers use a separate index, so we track by sequential appearance
      }
    }

    const name = fields[`spellName${i}`];
    if (!name) continue;

    // Determine level from surrounding headers
    // Each spellHeader field marks the start of a new level section
    // We find which header comes just before this spell index
    for (const h of headers) {
      // The header index in the spellHeader numbering corresponds roughly to
      // position in the spell list. We check if any headerN exists where N <= i
      // Actually, headers use their own index. Let's just track by the sequential order.
    }

    if (!spells[currentLevel]) spells[currentLevel] = [];
    spells[currentLevel].push(name);
  }

  // Better approach: parse spells using headers as markers
  // Reset and use header indices to determine boundaries
  const spellsByLevel: Record<string, string[]> = {};
  let currentLvl = '0';

  // Build a map of header index → level
  const headerMap: Record<number, string> = {};
  for (let i = 0; i <= 20; i++) {
    const header = fields[`spellHeader${i}`];
    if (header) {
      const match = header.match(/(\d+)(?:st|nd|rd|th)/i);
      const level = header.toUpperCase().includes('CANTRIP') ? '0' : (match ? match[1] : '0');
      headerMap[i] = level;
    }
  }

  // Headers appear interleaved with spells. spellHeader0 = cantrips, then spells 0..N,
  // spellHeader1 = 1st level, then spells N+1..M, etc.
  // The key insight: spellHeader indices tell us the spell index where a new level starts.

  // From the data, spellHeader0 appears before spellName0,
  // spellHeader1 appears after the last cantrip and before first 1st-level spell.
  // But they use separate numbering from spells.

  // Simpler: just iterate all spell names and track which header we've passed
  let headerIdx = 0;
  const sortedHeaders = Object.entries(headerMap).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  // We need to figure out at what spell index each header appears.
  // From the real data: headers and spells are interleaved in the PDF's annotation order.
  // Let's collect all fields in order and track transitions.

  // Collect all annotation field names that start with spell
  const spellEntries: { type: 'header' | 'spell'; level?: string; name?: string }[] = [];

  // Iterate through possible indices and collect in order
  for (let i = 0; i <= 50; i++) {
    const header = fields[`spellHeader${headerIdx}`];
    if (header) {
      // Check if this header "belongs" at this point
      // Headers use sequential numbering: 0, 1, 2, 3...
      // Spells also use sequential numbering: 0, 1, 2, ...
      // We can't directly correlate them by index.
    }

    const name = fields[`spellName${i}`];
    if (name) {
      spellEntries.push({ type: 'spell', name });
    }
  }

  // Most reliable: use the slot headers to map spell indices to levels.
  // From real data we know:
  // spellHeader0 = "=== CANTRIPS ===" (cantrips start at spellName0)
  // spellHeader1 = "=== 1st LEVEL ===" (1st level starts after cantrips)
  // spellHeader2 = "=== 2nd LEVEL ===" etc.

  // But we need to know WHERE in the spell sequence each header appears.
  // The order in the PDF annotations is: header0, spell0..spell6, header1, spell7..spell12, etc.
  // Since annotations are ordered, and headers have their own index, we can look at the
  // spellSlotHeader fields to find counts, or just detect gaps by the spell indices.

  // Alternative: Look at the slot headers which might tell us counts
  // spellSlotHeader0 = "(At Will)" for cantrips

  // Simplest reliable approach: Count cantrips by looking at which spells don't have a level header,
  // then use level transitions from spellHeader fields.

  // Actually, the most robust method from the actual field data:
  // We know spellHeader0/1/2/3 mark cantrips/1st/2nd/3rd.
  // We also know spells are numbered sequentially.
  // From real data: cantrips = spellName0-6 (7 cantrips), 1st = spellName7-12 (6 spells),
  // 2nd = spellName13-16 (4 spells), 3rd = spellName17-18 (2 spells).

  // We need the boundary indices. Let's reconstruct from the data patterns:
  // The header annotations appear BETWEEN spells in the PDF. We can detect this by
  // looking at all fields and building an ordered list.

  // Final approach: just track which level each spell belongs to by checking
  // if there's a header that appears at a certain boundary. We can detect boundaries
  // by tracking the spellHeader sequential index and matching it to a running spell count.

  // Let's use a different, simpler approach:
  // Collect all spells, then split them into levels based on header count
  const allSpells: string[] = [];
  for (let i = 0; i <= 50; i++) {
    const name = fields[`spellName${i}`];
    if (name) allSpells.push(name);
    else if (i > 0 && !fields[`spellName${i}`]) {
      // Check a few more in case of gaps
      if (!fields[`spellName${i + 1}`] && !fields[`spellName${i + 2}`]) break;
    }
  }

  // Now assign spells to levels using headers as dividers
  // We'll re-scan the fields looking for the annotation order
  const orderedEntries: { type: 'header' | 'spell'; value: string }[] = [];

  // Build a combined list by iterating through all possible indices
  // and checking which fields exist at each index
  let spellIdx = 0;
  let hdrIdx = 0;
  let spellsProcessed = 0;

  // The trick: header indices and spell indices are independent.
  // But headers appear between spell groups in the PDF.
  // spellHeader0 comes before spellName0.
  // After the last cantrip, spellHeader1 comes before the first 1st-level spell.

  // Since we can't reliably determine the order from indices alone,
  // let's use the pdftotext output which preserved the order correctly.
  // Actually, the simplest reliable approach: parse the count of spells per level
  // by looking at spellSlotHeader fields (e.g., "(At Will)", "2 Slots", etc.)

  // OR: we can just use the total spell count per header.
  // Let's check what slot info is available
  const slotHeaders: { idx: number; text: string }[] = [];
  for (let i = 0; i <= 20; i++) {
    const sh = fields[`spellSlotHeader${i}`];
    if (sh) slotHeaders.push({ idx: i, text: sh });
  }

  // For warlocks, all slots are "pact slots" at the same level
  // Detect warlock pact magic
  const castingClass = getField(fields, 'spellCastingClass0').toLowerCase();
  const isWarlock = castingClass.includes('warlock');

  // Build level boundaries from headers
  // We'll iterate spells and headers in parallel:
  // The Nth header corresponds to the spell index where that level starts.
  // We can determine this by checking: for each header index h,
  // spellSlotHeader h appears BETWEEN two spell groups.

  // Since we have real data showing the exact spell indices per level,
  // let's build a level assignment by using a scan approach:
  const levelAssignment: string[] = [];
  currentLvl = '0';

  // Track which spells belong to which level using sorted header positions
  // Key insight from real data: headers and spells share a global annotation index
  // The order in the annotation list determines the boundary.

  // We'll reconstruct by scanning the `fields` object for any key matching
  // spellHeader or spellName patterns and noting their global order.
  const allSpellFields: { key: string; globalIdx: number; type: 'header' | 'name'; localIdx: number }[] = [];

  // Extract all spell-related field names with their local indices
  for (const key of Object.keys(fields)) {
    const headerMatch = key.match(/^spellHeader(\d+)$/);
    if (headerMatch) {
      allSpellFields.push({ key, globalIdx: 0, type: 'header', localIdx: parseInt(headerMatch[1]) });
    }
    const nameMatch = key.match(/^spellName(\d+)$/);
    if (nameMatch) {
      allSpellFields.push({ key, globalIdx: 0, type: 'name', localIdx: parseInt(nameMatch[1]) });
    }
  }

  // From the real data analysis, we know that:
  // - Headers use indices 0, 1, 2, 3... for cantrips, 1st, 2nd, 3rd...
  // - Spells use indices 0, 1, 2, ... sequentially across all levels
  // - The boundary between levels is at the spell index where the next header appears
  //
  // The annotation order in the PDF is:
  //   spellHeader0, spellName0..spellName6, spellHeader1, spellName7..., etc.
  //
  // Since we can't get annotation order from the fields dict,
  // we need another way. The most reliable: use spellSlotHeader to count spells per level,
  // or just scan for the pattern where spellName indices reset or headers appear.
  //
  // ACTUALLY - simplest approach that works:
  // The annotations from pdfjs come in PDF order. Let me just iterate through the
  // raw annotation array and track the order.

  // Since this is an API route, we have access to the full PDF.
  // Let's use a stateful approach: we already extracted text by page.
  // The spells are all on one page. Let's parse the text-extracted content
  // from the spells page to get the order.

  // Or even simpler: we know the text from pdftotext preserved the order with
  // "=== CANTRIPS ===", "=== 1st LEVEL ===" etc. markers.
  // The fullText from the features/text pages had these markers too.
  // But in this function we don't have access to the text.

  // PRAGMATIC SOLUTION: Use the sequential spell name indices and
  // infer level boundaries from the known header positions.
  // Since D&D Beyond consistently numbers spells sequentially and
  // we know which header corresponds to which level, we can look at
  // the header-to-spell mapping by checking if a spellName index
  // appears right after a header transition.

  // After much analysis, the simplest reliable approach:
  // Read all headers in order to get level sequence, then partition spells
  // We know there are N headers for N levels that have spells.
  // The spell count per level isn't directly encoded, but we CAN compute it:
  //
  // Total spells = allSpells.length
  // Number of level groups = sortedHeaders.length
  //
  // Without boundary info, just assign based on text content matching.
  // OR: for each spell, check if it appears in a specific level by looking at
  // the spell's actual level in the SRD data.
  //
  // BEST APPROACH: read the actual annotations in order from the PDF page.
  // We already have extractFormFields but it doesn't preserve order.
  // Let me just return the fields plus the annotations in order.

  // For now, use a heuristic: we know headers 0,1,2,3... correspond to
  // cantrips, 1st, 2nd, 3rd... The total spells are sequential.
  // We need to know at which spell index each level starts.
  // We CAN determine this because we saved ALL fields including spellSlotHeader.
  // spellSlotHeader0 = "(At Will)" → cantrips
  // The spell page also has slot count info we might use.

  // FINAL PRAGMATIC APPROACH:
  // Parse the full text that pdftotext gave us (which DID preserve the order with
  // === CANTRIPS ===, === 1st LEVEL === markers between spell names).
  // We'll pass textByPage to this function and parse from there.

  return {
    isSpellcaster: true,
    spellAttackBonus,
    spellSaveDC,
    spellcastingAbility: ability,
    spells: null, // Will be filled by parseSpellsFromText
    pactSlotLevel: null,
    pactSlotCount: null,
  };
}

function parseSpellsFromAnnotations(spellOrder: SpellAnnotation[], fields: FormFields): {
  spells: Record<string, string[]>;
  pactSlotLevel: number | null;
  pactSlotCount: number | null;
} {
  const spells: Record<string, string[]> = {};
  let currentLevel = '0';

  // Walk through annotations in PDF order — headers mark level transitions
  for (const entry of spellOrder) {
    if (entry.type === 'header' && entry.level != null) {
      currentLevel = entry.level;
    } else if (entry.type === 'spell' && entry.name) {
      if (!spells[currentLevel]) spells[currentLevel] = [];
      spells[currentLevel].push(entry.name);
    }
  }

  // Detect warlock pact slots
  let pactSlotLevel: number | null = null;
  let pactSlotCount: number | null = null;
  const castingClass = getField(fields, 'spellCastingClass0').toLowerCase();
  if (castingClass.includes('warlock')) {
    const level = parseInt2(getField(fields, 'CLASS  LEVEL').match(/\d+/)?.[0] || '1');
    if (level >= 9) { pactSlotLevel = 5; pactSlotCount = 2; }
    else if (level >= 7) { pactSlotLevel = 4; pactSlotCount = 2; }
    else if (level >= 5) { pactSlotLevel = 3; pactSlotCount = 2; }
    else if (level >= 3) { pactSlotLevel = 2; pactSlotCount = 2; }
    else if (level >= 2) { pactSlotLevel = 1; pactSlotCount = 2; }
    else { pactSlotLevel = 1; pactSlotCount = 1; }
    if (level >= 17) pactSlotCount = 4;
    else if (level >= 11) pactSlotCount = 3;
  }

  return { spells, pactSlotLevel, pactSlotCount };
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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { fields, spellOrder } = await extractFormFields(buffer);

    // Parse all sections from form fields
    const classLevel = parseClassLevel(getField(fields, 'CLASS  LEVEL', 'CLASS  LEVEL2'));
    const proficiencies = parseProficiencies(fields);
    const defenses = parseDefenses(fields);
    const features = parseFeatures(fields);
    const spellInfo = parseSpells(fields);
    const spellsFromAnnotations = spellInfo.isSpellcaster ? parseSpellsFromAnnotations(spellOrder, fields) : null;
    const classResources = parseClassResources(fields);
    const isPreparedCaster = /cleric|druid|wizard|paladin/i.test(classLevel.class_name);

    const character: ParsedCharacter = {
      name: getField(fields, 'CharacterName', 'CharacterName2'),
      player_name: getField(fields, 'PLAYER NAME', 'PLAYER NAME2'),
      class_name: classLevel.class_name,
      subclass: classLevel.subclass,
      level: classLevel.level,

      armor_class: parseInt2(fields['AC']),
      ac_source: '',
      initiative_modifier: parseInt2(fields['Init']),
      speeds: parseSpeed(getField(fields, 'Speed')),
      hp_max: parseInt2(fields['MaxHP']),
      hit_dice_total: getField(fields, 'Total'),
      proficiency_bonus: parseInt2(fields['ProfBonus']),

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

      skill_modifiers: parseSkills(fields),
      save_modifiers: parseSaves(fields),
      attacks: parseAttacks(fields),

      damage_resistances: defenses.resistances,
      damage_immunities: defenses.immunities,
      condition_immunities: defenses.conditionImmunities,

      armor_proficiencies: proficiencies.armor,
      weapon_proficiencies: proficiencies.weapons,
      languages: proficiencies.languages,
      tool_proficiencies: proficiencies.tools,

      is_spellcaster: spellInfo.isSpellcaster,
      spell_attack_bonus: spellInfo.spellAttackBonus,
      spell_save_dc: spellInfo.spellSaveDC,
      spellcasting_ability: spellInfo.spellcastingAbility,
      spell_slots: null,
      pact_slot_level: spellsFromAnnotations?.pactSlotLevel ?? null,
      pact_slot_count: spellsFromAnnotations?.pactSlotCount ?? null,
      spells: spellsFromAnnotations?.spells ?? null,
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

    return Response.json({ character });
  } catch (error) {
    console.error('PDF parse error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error parsing PDF';
    return Response.json({ error: message }, { status: 500 });
  }
}
