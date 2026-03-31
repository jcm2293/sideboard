'use client';

import type { PlayerCharacter } from '@/types';

interface PlayerCardProps {
  pc: PlayerCharacter;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PlayerCard({ pc, onEdit, onDelete }: PlayerCardProps) {
  return (
    <div className="card-parchment rounded p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display">{pc.name}</h3>
            <span className="text-xs text-muted">Lv. {pc.level} {pc.class_name}</span>
          </div>
          <p className="text-sm text-muted">Player: {pc.player_name}</p>
          <div className="flex gap-4 text-xs text-muted mt-1">
            <span>AC {pc.armor_class}</span>
            <span>HP {pc.hp_max}</span>
            <span>PP {pc.passive_perception}</span>
          </div>
        </div>
        <div className="flex gap-1 ml-2 shrink-0">
          <button onClick={onEdit} className="text-muted hover:text-accent text-sm">Edit</button>
          <button onClick={onDelete} className="text-muted hover:text-danger text-sm">Del</button>
        </div>
      </div>
    </div>
  );
}
