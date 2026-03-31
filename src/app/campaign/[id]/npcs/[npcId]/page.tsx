'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { npcStore, locationStore, factionStore } from '@/lib/data';
import type { NPC, Location, Faction } from '@/types';

export default function NPCDetailPage({
  params,
}: {
  params: Promise<{ id: string; npcId: string }>;
}) {
  const { id, npcId } = use(params);
  const [npc, setNpc] = useState<NPC | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [faction, setFaction] = useState<Faction | null>(null);

  useEffect(() => {
    async function load() {
      const n = await npcStore.getById(npcId);
      if (n) {
        setNpc(n);
        if (n.location_id) {
          const loc = await locationStore.getById(n.location_id);
          setLocation(loc ?? null);
        }
        if (n.faction_id) {
          const fac = await factionStore.getById(n.faction_id);
          setFaction(fac ?? null);
        }
      }
    }
    load();
  }, [npcId]);

  if (!npc) return <p className="text-muted italic">Loading...</p>;

  const fields = [
    { label: 'Race', value: npc.race },
    { label: 'Role', value: npc.role },
    { label: 'Alignment', value: npc.alignment },
    { label: 'Personality', value: npc.personality },
    { label: 'Motivations', value: npc.motivations },
    { label: 'Secrets', value: npc.secrets },
    { label: 'Connections', value: npc.connections },
  ].filter((f) => f.value);

  return (
    <div className="max-w-3xl">
      <Link href={`/campaign/${id}/npcs`} className="text-sm text-muted hover:text-accent mb-4 inline-block">&larr; All NPCs</Link>
      <h1 className="font-display text-2xl text-accent mb-1">{npc.name}</h1>
      {npc.description && <p className="text-muted italic mb-4">{npc.description}</p>}

      <div className="divider-ornament text-sm mb-4">◆</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {fields.map((f) => (
          <div key={f.label} className="card-parchment rounded p-3">
            <span className="text-xs text-muted block mb-1 uppercase tracking-wider font-display">{f.label}</span>
            <p className="text-sm">{f.value}</p>
          </div>
        ))}
      </div>

      {(location || faction) && (
        <div className="flex gap-4 mb-4">
          {location && (
            <div className="card-parchment rounded p-3 flex-1">
              <span className="text-xs text-muted block mb-1 uppercase tracking-wider font-display">Location</span>
              <p className="text-sm">{location.name}</p>
            </div>
          )}
          {faction && (
            <div className="card-parchment rounded p-3 flex-1">
              <span className="text-xs text-muted block mb-1 uppercase tracking-wider font-display">Faction</span>
              <p className="text-sm">{faction.name}</p>
            </div>
          )}
        </div>
      )}

      {npc.notes && (
        <div className="card-parchment rounded p-3">
          <span className="text-xs text-muted block mb-1 uppercase tracking-wider font-display">Notes</span>
          <p className="text-sm whitespace-pre-wrap">{npc.notes}</p>
        </div>
      )}
    </div>
  );
}
