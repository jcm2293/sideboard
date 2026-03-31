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

function PCDetail({ data }: { data: Record<string, unknown> }) {
  const saves = (data.save_modifiers || {}) as Record<string, number>;
  const modStr = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  return (
    <div className="text-xs space-y-1.5 mt-1">
      <div className="text-muted">
        {String(data.class_name || '')}
        {data.subclass ? ` — ${data.subclass}` : ''}
        {' \u2022 '}Level {String(data.level || '')}
      </div>
      <div className="flex gap-3">
        <span>AC {String(data.armor_class || '')}{data.ac_source ? ` (${data.ac_source})` : ''}</span>
        <span>HP {String(data.hp_max || '')}</span>
        <span>PP {String(data.passive_perception || '')}</span>
      </div>
      {Object.keys(saves).length > 0 && (
        <div className="text-muted">
          <span className="block mb-0.5">Saves:</span>
          <span>
            STR {modStr(saves.str || 0)} {' \u2022 '}
            DEX {modStr(saves.dex || 0)} {' \u2022 '}
            CON {modStr(saves.con || 0)} {' \u2022 '}
            INT {modStr(saves.int || 0)} {' \u2022 '}
            WIS {modStr(saves.wis || 0)} {' \u2022 '}
            CHA {modStr(saves.cha || 0)}
          </span>
        </div>
      )}
      {data.senses ? (
        <div className="text-muted">{String(data.senses)}</div>
      ) : null}
      {(data.damage_resistances || data.damage_immunities || data.condition_immunities) ? (
        <div className="text-muted">
          {data.damage_resistances ? <div>Resist: {String(data.damage_resistances)}</div> : null}
          {data.damage_immunities ? <div>Immune: {String(data.damage_immunities)}</div> : null}
          {data.condition_immunities ? <div>Cond. Immune: {String(data.condition_immunities)}</div> : null}
        </div>
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
              Pin NPCs, locations, spells, or characters here for quick reference during a session.
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
                {item.type === 'Player Character' && <PCDetail data={item.data} />}
              </ShelfCard>
            ))
          )}
        </div>
      </div>
    </>
  );
}
