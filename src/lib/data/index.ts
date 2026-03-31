import { createSupabaseStore } from './supabase-store';
import type {
  Campaign,
  WorldMeta,
  LoreEntry,
  PlotArc,
  NPC,
  Location,
  Faction,
  Item,
  Session,
  Scene,
  Encounter,
  StatBlock,
  SessionLog,
  PlayerCharacter,
  BuilderMessage,
  CustomSpell,
} from '@/types';

export const campaignStore = createSupabaseStore<Campaign>('campaigns');
export const worldMetaStore = createSupabaseStore<WorldMeta>('world_meta');
export const loreStore = createSupabaseStore<LoreEntry>('lore_entries');
export const plotStore = createSupabaseStore<PlotArc>('plot_arcs');
export const npcStore = createSupabaseStore<NPC>('npcs');
export const locationStore = createSupabaseStore<Location>('locations');
export const factionStore = createSupabaseStore<Faction>('factions');
export const itemStore = createSupabaseStore<Item>('items');
export const sessionStore = createSupabaseStore<Session>('sessions');
export const sceneStore = createSupabaseStore<Scene>('scenes');
export const encounterStore = createSupabaseStore<Encounter>('encounters');
export const statBlockStore = createSupabaseStore<StatBlock>('stat_blocks');
export const sessionLogStore = createSupabaseStore<SessionLog>('session_logs');
export const playerCharacterStore = createSupabaseStore<PlayerCharacter>('player_characters');
export const builderMessageStore = createSupabaseStore<BuilderMessage>('builder_messages');
export const customSpellStore = createSupabaseStore<CustomSpell>('custom_spells');
