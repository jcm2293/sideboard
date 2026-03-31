'use client';

import { use, useState } from 'react';
import { locationStore } from '@/lib/data';
import { useCampaignData } from '@/hooks/use-campaign-data';
import LocationCard from '@/components/campaign/LocationCard';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function LocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { items, create, update, remove } = useCampaignData(locationStore, id);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const topLevel = items.filter((l) => !l.parent_id);
  const getChildren = (pid: string) => items.filter((l) => l.parent_id === pid);

  function handleSave() {
    if (!name.trim()) return;
    const data = { campaign_id: id, name: name.trim(), type, description, parent_id: parentId || null, notes };
    if (editId) update(editId, data);
    else create(data as never);
    resetForm();
  }

  function startEdit(locId: string) {
    const loc = items.find((i) => i.id === locId);
    if (loc) {
      setEditId(locId);
      setName(loc.name);
      setType(loc.type);
      setDescription(loc.description);
      setParentId(loc.parent_id ?? '');
      setNotes(loc.notes);
      setShowForm(true);
    }
  }

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setName('');
    setType('');
    setDescription('');
    setParentId('');
    setNotes('');
  }

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-accent">Locations</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary px-3 py-1.5 rounded text-sm">+ Add Location</button>
      </div>

      {showForm && (
        <div className="card-parchment rounded p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={fc} autoFocus />
            <input type="text" placeholder="Type (e.g. City, Dungeon, Tavern)" value={type} onChange={(e) => setType(e.target.value)} className={fc} />
          </div>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={fc}>
            <option value="">No parent (top-level)</option>
            {items.filter((l) => l.id !== editId).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <textarea placeholder="Description..." value={description} onChange={(e) => setDescription(e.target.value)} className={`${fc} resize-none`} rows={3} />
          <textarea placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fc} resize-none`} rows={2} />
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary px-4 py-2 rounded text-sm">Save</button>
            <button onClick={resetForm} className="text-muted hover:text-foreground px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {topLevel.map((loc) => (
          <LocationCard
            key={loc.id}
            location={loc}
            children={getChildren(loc.id)}
            onEdit={() => startEdit(loc.id)}
            onDelete={() => setDeleteId(loc.id)}
          />
        ))}
        {items.length === 0 && <p className="text-sm text-muted">No locations yet.</p>}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Location"
        message="Are you sure? Child locations will become top-level."
        onConfirm={() => { if (deleteId) remove(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
