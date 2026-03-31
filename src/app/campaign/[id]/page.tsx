'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { campaignStore } from '@/lib/data';
import WorldMetaEditor from '@/components/campaign/WorldMetaEditor';
import SectionDivider from '@/components/shared/SectionDivider';
import type { Campaign } from '@/types';

export default function CampaignOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    campaignStore.getById(id).then((c) => {
      if (c) {
        setCampaign(c);
        setName(c.name);
        setDescription(c.description);
      }
    });
  }, [id]);

  async function handleSave() {
    if (!name.trim()) return;
    const updated = await campaignStore.update(id, {
      name: name.trim(),
      description: description.trim(),
    });
    if (updated) {
      setCampaign(updated);
      setEditing(false);
    }
  }

  if (!campaign) {
    return <p className="text-muted italic">Loading...</p>;
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        {editing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-light border border-border rounded px-3 py-2 text-lg font-display focus:outline-none focus:border-accent"
              autoFocus
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="btn-primary px-4 py-2 rounded text-sm"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="btn-ghost px-4 py-2 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-2xl text-accent">{campaign.name}</h1>
              <button
                onClick={() => setEditing(true)}
                className="text-muted hover:text-accent text-sm"
              >
                Edit
              </button>
            </div>
            {campaign.description && (
              <p className="text-muted italic">{campaign.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Campaign Builder CTA */}
      <Link
        href={`/campaign/${id}/builder`}
        className="block card-parchment rounded-lg p-6 border-2 border-gold/30 hover:border-gold/60 transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="text-3xl">{'\u2728'}</div>
          <div className="flex-1">
            <h2 className="font-display text-xl text-accent group-hover:text-accent-light transition-colors">
              Build Your World
            </h2>
            <p className="text-sm text-muted mt-1">
              Create your campaign setting through guided conversation with an AI creative partner.
            </p>
          </div>
          <div className="text-muted group-hover:text-accent transition-colors text-xl">
            {'\u2192'}
          </div>
        </div>
      </Link>

      <SectionDivider />

      <WorldMetaEditor campaignId={id} />
    </div>
  );
}
