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

export interface AttackEntry {
  name: string;
  atk_bonus: string;
  damage: string;
  damage_type: string;
  range?: string;
  notes?: string;
}

export interface ClassResource {
  name: string;
  uses: number;
  die?: string;
  recovery: string;
}

export interface FeatureEntry {
  name: string;
  summary: string;
}

export interface EquipmentEntry {
  name: string;
  qty: number;
  weight?: string;
  notes?: string;
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

  // Pre-calculated modifiers
  skill_modifiers: Record<string, number>;
  save_modifiers: Record<string, number>;

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
  spell_attack_bonus: number | null;
  spell_save_dc: number | null;
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
