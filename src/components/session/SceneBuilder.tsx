'use client';

import { useState, useEffect } from 'react';
import { sceneStore, locationStore, npcStore } from '@/lib/data';
import EntityPicker from '@/components/shared/EntityPicker';
import type { Scene, Location, NPC } from '@/types';

interface SceneBuilderProps {
  sessionId: string;
  campaignId: string;
  scenes: Scene[];
  onUpdate: () => void;
}

export default function SceneBuilder({ sessionId, campaignId, scenes, onUpdate }: SceneBuilderProps) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dmNotes, setDmNotes] = useState('');
  const [locationId, setLocationId] = useState('');
  const [npcIds, setNpcIds] = useState<string[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);

  useEffect(() => {
    Promise.all([
      locationStore.getAll({ campaign_id: campaignId } as never),
      npcStore.getAll({ campaign_id: campaignId } as never),
    ]).then(([locs, npcList]) => {
      setLocations(locs);
      setNpcs(npcList);
    });
  }, [campaignId]);

  const sorted = [...scenes].sort((a, b) => a.sort_order - b.sort_order);

  async function handleSave() {
    if (!title.trim()) return;
    const data = {
      session_id: sessionId,
      title: title.trim(),
      description,
      dm_notes: dmNotes,
      sort_order: editId ? (scenes.find((s) => s.id === editId)?.sort_order ?? scenes.length) : scenes.length,
      location_id: locationId || null,
      npc_ids: npcIds,
    };
    if (editId) {
      await sceneStore.update(editId, data);
    } else {
      await sceneStore.create(data);
    }
    resetForm();
    onUpdate();
  }

  function startEdit(scene: Scene) {
    setEditId(scene.id);
    setTitle(scene.title);
    setDescription(scene.description);
    setDmNotes(scene.dm_notes);
    setLocationId(scene.location_id ?? '');
    setNpcIds(scene.npc_ids);
    setShowForm(true);
  }

  async function handleDelete(sceneId: string) {
    await sceneStore.delete(sceneId);
    onUpdate();
  }

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setTitle('');
    setDescription('');
    setDmNotes('');
    setLocationId('');
    setNpcIds([]);
  }

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg text-accent">Scenes</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary px-3 py-1 rounded text-sm">+ Scene</button>
      </div>

      {showForm && (
        <div className="card-parchment rounded p-4 mb-3 space-y-3">
          <input type="text" placeholder="Scene title" value={title} onChange={(e) => setTitle(e.target.value)} className={fc} autoFocus />
          <textarea placeholder="Description..." value={description} onChange={(e) => setDescription(e.target.value)} className={`${fc} resize-none`} rows={3} />
          <textarea placeholder="DM notes (hidden from players)..." value={dmNotes} onChange={(e) => setDmNotes(e.target.value)} className={`${fc} resize-none`} rows={2} />
          <div>
            <label className="block text-xs text-muted mb-1">Pinned Location</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={fc}>
              <option value="">None</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Pinned NPCs</label>
            <EntityPicker
              items={npcs.map((n) => ({ id: n.id, label: n.name }))}
              selected={npcIds}
              onChange={setNpcIds}
              placeholder="Search NPCs..."
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary px-4 py-2 rounded text-sm">Save</button>
            <button onClick={resetForm} className="text-muted hover:text-foreground px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((scene, i) => {
          const loc = scene.location_id ? locations.find((l) => l.id === scene.location_id) : null;
          const sceneNpcs = npcs.filter((n) => scene.npc_ids.includes(n.id));
          return (
            <div key={scene.id} className="card-parchment rounded p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted">Scene {i + 1}</span>
                    <h4 className="font-medium text-sm">{scene.title}</h4>
                  </div>
                  {scene.description && <p className="text-xs text-muted">{scene.description}</p>}
                  {loc && <p className="text-xs text-gold mt-1">Location: {loc.name}</p>}
                  {sceneNpcs.length > 0 && (
                    <p className="text-xs text-muted mt-1">NPCs: {sceneNpcs.map((n) => n.name).join(', ')}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-2 shrink-0">
                  <button onClick={() => startEdit(scene)} className="text-muted hover:text-foreground text-xs">Edit</button>
                  <button onClick={() => handleDelete(scene.id)} className="text-muted hover:text-danger text-xs">Del</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
