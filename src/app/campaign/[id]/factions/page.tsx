'use client';

import { use, useState } from 'react';
import { factionStore } from '@/lib/data';
import { useCampaignData } from '@/hooks/use-campaign-data';
import FactionCard from '@/components/campaign/FactionCard';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function FactionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { items, create, update, remove } = useCampaignData(factionStore, id);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goals, setGoals] = useState('');
  const [leader, setLeader] = useState('');
  const [alignment, setAlignment] = useState('');
  const [notes, setNotes] = useState('');

  function handleSave() {
    if (!name.trim()) return;
    const data = { campaign_id: id, name: name.trim(), description, goals, leader, alignment, notes };
    if (editId) update(editId, data);
    else create(data as never);
    resetForm();
  }

  function startEdit(fId: string) {
    const f = items.find((i) => i.id === fId);
    if (f) {
      setEditId(fId);
      setName(f.name);
      setDescription(f.description);
      setGoals(f.goals);
      setLeader(f.leader);
      setAlignment(f.alignment);
      setNotes(f.notes);
      setShowForm(true);
    }
  }

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setName('');
    setDescription('');
    setGoals('');
    setLeader('');
    setAlignment('');
    setNotes('');
  }

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-accent">Factions</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary px-3 py-1.5 rounded text-sm">+ Add Faction</button>
      </div>

      {showForm && (
        <div className="card-parchment rounded p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={fc} autoFocus />
            <input type="text" placeholder="Alignment" value={alignment} onChange={(e) => setAlignment(e.target.value)} className={fc} />
          </div>
          <input type="text" placeholder="Leader" value={leader} onChange={(e) => setLeader(e.target.value)} className={fc} />
          <textarea placeholder="Description..." value={description} onChange={(e) => setDescription(e.target.value)} className={`${fc} resize-none`} rows={3} />
          <textarea placeholder="Goals..." value={goals} onChange={(e) => setGoals(e.target.value)} className={`${fc} resize-none`} rows={2} />
          <textarea placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fc} resize-none`} rows={2} />
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary px-4 py-2 rounded text-sm">Save</button>
            <button onClick={resetForm} className="text-muted hover:text-foreground px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((f) => (
          <FactionCard key={f.id} faction={f} onEdit={() => startEdit(f.id)} onDelete={() => setDeleteId(f.id)} />
        ))}
        {items.length === 0 && <p className="text-sm text-muted">No factions yet.</p>}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Faction"
        message="Are you sure you want to delete this faction?"
        onConfirm={() => { if (deleteId) remove(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
