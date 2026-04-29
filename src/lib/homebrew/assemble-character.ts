// Take a fully-filled-out WizardState and produce a Partial<PlayerCharacter>
// ready to populate the standard edit view (same path as the D&D Beyond PDF
// parse flow: stash to sessionStorage, navigate to /players/new?parsed=true).
//
// All deterministic logic — the wizard collects user choices, this assembles
// them into the canonical PlayerCharacter shape.

import { getProgressionByCasterType } from '@/data/spell-progression';
import { findHomebrewClass, CANTRIP_FNS } from '@/data/homebrew-classes';
import { findRace } from '@/data/races';
import { FIGHTING_STYLES } from '@/data/fighting-styles';
import type { WizardState } from './wizard-reducer';
import type { AbilityKey } from '@/types/homebrew-class';
import type {
  PlayerCharacter,
  AttackEntry,
  ClassResource,
  EquipmentEntry,
  FeatureEntry,
  ProficiencyLevel,
} from '@/types';

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

function bonusFor(ability: AbilityKey, bonuses: { ability: AbilityKey; amount: number }[]): number {
  return bonuses.filter((b) => b.ability === ability).reduce((sum, b) => sum + b.amount, 0);
}

/** Sum all ability bonuses: racial + background + ASI choices. */
function aggregateBonuses(state: WizardState): { ability: AbilityKey; amount: number }[] {
  const all = [...state.raceChoices.abilityIncreases, ...state.background.abilityIncreases];
  for (const choice of Object.values(state.asiChoices)) {
    if (choice.type === 'ability_2') all.push({ ability: choice.ability, amount: 2 });
    else if (choice.type === 'ability_1_1') {
      all.push({ ability: choice.abilityA, amount: 1 });
      all.push({ ability: choice.abilityB, amount: 1 });
    }
  }
  return all;
}

function finalAbilityScores(state: WizardState): Record<AbilityKey, number> {
  const all = aggregateBonuses(state);
  return Object.fromEntries(
    ABILITY_KEYS.map((ab) => [ab, state.baseAbilities[ab] + bonusFor(ab, all)]),
  ) as Record<AbilityKey, number>;
}

function estimateHp(hitDie: string, level: number, conMod: number): number {
  const die = parseInt(hitDie.slice(1), 10);
  const avg = die / 2 + 1;
  const lv = Math.max(1, level);
  return die + conMod + (lv - 1) * (avg + conMod);
}

function buildSaveProfs(savingThrows: AbilityKey[]): Record<string, ProficiencyLevel> {
  const out: Record<string, ProficiencyLevel> = {
    str: 'none', dex: 'none', con: 'none', int: 'none', wis: 'none', cha: 'none',
  };
  for (const ab of savingThrows) out[ab.toLowerCase()] = 'proficient';
  return out;
}

function buildSkillProfs(skills: string[]): Record<string, ProficiencyLevel> {
  const out: Record<string, ProficiencyLevel> = {};
  for (const label of Object.keys(SKILL_TO_ABILITY)) out[skillKeyOf(label)] = 'none';
  for (const label of skills) out[skillKeyOf(label)] = 'proficient';
  return out;
}

