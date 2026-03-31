'use client';

import type { PlotArc, PlotStatus } from '@/types';

const STATUS_COLORS: Record<PlotStatus, string> = {
  active: 'bg-success/20 text-success border border-success/30',
  resolved: 'bg-muted/20 text-muted border border-muted/30',
  abandoned: 'bg-danger/20 text-danger border border-danger/30',
};

interface PlotArcCardProps {
  arc: PlotArc;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: PlotStatus) => void;
}

export default function PlotArcCard({ arc, onEdit, onDelete, onStatusChange }: PlotArcCardProps) {
  return (
    <div className="card-parchment rounded p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display">{arc.title}</h3>
            <select
              value={arc.status}
              onChange={(e) => onStatusChange(e.target.value as PlotStatus)}
              className={`text-xs px-2 py-0.5 rounded cursor-pointer ${STATUS_COLORS[arc.status]}`}
            >
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>
          <p className="text-sm text-muted">{arc.summary}</p>
        </div>
        <div className="flex gap-1 ml-2 shrink-0">
          <button onClick={onEdit} className="text-muted hover:text-accent text-sm">Edit</button>
          <button onClick={onDelete} className="text-muted hover:text-danger text-sm">Del</button>
        </div>
      </div>
    </div>
  );
}
