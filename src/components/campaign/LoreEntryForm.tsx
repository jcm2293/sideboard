'use client';

import { useState } from 'react';
import type { LoreEntry, LoreCategory } from '@/types';

const CATEGORIES: LoreCategory[] = ['history', 'geography', 'culture', 'religion', 'magic', 'politics', 'other'];

interface LoreEntryFormProps {
  initial?: LoreEntry;
  onSave: (data: Omit<LoreEntry, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
  campaignId: string;
}

export default function LoreEntryForm({ initial, onSave, onCancel, campaignId }: LoreEntryFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<LoreCategory>(initial?.category ?? 'other');
  const [content, setContent] = useState(initial?.content ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');

  function handleSubmit() {
    if (!title.trim()) return;
    onSave({
      campaign_id: campaignId,
      title: title.trim(),
      category,
      content,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
  }

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="card-parchment rounded p-4 space-y-3">
      <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className={fc} autoFocus />
      <select value={category} onChange={(e) => setCategory(e.target.value as LoreCategory)} className={fc}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
        ))}
      </select>
      <textarea placeholder="Content..." value={content} onChange={(e) => setContent(e.target.value)} className={`${fc} resize-none`} rows={6} />
      <input type="text" placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} className={fc} />
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="btn-primary px-4 py-2 rounded text-sm">Save</button>
        <button onClick={onCancel} className="btn-ghost px-4 py-2 rounded text-sm">Cancel</button>
      </div>
    </div>
  );
}
