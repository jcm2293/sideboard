// Take a homebrew ClassDefinition + user inputs and produce a Partial<PlayerCharacter>
// ready to populate the standard edit view (same path as the D&D Beyond PDF parse flow:
// stash to sessionStorage, navigate to /players/new?parsed=true).

import { getProgressionByCasterType } from '@/data/spell-progression';
import { CANTRIP_FNS } from '@/data/homebrew-classes';
import type {
  ClassDefinition,
  AbilityKey,
} from '@/types/homebrew-class';
import type {
  PlayerCharacter,
  AttackEntry,
  ClassResource,
  EquipmentEntry,
  FeatureEntry,
  ProficiencyLevel,
} from '@/types';

export interface CreationInputs {
  classDef: ClassDefinition;
  level: number;

  // Identity
  name: string;
  playerName: string;

  // Subclass id (must be chosen if level >= classDef.subclass_choice_level)
  subclassId: string | null;

  // Player choices
  selectedSkills: string[];        // labels from classDef.skill_choices.options
  fightingStyleText?: string;      // free-text for v1 — user types fighting style
  selectedCantrips: string[];      // spell names from classDef.spell_list['0']
  spellsKnown: Record<string, string[]>; // by spell level: { '1': [...], '2': [...] }

  // Manual fields
  race: string;
  background: string;
  abilities: Record<AbilityKey, number>; // raw scores
  equipmentText: string;
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number };
}

const ABILITY_KEYS: AbilityKey[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const SKILL_TO_ABILITY: Record<string, AbilityKey> = {
  Athletics: 'STR',
  Acrobatics: 'DEX',
  'Sleight of Hand': 'DEX',
  Stealth: 'DEX',
  Arcana: 'INT',
  History: 'INT',
  Investigation: 'INT',
  Nature: 'INT',
  Religion: 'INT',
  'Animal Handling': 'WIS',
  Insight: 'WIS',
  Medicine: 'WIS',
  Perception: 'WIS',
  Survival: 'WIS',
  Deception: 'CHA',
  Intimidation: 'CHA',
  Performance: 'CHA',
  Persuasion: 'CHA',
};

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function skillKeyOf(label: string): string {
  return label.toLowerCase().replace(/['']/g, '').replace(/\s+/g, '_');
}

/** Compute level-based proficiency bonus from the class's table. Falls back to 5e default if missing. */
function profBonusFor(classDef: ClassDefinition, level: number): number {
  const entry = classDef.level_progression.find((e) => e.level === level);
  if (entry) return entry.proficiency_bonus;
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}

/** Hit point estimate: max at L1, average + CON each level after. */
function estimateHp(classDef: ClassDefinition, level: number, conMod: number): number {
  const die = parseInt(classDef.hit_die.slice(1), 10); // 'd10' → 10
  const avg = die / 2 + 1;
  const lv = Math.max(1, level);
  return die + conMod + (lv - 1) * (avg + conMod);
}

/** Build the FeatureEntry list at the character's level. */
function buildFeatureList(
  classDef: ClassDefinition,
  level: number,
  subclassId: string | null,
  fightingStyleText: string | undefined,
): FeatureEntry[] {
  const out: FeatureEntry[] = [];
  const subclass = subclassId ? classDef.subclasses.find((s) => s.id === subclassId) : null;

  for (let lvl = 1; lvl <= level; lvl++) {
    const entry = classDef.level_progression.find((e) => e.level === lvl);
    if (!entry) continue;

    for (const featureId of entry.features) {
      const def = classDef.features[featureId];
      if (!def || def.hide_on_sheet) {
        // Special case: 'esoteric_order_feature' is hidden but signals "expand subclass at this tier"
        if (featureId === 'esoteric_order_feature' && subclass) {
          for (const subFeatureId of subclass.features_by_level[lvl] ?? []) {
            const subDef = subclass.features[subFeatureId];
            if (subDef && !subDef.hide_on_sheet) {
              out.push({ name: subDef.name, summary: subDef.description });
            }
          }
        }
        continue;
      }
      // Fighting Style: substitute the user's choice into the description if provided.
      if (featureId === 'fighting_style' && fightingStyleText?.trim()) {
        out.push({
          name: `Fighting Style: ${fightingStyleText.trim()}`,
          summary: def.description,
        });
        continue;
      }
      out.push({ name: def.name, summary: def.description });
    }

    // Subclass features at this level (when no esoteric_order_feature marker triggers it)
    if (subclass && lvl >= classDef.subclass_choice_level && (subclass.features_by_level[lvl]?.length ?? 0) > 0) {
      // Skip if we already injected via esoteric_order_feature marker above
      if (!entry.features.includes('esoteric_order_feature')) {
        for (const subFeatureId of subclass.features_by_level[lvl] ?? []) {
          const subDef = subclass.features[subFeatureId];
          if (subDef && !subDef.hide_on_sheet) {
            out.push({ name: subDef.name, summary: subDef.description });
          }
        }
      }
    }
  }

  return out;
}

/** Build class_resources list from features marked is_resource. */
function buildResources(
  classDef: ClassDefinition,
  level: number,
  subclassId: string | null,
): ClassResource[] {
  const out: ClassResource[] = [];
  const subclass = subclassId ? classDef.subclasses.find((s) => s.id === subclassId) : null;
  const seenIds = new Set<string>();

  function pushIfResource(featureId: string, def: { id: string; name: string; description: string; is_resource?: boolean; resource_uses?: string; resource_recovery?: 'short' | 'long' } | undefined) {
    if (!def?.is_resource) return;
    if (seenIds.has(featureId)) return;
    seenIds.add(featureId);
    out.push({
      name: def.name,
      uses: 1, // numeric placeholder; user edits if formula-based
      die: '',
      recovery: def.resource_recovery === 'long' ? 'Long Rest' : 'Short Rest',
    });
  }

  for (let lvl = 1; lvl <= level; lvl++) {
    const entry = classDef.level_progression.find((e) => e.level === lvl);
    if (!entry) continue;
    for (const featureId of entry.features) {
      pushIfResource(featureId, classDef.features[featureId]);
    }
    if (subclass && lvl >= classDef.subclass_choice_level) {
      for (const subFeatureId of subclass.features_by_level[lvl] ?? []) {
        pushIfResource(subFeatureId, subclass.features[subFeatureId]);
      }
    }
  }

  return out;
}

/** Compute save proficiency map from class definition. */
function buildSaveProfs(classDef: ClassDefinition): Record<string, ProficiencyLevel> {
  const out: Record<string, ProficiencyLevel> = {
    str: 'none', dex: 'none', con: 'none', int: 'none', wis: 'none', cha: 'none',
  };
  for (const ab of classDef.saving_throws) {
    out[ab.toLowerCase()] = 'proficient';
  }
  return out;
}

/** Compute skill proficiency map from chosen skill labels. */
function buildSkillProfs(selectedSkills: string[]): Record<string, ProficiencyLevel> {
  const out: Record<string, ProficiencyLevel> = {};
  for (const label of Object.keys(SKILL_TO_ABILITY)) {
    out[skillKeyOf(label)] = 'none';
  }
  for (const label of selectedSkills) {
    out[skillKeyOf(label)] = 'proficient';
  }
  return out;
}

/** Compute save modifiers from ability scores + class save proficiencies + PB. */
function buildSaveMods(
  classDef: ClassDefinition,
  abilities: Record<AbilityKey, number>,
  pb: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ab of ABILITY_KEYS) {
    const mod = abilityMod(abilities[ab]);
    const isProf = classDef.saving_throws.includes(ab);
    out[ab.toLowerCase()] = mod + (isProf ? pb : 0);
  }
  return out;
}

