'use client';

import { useState } from 'react';
import type { Item, ItemType } from '@/types';

const ITEM_TYPES: ItemType[] = ['weapon', 'armor', 'potion', 'quest_item', 'wondrous', 'other'];
const RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'];

interface ItemFormProps {
  initial?: Item;
  onSave: (data: Omit<Item, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
  campaignId: string;
}

export default function ItemForm({ initial, onSave, onCancel, campaignId }: ItemFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<ItemType>(initial?.type ?? 'other');
  const [rarity, setRarity] = useState(initial?.rarity ?? 'common');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [properties, setProperties] = useState(initial?.properties ?? '');
  const [attunement, setAttunement] = useState(initial?.attunement ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  function handleSubmit() {
    if (!name.trim()) return;
    onSave({ campaign_id: campaignId, name: name.trim(), type, rarity, description, properties, attunement, notes });
  }

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="card-parchment rounded p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={fc} autoFocus />
        <select value={type} onChange={(e) => setType(e.target.value as ItemType)} className={fc}>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} className={fc}>
          {RARITIES.map((r) => (
            <option key={r} value={r}>{r.replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
      </div>
      <textarea placeholder="Description..." value={description} onChange={(e) => setDescription(e.target.value)} className={`${fc} resize-none`} rows={3} />
      <textarea placeholder="Properties (e.g. 1d8 slashing, +1 to hit)..." value={properties} onChange={(e) => setProperties(e.target.value)} className={`${fc} resize-none`} rows={2} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={attunement} onChange={(e) => setAttunement(e.target.checked)} className="accent-accent" />
        Requires attunement
      </label>
      <textarea placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fc} resize-none`} rows={2} />
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="btn-primary px-4 py-2 rounded text-sm">Save</button>
        <button onClick={onCancel} className="text-muted hover:text-foreground px-4 py-2 text-sm">Cancel</button>
      </div>
    </div>
  );
}
