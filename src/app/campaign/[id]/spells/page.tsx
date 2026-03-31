'use client';

import { use, useState, useEffect, useMemo } from 'react';
import srdSpellsData from '@/data/spells.json';
import type { SrdSpell, CustomSpell } from '@/types';
import { customSpellStore } from '@/lib/data';
import { useShelfStore } from '@/stores/shelf-store';

const srdSpells: SrdSpell[] = srdSpellsData as SrdSpell[];

// ── Unified display type ──────────────────────────────────────

interface DisplaySpell {
  id: string;
  name: string;
  level: number;
  school: string;
  casting_time: string;
  range: string;
  components: string[];
  material: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  desc: string[];
  higher_level: string[];
  classes: string[];
  source: 'srd' | 'homebrew';
  customId?: string;
}

// ── Helpers ───────────────────────────────────────────────────

function levelLabel(level: number): string {
  if (level === 0) return 'Cantrip';
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${level}${suffixes[level] || 'th'}`;
}

function schoolColor(school: string): string {
  const colors: Record<string, string> = {
    Abjuration: '#3b82f6',
    Conjuration: '#d97706',
    Divination: '#0d9488',
    Enchantment: '#ec4899',
    Evocation: '#ef4444',
    Illusion: '#a855f7',
    Necromancy: '#6b7280',
    Transmutation: '#22c55e',
  };
  return colors[school] || '#6b7280';
}

function levelSchoolLine(level: number, school: string): string {
  if (level === 0) return `${school} cantrip`;
  return `${levelLabel(level)}-level ${school.toLowerCase()}`;
}

const SCHOOLS = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
];

const CLASSES = [
  'Bard',
  'Cleric',
  'Druid',
  'Paladin',
  'Ranger',
  'Sorcerer',
  'Warlock',
  'Wizard',
];

type SortKey = 'name' | 'level' | 'school';
type SortDir = 'asc' | 'desc';

// ── Converters ────────────────────────────────────────────────

function srdToDisplay(s: SrdSpell): DisplaySpell {
  return {
    id: s.index,
    name: s.name,
    level: s.level,
    school: s.school,
    casting_time: s.casting_time,
    range: s.range,
    components: s.components,
    material: s.material || '',
    duration: s.duration,
    concentration: s.concentration,
    ritual: s.ritual,
    desc: s.desc,
    higher_level: s.higher_level || [],
    classes: s.classes,
    source: 'srd',
  };
}

function customToDisplay(c: CustomSpell): DisplaySpell {
  const comps: string[] = [];
  if (c.components_v) comps.push('V');
  if (c.components_s) comps.push('S');
  if (c.components_m) comps.push('M');
  return {
    id: `custom-${c.id}`,
    name: c.name,
    level: c.level,
    school: c.school,
    casting_time: c.casting_time,
    range: c.range,
    components: comps,
    material: c.material_description || '',
    duration: c.duration,
    concentration: c.concentration,
    ritual: c.ritual,
    desc: c.description ? c.description.split('\n\n') : [],
    higher_level: c.higher_levels ? c.higher_levels.split('\n\n') : [],
    classes: c.classes || [],
    source: 'homebrew',
    customId: c.id,
  };
}

// ── Page component ────────────────────────────────────────────

export default function SpellsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { addItem } = useShelfStore();

  // ── Custom spells from Supabase ──
  const [customSpells, setCustomSpells] = useState<CustomSpell[]>([]);
  useEffect(() => {
    customSpellStore
      .getAll({ campaign_id: id } as any)
      .then(setCustomSpells);
  }, [id]);

  const reloadCustom = () => {
    customSpellStore
      .getAll({ campaign_id: id } as any)
      .then(setCustomSpells);
  };

  // ── Merged display list ──
  const allSpells = useMemo<DisplaySpell[]>(() => {
    const srd = srdSpells.map(srdToDisplay);
    const custom = customSpells.map(customToDisplay);
    return [...srd, ...custom];
  }, [customSpells]);

  // ── Filter state ──
  const [search, setSearch] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set());
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [concFilter, setConcFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [ritualFilter, setRitualFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'srd' | 'homebrew'>('all');

  // ── Sort state ──
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Expand / modal state ──
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editSpell, setEditSpell] = useState<CustomSpell | null>(null);

  // ── Filtering logic ──
  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    let list = allSpells.filter((s) => {
      if (
        lowerSearch &&
        !s.name.toLowerCase().includes(lowerSearch) &&
        !s.desc.some((d) => d.toLowerCase().includes(lowerSearch))
      )
        return false;
      if (selectedLevels.size > 0 && !selectedLevels.has(s.level)) return false;
      if (selectedSchool && s.school !== selectedSchool) return false;
      if (
        selectedClass &&
        !s.classes.some((c) => c.toLowerCase() === selectedClass.toLowerCase())
      )
        return false;
      if (concFilter === 'yes' && !s.concentration) return false;
      if (concFilter === 'no' && s.concentration) return false;
      if (ritualFilter === 'yes' && !s.ritual) return false;
      if (ritualFilter === 'no' && s.ritual) return false;
      if (sourceFilter !== 'all' && s.source !== sourceFilter) return false;
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'level') cmp = a.level - b.level;
      else if (sortKey === 'school') cmp = a.school.localeCompare(b.school);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [
    allSpells,
    search,
    selectedLevels,
    selectedSchool,
    selectedClass,
    concFilter,
    ritualFilter,
    sourceFilter,
    sortKey,
    sortDir,
  ]);

  const toggleLevel = (lvl: number) => {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedLevels(new Set());
    setSelectedSchool('');
    setSelectedClass('');
    setConcFilter('all');
    setRitualFilter('all');
    setSourceFilter('all');
  };

  const hasFilters =
    search ||
    selectedLevels.size > 0 ||
    selectedSchool ||
    selectedClass ||
    concFilter !== 'all' ||
    ritualFilter !== 'all' ||
    sourceFilter !== 'all';

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const pinToShelf = (spell: DisplaySpell) => {
    addItem({
      id: `spell-${spell.id}`,
      type: 'Spell',
      label: spell.name,
      data: {
        level: spell.level,
        school: spell.school,
        casting_time: spell.casting_time,
        range: spell.range,
        duration: spell.duration,
        concentration: spell.concentration,
        description: spell.desc.join('\n\n'),
      },
    });
  };

  const handleDelete = async (customId: string) => {
    if (!confirm('Delete this homebrew spell?')) return;
    await customSpellStore.delete(customId);
    reloadCustom();
    setExpandedId(null);
  };

  const handleEdit = (spell: DisplaySpell) => {
    if (!spell.customId) return;
    const c = customSpells.find((cs) => cs.id === spell.customId);
    if (c) setEditSpell(c);
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-accent">Spells Library</h1>
        <button
          onClick={() => {
            setEditSpell(null);
            setShowCreate(true);
          }}
          className="btn-primary px-3 py-1.5 rounded text-sm"
        >
          + Create Spell
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="card-parchment rounded p-4 mb-4 sticky top-0 z-10 space-y-3">
        {/* Row 1: search + source + clear */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search spells..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] bg-surface-light border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <select
            value={sourceFilter}
            onChange={(e) =>
              setSourceFilter(e.target.value as 'all' | 'srd' | 'homebrew')
            }
            className="bg-surface-light border border-border rounded px-2 py-1.5 text-sm"
          >
            <option value="all">All Sources</option>
            <option value="srd">SRD</option>
            <option value="homebrew">Homebrew</option>
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-muted hover:text-foreground underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Row 2: level pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted mr-1">Level:</span>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
            <button
              key={lvl}
              onClick={() => toggleLevel(lvl)}
              className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                selectedLevels.has(lvl)
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface-light border-border text-muted hover:border-accent hover:text-foreground'
              }`}
            >
              {lvl === 0 ? 'Cantrip' : levelLabel(lvl)}
            </button>
          ))}
        </div>

        {/* Row 3: school, class, concentration, ritual */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            className="bg-surface-light border border-border rounded px-2 py-1.5 text-sm"
          >
            <option value="">All Schools</option>
            {SCHOOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-surface-light border border-border rounded px-2 py-1.5 text-sm"
          >
            <option value="">All Classes</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted">Conc:</span>
            {(['all', 'yes', 'no'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setConcFilter(v)}
                className={`px-1.5 py-0.5 rounded border text-xs transition-colors ${
                  concFilter === v
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface-light border-border text-muted hover:border-accent'
                }`}
              >
                {v === 'all' ? 'All' : v === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted">Ritual:</span>
            {(['all', 'yes', 'no'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setRitualFilter(v)}
                className={`px-1.5 py-0.5 rounded border text-xs transition-colors ${
                  ritualFilter === v
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface-light border-border text-muted hover:border-accent'
                }`}
              >
                {v === 'all' ? 'All' : v === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="text-xs text-muted">
          Showing {filtered.length} of {allSpells.length} spells
        </div>
      </div>

      {/* ── Spell Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="py-2 px-2 w-4"></th>
              <th
                className="py-2 px-2 cursor-pointer hover:text-foreground select-none"
                onClick={() => toggleSort('name')}
              >
                Name{sortIndicator('name')}
              </th>
              <th
                className="py-2 px-2 cursor-pointer hover:text-foreground select-none w-16"
                onClick={() => toggleSort('level')}
              >
                Level{sortIndicator('level')}
              </th>
              <th
                className="py-2 px-2 cursor-pointer hover:text-foreground select-none w-28"
                onClick={() => toggleSort('school')}
              >
                School{sortIndicator('school')}
              </th>
              <th className="py-2 px-2 w-28">Casting Time</th>
              <th className="py-2 px-2 w-24">Range</th>
              <th className="py-2 px-2 w-8 text-center" title="Concentration">
                C
              </th>
              <th className="py-2 px-2 w-8 text-center" title="Ritual">
                R
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((spell, idx) => (
              <SpellRow
                key={spell.id}
                spell={spell}
                isEven={idx % 2 === 1}
                isExpanded={expandedId === spell.id}
                onToggle={() =>
                  setExpandedId(expandedId === spell.id ? null : spell.id)
                }
                onPin={() => pinToShelf(spell)}
                onEdit={() => handleEdit(spell)}
                onDelete={() => spell.customId && handleDelete(spell.customId)}
              />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-muted py-8 text-sm">
            No spells match your filters.
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {(showCreate || editSpell) && (
        <SpellModal
          campaignId={id}
          initial={editSpell}
          onClose={() => {
            setShowCreate(false);
            setEditSpell(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditSpell(null);
            reloadCustom();
          }}
        />
      )}
    </div>
  );
}

// ── Spell Row ─────────────────────────────────────────────────

function SpellRow({
  spell,
  isEven,
  isExpanded,
  onToggle,
  onPin,
  onEdit,
  onDelete,
}: {
  spell: DisplaySpell;
  isEven: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer hover:bg-amber-900/5 border-b border-border/30 ${
          isEven ? 'bg-amber-900/5' : ''
        }`}
        style={{ borderLeft: `4px solid ${schoolColor(spell.school)}` }}
      >
        <td className="py-1.5 px-2"></td>
        <td className="py-1.5 px-2 font-medium">
          {spell.name}
          {spell.source === 'homebrew' && (
            <span className="ml-2 text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded">
              Homebrew
            </span>
          )}
        </td>
        <td className="py-1.5 px-2 text-muted">{levelLabel(spell.level)}</td>
        <td className="py-1.5 px-2 text-muted">{spell.school}</td>
        <td className="py-1.5 px-2 text-muted">{spell.casting_time}</td>
        <td className="py-1.5 px-2 text-muted">{spell.range}</td>
        <td className="py-1.5 px-2 text-center">
          {spell.concentration && (
            <span title="Concentration" className="text-warning">
              ●
            </span>
          )}
        </td>
        <td className="py-1.5 px-2 text-center">
          {spell.ritual && (
            <span title="Ritual" className="text-accent-light">
              ✦
            </span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="card-parchment rounded p-4 mx-2 my-2">
              <h2 className="font-display text-xl text-accent mb-1">
                {spell.name}
              </h2>
              <p className="text-sm italic text-muted mb-3">
                {levelSchoolLine(spell.level, spell.school)}
              </p>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
                <div>
                  <span className="font-semibold">Casting Time:</span>{' '}
                  {spell.casting_time}
                </div>
                <div>
                  <span className="font-semibold">Range:</span> {spell.range}
                </div>
                <div>
                  <span className="font-semibold">Components:</span>{' '}
                  {spell.components.join(', ')}
                  {spell.material && (
                    <span className="text-muted"> ({spell.material})</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold">Duration:</span>{' '}
                  {spell.concentration && 'Concentration, '}
                  {spell.duration}
                </div>
              </div>

              <div className="space-y-2 text-sm leading-relaxed mb-3">
                {spell.desc.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {spell.higher_level.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm">
                    <span className="font-semibold italic">
                      At Higher Levels.
                    </span>{' '}
                    {spell.higher_level.join(' ')}
                  </p>
                </div>
              )}

              <div className="text-xs text-muted mb-3">
                <span className="font-semibold">Classes:</span>{' '}
                {spell.classes.join(', ')}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPin();
                  }}
                  className="btn-primary px-3 py-1 rounded text-xs"
                >
                  Pin to Shelf
                </button>
                {spell.source === 'homebrew' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                      }}
                      className="btn-ghost px-3 py-1 rounded text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="px-3 py-1 rounded text-xs border border-danger/50 text-danger hover:bg-danger/10 transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Create / Edit Modal ───────────────────────────────────────

function SpellModal({
  campaignId,
  initial,
  onClose,
  onSaved,
}: {
  campaignId: string;
  initial: CustomSpell | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [level, setLevel] = useState(initial?.level ?? 0);
  const [school, setSchool] = useState(initial?.school ?? 'Evocation');
  const [castingTime, setCastingTime] = useState(
    initial?.casting_time ?? '1 action'
  );
  const [range, setRange] = useState(initial?.range ?? '');
  const [compV, setCompV] = useState(initial?.components_v ?? false);
  const [compS, setCompS] = useState(initial?.components_s ?? false);
  const [compM, setCompM] = useState(initial?.components_m ?? false);
  const [material, setMaterial] = useState(
    initial?.material_description ?? ''
  );
  const [duration, setDuration] = useState(initial?.duration ?? '');
  const [concentration, setConcentration] = useState(
    initial?.concentration ?? false
  );
  const [ritual, setRitual] = useState(initial?.ritual ?? false);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [higherLevels, setHigherLevels] = useState(
    initial?.higher_levels ?? ''
  );
  const [classes, setClasses] = useState<Set<string>>(
    new Set(initial?.classes ?? [])
  );
  const [saving, setSaving] = useState(false);

  const toggleClass = (c: string) => {
    setClasses((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setSaving(true);

    const payload = {
      campaign_id: campaignId,
      name: name.trim(),
      level,
      school,
      casting_time: castingTime.trim(),
      range: range.trim(),
      components_v: compV,
      components_s: compS,
      components_m: compM,
      material_description: material.trim(),
      duration: duration.trim(),
      concentration,
      ritual,
      description: description.trim(),
      higher_levels: higherLevels.trim(),
      classes: Array.from(classes),
    };

    try {
      if (initial) {
        await customSpellStore.update(initial.id, payload);
      } else {
        await customSpellStore.create(payload as any);
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save spell', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="card-parchment rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-accent mb-4">
          {initial ? 'Edit Spell' : 'Create Spell'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-muted mb-1">
              Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-surface-light border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Level + School */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="w-full bg-surface-light border border-border rounded px-2 py-1.5 text-sm"
              >
                <option value={0}>Cantrip</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                  <option key={l} value={l}>
                    {levelLabel(l)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">School</label>
              <select
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="w-full bg-surface-light border border-border rounded px-2 py-1.5 text-sm"
              >
                {SCHOOLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Casting Time + Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">
                Casting Time
              </label>
              <input
                type="text"
                value={castingTime}
                onChange={(e) => setCastingTime(e.target.value)}
                className="w-full bg-surface-light border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Range</label>
              <input
                type="text"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="w-full bg-surface-light border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* Components */}
          <div>
            <label className="block text-xs text-muted mb-1">Components</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={compV}
                  onChange={(e) => setCompV(e.target.checked)}
                  className="accent-accent"
                />{' '}
                V
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={compS}
                  onChange={(e) => setCompS(e.target.checked)}
                  className="accent-accent"
                />{' '}
                S
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={compM}
                  onChange={(e) => setCompM(e.target.checked)}
                  className="accent-accent"
                />{' '}
                M
              </label>
            </div>
            {compM && (
              <input
                type="text"
                placeholder="Material description..."
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="mt-2 w-full bg-surface-light border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            )}
          </div>

          {/* Duration + toggles */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">Duration</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-surface-light border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={concentration}
                  onChange={(e) => setConcentration(e.target.checked)}
                  className="accent-accent"
                />{' '}
                Concentration
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={ritual}
                  onChange={(e) => setRitual(e.target.checked)}
                  className="accent-accent"
                />{' '}
                Ritual
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-muted mb-1">
              Description <span className="text-danger">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              className="w-full bg-surface-light border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>

          {/* Higher Levels */}
          <div>
            <label className="block text-xs text-muted mb-1">
              At Higher Levels
            </label>
            <textarea
              value={higherLevels}
              onChange={(e) => setHigherLevels(e.target.value)}
              rows={2}
              className="w-full bg-surface-light border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>

          {/* Classes */}
          <div>
            <label className="block text-xs text-muted mb-1">Classes</label>
            <div className="flex flex-wrap gap-3">
              {CLASSES.map((c) => (
                <label key={c} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={classes.has(c)}
                    onChange={() => toggleClass(c)}
                    className="accent-accent"
                  />{' '}
                  {c}
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-4 py-1.5 rounded text-sm"
            >
              {saving ? 'Saving...' : initial ? 'Update Spell' : 'Create Spell'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-4 py-1.5 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
