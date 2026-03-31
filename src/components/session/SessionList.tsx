'use client';

import Link from 'next/link';
import type { Session, SessionStatus } from '@/types';

const STATUS_COLORS: Record<SessionStatus, string> = {
  planning: 'bg-warning/20 text-warning border border-warning/30',
  upcoming: 'bg-gold/20 text-gold border border-gold/30',
  completed: 'bg-muted/20 text-muted border border-muted/30',
};

interface SessionListProps {
  sessions: Session[];
  campaignId: string;
  onDelete: (id: string) => void;
}

export default function SessionList({ sessions, campaignId, onDelete }: SessionListProps) {
  const sorted = [...sessions].sort((a, b) => a.session_number - b.session_number);

  return (
    <div className="space-y-2">
      {sorted.map((s) => (
        <div key={s.id} className="card-parchment rounded p-4">
          <div className="flex items-start justify-between">
            <Link href={`/campaign/${campaignId}/sessions/${s.id}`} className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted">#{s.session_number}</span>
                <h3 className="font-display hover:text-accent">{s.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded capitalize ${STATUS_COLORS[s.status]}`}>{s.status}</span>
              </div>
              {s.date && <p className="text-xs text-muted">{s.date}</p>}
              {s.summary && <p className="text-sm text-muted line-clamp-1 mt-1">{s.summary}</p>}
            </Link>
            <button onClick={() => onDelete(s.id)} className="text-muted hover:text-danger text-sm ml-2 shrink-0">Del</button>
          </div>
        </div>
      ))}
      {sessions.length === 0 && <p className="text-sm text-muted italic">No sessions yet.</p>}
    </div>
  );
}
