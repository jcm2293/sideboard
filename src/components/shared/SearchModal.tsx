'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { npcStore, locationStore, factionStore, itemStore, loreStore } from '@/lib/data';

interface SearchResult {
  type: string;
  id: string;
  label: string;
  href: string;
}

export default function SearchModal({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const base = `/campaign/${campaignId}`;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      const lq = q.toLowerCase();
      const r: SearchResult[] = [];
      const filter = { campaign_id: campaignId } as never;

      const [npcs, locations, factions, items, lore] = await Promise.all([
        npcStore.getAll(filter),
        locationStore.getAll(filter),
        factionStore.getAll(filter),
        itemStore.getAll(filter),
        loreStore.getAll(filter),
      ]);

      for (const npc of npcs) {
        if (npc.name.toLowerCase().includes(lq))
          r.push({ type: 'NPC', id: npc.id, label: npc.name, href: `${base}/npcs/${npc.id}` });
      }
      for (const loc of locations) {
        if (loc.name.toLowerCase().includes(lq))
          r.push({ type: 'Location', id: loc.id, label: loc.name, href: `${base}/locations` });
      }
      for (const fac of factions) {
        if (fac.name.toLowerCase().includes(lq))
          r.push({ type: 'Faction', id: fac.id, label: fac.name, href: `${base}/factions` });
      }
      for (const item of items) {
        if (item.name.toLowerCase().includes(lq))
          r.push({ type: 'Item', id: item.id, label: item.name, href: `${base}/items` });
      }
      for (const entry of lore) {
        if (entry.title.toLowerCase().includes(lq))
          r.push({ type: 'Lore', id: entry.id, label: entry.title, href: `${base}/lore` });
      }

      setResults(r.slice(0, 20));
    },
    [campaignId, base]
  );

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => search(query), 150);
    return () => clearTimeout(searchTimer.current);
  }, [query, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40">
      <div className="card-parchment rounded w-full max-w-lg mx-4 shadow-xl overflow-hidden">
        <input
          type="text"
          placeholder="Search campaign..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent px-4 py-3 text-sm focus:outline-none border-b border-border"
          autoFocus
        />
        <div className="max-h-64 overflow-y-auto">
          {results.length === 0 && query && (
            <p className="px-4 py-3 text-sm text-muted italic">No results.</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                router.push(r.href);
                setOpen(false);
                setQuery('');
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-surface-light flex items-center gap-2"
            >
              <span className="text-xs text-gold w-16 font-display">{r.type}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-border text-xs text-muted">
          Press Esc to close
        </div>
      </div>
    </div>
  );
}
