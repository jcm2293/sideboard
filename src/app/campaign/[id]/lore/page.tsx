'use client';

import { use, useState } from 'react';
import { loreStore } from '@/lib/data';
import { useCampaignData } from '@/hooks/use-campaign-data';
import LoreEntryForm from '@/components/campaign/LoreEntryForm';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import type { LoreCategory } from '@/types';

const CATEGORIES: LoreCategory[] = ['history', 'geography', 'culture', 'religion', 'magic', 'politics', 'other'];

export default function LorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { items, create, update, remove } = useCampaignData(loreStore, id);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<LoreCategory | ''>('');

  const filtered = filterCat ? items.filter((i) => i.category === filterCat) : items;
  const editItem = editId ? items.find((i) => i.id === editId) : undefined;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-accent">Lore</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); }} className="btn-primary px-3 py-1.5 rounded text-sm">+ Add Entry</button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterCat('')} className={`px-3 py-1 rounded text-xs ${!filterCat ? 'bg-accent text-amber-50' : 'bg-surface-light text-muted hover:text-foreground border border-border'}`}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setFilterCat(c)} className={`px-3 py-1 rounded text-xs capitalize ${filterCat === c ? 'bg-accent text-amber-50' : 'bg-surface-light text-muted hover:text-foreground border border-border'}`}>{c}</button>
        ))}
      </div>

      {(showForm || editId) && (
        <div className="mb-4">
          <LoreEntryForm
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
        {filtered.map((entry) => (
          <div key={entry.id} className="card-parchment rounded p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-display">{entry.title}</h3>
                  <span className="text-xs bg-surface-light text-muted px-2 py-0.5 rounded capitalize border border-border">{entry.category}</span>
                </div>
                <p className="text-sm text-muted line-clamp-2">{entry.content}</p>
                {entry.tags.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {entry.tags.map((t) => (
                      <span key={t} className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded border border-gold/30">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 ml-2 shrink-0">
                <button onClick={() => setEditId(entry.id)} className="text-muted hover:text-accent text-sm">Edit</button>
                <button onClick={() => setDeleteId(entry.id)} className="text-muted hover:text-danger text-sm">Del</button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted italic">No lore entries yet.</p>}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Lore Entry"
        message="Are you sure you want to delete this lore entry?"
        onConfirm={() => { if (deleteId) remove(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
