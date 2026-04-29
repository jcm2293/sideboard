// Homebrew class definitions are bundled as TS data files in /src/data/homebrew-classes/.
// The character creation wizard reads these to drive its UI and to pre-populate
// a PlayerCharacter record. See /src/lib/homebrew/assemble-character.ts.

import type { CasterType } from '@/data/spell-progression';

export type AbilityKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface ArmorProficiencies {
  light: boolean;
  medium: boolean;
  heavy: boolean;
  shields: boolean;
}

export interface WeaponProficiencies {
  simple: boolean;
  martial: boolean;
  /** Specific weapons granted on top of simple/martial. */
  specific?: string[];
}

export interface SkillChoices {
  count: number;
  options: string[]; // canonical skill labels: 'Acrobatics', 'Sleight of Hand', etc.
}

export interface FeatureDefinition {
  id: string;
  name: string;
  /** Full mechanical description; should NOT be condensed. */
  description: string;
  /** True if this is a recurring class resource the sheet should track. */
  is_resource?: boolean;
  /** Display formula like "INT modifier" or a literal "1". */
  resource_uses?: string;
  resource_recovery?: 'short' | 'long';
  /** True if this feature should surface as an action on the sheet. */
  is_action?: boolean;
  /** Skip from the on-sheet class-features list (e.g. ASI is already in ability scores). */
  hide_on_sheet?: boolean;
}

export interface LevelEntry {
  level: number;
  proficiency_bonus: number;
  /** Feature ids gained at this level. Reference keys in ClassDefinition.features. */
  features: string[];
  cantrips_known?: number;
  spells_known?: number;
  /** Class-specific tracked numbers (e.g. exploit_dice). Display-only for now. */
  extra_columns?: Record<string, number | string>;
}

export interface SubclassDefinition {
  id: string;
  name: string;
  description: string;
  /** Feature ids granted at each milestone. Keys are the levels (e.g. 3, 7, 15, 20). */
  features_by_level: Record<number, string[]>;
  features: Record<string, FeatureDefinition>;
  /** Bonus spells granted by the subclass; do not count against spells known. */
  bonus_spells?: Record<number, string[]>;
}

export interface ClassDefinition {
  id: string;
  name: string;
  source: string;
  /** One-paragraph blurb shown on the homebrew class card. */
  description: string;

  // Core mechanics
  hit_die: 'd6' | 'd8' | 'd10' | 'd12';
  /** Primary ability (or set of options). E.g. ['INT'] or ['INT', 'STR', 'DEX']. */
  primary_ability: AbilityKey[];
  /** Saving throw proficiencies. */
  saving_throws: AbilityKey[];

  // Spellcasting (drives slot lookup via /src/data/spell-progression.ts)
  caster_type: CasterType;
  spellcasting_ability: AbilityKey | null;

  // Proficiencies granted at level 1
  armor_proficiencies: ArmorProficiencies;
  weapon_proficiencies: WeaponProficiencies;
  tool_proficiencies: string[];
  skill_choices: SkillChoices;

  /** Display-only equipment options. Free-text user input picks one bundle. */
  starting_equipment_options: string[];

  /** 20 entries, level 1..20. */
  level_progression: LevelEntry[];

  /** Map from feature id to its definition. Includes fighting styles, etc. */
  features: Record<string, FeatureDefinition>;

  /** Subclass label shown to the user (e.g. 'Esoteric Order' for Magus). */
  subclass_label: string;
  /** Level at which the subclass is selected. */
  subclass_choice_level: number;
  subclasses: SubclassDefinition[];

  /** Spell names available to this class, grouped by spell level ("0", "1", ...). */
  spell_list: Record<string, string[]>;

  /** IDs from src/data/fighting-styles.ts that this class can choose from. */
  allowed_fighting_style_ids?: string[];
}
