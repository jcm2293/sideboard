'use client';

import { useShelfStore } from '@/stores/shelf-store';
import ShelfCard from './ShelfCard';

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
        {isOpen ? 'Close Shelf ›' : '‹ Shelf'}
      </button>

      {/* Shelf panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-surface-light border-l-2 border-border z-40 transition-transform duration-200 shadow-lg ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 pt-12">
          <h3 className="font-display text-base text-accent mb-3 tracking-wide">Live Shelf</h3>
          <div className="divider-ornament text-xs">◆</div>
          {items.length === 0 ? (
            <p className="text-sm text-muted italic">
              Pin NPCs, locations, or notes here for quick reference during a session.
            </p>
          ) : (
            items.map((item) => (
              <ShelfCard
                key={item.id}
                label={item.label}
                type={item.type}
                onRemove={() => removeItem(item.id)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
