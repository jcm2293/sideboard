// Single-reducer state for the homebrew character creation wizard.
//
// Why: scattered useState in step components caused remount/focus bugs.
// Centralizing in a reducer means step components are pure renderers reading
// state + dispatching actions; they hold zero local state.
//
// Step layout:
//   1. Identity      — name, level, class, subclass, race+race choices, background
//   2. Class Choices — skills, fighting style, cantrips, spells known, subclass picks
//   3. Ability Scores — point buy or standard array
//   4. Level-by-Level — ASI/feat decisions and per-level spell picks
//   5. Manual         — equipment, currency, personality, appearance
//   6. Review         — final summary + Create Character button

import type { AbilityKey } from '@/types/homebrew-class';

export type WizardStep = 'identity' | 'class' | 'abilities' | 'levels' | 'manual' | 'review';

export const WIZARD_STEPS: WizardStep[] = ['identity', 'class', 'abilities', 'levels', 'manual', 'review'];

export const STEP_LABELS: Record<WizardStep, string> = {
  identity: 'Identity',
  class: 'Class Choices',
  abilities: 'Ability Scores',
  levels: 'Level-by-Level',
  manual: 'Manual Fields',
  review: 'Review',
};

// ──────────────────────────────────────────────────────────────────────
// Per-section state
// ──────────────────────────────────────────────────────────────────────

export interface RaceChoices {
  /** Resolved racial ability score increases. Only legacy races (Half-Elf 2014) populate these. */
  abilityIncreases: { ability: AbilityKey; amount: number }[];
  /** Race-granted skill choices, e.g. Half-Elf's Skill Versatility. */
  skillProficiencies: string[];
  /** Race-granted languages chosen by the user. */
  languages: string[];
  /** Free-text starting feat for races that grant one (e.g. variant rules). */
  startingFeat: { name: string; description: string };
  /** For races with size choice (Aasimar Small/Medium etc.). */
  size?: string;
}

export interface BackgroundDetails {
  name: string;
  description: string;
  /** Skills granted by background — user picks from full skill list. */
  skillProficiencies: string[];
  toolProficiencies: string;
  languages: string;
  /** Background-granted ability score increases (2024 rules). */
  abilityIncreases: { ability: AbilityKey; amount: number }[];
  feature: { name: string; description: string };
}

export type ASIChoice =
  | { type: 'ability_2'; ability: AbilityKey }
  | { type: 'ability_1_1'; abilityA: AbilityKey; abilityB: AbilityKey }
  | { type: 'feat'; feat: { name: string; description: string } }
  | { type: 'unset' };

export interface BaseAbilityScores {
  STR: number;
  DEX: number;
  CON: number;
  INT: number;
  WIS: number;
  CHA: number;
}

export interface WizardState {
  // Step 1: Identity
  characterName: string;
  playerName: string;
  level: number;
  classId: string;
  subclassId: string | null;
  raceId: string | null;
  raceChoices: RaceChoices;
  background: BackgroundDetails;

  // Step 2: Class Choices
  classSkillProficiencies: string[];
  fightingStyleId: string | null;
  cantripsKnown: string[];
  spellsKnownByLevel: Record<string, string[]>; // by spell level

  // Step 3: Ability Scores
  baseAbilities: BaseAbilityScores;
  /** Whether the user is in standard-array mode (false = point buy). */
  useStandardArray: boolean;

  // Step 4: Level-by-Level
  asiChoices: Record<number, ASIChoice>;
  /** Optional per-level spell additions (overrides for the otherwise-aggregate spellsKnownByLevel). */
  spellsAddedAtLevel: Record<number, string[]>;

  // Step 5: Manual
  equipmentText: string;
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number };
  personality: string;
  appearance: string;
}

