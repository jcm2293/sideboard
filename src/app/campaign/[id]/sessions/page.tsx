'use client';

import { use, useState } from 'react';
import { sessionStore } from '@/lib/data';
import { useCampaignData } from '@/hooks/use-campaign-data';
import SessionList from '@/components/session/SessionList';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import type { SessionStatus } from '@/types';

export default function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { items, create, remove } = useCampaignData(sessionStore, id);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [sessionNumber, setSessionNumber] = useState('');
  const [status, setStatus] = useState<SessionStatus>('planning');
  const [date, setDate] = useState('');

  function handleCreate() {
    if (!title.trim()) return;
    create({
      campaign_id: id,
      title: title.trim(),
      session_number: parseInt(sessionNumber) || items.length + 1,
      status,
      date: date || null,
      summary: '',
      prep_notes: '',
    } as never);
    setTitle('');
    setSessionNumber('');
    setStatus('planning');
    setDate('');
    setShowForm(false);
  }

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-accent">Sessions</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary px-3 py-1.5 rounded text-sm">+ New Session</button>
      </div>

      {showForm && (
        <div className="card-parchment rounded p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" placeholder="Session title" value={title} onChange={(e) => setTitle(e.target.value)} className={fc} autoFocus />
            <input type="number" placeholder={`Session # (default: ${items.length + 1})`} value={sessionNumber} onChange={(e) => setSessionNumber(e.target.value)} className={fc} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select value={status} onChange={(e) => setStatus(e.target.value as SessionStatus)} className={fc}>
              <option value="planning">Planning</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fc} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary px-4 py-2 rounded text-sm">Create</button>
            <button onClick={() => setShowForm(false)} className="text-muted hover:text-foreground px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <SessionList sessions={items} campaignId={id} onDelete={(sid) => setDeleteId(sid)} />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Session"
        message="This will also delete all scenes and encounters in this session."
        onConfirm={() => { if (deleteId) remove(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
