// Race definitions are loaded from src/data/races.json. The JSON structure follows
// D&D Beyond's 2024 PHB conventions (with one 2014 legacy race: Half-Elf).
//
// Key 2024 differences captured here:
// - Ability Score Increases come from BACKGROUND, not race (legacy races still encode them)
// - Languages: all characters know Common plus 2 from background (legacy races still grant some)
// - Age is flavor only

export type Ruleset = '2014' | '2024';

export interface RaceMechanics {
  damage_resistances?: string[];
  damage_immunities?: string[];
  condition_immunities?: string[];
  darkvision_feet?: number;
  blindsight_feet?: number;
  truesight_feet?: number;
  innate_spells?: { spell: string; level: string; spellcasting_ability: string }[];
  speed_modifications?: { fly?: number; climb?: number; swim?: number; burrow?: number };
  ability_check_advantage?: string[];
  saving_throw_advantage?: string[];
  proficiencies?: string[];
  uses?: string;
  recharge?: string;
  dice?: string;
  action_type?: string;
  // Free-form catch-all for unmodeled fields:
  [key: string]: unknown;
}

export interface RaceTrait {
  name: string;
  description: string;
  mechanics?: RaceMechanics;
  /** Some traits offer choices (e.g. lineage selection on Elf). */
  choices?: {
    type: string;
    options: { name: string; description: string }[];
  };
}

export interface RaceLanguageBlock {
  fixed?: string[];
  choices?: { count: number; from: string };
  description?: string;
}

export interface RaceSizeBlock {
  options: string[];
  details?: string;
  choose_at_creation?: boolean;
}

export interface RaceAbilityIncrease {
  /** Specific ability granted, or null if user chooses. */
  ability: string | null;
  amount: number;
  /** True if user chooses which ability. */
  choice?: boolean;
  count?: number;
}

export interface RaceDefinition {
  id: string;                      // map key — 'aasimar', 'half-elf', etc.
  name: string;
  ruleset: Ruleset;
  description: string;
  source?: { book: string; page: number };
  size: RaceSizeBlock;
  speed: { walk: number; fly?: number; climb?: number; swim?: number; burrow?: number };
  traits: RaceTrait[];
  /** Only present for 2014 races (Half-Elf). 2024 races don't encode this. */
  ability_score_increases?: RaceAbilityIncrease[];
  /** Only present for 2014 races. */
  languages?: RaceLanguageBlock;
  /** Some races (e.g. Half-Elf 2014) grant skill choices at the race level. */
  skill_proficiencies?: { count: number; from?: string[]; description?: string };
  /** True if this race grants a starting feat (e.g. variant rules). */
  starting_feat?: boolean;
  lifespan_years?: number;
}