export function assembleFromWizardState(state: WizardState): Partial<PlayerCharacter> {
  const classDef = findHomebrewClass(state.classId);
  if (!classDef) {
    throw new Error(`Unknown class id: ${state.classId}`);
  }

  const race = findRace(state.raceId);
  const subclass = state.subclassId
    ? classDef.subclasses.find((s) => s.id === state.subclassId)
    : null;

  const finalAbil = finalAbilityScores(state);
  const conMod = abilityMod(finalAbil.CON);
  const dexMod = abilityMod(finalAbil.DEX);
  const intMod = abilityMod(finalAbil.INT);
  const wisMod = abilityMod(finalAbil.WIS);

  const levelEntry = classDef.level_progression.find((e) => e.level === state.level);
  const pb = levelEntry?.proficiency_bonus ?? 2 + Math.floor((Math.max(1, state.level) - 1) / 4);

  // Aggregate skills from class + background + race
  const allSkills = Array.from(new Set([
    ...state.classSkillProficiencies,
    ...state.background.skillProficiencies,
    ...state.raceChoices.skillProficiencies,
  ]));

  // Save modifiers: ability mod + (proficient ? PB : 0)
  const saveMods: Record<string, number> = {};
  for (const ab of ABILITY_KEYS) {
    const mod = abilityMod(finalAbil[ab]);
    const prof = classDef.saving_throws.includes(ab);
    saveMods[ab.toLowerCase()] = mod + (prof ? pb : 0);
  }

  // Skill modifiers: ability mod + (proficient ? PB : 0)
  const skillMods: Record<string, number> = {};
  const profSkillSet = new Set(allSkills);
  for (const [label, ability] of Object.entries(SKILL_TO_ABILITY)) {
    const mod = abilityMod(finalAbil[ability]);
    skillMods[skillKeyOf(label)] = mod + (profSkillSet.has(label) ? pb : 0);
  }

  // Class + subclass features at this character level (excluding hidden ones).
  const classFeatures: FeatureEntry[] = [];
  for (let lvl = 1; lvl <= state.level; lvl++) {
    const e = classDef.level_progression.find((x) => x.level === lvl);
    if (!e) continue;
    for (const featureId of e.features) {
      const def = classDef.features[featureId];
      if (!def) continue;
      // 'esoteric_order_feature' is a hidden marker that injects subclass tier features
      if (featureId === 'esoteric_order_feature' && subclass) {
        for (const subId of subclass.features_by_level[lvl] ?? []) {
          const sd = subclass.features[subId];
          if (sd && !sd.hide_on_sheet) classFeatures.push({ name: sd.name, summary: sd.description });
        }
        continue;
      }
      if (def.hide_on_sheet) continue;
      // Fighting Style: substitute the user's chosen style
      if (featureId === 'fighting_style' && state.fightingStyleId) {
        const fs = FIGHTING_STYLES[state.fightingStyleId];
        if (fs) {
          classFeatures.push({ name: `Fighting Style: ${fs.name}`, summary: fs.description });
          continue;
        }
      }
      classFeatures.push({ name: def.name, summary: def.description });
    }
    // Subclass features at L >= subclass_choice_level not already handled by esoteric_order_feature
    if (subclass && lvl >= classDef.subclass_choice_level && !e.features.includes('esoteric_order_feature')) {
      for (const subId of subclass.features_by_level[lvl] ?? []) {
        const sd = subclass.features[subId];
        if (sd && !sd.hide_on_sheet) classFeatures.push({ name: sd.name, summary: sd.description });
      }
    }
  }
  // Background feature
  if (state.background.feature.name.trim()) {
    classFeatures.push({
      name: `Background: ${state.background.feature.name}`,
      summary: state.background.feature.description,
    });
  }

  // Racial traits
  const racialTraits: FeatureEntry[] = race
    ? race.traits.map((t) => ({ name: t.name, summary: t.description }))
    : [];

  // Feats: starting feat + ASI feats
  const feats: FeatureEntry[] = [];
  if (state.raceChoices.startingFeat.name.trim()) {
    feats.push({
      name: state.raceChoices.startingFeat.name,
      summary: state.raceChoices.startingFeat.description,
    });
  }
  for (const choice of Object.values(state.asiChoices)) {
    if (choice.type === 'feat' && choice.feat.name.trim()) {
      feats.push({ name: choice.feat.name, summary: choice.feat.description });
    }
  }

  // Class resources from features marked is_resource
  const classResources: ClassResource[] = [];
  const seenResource = new Set<string>();
  function pushResource(featureId: string, def: { is_resource?: boolean; name: string; resource_recovery?: 'short' | 'long' } | undefined) {
    if (!def?.is_resource || seenResource.has(featureId)) return;
    seenResource.add(featureId);
    classResources.push({
      name: def.name,
      uses: 1,
      die: '',
      recovery: def.resource_recovery === 'long' ? 'Long Rest' : 'Short Rest',
    });
  }
  for (let lvl = 1; lvl <= state.level; lvl++) {
    const e = classDef.level_progression.find((x) => x.level === lvl);
    if (!e) continue;
    for (const fId of e.features) pushResource(fId, classDef.features[fId]);
    if (subclass && lvl >= classDef.subclass_choice_level) {
      for (const sId of subclass.features_by_level[lvl] ?? []) {
        pushResource(sId, subclass.features[sId]);
      }
    }
  }

  // Spells: cantrips + chosen spells by level + subclass bonus spells
  const isCaster = classDef.caster_type !== 'none';
  const spells: Record<string, string[]> = {};
  for (let l = 0; l <= 9; l++) spells[String(l)] = [];
  if (isCaster) {
    spells['0'] = [...state.cantripsKnown];
    for (const [lvl, names] of Object.entries(state.spellsKnownByLevel)) {
      spells[lvl] = [...(spells[lvl] ?? []), ...names];
    }
    if (subclass?.bonus_spells) {
      const findSpellLevel = (name: string): string | null => {
        const lc = name.toLowerCase().trim();
        for (const lvl of Object.keys(classDef.spell_list)) {
          if (classDef.spell_list[lvl].some((s) => s.toLowerCase() === lc)) return lvl;
        }
        return null;
      };
      for (const [grantedAt, names] of Object.entries(subclass.bonus_spells)) {
        if (parseInt(grantedAt, 10) > state.level) continue;
        for (const n of names) {
          const lvl = findSpellLevel(n) ?? '1';
          if (!spells[lvl].some((x) => x.toLowerCase() === n.toLowerCase())) {
            spells[lvl].push(n);
          }
        }
      }
    }
  }

  // Slot lookup
  const progression = getProgressionByCasterType(
    classDef.caster_type,
    state.level,
    CANTRIP_FNS[classDef.id],
  );

  const spellAbility = classDef.spellcasting_ability;

  // Equipment from textarea
  const equipment: EquipmentEntry[] = state.equipmentText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({ name: line, qty: 1, weight: '', notes: '' }));

  // Speed: prefer race speed.walk if present
  const speedFt = race?.speed?.walk ?? 30;

  // Senses: derive from race traits (e.g. Darkvision)
  const senses = (race?.traits ?? [])
    .filter((t) => t.mechanics?.darkvision_feet || t.mechanics?.blindsight_feet || t.mechanics?.truesight_feet)
    .map((t) => {
      const m = t.mechanics!;
      if (m.darkvision_feet) return `Darkvision ${m.darkvision_feet} ft.`;
      if (m.blindsight_feet) return `Blindsight ${m.blindsight_feet} ft.`;
      if (m.truesight_feet) return `Truesight ${m.truesight_feet} ft.`;
      return '';
    })
    .filter(Boolean)
    .join(', ');

  return {
    name: state.characterName,
    player_name: state.playerName,
    class_name: classDef.name,
    subclass: subclass?.name ?? '',
    level: state.level,
    is_multiclass: false,

    armor_class: 10 + dexMod,
    ac_source: '',
    initiative_modifier: dexMod,
    speeds: { walking: `${speedFt} ft.` },
    hp_max: estimateHp(classDef.hit_die, state.level, conMod),
    hit_dice_total: `${state.level}${classDef.hit_die}`,
    proficiency_bonus: pb,

    passive_perception: 10 + (skillMods['perception'] ?? wisMod),
    passive_insight: 10 + (skillMods['insight'] ?? wisMod),
    passive_investigation: 10 + (skillMods['investigation'] ?? intMod),
    senses,

    str_score: finalAbil.STR,
    dex_score: finalAbil.DEX,
    con_score: finalAbil.CON,
    int_score: finalAbil.INT,
    wis_score: finalAbil.WIS,
    cha_score: finalAbil.CHA,

    save_modifiers: saveMods,
    skill_modifiers: skillMods,
    save_proficiencies: buildSaveProfs(classDef.saving_throws),
    skill_proficiencies: buildSkillProfs(allSkills),

    attacks: [] as AttackEntry[],

    damage_resistances: '',
    damage_immunities: '',
    condition_immunities: '',

    armor_proficiencies: { ...classDef.armor_proficiencies },
    weapon_proficiencies: {
      simple: classDef.weapon_proficiencies.simple,
      martial: classDef.weapon_proficiencies.martial,
    },
    languages: [
      ...state.raceChoices.languages.filter(Boolean),
      state.background.languages,
    ].filter(Boolean).join(', '),
    tool_proficiencies: [
      classDef.tool_proficiencies.join(', '),
      state.background.toolProficiencies,
    ].filter(Boolean).join(', '),

    is_spellcaster: isCaster,
    spellcasting_ability: spellAbility,
    // Spell DC + attack derive from PB + ability mod via /src/lib/character.ts.
    // Wizard never sets overrides; user toggles them on later if needed.
    spell_attack_bonus_override: null,
    spell_save_dc_override: null,
    spell_slots: progression.spellSlots,
    pact_slot_level: progression.pactSlotLevel,
    pact_slot_count: progression.pactSlotCount,
    spells: isCaster ? spells : null,
    is_prepared_caster: false,
    prepared_spells: null,

    class_resources: classResources,
    class_features: classFeatures,
    racial_traits: racialTraits.length > 0 ? racialTraits : null,
    feats: feats.length > 0 ? feats : null,

    equipment,

    cp: state.currency.cp,
    sp: state.currency.sp,
    ep: state.currency.ep,
    gp: state.currency.gp,
    pp: state.currency.pp,

    pdf_url: null,
  };
}
