'use client';

import { use, useState } from 'react';
import { npcStore } from '@/lib/data';
import { useCampaignData } from '@/hooks/use-campaign-data';
import NPCCard from '@/components/campaign/NPCCard';
import NPCForm from '@/components/campaign/NPCForm';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function NPCsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { items, create, update, remove } = useCampaignData(npcStore, id);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = items.filter(
    (npc) =>
      npc.name.toLowerCase().includes(search.toLowerCase()) ||
      npc.role.toLowerCase().includes(search.toLowerCase())
  );

  const editItem = editId ? items.find((i) => i.id === editId) : undefined;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-accent">NPCs</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); }} className="btn-primary px-3 py-1.5 rounded text-sm">+ Add NPC</button>
      </div>

      <input
        type="text"
        placeholder="Search NPCs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:border-accent"
      />

      {(showForm || editId) && (
        <div className="mb-4">
          <NPCForm
            campaignId={id}
            initial={editItem}
            onSave={(data) => {
              if (editId) update(editId, data);
              else create(data as never);
              setShowForm(false);
              setEditId(null);
            }}
            onCancel={() => { setShowForm(false); setEditId(null); }}
          />
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((npc) => (
          <NPCCard
            key={npc.id}
            npc={npc}
            campaignId={id}
            onEdit={() => setEditId(npc.id)}
            onDelete={() => setDeleteId(npc.id)}
          />
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted">{search ? 'No matches.' : 'No NPCs yet. Add one above.'}</p>}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete NPC"
        message="Are you sure you want to delete this NPC?"
        onConfirm={() => { if (deleteId) remove(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
