'use client';

import Link from 'next/link';
import type { NPC } from '@/types';

interface NPCCardProps {
  npc: NPC;
  campaignId: string;
  onEdit: () => void;
  onDelete: () => void;
}

export default function NPCCard({ npc, campaignId, onEdit, onDelete }: NPCCardProps) {
  return (
    <div className="card-parchment rounded p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/campaign/${campaignId}/npcs/${npc.id}`} className="font-display hover:text-accent">
              {npc.name}
            </Link>
            {npc.race && <span className="text-xs text-muted">{npc.race}</span>}
            {npc.role && <span className="text-xs bg-surface-light text-muted px-2 py-0.5 rounded border border-border">{npc.role}</span>}
          </div>
          {npc.description && <p className="text-sm text-muted line-clamp-2">{npc.description}</p>}
        </div>
        <div className="flex gap-1 ml-2 shrink-0">
          <button onClick={onEdit} className="text-muted hover:text-accent text-sm">Edit</button>
          <button onClick={onDelete} className="text-muted hover:text-danger text-sm">Del</button>
        </div>
      </div>
    </div>
  );
}
