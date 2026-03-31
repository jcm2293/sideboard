'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { sessionStore, sceneStore, encounterStore } from '@/lib/data';
import SceneBuilder from '@/components/session/SceneBuilder';
import EncounterBuilder from '@/components/session/EncounterBuilder';
import type { Session, Scene, Encounter } from '@/types';

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [encounters, setEncounters] = useState<Record<string, Encounter[]>>({});
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState('');
  const [prepNotes, setPrepNotes] = useState('');

  const loadData = useCallback(async () => {
    const s = await sessionStore.getById(sessionId);
    if (s) {
      setSession(s);
      setSummary(s.summary);
      setPrepNotes(s.prep_notes);
    }
    const sc = await sceneStore.getAll({ session_id: sessionId } as never);
    setScenes(sc);
    const enc: Record<string, Encounter[]> = {};
    for (const scene of sc) {
      enc[scene.id] = await encounterStore.getAll({ scene_id: scene.id } as never);
    }
    setEncounters(enc);
  }, [sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSaveNotes() {
    await sessionStore.update(sessionId, { summary, prep_notes: prepNotes });
    const updated = await sessionStore.getById(sessionId);
    setSession(updated ?? null);
    setEditing(false);
  }

  if (!session) return <p className="text-muted">Loading...</p>;

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/campaign/${id}/sessions`} className="text-sm text-muted hover:text-foreground mb-2 inline-block">&larr; All Sessions</Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">#{session.session_number}</span>
          <h1 className="font-display text-2xl text-accent">{session.title}</h1>
          <span className="text-xs bg-surface-light text-muted px-2 py-0.5 rounded capitalize">{session.status}</span>
        </div>
        {session.date && <p className="text-sm text-muted mt-1">{session.date}</p>}
      </div>

      <div className="card-parchment rounded p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg text-accent">Prep Notes</h3>
          <button onClick={() => setEditing(!editing)} className="text-muted hover:text-foreground text-sm">
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted mb-1">Summary</label>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className={`${fc} resize-none`} rows={3} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Prep Notes</label>
              <textarea value={prepNotes} onChange={(e) => setPrepNotes(e.target.value)} className={`${fc} resize-none`} rows={4} />
            </div>
            <button onClick={handleSaveNotes} className="btn-primary px-4 py-2 rounded text-sm">Save</button>
          </div>
        ) : (
          <div>
            {session.summary && (
              <div className="mb-2">
                <span className="text-xs text-muted">Summary</span>
                <p className="text-sm whitespace-pre-wrap">{session.summary}</p>
              </div>
            )}
            {session.prep_notes && (
              <div>
                <span className="text-xs text-muted">Prep Notes</span>
                <p className="text-sm whitespace-pre-wrap">{session.prep_notes}</p>
              </div>
            )}
            {!session.summary && !session.prep_notes && (
              <p className="text-sm text-muted">No notes yet. Click Edit to add.</p>
            )}
          </div>
        )}
      </div>

      <SceneBuilder sessionId={sessionId} campaignId={id} scenes={scenes} onUpdate={loadData} />

      {scenes.length > 0 && (
        <div className="space-y-4">
          {scenes.sort((a, b) => a.sort_order - b.sort_order).map((scene) => (
            <div key={scene.id} className="card-parchment rounded p-4">
              <h4 className="text-sm font-medium mb-2">Encounters for: {scene.title}</h4>
              <EncounterBuilder
                sceneId={scene.id}
                campaignId={id}
                encounters={encounters[scene.id] ?? []}
                onUpdate={loadData}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