export const ABILITY_KEYS: AbilityKey[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export const ALL_SKILLS: { label: string; ability: AbilityKey }[] = [
  { label: 'Acrobatics', ability: 'DEX' },
  { label: 'Animal Handling', ability: 'WIS' },
  { label: 'Arcana', ability: 'INT' },
  { label: 'Athletics', ability: 'STR' },
  { label: 'Deception', ability: 'CHA' },
  { label: 'History', ability: 'INT' },
  { label: 'Insight', ability: 'WIS' },
  { label: 'Intimidation', ability: 'CHA' },
  { label: 'Investigation', ability: 'INT' },
  { label: 'Medicine', ability: 'WIS' },
  { label: 'Nature', ability: 'INT' },
  { label: 'Perception', ability: 'WIS' },
  { label: 'Performance', ability: 'CHA' },
  { label: 'Persuasion', ability: 'CHA' },
  { label: 'Religion', ability: 'INT' },
  { label: 'Sleight of Hand', ability: 'DEX' },
  { label: 'Stealth', ability: 'DEX' },
  { label: 'Survival', ability: 'WIS' },
];

// ──────────────────────────────────────────────────────────────────────
// Initial state
// ──────────────────────────────────────────────────────────────────────

export function makeInitialState(classId: string): WizardState {
  return {
    characterName: '',
    playerName: '',
    level: 1,
    classId,
    subclassId: null,
    raceId: null,
    raceChoices: {
      abilityIncreases: [],
      skillProficiencies: [],
      languages: [],
      startingFeat: { name: '', description: '' },
      size: undefined,
    },
    background: {
      name: '',
      description: '',
      skillProficiencies: [],
      toolProficiencies: '',
      languages: '',
      abilityIncreases: [],
      feature: { name: '', description: '' },
    },
    classSkillProficiencies: [],
    fightingStyleId: null,
    cantripsKnown: [],
    spellsKnownByLevel: {},
    baseAbilities: { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 },
    useStandardArray: false,
    asiChoices: {},
    spellsAddedAtLevel: {},
    equipmentText: '',
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    personality: '',
    appearance: '',
  };
}

// ──────────────────────────────────────────────────────────────────────
// Action types
// ──────────────────────────────────────────────────────────────────────

export type WizardAction =
  // Identity
  | { type: 'set_field'; field: keyof Pick<WizardState, 'characterName' | 'playerName' | 'level' | 'subclassId' | 'raceId' | 'fightingStyleId' | 'equipmentText' | 'personality' | 'appearance' | 'useStandardArray'>; value: string | number | boolean | null }
  // Race choices
  | { type: 'set_race_starting_feat'; field: 'name' | 'description'; value: string }
  | { type: 'set_race_size'; value: string }
  | { type: 'toggle_race_skill'; skill: string; max: number }
  | { type: 'set_race_language'; index: number; value: string }
  | { type: 'set_race_ability_increase'; index: number; ability: AbilityKey; amount: number }
  // Background
  | { type: 'set_background_field'; field: 'name' | 'description' | 'toolProficiencies' | 'languages'; value: string }
  | { type: 'toggle_background_skill'; skill: string; max: number }
  | { type: 'set_background_feature'; field: 'name' | 'description'; value: string }
  | { type: 'set_background_ability_increase'; index: number; ability: AbilityKey; amount: number }
  // Class choices
  | { type: 'toggle_class_skill'; skill: string; max: number }
  | { type: 'toggle_cantrip'; spell: string; max: number }
  | { type: 'toggle_spell_known'; spellLevel: string; spell: string }
  // Ability scores
  | { type: 'set_base_ability'; ability: AbilityKey; value: number }
  | { type: 'reset_abilities' }
  | { type: 'apply_standard_array'; assignments: BaseAbilityScores }
  // ASI choices
  | { type: 'set_asi'; level: number; choice: ASIChoice }
  // Currency
  | { type: 'set_currency'; coin: 'cp' | 'sp' | 'ep' | 'gp' | 'pp'; value: number }
  // Reset / load
  | { type: 'reset'; classId: string };

// ──────────────────────────────────────────────────────────────────────
// Reducer
// ──────────────────────────────────────────────────────────────────────

function toggleInArray<T>(arr: T[], val: T, max?: number): T[] {
  if (arr.includes(val)) return arr.filter((x) => x !== val);
  if (max != null && arr.length >= max) return arr;
  return [...arr, val];
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'set_field':
      return { ...state, [action.field]: action.value };

    case 'set_race_starting_feat':
      return {
        ...state,
        raceChoices: {
          ...state.raceChoices,
          startingFeat: { ...state.raceChoices.startingFeat, [action.field]: action.value },
        },
      };

    case 'set_race_size':
      return { ...state, raceChoices: { ...state.raceChoices, size: action.value } };

    case 'toggle_race_skill':
      return {
        ...state,
        raceChoices: {
          ...state.raceChoices,
          skillProficiencies: toggleInArray(state.raceChoices.skillProficiencies, action.skill, action.max),
        },
      };

    case 'set_race_language': {
      const next = [...state.raceChoices.languages];
      next[action.index] = action.value;
      return { ...state, raceChoices: { ...state.raceChoices, languages: next } };
    }

    case 'set_race_ability_increase': {
      const next = [...state.raceChoices.abilityIncreases];
      next[action.index] = { ability: action.ability, amount: action.amount };
      return { ...state, raceChoices: { ...state.raceChoices, abilityIncreases: next } };
    }

    case 'set_background_field':
      return { ...state, background: { ...state.background, [action.field]: action.value } };

    case 'toggle_background_skill':
      return {
        ...state,
        background: {
          ...state.background,
          skillProficiencies: toggleInArray(state.background.skillProficiencies, action.skill, action.max),
        },
      };

    case 'set_background_feature':
      return {
        ...state,
        background: {
          ...state.background,
          feature: { ...state.background.feature, [action.field]: action.value },
        },
      };

    case 'set_background_ability_increase': {
      const next = [...state.background.abilityIncreases];
      next[action.index] = { ability: action.ability, amount: action.amount };
      return { ...state, background: { ...state.background, abilityIncreases: next } };
    }

    case 'toggle_class_skill':
      return {
        ...state,
        classSkillProficiencies: toggleInArray(state.classSkillProficiencies, action.skill, action.max),
      };

    case 'toggle_cantrip':
      return {
        ...state,
        cantripsKnown: toggleInArray(state.cantripsKnown, action.spell, action.max),
      };

    case 'toggle_spell_known': {
      const cur = state.spellsKnownByLevel[action.spellLevel] ?? [];
      return {
        ...state,
        spellsKnownByLevel: {
          ...state.spellsKnownByLevel,
          [action.spellLevel]: toggleInArray(cur, action.spell),
        },
      };
    }

    case 'set_base_ability':
      return { ...state, baseAbilities: { ...state.baseAbilities, [action.ability]: action.value } };

    case 'reset_abilities':
      return { ...state, baseAbilities: { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 } };

    case 'apply_standard_array':
      return { ...state, baseAbilities: action.assignments };

    case 'set_asi':
      return { ...state, asiChoices: { ...state.asiChoices, [action.level]: action.choice } };

    case 'set_currency':
      return { ...state, currency: { ...state.currency, [action.coin]: action.value } };

    case 'reset':
      return makeInitialState(action.classId);
  }
}
