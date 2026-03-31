'use client';

import type { Faction } from '@/types';

interface FactionCardProps {
  faction: Faction;
  onEdit: () => void;
  onDelete: () => void;
}

export default function FactionCard({ faction, onEdit, onDelete }: FactionCardProps) {
  return (
    <div className="card-parchment rounded p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display">{faction.name}</h3>
            {faction.alignment && <span className="text-xs bg-surface-light text-muted px-2 py-0.5 rounded border border-border">{faction.alignment}</span>}
          </div>
          {faction.description && <p className="text-sm text-muted line-clamp-2">{faction.description}</p>}
          {faction.leader && <p className="text-xs text-gold mt-1">Leader: {faction.leader}</p>}
        </div>
        <div className="flex gap-1 ml-2 shrink-0">
          <button onClick={onEdit} className="text-muted hover:text-accent text-sm">Edit</button>
          <button onClick={onDelete} className="text-muted hover:text-danger text-sm">Del</button>
        </div>
      </div>
    </div>
  );
}
