'use client';

import { useShelfStore } from '@/stores/shelf-store';
import ShelfCard from './ShelfCard';

function SpellDetail({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="text-xs space-y-1 mt-1">
      <div className="flex gap-3 text-muted">
        <span>{data.level === 0 ? 'Cantrip' : `Level ${data.level}`}</span>
        <span>{String(data.school)}</span>
      </div>
      <div className="flex gap-3 text-muted">
        <span>{String(data.casting_time)}</span>
        <span>{String(data.range)}</span>
      </div>
      <div className="text-muted">
        {String(data.duration)}{data.concentration ? ' (C)' : ''}
      </div>
      {data.description ? (
        <p className="text-foreground/80 whitespace-pre-wrap mt-2 leading-relaxed">
          {String(data.description)}
        </p>
      ) : null}
    </div>
  );
}

export default function LiveShelf() {
  const { isOpen, items, toggle, removeItem } = useShelfStore();

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={toggle}
        className="fixed top-3 right-3 z-50 bg-surface border border-border rounded px-3 py-1.5 text-sm text-accent font-display tracking-wide hover:text-gold hover:border-gold transition-colors"
        title={isOpen ? 'Close shelf' : 'Open shelf'}
      >
        {isOpen ? 'Close Shelf \u203A' : '\u2039 Shelf'}
      </button>

      {/* Shelf panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-surface-light border-l-2 border-border z-40 transition-transform duration-200 shadow-lg overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 pt-12">
          <h3 className="font-display text-base text-accent mb-3 tracking-wide">Live Shelf</h3>
          <div className="divider-ornament text-xs">◆</div>
          {items.length === 0 ? (
            <p className="text-sm text-muted italic">
              Pin NPCs, locations, spells, or notes here for quick reference during a session.
            </p>
          ) : (
            items.map((item) => (
              <ShelfCard
                key={item.id}
                label={item.label}
                type={item.type}
                onRemove={() => removeItem(item.id)}
              >
                {item.type === 'Spell' && <SpellDetail data={item.data} />}
              </ShelfCard>
            ))
          )}
        </div>
      </div>
    </>
  );
}
