import {
  worldMetaStore,
  loreStore,
  locationStore,
  factionStore,
  npcStore,
  plotStore,
  sessionStore,
} from '@/lib/data';
import type { WorldMeta, LoreEntry, Location, Faction, NPC, PlotArc, Session } from '@/types';

export async function buildCampaignContext(campaignId: string): Promise<string> {
  const filter = { campaign_id: campaignId } as Record<string, unknown>;

  const [worldMetas, lore, locations, factions, npcs, plots, sessions] = await Promise.all([
    worldMetaStore.getAll(filter as Partial<WorldMeta>),
    loreStore.getAll(filter as Partial<LoreEntry>),
    locationStore.getAll(filter as Partial<Location>),
    factionStore.getAll(filter as Partial<Faction>),
    npcStore.getAll(filter as Partial<NPC>),
    plotStore.getAll(filter as Partial<PlotArc>),
    sessionStore.getAll(filter as Partial<Session>),
  ]);

  const worldMeta = worldMetas[0];
  const sections: string[] = [];

  // World Meta
  if (worldMeta && (worldMeta.tone || worldMeta.tech_level || worldMeta.themes.length || worldMeta.magic_system)) {
    const lines = ['WORLD META:'];
    if (worldMeta.tone) lines.push(`  Tone: ${worldMeta.tone}`);
    if (worldMeta.tech_level) lines.push(`  Tech Level: ${worldMeta.tech_level}`);
    if (worldMeta.themes.length) lines.push(`  Themes: ${worldMeta.themes.join(', ')}`);
    if (worldMeta.magic_system) lines.push(`  Magic System: ${worldMeta.magic_system}`);
    if (worldMeta.notes) lines.push(`  Notes: ${worldMeta.notes}`);
    sections.push(lines.join('\n'));
  }

  // Lore
  if (lore.length) {
    const lines = [`LORE ENTRIES (${lore.length}):`];
    for (const entry of lore) {
      const firstSentence = entry.content.split('.')[0] + '.';
      lines.push(`  ${entry.title} [${entry.category}]: ${firstSentence}`);
    }
    sections.push(lines.join('\n'));
  }

  // Locations
  if (locations.length) {
    const lines = [`LOCATIONS (${locations.length}):`];
    for (const loc of locations) {
      const type = loc.type ? ` (${loc.type})` : '';
      const desc = loc.description ? `: ${loc.description.split('.')[0]}.` : '';
      lines.push(`  ${loc.name}${type}${desc}`);
    }
    sections.push(lines.join('\n'));
  }

  // Factions
  if (factions.length) {
    const lines = [`FACTIONS (${factions.length}):`];
    for (const f of factions) {
      const desc = f.description ? `: ${f.description.split('.')[0]}.` : '';
      lines.push(`  ${f.name}${desc}`);
    }
    sections.push(lines.join('\n'));
  }

  // NPCs
  if (npcs.length) {
    const lines = [`NPCs (${npcs.length}):`];
    for (const npc of npcs) {
      const role = npc.role ? ` (${npc.role})` : '';
      const loc = npc.location_id
        ? (() => {
            const l = locations.find((lo) => lo.id === npc.location_id);
            return l ? ` — in ${l.name}` : '';
          })()
        : '';
      lines.push(`  ${npc.name}${role}${loc}`);
    }
    sections.push(lines.join('\n'));
  }

  // Plot Arcs
  if (plots.length) {
    const lines = ['PLOT ARCS:'];
    for (const arc of plots) {
      lines.push(`  ${arc.title} (${arc.status}): ${arc.summary}`);
    }
    sections.push(lines.join('\n'));
  }

  // Sessions
  if (sessions.length) {
    const sorted = [...sessions].sort((a, b) => a.session_number - b.session_number);
    const lines = ['SESSIONS:'];
    for (const s of sorted) {
      const recap = s.summary ? `: ${s.summary.split('.')[0]}.` : '';
      lines.push(`  Session ${s.session_number} "${s.title}" (${s.status})${recap}`);
    }
    sections.push(lines.join('\n'));
  }

  if (sections.length === 0) {
    return 'This is a new campaign with no content yet.';
  }

  return sections.join('\n\n');
}

export async function getCampaignStats(campaignId: string) {
  const filter = { campaign_id: campaignId } as Record<string, unknown>;

  const [locations, factions, npcs, lore, plots, sessions, worldMetas] = await Promise.all([
    locationStore.getAll(filter as Partial<Location>),
    factionStore.getAll(filter as Partial<Faction>),
    npcStore.getAll(filter as Partial<NPC>),
    loreStore.getAll(filter as Partial<LoreEntry>),
    plotStore.getAll(filter as Partial<PlotArc>),
    sessionStore.getAll(filter as Partial<Session>),
    worldMetaStore.getAll(filter as Partial<WorldMeta>),
  ]);

  return {
    locations: locations.length,
    factions: factions.length,
    npcs: npcs.length,
    lore: lore.length,
    plots: plots.length,
    sessions: sessions.length,
    hasWorldMeta: worldMetas.length > 0,
  };
}
