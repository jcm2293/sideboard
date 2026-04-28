// 5e (2024) spell-slot progression by class and level.
//
// USAGE: After parsing a character's class and level from a D&D Beyond PDF,
// call `getSpellProgression(className, level)` to get authoritative slot counts.
// This always wins over whatever the PDF parser produced.
//
// Multiclass: callers should pick the highest-level class and call once with
// that class. The 5e multiclass spellcasting rule (sum half/third caster levels,
// look up combined level) is intentionally NOT applied here — too brittle for
// auto-import. The edit view shows a manual-verify note for multiclass.

export type CasterType = 'full' | 'half' | 'third' | 'warlock' | 'none';

export interface SpellProgression {
  casterType: CasterType;
  cantripsKnown: number;
  // For full/half/third casters: spell_slots jsonb (1-9 keys, 0-N values)
  spellSlots: Record<string, number> | null;
  // For warlocks only:
  pactSlotLevel: number | null;
  pactSlotCount: number | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Caster classification
// ──────────────────────────────────────────────────────────────────────────

const FULL_CASTERS = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'];
const HALF_CASTERS = ['paladin', 'ranger', 'artificer'];
// Third casters are subclasses of Fighter / Rogue — caller passes the parent class.
// We detect via subclass when available; otherwise treat Fighter/Rogue as non-caster.
const THIRD_CASTER_SUBCLASSES = ['eldritch knight', 'arcane trickster'];

function classify(className: string, subclass: string = ''): CasterType {
  const c = className.trim().toLowerCase();
  const s = subclass.trim().toLowerCase();
  if (c === 'warlock') return 'warlock';
  if (FULL_CASTERS.includes(c)) return 'full';
  if (HALF_CASTERS.includes(c)) return 'half';
  if ((c === 'fighter' || c === 'rogue') && THIRD_CASTER_SUBCLASSES.includes(s)) return 'third';
  return 'none';
}

// ──────────────────────────────────────────────────────────────────────────
// Slot tables
// ──────────────────────────────────────────────────────────────────────────

// Full caster: index by character level 1..20. Each row is [L1, L2, ..., L9].
const FULL_CASTER_SLOTS: Record<number, number[]> = {
  1:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  3:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  4:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  5:  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6:  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7:  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8:  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9:  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

// Half caster: levels at which a new row applies. Levels in between hold prior row.
const HALF_CASTER_SLOTS: Record<number, number[]> = {
  2:  [2, 0, 0, 0, 0],
  3:  [3, 0, 0, 0, 0],
  5:  [4, 2, 0, 0, 0],
  7:  [4, 3, 0, 0, 0],
  9:  [4, 3, 2, 0, 0],
  11: [4, 3, 3, 0, 0],
  13: [4, 3, 3, 1, 0],
  15: [4, 3, 3, 2, 0],
  17: [4, 3, 3, 3, 1],
  19: [4, 3, 3, 3, 2],
};

const THIRD_CASTER_SLOTS: Record<number, number[]> = {
  3:  [2, 0, 0, 0],
  4:  [3, 0, 0, 0],
  7:  [4, 2, 0, 0],
  10: [4, 3, 0, 0],
  13: [4, 3, 2, 0],
  16: [4, 3, 3, 0],
  19: [4, 3, 3, 1],
};

interface WarlockProg { level: number; count: number }
const WARLOCK_PROG: Record<number, WarlockProg> = {
  1:  { level: 1, count: 1 },
  2:  { level: 1, count: 2 },
  3:  { level: 2, count: 2 },
  4:  { level: 2, count: 2 },
  5:  { level: 3, count: 2 },
  6:  { level: 3, count: 2 },
  7:  { level: 4, count: 2 },
  8:  { level: 4, count: 2 },
  9:  { level: 5, count: 2 },
  10: { level: 5, count: 2 },
  11: { level: 5, count: 3 },
  12: { level: 5, count: 3 },
  13: { level: 5, count: 3 },
  14: { level: 5, count: 3 },
  15: { level: 5, count: 3 },
  16: { level: 5, count: 3 },
  17: { level: 5, count: 4 },
  18: { level: 5, count: 4 },
  19: { level: 5, count: 4 },
  20: { level: 5, count: 4 },
};

// Cantrips known by class+level (only for classes that get cantrips innately)
const CANTRIP_PROG: Record<string, (level: number) => number> = {
  bard:     (l) => (l >= 10 ? 4 : l >= 4 ? 3 : 2),
  cleric:   (l) => (l >= 10 ? 5 : l >= 4 ? 4 : 3),
  druid:    (l) => (l >= 10 ? 4 : l >= 4 ? 3 : 2),
  sorcerer: (l) => (l >= 10 ? 6 : l >= 4 ? 5 : 4),
  wizard:   (l) => (l >= 10 ? 5 : l >= 4 ? 4 : 3),
  warlock:  (l) => (l >= 10 ? 4 : l >= 4 ? 3 : 2),
};

// ──────────────────────────────────────────────────────────────────────────
// Lookups
// ──────────────────────────────────────────────────────────────────────────

function priorRow(table: Record<number, number[]>, level: number): number[] | null {
  for (let l = level; l >= 1; l--) {
    if (table[l]) return table[l];
  }
  return null;
}

function rowToSlotMap(row: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < row.length; i++) {
    out[String(i + 1)] = row[i];
  }
  return out;
}

export function getSpellProgression(
  className: string,
  level: number,
  subclass: string = '',
): SpellProgression {
  const lvl = Math.max(1, Math.min(20, Math.floor(level || 1)));
  const type = classify(className, subclass);
  const c = className.trim().toLowerCase();
  const cantrips = CANTRIP_PROG[c] ? CANTRIP_PROG[c](lvl) : 0;

  switch (type) {
    case 'full': {
      const row = FULL_CASTER_SLOTS[lvl] ?? FULL_CASTER_SLOTS[1];
      return {
        casterType: 'full',
        cantripsKnown: cantrips,
        spellSlots: rowToSlotMap(row),
        pactSlotLevel: null,
        pactSlotCount: null,
      };
    }
    case 'half': {
      const row = priorRow(HALF_CASTER_SLOTS, lvl);
      return {
        casterType: 'half',
        cantripsKnown: 0,
        spellSlots: row ? rowToSlotMap(row) : null,
        pactSlotLevel: null,
        pactSlotCount: null,
      };
    }
    case 'third': {
      const row = priorRow(THIRD_CASTER_SLOTS, lvl);
      return {
        casterType: 'third',
        cantripsKnown: 0,
        spellSlots: row ? rowToSlotMap(row) : null,
        pactSlotLevel: null,
        pactSlotCount: null,
      };
    }
    case 'warlock': {
      const w = WARLOCK_PROG[lvl] ?? WARLOCK_PROG[1];
      return {
        casterType: 'warlock',
        cantripsKnown: cantrips,
        spellSlots: null,
        pactSlotLevel: w.level,
        pactSlotCount: w.count,
      };
    }
    default:
      return {
        casterType: 'none',
        cantripsKnown: 0,
        spellSlots: null,
        pactSlotLevel: null,
        pactSlotCount: null,
      };
  }
}

// Convenience: detect whether a class qualifies as a spellcaster at all,
// useful for parser/edit-view wiring. Returns true for full/half/third/warlock.
export function isCasterClass(className: string, subclass: string = ''): boolean {
  return classify(className, subclass) !== 'none';
}

// ──────────────────────────────────────────────────────────────────────────
// Multiclass parsing (CLASS LEVEL field from D&D Beyond)
// ──────────────────────────────────────────────────────────────────────────

export interface ParsedClassLine {
  primaryClass: string;
  primaryLevel: number;
  subclass: string;
  isMulticlass: boolean;
  classes: Array<{ name: string; level: number }>;
}

/**
 * Parse the D&D Beyond "CLASS LEVEL" field. Handles single-class
 * ("Warlock 7"), multiclass ("Warlock 5 / Sorcerer 2"), and parenthesized
 * subclass ("Fighter 3 (Eldritch Knight)").
 *
 * Picks the highest-level class as primary for spell slot lookup.
 */
export function parseClassLine(raw: string): ParsedClassLine {
  if (!raw) {
    return { primaryClass: '', primaryLevel: 1, subclass: '', isMulticlass: false, classes: [] };
  }

  // Pull out (Subclass) parentheticals before splitting on /
  const subclassMatches: string[] = [];
  const stripped = raw.replace(/\(([^)]+)\)/g, (_m, s) => {
    subclassMatches.push(s.trim());
    return '';
  });

  const parts = stripped.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
  const classes = parts.map((p) => {
    const m = p.match(/^(.+?)\s+(\d+)/);
    if (m) return { name: m[1].trim(), level: parseInt(m[2], 10) };
    return { name: p, level: 1 };
  }).filter((c) => c.name);

  if (classes.length === 0) {
    return { primaryClass: '', primaryLevel: 1, subclass: '', isMulticlass: false, classes: [] };
  }

  const sorted = [...classes].sort((a, b) => b.level - a.level);
  const primary = sorted[0];
  return {
    primaryClass: primary.name,
    primaryLevel: primary.level,
    subclass: subclassMatches[0] || '',
    isMulticlass: classes.length > 1,
    classes,
  };
}
