'use client';

import { use, useState } from 'react';
import { playerCharacterStore } from '@/lib/data';
import { useCampaignData } from '@/hooks/use-campaign-data';
import PlayerCard from '@/components/campaign/PlayerCard';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function PlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { items, create, update, remove } = useCampaignData(playerCharacterStore, id);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [race, setRace] = useState('');
  const [className, setClassName] = useState('');
  const [level, setLevel] = useState(1);
  const [ac, setAc] = useState(10);
  const [hp, setHp] = useState(10);
  const [backstory, setBackstory] = useState('');
  const [notes, setNotes] = useState('');

  function handleSave() {
    if (!name.trim()) return;
    const data = {
      campaign_id: id,
      name: name.trim(),
      player_name: playerName,
      race,
      class_name: className,
      level,
      armor_class: ac,
      hit_points: hp,
      backstory,
      notes,
    };
    if (editId) update(editId, data);
    else create(data as never);
    resetForm();
  }

  function startEdit(pcId: string) {
    const pc = items.find((i) => i.id === pcId);
    if (pc) {
      setEditId(pcId);
      setName(pc.name);
      setPlayerName(pc.player_name);
      setRace(pc.race);
      setClassName(pc.class_name);
      setLevel(pc.level);
      setAc(pc.armor_class);
      setHp(pc.hit_points);
      setBackstory(pc.backstory);
      setNotes(pc.notes);
      setShowForm(true);
    }
  }

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setName('');
    setPlayerName('');
    setRace('');
    setClassName('');
    setLevel(1);
    setAc(10);
    setHp(10);
    setBackstory('');
    setNotes('');
  }

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-accent">Player Characters</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary px-3 py-1.5 rounded text-sm">+ Add PC</button>
      </div>

      {showForm && (
        <div className="card-parchment rounded p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" placeholder="Character name" value={name} onChange={(e) => setName(e.target.value)} className={fc} autoFocus />
            <input type="text" placeholder="Player name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className={fc} />
            <input type="text" placeholder="Race" value={race} onChange={(e) => setRace(e.target.value)} className={fc} />
            <input type="text" placeholder="Class" value={className} onChange={(e) => setClassName(e.target.value)} className={fc} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Level</label>
              <input type="number" value={level} onChange={(e) => setLevel(parseInt(e.target.value) || 1)} className={fc} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">AC</label>
              <input type="number" value={ac} onChange={(e) => setAc(parseInt(e.target.value) || 0)} className={fc} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">HP</label>
              <input type="number" value={hp} onChange={(e) => setHp(parseInt(e.target.value) || 0)} className={fc} />
            </div>
          </div>
          <textarea placeholder="Backstory..." value={backstory} onChange={(e) => setBackstory(e.target.value)} className={`${fc} resize-none`} rows={3} />
          <textarea placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fc} resize-none`} rows={2} />
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary px-4 py-2 rounded text-sm">Save</button>
            <button onClick={resetForm} className="text-muted hover:text-foreground px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((pc) => (
          <PlayerCard key={pc.id} pc={pc} onEdit={() => startEdit(pc.id)} onDelete={() => setDeleteId(pc.id)} />
        ))}
        {items.length === 0 && <p className="text-sm text-muted">No player characters yet.</p>}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Player Character"
        message="Are you sure you want to delete this character?"
        onConfirm={() => { if (deleteId) remove(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
