'use client';

import { useState } from 'react';
import type { ProposedElement, ProposalType } from '@/types';

interface SaveCardProps {
  proposal: ProposedElement;
  campaignId: string;
  onSave: (proposal: ProposedElement) => void;
  onEditAndSave: (proposal: ProposedElement) => void;
  onDismiss: () => void;
  saved?: boolean;
}

const TYPE_LABELS: Record<ProposalType, string> = {
  location: 'Location',
  npc: 'NPC',
  faction: 'Faction',
  lore: 'Lore Entry',
  plot_arc: 'Plot Arc',
  world_meta: 'World Details',
};

const TYPE_ICONS: Record<ProposalType, string> = {
  location: '\u{1F3F0}',
  npc: '\u{1F464}',
  faction: '\u{2691}',
  lore: '\u{1F4DC}',
  plot_arc: '\u{1F5FA}',
  world_meta: '\u{2694}',
};

function FieldRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs text-muted uppercase tracking-wider">{label}</span>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function LocationPreview({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <FieldRow label="Description" value={data.description as string} />
      <FieldRow label="Notable Features" value={data.notable_features as string} />
      <FieldRow label="Region" value={data.region as string} />
    </div>
  );
}

function NPCPreview({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <FieldRow label="Role" value={data.role as string} />
      <FieldRow label="Backstory" value={data.backstory as string} />
      <FieldRow label="Goal" value={data.goal as string} />
      <FieldRow label="Fear" value={data.fear as string} />
      <FieldRow label="Leverage" value={data.leverage as string} />
      <FieldRow label="Knowledge" value={data.knowledge as string} />
      <FieldRow label="Free Knowledge" value={data.knowledge_free as string} />
      <FieldRow label="Knowledge Check" value={data.knowledge_check as string} />
      <FieldRow label="Quirk" value={data.quirk as string} />
      <FieldRow label="Voice Notes" value={data.voice_notes as string} />
    </div>
  );
}

function FactionPreview({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <FieldRow label="Description" value={data.description as string} />
      <FieldRow label="Goals" value={data.goals as string} />
      <FieldRow label="Alignment" value={data.alignment as string} />
    </div>
  );
}

function LorePreview({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      {typeof data.category === 'string' && (
        <span className="text-xs bg-surface-light text-muted px-2 py-0.5 rounded border border-border">
          {data.category.charAt(0).toUpperCase() + data.category.slice(1)}
        </span>
      )}
      <FieldRow label="Content" value={data.content as string} />
    </div>
  );
}

function PlotArcPreview({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <FieldRow label="Description" value={data.description as string} />
      <FieldRow label="DM Secrets" value={data.dm_secrets as string} />
      {typeof data.status === 'string' && (
        <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded border border-success/30">
          {data.status}
        </span>
      )}
    </div>
  );
}

function WorldMetaPreview({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <FieldRow label="Tone" value={data.tone as string} />
      <FieldRow label="Tech Level" value={data.tech_level as string} />
      <FieldRow label="Themes" value={data.themes as string} />
      <FieldRow label="Magic System" value={data.magic_system as string} />
    </div>
  );
}

export default function SaveCard({
  proposal,
  onSave,
  onEditAndSave,
  onDismiss,
  saved,
}: SaveCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const name =
    (proposal.data.name as string) ||
    (proposal.data.title as string) ||
    TYPE_LABELS[proposal.type];

  return (
    <div className={`my-3 rounded border ${saved ? 'border-success/40 bg-success/5' : 'border-gold/40 bg-surface'} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-2 flex items-center gap-2 ${saved ? 'bg-success/10' : 'bg-gold/10'} border-b ${saved ? 'border-success/20' : 'border-gold/20'}`}>
        <span className="text-base">{TYPE_ICONS[proposal.type]}</span>
        <span className="font-display text-sm">{TYPE_LABELS[proposal.type]}</span>
        <span className="text-muted">—</span>
        <span className="font-display text-sm text-accent">{name}</span>
        {saved && (
          <span className="ml-auto text-xs text-success flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {proposal.type === 'location' && <LocationPreview data={proposal.data} />}
        {proposal.type === 'npc' && <NPCPreview data={proposal.data} />}
        {proposal.type === 'faction' && <FactionPreview data={proposal.data} />}
        {proposal.type === 'lore' && <LorePreview data={proposal.data} />}
        {proposal.type === 'plot_arc' && <PlotArcPreview data={proposal.data} />}
        {proposal.type === 'world_meta' && <WorldMetaPreview data={proposal.data} />}
      </div>

      {/* Actions */}
      {!saved && (
        <div className="px-4 py-2 border-t border-border/50 flex gap-2">
          <button
            onClick={() => onSave(proposal)}
            className="btn-primary px-3 py-1.5 rounded text-xs"
          >
            Save to Campaign
          </button>
          <button
            onClick={() => onEditAndSave(proposal)}
            className="btn-ghost px-3 py-1.5 rounded text-xs"
          >
            Edit & Save
          </button>
          <button
            onClick={() => {
              setDismissed(true);
              onDismiss();
            }}
            className="text-muted hover:text-foreground text-xs px-2"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
