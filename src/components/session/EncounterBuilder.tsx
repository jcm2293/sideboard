'use client';

import { useState, useEffect } from 'react';
import { encounterStore, statBlockStore } from '@/lib/data';
import EntityPicker from '@/components/shared/EntityPicker';
import StatBlockDisplay from '@/components/campaign/StatBlockDisplay';
import type { Encounter, StatBlock } from '@/types';

interface EncounterBuilderProps {
  sceneId: string;
  campaignId: string;
  encounters: Encounter[];
  onUpdate: () => void;
}

const DIFFICULTIES = ['trivial', 'easy', 'medium', 'hard', 'deadly'];

export default function EncounterBuilder({ sceneId, campaignId, encounters, onUpdate }: EncounterBuilderProps) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [statBlockIds, setStatBlockIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [expandedEnc, setExpandedEnc] = useState<string | null>(null);
  const [statBlocks, setStatBlocks] = useState<StatBlock[]>([]);

  useEffect(() => {
    statBlockStore.getAll({ campaign_id: campaignId } as never).then(setStatBlocks);
  }, [campaignId]);

  async function handleSave() {
    if (!name.trim()) return;
    const data = { scene_id: sceneId, name: name.trim(), description, difficulty, stat_block_ids: statBlockIds, notes };
    if (editId) await encounterStore.update(editId, data);
    else await encounterStore.create(data);
    resetForm();
    onUpdate();
  }

  function startEdit(enc: Encounter) {
    setEditId(enc.id);
    setName(enc.name);
    setDescription(enc.description);
    setDifficulty(enc.difficulty);
    setStatBlockIds(enc.stat_block_ids);
    setNotes(enc.notes);
    setShowForm(true);
  }

  async function handleDelete(encId: string) {
    await encounterStore.delete(encId);
    onUpdate();
  }

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setName('');
    setDescription('');
    setDifficulty('medium');
    setStatBlockIds([]);
    setNotes('');
  }

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">Encounters</h4>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="text-gold hover:text-accent text-xs">+ Encounter</button>
      </div>

      {showForm && (
        <div className="bg-surface-light border border-border rounded p-3 mb-2 space-y-2">
          <input type="text" placeholder="Encounter name" value={name} onChange={(e) => setName(e.target.value)} className={fc} autoFocus />
          <textarea placeholder="Description..." value={description} onChange={(e) => setDescription(e.target.value)} className={`${fc} resize-none`} rows={2} />
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={fc}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
          <div>
            <label className="block text-xs text-muted mb-1">Stat Blocks</label>
            <EntityPicker
              items={statBlocks.map((sb) => ({ id: sb.id, label: `${sb.name} (CR ${sb.challenge_rating})` }))}
              selected={statBlockIds}
              onChange={setStatBlockIds}
              placeholder="Search bestiary..."
            />
          </div>
          <textarea placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fc} resize-none`} rows={2} />
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary px-3 py-1.5 rounded text-xs">Save</button>
            <button onClick={resetForm} className="text-muted hover:text-foreground px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}

      {encounters.map((enc) => {
        const encBlocks = statBlocks.filter((sb) => enc.stat_block_ids.includes(sb.id));
        const isExpanded = expandedEnc === enc.id;
        return (
          <div key={enc.id} className="card-parchment rounded p-2 mb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{enc.name}</span>
                <span className="text-xs text-muted capitalize">{enc.difficulty}</span>
                {encBlocks.length > 0 && (
                  <button
                    onClick={() => setExpandedEnc(isExpanded ? null : enc.id)}
                    className="text-xs text-gold hover:text-accent"
                  >
                    {isExpanded ? 'Hide' : 'Show'} {encBlocks.length} creature{encBlocks.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(enc)} className="text-muted hover:text-foreground text-xs">Edit</button>
                <button onClick={() => handleDelete(enc.id)} className="text-muted hover:text-danger text-xs">Del</button>
              </div>
            </div>
            {isExpanded && encBlocks.length > 0 && (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {encBlocks.map((sb) => (
                  <StatBlockDisplay key={sb.id} statBlock={sb} compact />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
