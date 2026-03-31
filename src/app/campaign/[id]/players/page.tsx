'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { playerCharacterStore } from '@/lib/data';
import { useShelfStore } from '@/stores/shelf-store';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import type { PlayerCharacter } from '@/types';

export default function PlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { addItem } = useShelfStore();

  const [characters, setCharacters] = useState<PlayerCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  const reuploadPcIdRef = useRef<string | null>(null);

  useEffect(() => {
    playerCharacterStore.getAll({ campaign_id: id } as any).then(data => {
      setCharacters(data);
      setLoading(false);
    });
  }, [id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse-character', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `Parse failed (${res.status})`);
        return;
      }
      if (data.character) {
        sessionStorage.setItem('parsedCharacter', JSON.stringify(data.character));
        router.push(`/campaign/${id}/players/new?parsed=true`);
      } else {
        setError('No character data returned from parser');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload PDF');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const pcId = reuploadPcIdRef.current;
    if (!file || !pcId) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse-character', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `Parse failed (${res.status})`);
        return;
      }
      if (data.character) {
        sessionStorage.setItem('parsedCharacter', JSON.stringify(data.character));
        router.push(`/campaign/${id}/players/${pcId}?parsed=true`);
      } else {
        setError('No character data returned from parser');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload PDF');
    } finally {
      setUploading(false);
      reuploadPcIdRef.current = null;
      if (reuploadInputRef.current) reuploadInputRef.current.value = '';
    }
  }

  async function handleExport(pc: PlayerCharacter) {
    const res = await fetch('/api/export-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pc),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pc.name}-sheet.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function pinToShelf(pc: PlayerCharacter) {
    addItem({
      id: `pc-${pc.id}`,
      type: 'Player Character',
      label: pc.name,
      data: {
        class_name: pc.class_name,
        subclass: pc.subclass,
        level: pc.level,
        armor_class: pc.armor_class,
        ac_source: pc.ac_source,
        hp_max: pc.hp_max,
        passive_perception: pc.passive_perception,
        senses: pc.senses,
        save_modifiers: pc.save_modifiers,
        damage_resistances: pc.damage_resistances,
        damage_immunities: pc.damage_immunities,
        condition_immunities: pc.condition_immunities,
      },
    });
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await playerCharacterStore.delete(deleteId);
    setCharacters(prev => prev.filter(c => c.id !== deleteId));
    setDeleteId(null);
  }

  function triggerReupload(pcId: string) {
    reuploadPcIdRef.current = pcId;
    reuploadInputRef.current?.click();
  }

  if (loading) {
    return (
      <div className="max-w-5xl">
        <p className="text-sm text-muted">Loading player characters...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-accent">Player Characters</h1>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary px-4 py-2 rounded text-sm"
          >
            {uploading ? 'Parsing character sheet...' : 'Upload Character PDF'}
          </button>
          <button
            onClick={() => router.push(`/campaign/${id}/players/new`)}
            className="btn-ghost px-4 py-2 rounded text-sm"
          >
            Create Manually
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-900/40 rounded text-sm text-red-300">
          <div className="flex justify-between items-start">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-2">✕</button>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        type="file"
        accept=".pdf"
        ref={fileInputRef}
        onChange={handleUpload}
        className="hidden"
      />
      <input
        type="file"
        accept=".pdf"
        ref={reuploadInputRef}
        onChange={handleReupload}
        className="hidden"
      />

      {/* Character grid */}
      {characters.length === 0 ? (
        <p className="text-sm text-muted">
          No player characters yet. Upload a D&amp;D Beyond character sheet PDF or create one manually.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map(pc => (
            <div
              key={pc.id}
              className="card-parchment rounded-lg p-5 hover:shadow-lg transition-shadow"
            >
              {/* Identity */}
              <h2 className="font-display text-xl text-accent">{pc.name}</h2>
              <p className="text-sm text-muted">{pc.player_name}</p>
              <p className="text-sm mt-1">
                {pc.class_name}
                {pc.subclass ? ` \u2014 ${pc.subclass}` : ''}
                {' \u2022 Level '}
                {pc.level}
              </p>

              {/* Divider */}
              <hr className="border-border my-3" />

              {/* Key stats */}
              <div className="flex gap-4 text-sm">
                <span>
                  <span className="font-display text-accent">AC</span>{' '}
                  {pc.armor_class}
                  {pc.ac_source ? ` (${pc.ac_source})` : ''}
                </span>
                <span>
                  <span className="font-display text-accent">HP</span>{' '}
                  {pc.hp_max}
                </span>
                <span>
                  <span className="font-display text-accent">PP</span>{' '}
                  {pc.passive_perception}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => router.push(`/campaign/${id}/players/${pc.id}`)}
                  className="btn-ghost px-3 py-1 rounded text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleExport(pc)}
                  className="btn-ghost px-3 py-1 rounded text-xs"
                >
                  Export PDF
                </button>
                <button
                  onClick={() => triggerReupload(pc.id)}
                  className="btn-ghost px-3 py-1 rounded text-xs"
                >
                  Re-upload
                </button>
                <button
                  onClick={() => pinToShelf(pc)}
                  className="btn-ghost px-3 py-1 rounded text-xs"
                >
                  Pin
                </button>
                <button
                  onClick={() => setDeleteId(pc.id)}
                  className="btn-ghost px-3 py-1 rounded text-xs text-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete Player Character"
        message="Are you sure you want to delete this character? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
