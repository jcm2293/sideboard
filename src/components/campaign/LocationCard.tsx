'use client';

import type { Location } from '@/types';

interface LocationCardProps {
  location: Location;
  children?: Location[];
  onEdit: () => void;
  onDelete: () => void;
}

export default function LocationCard({ location, children = [], onEdit, onDelete }: LocationCardProps) {
  return (
    <div className="card-parchment rounded p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display">{location.name}</h3>
            {location.type && <span className="text-xs bg-surface-light text-muted px-2 py-0.5 rounded border border-border">{location.type}</span>}
          </div>
          {location.description && <p className="text-sm text-muted line-clamp-2">{location.description}</p>}
          {children.length > 0 && (
            <div className="mt-2 pl-4 border-l-2 border-gold/40 space-y-1">
              {children.map((child) => (
                <div key={child.id} className="text-sm text-muted">
                  {child.name} {child.type && <span className="text-xs">({child.type})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1 ml-2 shrink-0">
          <button onClick={onEdit} className="text-muted hover:text-accent text-sm">Edit</button>
          <button onClick={onDelete} className="text-muted hover:text-danger text-sm">Del</button>
        </div>
      </div>
    </div>
  );
}
