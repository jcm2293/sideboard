export type LoreCategory = 'history' | 'geography' | 'culture' | 'religion' | 'magic' | 'politics' | 'other';
export type PlotStatus = 'active' | 'resolved' | 'abandoned';
export type SessionStatus = 'planning' | 'upcoming' | 'completed';
export type ItemType = 'weapon' | 'armor' | 'potion' | 'quest_item' | 'wondrous' | 'other';

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface WorldMeta {
  id: string;
  campaign_id: string;
  tone: string;
  tech_level: string;
  themes: string[];
  magic_system: string;
  notes: string;
}

export interface LoreEntry {
  id: string;
  campaign_id: string;
  title: string;
  category: LoreCategory;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PlotArc {
  id: string;
  campaign_id: string;
  title: string;
  summary: string;
  status: PlotStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NPC {
  id: string;
  campaign_id: string;
  name: string;
  race: string;
  role: string;
  alignment: string;
  description: string;
  personality: string;
  motivations: string;
  secrets: string;
  connections: string;
  location_id: string | null;
  faction_id: string | null;
  stat_block_id: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  type: string;
  parent_id: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Faction {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  goals: string;
  leader: string;
  alignment: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  campaign_id: string;
  name: string;
  type: ItemType;
  rarity: string;
  description: string;
  properties: string;
  attunement: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  campaign_id: string;
  title: string;
  session_number: number;
  status: SessionStatus;
  date: string | null;
  summary: string;
  prep_notes: string;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  id: string;
  session_id: string;
  title: string;
  description: string;
  dm_notes: string;
  sort_order: number;
  location_id: string | null;
  npc_ids: string[];
}

export interface Encounter {
  id: string;
  scene_id: string;
  name: string;
  description: string;
  difficulty: string;
  stat_block_ids: string[];
  notes: string;
}

export interface StatBlock {
  id: string;
  campaign_id: string;
  name: string;
  size: string;
  type: string;
  alignment: string;
  armor_class: number;
  hit_points: string;
  speed: string;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  saving_throws: string;
  skills: string;
  damage_resistances: string;
  damage_immunities: string;
  condition_immunities: string;
  senses: string;
  languages: string;
  challenge_rating: string;
  traits: string;
  actions: string;
  reactions: string;
  legendary_actions: string;
  created_at: string;
  updated_at: string;
}

export interface SessionLog {
  id: string;
  session_id: string;
  content: string;
  created_at: string;
}

export type ProficiencyLevel = 'none' | 'half' | 'proficient' | 'expertise';

// Optional fields below come from the structured D&D Beyond import (sheet v3,
// docs/character-sheet-spec-v3.md). Homebrew-wizard and older characters
// don't have them; the PDF falls back to the basic fields.

export interface AttackEntry {
  name: string;
  atk_bonus: string;
  damage: string;
  damage_type: string;
  range?: string;
  notes?: string;
  /** 'rider' is damage added to a hit: Sneak Attack, Rage damage, the Martial Arts die. */
  kind?: 'weapon' | 'unarmed' | 'spell' | 'rider';
  /** e.g. ["Vex"], ["3 / long rest"]. */
  tags?: string[];
}

export interface ClassResource {
  name: string;
  uses: number;
  die?: string;
  recovery: string;
  /** `uses` is a point total to spend from (Lay On Hands 25): a write-in box, not bubbles. */
  pool?: boolean;
  /** 'table' when the count came from the class reference table rather than the export. */
  source?: 'pdf' | 'table';
}

export interface ClassLevel {
  class_name: string;
  level: number;
  subclass: string;
}

/** Action economy. 'special' = free or triggered; 'none' = takes no part in a turn. */
export type ActionType = 'action' | 'bonus' | 'reaction' | 'special' | 'none';

export interface FeatureUses {
  count: number;
  per: 'short' | 'long' | 'turn' | 'day';
  pool?: boolean;
  die?: string;
  /** Beyond's name for the resource when it isn't the feature's ("Luck Points", "Focus Points"). */
  label?: string;
}

/** An activation listed under a feature, e.g. "| Flurry of Blows: 1 Bonus Action". */
export interface FeatureActivation {
  label: string;
  action: ActionType;
}

export interface FeatureEntry {
  name: string;
  /** The first paragraph of full_text (the whole description for older records). */
  summary: string;
  /** Complete description, paragraphs joined with \n\n. */
  full_text?: string;
  kind?: 'mechanical' | 'passive' | 'ribbon' | 'container';
  /** "Warlock", "Rogue", "Dhampir", "Feats". */
  group?: string;
  /** "Eldritch Invocations" for Thirsting Blade. */
  parent?: string;
  action?: ActionType;
  uses?: FeatureUses;
  /** "PHB-2024 153" — never printed on the player sheet. */
  source_ref?: string;
  /** Chosen sub-options: ["Sea"], ["Greatsword (Graze)", "Whip (Slow)"]. */
  options?: string[];
  /** Body text of chosen options that have one. */
  option_details?: { name: string; text: string }[];
  activations?: FeatureActivation[];
}

export interface EquipmentEntry {
  name: string;
  qty: number;
  weight?: string;
  notes?: string;
  /** e.g. ["attunement?"] — Beyond doesn't export attunement state. */
  tags?: string[];
}

export interface SpellEntry {
  name: string;
  level: number;
  /** Raw Beyond source, e.g. "Fiend Spells (Always Prepared)". */
  source: string;
  origin: 'class' | 'subclass' | 'feat' | 'species' | 'invocation' | 'item' | 'other';
  always_prepared: boolean;
  costs_slot: boolean;
  free_uses?: { count: number; per: 'long' | 'short' };
  ritual: boolean;
  concentration: boolean;
  save_or_atk: string;
  casting_time: string;
  range: string;
  components: string;
  duration: string;
  notes: string;
  page_ref: string;
}

export interface WeaponMastery {
  weapon: string;
  mastery: string;
}

/** The DC on the vitals strip: Spell DC, Focus DC, Maneuver DC, or Grapple/Shove DC. */
export interface FeatureDc {
  label: string;
  value: number;
}

export interface PlayerCharacter {
  id: string;
  campaign_id: string;

  // Identity
  name: string;
  player_name: string;
  class_name: string;
  subclass: string;
  level: number;
  is_multiclass: boolean;

  // Combat stats
  armor_class: number;
  ac_source: string;
  initiative_modifier: number;
  speeds: Record<string, string>;
  hp_max: number;
  hit_dice_total: string;
  proficiency_bonus: number;

  // Passives & senses
  passive_perception: number;
  passive_insight: number | null;
  passive_investigation: number | null;
  senses: string;

  // Ability scores
  str_score: number;
  dex_score: number;
  con_score: number;
  int_score: number;
  wis_score: number;
  cha_score: number;

  // Pre-calculated modifiers (final values, used in PDF export and shelf)
  skill_modifiers: Record<string, number>;
  save_modifiers: Record<string, number>;

  // Proficiency metadata for the edit view (not used in calc — modifiers above are authoritative)
  // Values: 'none' | 'half' | 'proficient' | 'expertise'. Saves only use 'none' | 'proficient'.
  skill_proficiencies: Record<string, ProficiencyLevel>;
  save_proficiencies: Record<string, ProficiencyLevel>;

  // Attacks
  attacks: AttackEntry[];

  // Defenses
  damage_resistances: string;
  damage_immunities: string;
  condition_immunities: string;

  // Proficiencies
  armor_proficiencies: Record<string, boolean>;
  weapon_proficiencies: Record<string, boolean>;
  languages: string;
  tool_proficiencies: string;

  // Spellcasting
  is_spellcaster: boolean;
  // Spell save DC and attack bonus are calculated from PB + ability mod
  // (see /src/lib/character.ts). Override fields are non-null only when the
  // character has a magic item or feature that pushes them off the formula.
  spell_attack_bonus_override: number | null;
  spell_save_dc_override: number | null;
  spellcasting_ability: string | null;
  spell_slots: Record<string, number> | null;
  pact_slot_level: number | null;
  pact_slot_count: number | null;
  spells: Record<string, string[]> | null;
  is_prepared_caster: boolean;
  prepared_spells: string[] | null;

  // Class resources
  class_resources: ClassResource[] | null;

  // Features
  class_features: FeatureEntry[];
  racial_traits: FeatureEntry[] | null;
  feats: FeatureEntry[] | null;

  // Inventory
  equipment: EquipmentEntry[];

  // Currency
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;

  // Source
  pdf_url: string | null;

  // Structured D&D Beyond import (sheet v3)
  species?: string | null;
  background?: string | null;
  /** "Wizard 5 / Rogue 3" as [{Wizard, 5, Evoker}, {Rogue, 3, Thief}]. */
  classes?: ClassLevel[] | null;
  spell_details?: Record<string, SpellEntry> | null;
  weapon_masteries?: WeaponMastery[] | null;
  /** 8 + PB + Str mod, or Dex mod with Martial Arts when Dex is higher. */
  grapple_shove_dc?: number | null;
  feature_dc?: FeatureDc | null;

  created_at: string;
  updated_at: string;
}

export interface CustomSpell {
  id: string;
  campaign_id: string;
  name: string;
  level: number;
  school: string;
  casting_time: string;
  range: string;
  components_v: boolean;
  components_s: boolean;
  components_m: boolean;
  material_description: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higher_levels: string;
  classes: string[];
  created_at: string;
}

export interface SrdSpell {
  index: string;
  name: string;
  desc: string[];
  higher_level: string[];
  range: string;
  components: string[];
  material: string;
  ritual: boolean;
  duration: string;
  concentration: boolean;
  casting_time: string;
  level: number;
  school: string;
  classes: string[];
}

export type BuilderMessageRole = 'user' | 'assistant';

export type ProposalType = 'location' | 'npc' | 'faction' | 'lore' | 'plot_arc' | 'world_meta';

export interface ProposedElement {
  type: ProposalType;
  data: Record<string, unknown>;
  saved?: boolean;
  savedId?: string;
}

export interface BuilderMessage {
  id: string;
  campaign_id: string;
  role: BuilderMessageRole;
  content: string;
  proposed_elements: ProposedElement[] | null;
  created_at: string;
}
