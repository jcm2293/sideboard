'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  builderMessageStore,
  worldMetaStore,
  loreStore,
  locationStore,
  factionStore,
  npcStore,
  plotStore,
} from '@/lib/data';
import { buildCampaignContext, getCampaignStats } from '@/lib/builder/context-builder';
import { parseProposals, segmentContent } from '@/lib/builder/parse-proposals';
import SaveCard from './SaveCard';
import type { BuilderMessage, ProposedElement, WorldMeta, LoreEntry, Location as LocationType, Faction, NPC, PlotArc } from '@/types';

interface BuilderChatProps {
  campaignId: string;
}

function MarkdownText({ content }: { content: string }) {
  const html = content
    .replace(/^### (.+)$/gm, '<h4 class="font-display text-sm text-accent mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-display text-base text-accent mt-4 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-display text-lg text-accent mt-4 mb-2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>');

  return (
    <div
      className="prose-sm text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
    />
  );
}

export default function BuilderChat({ campaignId }: BuilderChatProps) {
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [savedProposals, setSavedProposals] = useState<Record<string, boolean>>({});
  const [editingProposal, setEditingProposal] = useState<ProposedElement | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});
  const [stats, setStats] = useState({ locations: 0, factions: 0, npcs: 0, lore: 0, plots: 0, sessions: 0, hasWorldMeta: false });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load existing messages and saved states
  useEffect(() => {
    async function load() {
      const existing = await builderMessageStore
        .getAll({ campaign_id: campaignId } as Partial<BuilderMessage>);
      const sorted = existing.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages(sorted);

      const saved: Record<string, boolean> = {};
      for (const msg of sorted) {
        if (msg.proposed_elements) {
          for (let i = 0; i < msg.proposed_elements.length; i++) {
            if (msg.proposed_elements[i].saved) {
              saved[`${msg.id}-${i}`] = true;
            }
          }
        }
      }
      setSavedProposals(saved);

      const s = await getCampaignStats(campaignId);
      setStats(s);
    }
    load();
  }, [campaignId]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setStreaming(true);
    setStreamText('');

    // Save user message
    const userMsg = await builderMessageStore.create({
      campaign_id: campaignId,
      role: 'user',
      content: text,
      proposed_elements: null,
    });
    setMessages((prev) => [...prev, userMsg]);

    // Build context and message history
    const campaignContext = await buildCampaignContext(campaignId);
    const allMessages = [...messages, userMsg];
    const apiMessages = allMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch('/api/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, campaignContext }),
      });

      if (!res.ok) throw new Error('API request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              fullText += parsed.text;
              setStreamText(fullText);
            }
          } catch {
            // Skip parse errors for incomplete JSON chunks
          }
        }
      }

      // Parse proposals and save assistant message
      const proposals = parseProposals(fullText);
      const assistantMsg = await builderMessageStore.create({
        campaign_id: campaignId,
        role: 'assistant',
        content: fullText,
        proposed_elements: proposals.length > 0 ? proposals : null,
      });
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorText = `*Error: ${err instanceof Error ? err.message : 'Failed to get response'}*`;
      const errorMsg = await builderMessageStore.create({
        campaign_id: campaignId,
        role: 'assistant',
        content: errorText,
        proposed_elements: null,
      });
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setStreaming(false);
      setStreamText('');
    }
  }, [input, streaming, campaignId, messages]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function saveProposal(msgId: string, proposalIndex: number, proposal: ProposedElement) {
    const data = proposal.data;

    switch (proposal.type) {
      case 'location':
        await locationStore.create({
          campaign_id: campaignId,
          name: (data.name as string) || '',
          description: (data.description as string) || '',
          type: (data.region as string) ? 'settlement' : '',
          parent_id: null,
          notes: [data.notable_features, data.region].filter(Boolean).join('\n'),
        } as Omit<LocationType, 'id' | 'created_at' | 'updated_at'>);
        break;

      case 'npc':
        await npcStore.create({
          campaign_id: campaignId,
          name: (data.name as string) || '',
          race: '',
          role: (data.role as string) || '',
          alignment: '',
          description: [data.backstory, data.quirk, data.voice_notes].filter(Boolean).join('\n'),
          personality: (data.quirk as string) || '',
          motivations: [data.goal, data.fear].filter(Boolean).join('\n'),
          secrets: [data.knowledge, data.knowledge_check].filter(Boolean).join('\n'),
          connections: (data.leverage as string) || '',
          location_id: null,
          faction_id: null,
          stat_block_id: null,
          notes: [data.knowledge_free, data.voice_notes].filter(Boolean).join('\n'),
        } as Omit<NPC, 'id' | 'created_at' | 'updated_at'>);
        break;

      case 'faction':
        await factionStore.create({
          campaign_id: campaignId,
          name: (data.name as string) || '',
          description: (data.description as string) || '',
          goals: (data.goals as string) || '',
          leader: '',
          alignment: (data.alignment as string) || '',
          notes: '',
        } as Omit<Faction, 'id' | 'created_at' | 'updated_at'>);
        break;

      case 'lore':
        await loreStore.create({
          campaign_id: campaignId,
          title: (data.title as string) || '',
          category: (data.category as string) || 'other',
          content: (data.content as string) || '',
          tags: [],
        } as Omit<LoreEntry, 'id' | 'created_at' | 'updated_at'>);
        break;

      case 'plot_arc':
        await plotStore.create({
          campaign_id: campaignId,
          title: (data.title as string) || '',
          summary: [(data.description as string), data.dm_secrets ? `\n\nDM SECRETS: ${data.dm_secrets}` : ''].join(''),
          status: (data.status as string) || 'active',
          sort_order: 0,
        } as Omit<PlotArc, 'id' | 'created_at' | 'updated_at'>);
        break;

      case 'world_meta': {
        const existing = (await worldMetaStore.getAll({ campaign_id: campaignId } as Partial<WorldMeta>))[0];
        const themes = typeof data.themes === 'string'
          ? (data.themes as string).split('.').map((t: string) => t.trim()).filter(Boolean)
          : Array.isArray(data.themes) ? data.themes as string[] : [];
        const metaData = {
          campaign_id: campaignId,
          tone: (data.tone as string) || '',
          tech_level: (data.tech_level as string) || '',
          themes,
          magic_system: (data.magic_system as string) || '',
          notes: '',
        };
        if (existing) {
          await worldMetaStore.update(existing.id, metaData);
        } else {
          await worldMetaStore.create(metaData as Omit<WorldMeta, 'id' | 'created_at' | 'updated_at'>);
        }
        break;
      }
    }

    // Mark as saved in the stored message
    const key = `${msgId}-${proposalIndex}`;
    setSavedProposals((prev) => ({ ...prev, [key]: true }));

    // Update the stored message's proposed_elements
    const msg = await builderMessageStore.getById(msgId);
    if (msg?.proposed_elements) {
      const updated = [...msg.proposed_elements];
      updated[proposalIndex] = { ...updated[proposalIndex], saved: true };
      await builderMessageStore.update(msgId, { proposed_elements: updated } as Partial<BuilderMessage>);
    }

    // Refresh stats
    const s = await getCampaignStats(campaignId);
    setStats(s);
  }

  function openEditForm(proposal: ProposedElement) {
    setEditingProposal(proposal);
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(proposal.data)) {
      fields[k] = String(v ?? '');
    }
    setEditFormData(fields);
  }

  async function saveEditedProposal(msgId: string, proposalIndex: number) {
    if (!editingProposal) return;
    const updatedProposal: ProposedElement = {
      ...editingProposal,
      data: { ...editFormData },
    };
    await saveProposal(msgId, proposalIndex, updatedProposal);
    setEditingProposal(null);
    setEditFormData({});
  }

  function renderMessage(msg: BuilderMessage) {
    const isUser = msg.role === 'user';

    if (isUser) {
      return (
        <div key={msg.id} className="flex justify-end mb-4">
          <div className="max-w-[80%] bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      );
    }

    // Assistant message — segment into text and proposals
    const segments = segmentContent(msg.content);

    return (
      <div key={msg.id} className="mb-4">
        <div className="max-w-[90%]">
          {segments.map((seg, i) => {
            if (seg.type === 'text') {
              return <MarkdownText key={i} content={seg.content!} />;
            }

            if (seg.type === 'proposal' && seg.proposal) {
              const pIdx = seg.proposalIndex ?? 0;
              const key = `${msg.id}-${pIdx}`;
              const isSaved = savedProposals[key] || false;

              return (
                <SaveCard
                  key={key}
                  proposal={seg.proposal}
                  campaignId={campaignId}
                  saved={isSaved}
                  onSave={(p) => saveProposal(msg.id, pIdx, p)}
                  onEditAndSave={(p) => openEditForm(p)}
                  onDismiss={() => {}}
                />
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  const hasContent = stats.locations > 0 || stats.factions > 0 || stats.npcs > 0 || stats.lore > 0 || stats.plots > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Context indicator */}
      {hasContent && (
        <div className="px-4 py-2 bg-surface border-b border-border text-xs text-muted flex gap-3 flex-wrap">
          <span>Your campaign has:</span>
          {stats.locations > 0 && <span>{stats.locations} location{stats.locations !== 1 ? 's' : ''}</span>}
          {stats.factions > 0 && <span>{stats.factions} faction{stats.factions !== 1 ? 's' : ''}</span>}
          {stats.npcs > 0 && <span>{stats.npcs} NPC{stats.npcs !== 1 ? 's' : ''}</span>}
          {stats.lore > 0 && <span>{stats.lore} lore entr{stats.lore !== 1 ? 'ies' : 'y'}</span>}
          {stats.plots > 0 && <span>{stats.plots} plot arc{stats.plots !== 1 ? 's' : ''}</span>}
          {stats.sessions > 0 && <span>{stats.sessions} session{stats.sessions !== 1 ? 's' : ''}</span>}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && !streaming && (
          <div className="text-center py-16 text-muted">
            <p className="font-display text-lg text-accent mb-2">Begin Building Your World</p>
            <p className="text-sm max-w-md mx-auto">
              Share your campaign idea — a theme, a vibe, a starting scenario, or even just a single image that inspires you.
              We&apos;ll build from there together.
            </p>
          </div>
        )}

        {messages.map(renderMessage)}

        {/* Streaming message */}
        {streaming && streamText && (
          <div className="mb-4">
            <div className="max-w-[90%]">
              <MarkdownText content={streamText} />
              <span className="inline-block w-1.5 h-4 bg-accent/60 animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {streaming && !streamText && (
          <div className="mb-4 text-muted text-sm italic">Thinking...</div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Edit modal */}
      {editingProposal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card-parchment rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto space-y-3">
            <h3 className="font-display text-accent">
              Edit {editingProposal.type.replace('_', ' ')}
            </h3>
            {Object.entries(editFormData).map(([key, value]) => (
              <div key={key}>
                <label className="block text-xs text-muted mb-1 uppercase tracking-wider">
                  {key.replace(/_/g, ' ')}
                </label>
                {value.length > 60 ? (
                  <textarea
                    value={value}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
                    rows={3}
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  // Find which message this proposal belongs to by scanning
                  for (const msg of messages) {
                    if (msg.proposed_elements) {
                      const idx = msg.proposed_elements.findIndex(
                        (p) => p.type === editingProposal.type &&
                          JSON.stringify(p.data) === JSON.stringify(editingProposal.data)
                      );
                      if (idx !== -1) {
                        saveEditedProposal(msg.id, idx);
                        return;
                      }
                    }
                  }
                  setEditingProposal(null);
                }}
                className="btn-primary px-4 py-2 rounded text-sm"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingProposal(null);
                  setEditFormData({});
                }}
                className="btn-ghost px-4 py-2 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border p-4 bg-surface">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your campaign idea, or ask about what to build next..."
            className="flex-1 bg-surface-light border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent resize-none min-h-[48px] max-h-[200px]"
            rows={2}
            disabled={streaming}
          />
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="btn-primary px-4 py-3 rounded-lg text-sm shrink-0 disabled:opacity-50"
          >
            {streaming ? 'Sending...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-muted mt-1">Shift+Enter for newline, Enter to send</p>
      </div>
    </div>
  );
}