/** Compute skill modifiers from ability scores + chosen skills + PB. */
function buildSkillMods(
  abilities: Record<AbilityKey, number>,
  selectedSkills: string[],
  pb: number,
): Record<string, number> {
  const proficient = new Set(selectedSkills);
  const out: Record<string, number> = {};
  for (const [label, ability] of Object.entries(SKILL_TO_ABILITY)) {
    const mod = abilityMod(abilities[ability]);
    out[skillKeyOf(label)] = mod + (proficient.has(label) ? pb : 0);
  }
  return out;
}

/** Build spells map: user-picked spells per level + subclass bonus spells. Bonus spells are folded in but flagged with a marker is unnecessary; we just merge them in. */
function buildSpells(
  classDef: ClassDefinition,
  level: number,
  subclassId: string | null,
  selectedCantrips: string[],
  spellsKnown: Record<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (selectedCantrips.length) out['0'] = [...selectedCantrips];
  for (const [lvlStr, names] of Object.entries(spellsKnown)) {
    if (!names.length) continue;
    out[lvlStr] = [...(out[lvlStr] ?? []), ...names];
  }

  // Subclass bonus spells: every level <= character level, merged into the appropriate spell level.
  // Bonus spells in the class def are keyed by Magus level granted, not spell level — we need to look
  // them up in the Magus spell_list to figure out which spell level they belong to.
  const subclass = subclassId ? classDef.subclasses.find((s) => s.id === subclassId) : null;
  if (subclass?.bonus_spells) {
    const allLevels = Object.keys(classDef.spell_list);
    const findSpellLevel = (spellName: string): string | null => {
      const lc = spellName.toLowerCase().trim();
      for (const lvl of allLevels) {
        if (classDef.spell_list[lvl].some((s) => s.toLowerCase() === lc)) return lvl;
      }
      return null;
    };

    for (const [grantedAtLvlStr, names] of Object.entries(subclass.bonus_spells)) {
      if (parseInt(grantedAtLvlStr, 10) > level) continue;
      for (const name of names) {
        const spellLvl = findSpellLevel(name) ?? '1'; // fallback bucket if not in class spell list
        out[spellLvl] = out[spellLvl] ?? [];
        if (!out[spellLvl].some((n) => n.toLowerCase() === name.toLowerCase())) {
          out[spellLvl].push(name);
        }
      }
    }
  }

  // Ensure every level key exists (empty array) so the edit view's spell-list grouping works.
  for (let lvl = 0; lvl <= 9; lvl++) {
    out[String(lvl)] = out[String(lvl)] ?? [];
  }

  return out;
}

