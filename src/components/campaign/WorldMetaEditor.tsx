'use client';

import { useState, useEffect } from 'react';
import { worldMetaStore } from '@/lib/data';
import type { WorldMeta } from '@/types';

export default function WorldMetaEditor({ campaignId }: { campaignId: string }) {
  const [meta, setMeta] = useState<WorldMeta | null>(null);
  const [tone, setTone] = useState('');
  const [techLevel, setTechLevel] = useState('');
  const [themes, setThemes] = useState('');
  const [magicSystem, setMagicSystem] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    worldMetaStore.getAll({ campaign_id: campaignId } as Partial<WorldMeta>).then((results) => {
      const existing = results[0];
      if (existing) {
        setMeta(existing);
        setTone(existing.tone);
        setTechLevel(existing.tech_level);
        setThemes(existing.themes.join(', '));
        setMagicSystem(existing.magic_system);
        setNotes(existing.notes);
      }
    });
  }, [campaignId]);

  async function handleSave() {
    const data = {
      campaign_id: campaignId,
      tone,
      tech_level: techLevel,
      themes: themes.split(',').map((t) => t.trim()).filter(Boolean),
      magic_system: magicSystem,
      notes,
    };
    if (meta) {
      const updated = await worldMetaStore.update(meta.id, data);
      if (updated) setMeta(updated);
    } else {
      const created = await worldMetaStore.create(data);
      setMeta(created);
    }
  }

  const fieldClass =
    'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg text-accent">World Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Tone</label>
          <input
            type="text"
            placeholder="e.g. Dark fantasy, Lighthearted adventure"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Tech Level</label>
          <input
            type="text"
            placeholder="e.g. Medieval, Steampunk, Magitech"
            value={techLevel}
            onChange={(e) => setTechLevel(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Themes (comma-separated)</label>
          <input
            type="text"
            placeholder="e.g. Redemption, Power, Discovery"
            value={themes}
            onChange={(e) => setThemes(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Magic System</label>
          <input
            type="text"
            placeholder="e.g. Vancian, Wild magic, Low magic"
            value={magicSystem}
            onChange={(e) => setMagicSystem(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted mb-1 uppercase tracking-wider">World Notes</label>
        <textarea
          placeholder="General notes about your world..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${fieldClass} resize-none`}
          rows={4}
        />
      </div>
      <button
        onClick={handleSave}
        className="btn-primary px-4 py-2 rounded text-sm"
      >
        Save World Details
      </button>
    </div>
  );
}
