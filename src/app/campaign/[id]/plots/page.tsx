'use client';

import { use, useState } from 'react';
import { plotStore } from '@/lib/data';
import { useCampaignData } from '@/hooks/use-campaign-data';
import PlotArcCard from '@/components/campaign/PlotArcCard';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import type { PlotStatus } from '@/types';

export default function PlotsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { items, create, update, remove } = useCampaignData(plotStore, id);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);

  function handleSave() {
    if (!title.trim()) return;
    if (editId) {
      update(editId, { title: title.trim(), summary: summary.trim() });
    } else {
      create({ campaign_id: id, title: title.trim(), summary: summary.trim(), status: 'active' as PlotStatus, sort_order: items.length } as never);
    }
    setTitle('');
    setSummary('');
    setShowForm(false);
    setEditId(null);
  }

  function startEdit(arcId: string) {
    const arc = items.find((i) => i.id === arcId);
    if (arc) {
      setEditId(arcId);
      setTitle(arc.title);
      setSummary(arc.summary);
      setShowForm(true);
    }
  }

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-accent">Plot Arcs</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); setTitle(''); setSummary(''); }} className="btn-primary px-3 py-1.5 rounded text-sm">+ Add Arc</button>
      </div>

      {showForm && (
        <div className="card-parchment rounded p-4 mb-4 space-y-3">
          <input type="text" placeholder="Arc title" value={title} onChange={(e) => setTitle(e.target.value)} className={fc} autoFocus />
          <textarea placeholder="Summary..." value={summary} onChange={(e) => setSummary(e.target.value)} className={`${fc} resize-none`} rows={3} />
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary px-4 py-2 rounded text-sm">Save</button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="btn-ghost px-4 py-2 rounded text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((arc) => (
          <PlotArcCard
            key={arc.id}
            arc={arc}
            onEdit={() => startEdit(arc.id)}
            onDelete={() => setDeleteId(arc.id)}
            onStatusChange={(status) => update(arc.id, { status })}
          />
        ))}
        {items.length === 0 && <p className="text-sm text-muted italic">No plot arcs yet.</p>}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Plot Arc"
        message="Are you sure you want to delete this plot arc?"
        onConfirm={() => { if (deleteId) remove(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
