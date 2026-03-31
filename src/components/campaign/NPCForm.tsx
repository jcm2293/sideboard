'use client';

import { useState } from 'react';
import type { NPC } from '@/types';

interface NPCFormProps {
  initial?: NPC;
  onSave: (data: Omit<NPC, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
  campaignId: string;
}

export default function NPCForm({ initial, onSave, onCancel, campaignId }: NPCFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [race, setRace] = useState(initial?.race ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [alignment, setAlignment] = useState(initial?.alignment ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [personality, setPersonality] = useState(initial?.personality ?? '');
  const [motivations, setMotivations] = useState(initial?.motivations ?? '');
  const [secrets, setSecrets] = useState(initial?.secrets ?? '');
  const [connections, setConnections] = useState(initial?.connections ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  function handleSubmit() {
    if (!name.trim()) return;
    onSave({
      campaign_id: campaignId,
      name: name.trim(),
      race, role, alignment, description, personality,
      motivations, secrets, connections, notes,
      location_id: initial?.location_id ?? null,
      faction_id: initial?.faction_id ?? null,
      stat_block_id: initial?.stat_block_id ?? null,
    });
  }

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="card-parchment rounded p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={fc} autoFocus />
        <input type="text" placeholder="Race" value={race} onChange={(e) => setRace(e.target.value)} className={fc} />
        <input type="text" placeholder="Role (e.g. Tavern keeper, Villain)" value={role} onChange={(e) => setRole(e.target.value)} className={fc} />
        <input type="text" placeholder="Alignment" value={alignment} onChange={(e) => setAlignment(e.target.value)} className={fc} />
      </div>
      <textarea placeholder="Description..." value={description} onChange={(e) => setDescription(e.target.value)} className={`${fc} resize-none`} rows={3} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <textarea placeholder="Personality traits..." value={personality} onChange={(e) => setPersonality(e.target.value)} className={`${fc} resize-none`} rows={2} />
        <textarea placeholder="Motivations..." value={motivations} onChange={(e) => setMotivations(e.target.value)} className={`${fc} resize-none`} rows={2} />
        <textarea placeholder="Secrets..." value={secrets} onChange={(e) => setSecrets(e.target.value)} className={`${fc} resize-none`} rows={2} />
        <textarea placeholder="Connections..." value={connections} onChange={(e) => setConnections(e.target.value)} className={`${fc} resize-none`} rows={2} />
      </div>
      <textarea placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fc} resize-none`} rows={2} />
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="btn-primary px-4 py-2 rounded text-sm">Save</button>
        <button onClick={onCancel} className="btn-ghost px-4 py-2 rounded text-sm">Cancel</button>
      </div>
    </div>
  );
}
