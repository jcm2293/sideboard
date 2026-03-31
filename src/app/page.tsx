'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { campaignStore } from '@/lib/data';
import type { Campaign } from '@/types';

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const data = await campaignStore.getAll();
        setCampaigns(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleCreate() {
    if (!name.trim() || !userId) return;
    const campaign = await campaignStore.create({
      name: name.trim(),
      description: description.trim(),
      user_id: userId,
    });
    setCampaigns([...campaigns, campaign]);
    setName('');
    setDescription('');
    setShowCreate(false);
  }

  async function handleDelete(id: string) {
    await campaignStore.delete(id);
    setCampaigns(campaigns.filter((c) => c.id !== id));
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center parchment-bg">
        <p className="text-muted italic">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 parchment-bg">
      <h1 className="font-logo text-4xl mb-2 text-accent">Sideboard</h1>
      <p className="text-muted mb-2 italic">Campaign Manager for Dungeon Masters</p>
      <div className="divider-ornament text-sm mb-6 w-48">◆</div>

      <div className="w-full max-w-lg">
        {campaigns.length === 0 && !showCreate ? (
          <div className="text-center">
            <p className="text-muted mb-4 italic">No campaigns yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between card-parchment rounded p-4 hover:border-accent"
              >
                <Link
                  href={`/campaign/${c.id}`}
                  className="flex-1 min-w-0"
                >
                  <h3 className="font-display truncate">{c.name}</h3>
                  {c.description && (
                    <p className="text-sm text-muted truncate">{c.description}</p>
                  )}
                </Link>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="ml-3 text-muted hover:text-danger text-sm shrink-0"
                  title="Delete campaign"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {showCreate ? (
          <div className="card-parchment rounded p-4 space-y-3">
            <input
              type="text"
              placeholder="Campaign name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="btn-primary px-4 py-2 rounded text-sm"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="btn-ghost px-4 py-2 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full btn-primary px-4 py-3 rounded text-sm"
          >
            + New Campaign
          </button>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={handleSignOut}
            className="text-muted hover:text-foreground text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
