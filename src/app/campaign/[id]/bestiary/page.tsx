'use client';

import { use, useState } from 'react';
import { statBlockStore } from '@/lib/data';
import { useCampaignData } from '@/hooks/use-campaign-data';
import StatBlockForm from '@/components/campaign/StatBlockForm';
import StatBlockDisplay from '@/components/campaign/StatBlockDisplay';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function BestiaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { items, create, update, remove } = useCampaignData(statBlockStore, id);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = items.filter((sb) => sb.name.toLowerCase().includes(search.toLowerCase()));
  const editItem = editId ? items.find((i) => i.id === editId) : undefined;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-accent">Bestiary</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); }} className="btn-primary px-3 py-1.5 rounded text-sm">+ Add Stat Block</button>
      </div>

      <input
        type="text"
        placeholder="Search bestiary..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:border-accent"
      />

      {(showForm || editId) && (
        <div className="mb-4">
          <StatBlockForm
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

      <div className="space-y-4">
        {filtered.map((sb) => (
          <div key={sb.id} className="relative">
            <StatBlockDisplay statBlock={sb} />
            <div className="absolute top-2 right-3 flex gap-2 z-10">
              <button onClick={() => setEditId(sb.id)} className="text-muted hover:text-accent text-sm">Edit</button>
              <button onClick={() => setDeleteId(sb.id)} className="text-muted hover:text-danger text-sm">Del</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted italic">{search ? 'No matches.' : 'No stat blocks yet.'}</p>}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Stat Block"
        message="Are you sure you want to delete this stat block?"
        onConfirm={() => { if (deleteId) remove(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