/** Parse the equipment textarea into EquipmentEntry rows. One per non-empty line. */
function buildEquipment(equipmentText: string): EquipmentEntry[] {
  return equipmentText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({ name: line, qty: 1, weight: '', notes: '' }));
}

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

export interface AssembledCharacter extends Partial<PlayerCharacter> {
  /** Forwarded to the edit view via sessionStorage; not persisted. */
  is_multiclass: boolean;
}

export function assembleCharacterFromClass(inputs: CreationInputs): AssembledCharacter {
  const { classDef, level, abilities, currency } = inputs;
  const pb = profBonusFor(classDef, level);
  const conMod = abilityMod(abilities.CON);
  const wisMod = abilityMod(abilities.WIS);
  const dexMod = abilityMod(abilities.DEX);
  const intMod = abilityMod(abilities.INT);

  const subclassObj = inputs.subclassId
    ? classDef.subclasses.find((s) => s.id === inputs.subclassId)
    : null;

  // Spell slot lookup using the class's caster type + cantrip function
  const cantripFn = CANTRIP_FNS[classDef.id];
  const progression = getProgressionByCasterType(classDef.caster_type, level, cantripFn);

  const isCaster = classDef.caster_type !== 'none';
  const spellAbility = classDef.spellcasting_ability;
  const spellMod = spellAbility ? abilityMod(abilities[spellAbility]) : 0;

  const skillMods = buildSkillMods(abilities, inputs.selectedSkills, pb);

  // Passive perception: 10 + perception skill modifier (already includes PB if proficient)
  const passivePerception = 10 + (skillMods['perception'] ?? wisMod);

  return {
    name: inputs.name,
    player_name: inputs.playerName,
    class_name: classDef.name,
    subclass: subclassObj?.name ?? '',
    level,
    is_multiclass: false,

    armor_class: 10 + dexMod, // user adjusts after picking armor
    ac_source: '',
    initiative_modifier: dexMod,
    speeds: { walking: '30 ft.' },
    hp_max: estimateHp(classDef, level, conMod),
    hit_dice_total: `${level}${classDef.hit_die}`,
    proficiency_bonus: pb,

    passive_perception: passivePerception,
    passive_insight: 10 + (skillMods['insight'] ?? wisMod),
    passive_investigation: 10 + (skillMods['investigation'] ?? intMod),
    senses: '',

    str_score: abilities.STR,
    dex_score: abilities.DEX,
    con_score: abilities.CON,
    int_score: abilities.INT,
    wis_score: abilities.WIS,
    cha_score: abilities.CHA,

    save_modifiers: buildSaveMods(classDef, abilities, pb),
    skill_modifiers: skillMods,
    save_proficiencies: buildSaveProfs(classDef),
    skill_proficiencies: buildSkillProfs(inputs.selectedSkills),

    attacks: [] as AttackEntry[],

    damage_resistances: '',
    damage_immunities: '',
    condition_immunities: '',

    armor_proficiencies: {
      light: classDef.armor_proficiencies.light,
      medium: classDef.armor_proficiencies.medium,
      heavy: classDef.armor_proficiencies.heavy,
      shields: classDef.armor_proficiencies.shields,
    },
    weapon_proficiencies: {
      simple: classDef.weapon_proficiencies.simple,
      martial: classDef.weapon_proficiencies.martial,
    },
    languages: '',
    tool_proficiencies: classDef.tool_proficiencies.join(', '),

    is_spellcaster: isCaster,
    spellcasting_ability: spellAbility,
    spell_attack_bonus: isCaster ? pb + spellMod : null,
    spell_save_dc: isCaster ? 8 + pb + spellMod : null,
    spell_slots: progression.spellSlots,
    pact_slot_level: progression.pactSlotLevel,
    pact_slot_count: progression.pactSlotCount,
    spells: isCaster
      ? buildSpells(classDef, level, inputs.subclassId, inputs.selectedCantrips, inputs.spellsKnown)
      : null,
    is_prepared_caster: false,
    prepared_spells: null,

    class_resources: buildResources(classDef, level, inputs.subclassId),
    class_features: buildFeatureList(classDef, level, inputs.subclassId, inputs.fightingStyleText),
    racial_traits: inputs.race ? [{ name: inputs.race, summary: 'Fill in racial traits manually after creation.' }] : null,
    feats: null,

    equipment: buildEquipment(inputs.equipmentText),

    cp: currency.cp,
    sp: currency.sp,
    ep: currency.ep,
    gp: currency.gp,
    pp: currency.pp,

    pdf_url: null,
  };
}
