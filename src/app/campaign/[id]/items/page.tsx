'use client';

import { use, useState } from 'react';
import { itemStore } from '@/lib/data';
import { useCampaignData } from '@/hooks/use-campaign-data';
import ItemForm from '@/components/campaign/ItemForm';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function ItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { items, create, update, remove } = useCampaignData(itemStore, id);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const editItem = editId ? items.find((i) => i.id === editId) : undefined;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-accent">Items</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); }} className="btn-primary px-3 py-1.5 rounded text-sm">+ Add Item</button>
      </div>

      {(showForm || editId) && (
        <div className="mb-4">
          <ItemForm
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
        {items.map((item) => (
          <div key={item.id} className="card-parchment rounded p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium">{item.name}</h3>
                  <span className="text-xs bg-surface-light text-muted px-2 py-0.5 rounded capitalize">{item.type.replace('_', ' ')}</span>
                  <span className="text-xs text-gold capitalize">{item.rarity}</span>
                  {item.attunement && <span className="text-xs text-warning">Attunement</span>}
                </div>
                {item.description && <p className="text-sm text-muted line-clamp-2">{item.description}</p>}
              </div>
              <div className="flex gap-1 ml-2 shrink-0">
                <button onClick={() => setEditId(item.id)} className="text-muted hover:text-foreground text-sm">Edit</button>
                <button onClick={() => setDeleteId(item.id)} className="text-muted hover:text-danger text-sm">Del</button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted">No items yet.</p>}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Item"
        message="Are you sure you want to delete this item?"
        onConfirm={() => { if (deleteId) remove(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
