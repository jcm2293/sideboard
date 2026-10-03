'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { playerCharacterStore, customSpellStore } from '@/lib/data';
import { useShelfStore } from '@/stores/shelf-store';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { ALL_HOMEBREW_CLASSES } from '@/data/homebrew-classes';
import type { PlayerCharacter, CustomSpell } from '@/types';

export default function PlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { addItem } = useShelfStore();

  const [characters, setCharacters] = useState<PlayerCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<'official' | 'homebrew'>('official');
  // Cached custom spells for the campaign — passed to PDF export so custom-spell
  // cards render with their full description instead of name-only.
  const [customSpells, setCustomSpells] = useState<CustomSpell[]>([]);

  // Upload dialog: a new character (pcId null) or a re-upload into an existing one.
  const [uploadFor, setUploadFor] = useState<{ pcId: string | null; name?: string } | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);

  useEffect(() => {
    playerCharacterStore.getAll({ campaign_id: id } as Partial<PlayerCharacter>).then(data => {
      setCharacters(data);
      setLoading(false);
    });
    customSpellStore
      .getAll({ campaign_id: id } as Partial<CustomSpell>)
      .then(setCustomSpells);
  }, [id]);

  function openUpload(pcId: string | null, name?: string) {
    setError(null);
    setPdfFile(null);
    setJsonFile(null);
    setUploadFor({ pcId, name });
  }

  // The Beyond PDF is required; the character JSON is an optional overlay of full rules text.
  async function handleParse() {
    if (!uploadFor || !pdfFile) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      if (jsonFile) formData.append('json', jsonFile);
      const res = await fetch('/api/parse-character', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `Parse failed (${res.status})`);
        return;
      }
      if (!data.character) {
        setError('No character data returned from parser');
        return;
      }
      sessionStorage.setItem('parsedCharacter', JSON.stringify(data.character));
      sessionStorage.setItem('parsedNotices', JSON.stringify(data.notices ?? []));
      router.push(`/campaign/${id}/players/${uploadFor.pcId ?? 'new'}?parsed=true`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  }

  async function handleExport(pc: PlayerCharacter) {
    setError(null);
    const res = await fetch('/api/export-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character: pc, customSpells }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || `Export failed (${res.status})`);
      return;
    }
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
          <button onClick={() => openUpload(null)} className="btn-primary px-4 py-2 rounded text-sm">
            Upload Character
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-ghost px-4 py-2 rounded text-sm"
          >
            Create Manually
          </button>
        </div>
      </div>

      {/* Error message (the upload dialog shows its own) */}
      {error && !uploadFor && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-900/40 rounded text-sm text-red-300">
          <div className="flex justify-between items-start">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-2">✕</button>
          </div>
        </div>
      )}

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
                  onClick={() => openUpload(pc.id, pc.name)}
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

      {/* Create-character modal: choose Official (blank edit form) or Homebrew (wizard) */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setCreateOpen(false)}>
          <div
            className="card-parchment rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="font-display text-lg text-accent">Create Character</h3>
              <button onClick={() => setCreateOpen(false)} className="text-muted hover:text-foreground">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border mb-4">
              {(['official', 'homebrew'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCreateTab(t)}
                  className={`px-4 py-2 text-sm font-medium ${
                    createTab === t
                      ? 'text-accent border-b-2 border-accent -mb-px'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {t === 'official' ? 'Official Class' : 'Homebrew Class'}
                </button>
              ))}
            </div>

            {createTab === 'official' ? (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Standard manual entry. Opens an empty character sheet for any 5e class — fill in everything by hand.
                </p>
                <button
                  onClick={() => {
                    setCreateOpen(false);
                    router.push(`/campaign/${id}/players/new`);
                  }}
                  className="btn-primary px-4 py-2 rounded text-sm"
                >
                  Create Blank Character →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {ALL_HOMEBREW_CLASSES.length === 0 ? (
                  <p className="text-sm text-muted italic">
                    No homebrew classes available. Drop a ClassDefinition into <code>/src/data/homebrew-classes/</code> to add one.
                  </p>
                ) : (
                  ALL_HOMEBREW_CLASSES.map((cls) => (
                    <div key={cls.id} className="border border-border rounded p-4 bg-surface-light/40">
                      <div className="flex items-baseline justify-between mb-1">
                        <h4 className="font-display text-base text-accent">{cls.name}</h4>
                        <span className="text-xs text-muted">{cls.source}</span>
                      </div>
                      <p className="text-sm text-muted mb-3">{cls.description}</p>
                      <button
                        onClick={() => {
                          setCreateOpen(false);
                          router.push(`/campaign/${id}/players/new-homebrew?class=${cls.id}`);
                        }}
                        className="btn-primary px-3 py-1.5 rounded text-xs"
                      >
                        Select
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload dialog: the Beyond PDF, plus its character JSON if you have it */}
      {uploadFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !uploading && setUploadFor(null)}>
          <div className="card-parchment rounded-lg p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="font-display text-lg text-accent">
                {uploadFor.pcId ? `Re-upload ${uploadFor.name ?? 'character'}` : 'Upload Character'}
              </h3>
              <button onClick={() => setUploadFor(null)} disabled={uploading} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>

            <label className="block text-sm font-medium mb-1">D&amp;D Beyond character sheet PDF</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm mb-4 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-accent/15 file:text-accent file:cursor-pointer"
            />

            <label className="block text-sm font-medium mb-1">
              Beyond character JSON <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => setJsonFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-accent/15 file:text-accent file:cursor-pointer"
            />
            <p className="text-xs text-muted mt-1 mb-4">
              Adds Beyond&apos;s full rules text for features, options, and spells. Save it from
              character-service.dndbeyond.com/character/v5/character/&lt;character id&gt;.
            </p>

            {error && (
              <div className="mb-4 p-2 bg-red-900/20 border border-red-900/40 rounded text-sm text-red-300">{error}</div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setUploadFor(null)} disabled={uploading} className="btn-ghost px-4 py-2 rounded text-sm">
                Cancel
              </button>
              <button onClick={handleParse} disabled={!pdfFile || uploading} className="btn-primary px-4 py-2 rounded text-sm disabled:opacity-50">
                {uploading ? 'Parsing…' : 'Parse'}
              </button>
            </div>
          </div>
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
