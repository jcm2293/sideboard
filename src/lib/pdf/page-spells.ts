// Spells pages (sheet spec v3 §5.3): the stats strip with slot bubbles, a
// chip legend, and one deduped spell index grouped by level. The description
// cards that follow are the existing card renderer in character-export.ts,
// fed by spellsByLevel() so they dedupe the same way.

import type { jsPDF } from 'jspdf';
import type { PlayerCharacter, SpellEntry } from '@/types';
import { modString, spellAttackBonus, spellKey, spellSaveDc } from '@/lib/character';
import { featureKey } from '@/data/class-reference';
import type { SrdSpell } from '@/types';
import {
  C,
  CONTENT_W,
  FONT,
  PAGE,
  capsOpts,
  drawRich,
  fitText,
  fill,
  fs,
  hline,
  layoutRich,
  ptMm,
  px,
  rect,
  stroke,
  text,
  vline,
  wrap,
  type ChipVariant,
  type Run,
} from './sheet-kit';
import { allFeatures, hitOrDc, shortRange, spellDetailsOf } from './sheet-data';
import { drawBand } from './page-combat';
import type { SpellLookup } from './spell-library';

const BOTTOM = PAGE.h - PAGE.margin - px(6);
const ascent = (sizePx: number) => ptMm(fs(sizePx)) * 0.72;
const lineH = (sizePx: number, leading: number) => ptMm(fs(sizePx)) * leading;
const ORDINAL = ['cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

// ──────────────────────────────────────────────────────────────────────────
// The spell list: deduped, one entry per spell, ordered for reading
// ──────────────────────────────────────────────────────────────────────────

/** A stored sheet without spell_details still has names by level; fill what the library knows. */
function fromNames(c: PlayerCharacter, lookup: SpellLookup): SpellEntry[] {
  const out: SpellEntry[] = [];
  for (const [lvl, names] of Object.entries(c.spells ?? {})) {
    for (const raw of names ?? []) {
      const lib = lookup(raw);
      const level = parseInt(lvl, 10) || 0;
      out.push({
        name: raw.replace(/\s*\[[^\]]*\]\s*$/, ''),
        level,
        source: '',
        origin: 'class',
        always_prepared: false,
        costs_slot: level > 0 && !/\[(?:R|At Will)\]/i.test(raw),
        ritual: /\[R\]/i.test(raw) || Boolean(lib?.ritual),
        concentration: Boolean(lib?.concentration),
        save_or_atk: '',
        casting_time: lib?.casting_time ?? '',
        range: lib?.range ?? '',
        components: (lib?.components ?? []).join(','),
        duration: lib?.duration ?? '',
        notes: '',
        page_ref: '',
        ...(/\[1\/LR\]/i.test(raw) ? { free_uses: { count: 1, per: 'long' as const } } : {}),
      });
    }
  }
  return out;
}

// Reading order inside a level: slot spells, free casts, always-prepared, at will, rituals.
function rank(s: SpellEntry): number {
  if (s.level === 0) return 0;
  if (s.free_uses) return 1;
  if (s.always_prepared && s.costs_slot) return 2;
  if (s.costs_slot) return 0;
  return s.ritual ? 4 : 3;
}

/** Every spell once (by name, ignoring "[R]"-style markers), grouped by level. */
export function spellsByLevel(c: PlayerCharacter, lookup: SpellLookup): [number, SpellEntry[]][] {
  const source = spellDetailsOf(c).length > 0 ? spellDetailsOf(c) : fromNames(c, lookup);
  const seen = new Map<string, SpellEntry>();
  for (const s of source) if (!seen.has(spellKey(s.name))) seen.set(spellKey(s.name), s);
  const byLevel = new Map<number, SpellEntry[]>();
  for (const s of seen.values()) byLevel.set(s.level, [...(byLevel.get(s.level) ?? []), s]);
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lvl, list]) => [lvl, list.sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name))]);
}

// ──────────────────────────────────────────────────────────────────────────
// Cell text
// ──────────────────────────────────────────────────────────────────────────

/** "1BA" → "1 BA", "1m" → "1 min", "10m" → "10 min", "1h" → "1 hr". */
export function timeLabel(t: string): string {
  const action = t.match(/^(\d+)\s*(A|BA|R)$/i);
  if (action) return `${action[1]} ${action[2].toUpperCase()}`;
  const unit = t.match(/^(\d+)\s*(m|h)$/i);
  if (unit) return `${unit[1]} ${unit[2].toLowerCase() === 'm' ? 'min' : 'hr'}`;
  return t || '—';
}

/** "Concentration, up to 1 minute" → "1 min" (the C chip carries concentration); "Instantaneous" → "—". */
function durationLabel(d: string): string {
  const s = d.replace(/^Concentration,?\s*(?:up to\s*)?/i, '').trim();
  if (!s || /^instantaneous$/i.test(s)) return '—';
  return s.replace(/\bminutes?\b/i, 'min').replace(/\bhours?\b/i, 'hr').toLowerCase();
}

/** "Self/15 ft. Cone" → "15 ft cone"; a self-centred area needs no "self". */
function rangeLabel(r: string): string {
  return shortRange(r).replace(/^self, (?=\d)/, '') || '—';
}

const SUBCLASS_PREFIX = /^(?:Oath of(?: the)?|Circle of(?: the)?|College of|Path of the|Way of the|Way of)\s+/i;

/** The From column: Warlock, Tome, Fiend (always prepared), Fey Touched, Drow lineage, Evocation Savant. */
export function fromLabel(c: PlayerCharacter, s: SpellEntry): string {
  const src = s.source.replace(/\s*\(Always Prepared\)\s*$/i, '').trim();
  let label = src.replace(/\s+Spells$/i, '');
  if (s.origin === 'invocation') {
    // The invocation that names the spell (Mask of Many Faces); else a Book of Shadows pick.
    const named = new RegExp(`\\b${s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const grantor = allFeatures(c).find((f) => f.parent && named.test(f.full_text || f.summary || ''));
    const tome = allFeatures(c).some((f) => featureKey(f.name) === 'pact of the tome');
    label = grantor?.name ?? (tome ? 'Tome' : 'Invocation');
  } else if (s.origin === 'species') {
    const lineage = (c.racial_traits ?? []).flatMap((f) => f.options ?? []).find((o) => /lineage$/i.test(o));
    if (lineage) label = lineage.replace(/\s+Lineage$/i, ' lineage');
  } else if (s.origin === 'subclass') {
    label = label.replace(SUBCLASS_PREFIX, '');
    if (s.always_prepared) label += ', always prepared';
  }
  return label || '—';
}

export function spellChips(s: SpellEntry): { text: string; variant: ChipVariant }[] {
  const chips: { text: string; variant: ChipVariant }[] = [];
  if (s.concentration) chips.push({ text: 'C', variant: 'conc' });
  if (s.free_uses) chips.push({ text: `free ${s.free_uses.count}/${s.free_uses.per === 'short' ? 'SR' : 'LR'}`, variant: 'free' });
  if (s.costs_slot) chips.push({ text: s.free_uses ? 'then slot' : 'slot', variant: 'slot' });
  else if (s.level > 0 && !s.free_uses && !s.ritual) chips.push({ text: 'at will', variant: 'plain' });
  if (s.ritual) chips.push({ text: 'ritual', variant: 'plain' });
  return chips;
}

const abilityWord = (c: PlayerCharacter) => {
  const a = (c.spellcasting_ability ?? '').toLowerCase();
  return a ? a[0].toUpperCase() + a.slice(1, 3) : '';
};
const isPact = (c: PlayerCharacter) => c.pact_slot_count != null && c.pact_slot_level != null;

export function indexDetail(c: PlayerCharacter): string {
  return [isPact(c) ? 'Pact Magic' : '', abilityWord(c), `DC ${spellSaveDc(c)}`, `atk ${modString(spellAttackBonus(c))}`]
    .filter(Boolean)
    .join(' · ');
}

export function cardsDetail(c: PlayerCharacter): string {
  const pact = isPact(c) ? `slots at ${ORDINAL[c.pact_slot_level!]}` : '';
  return [`DC ${spellSaveDc(c)}`, `atk ${modString(spellAttackBonus(c))}`, pact].filter(Boolean).join(' · ');
}

// ──────────────────────────────────────────────────────────────────────────
// Stats strip: spell save DC, spell attack, ability, slots
// ──────────────────────────────────────────────────────────────────────────

function slotBubble(doc: jsPDF, cx: number, cy: number, r: number, heavy: boolean) {
  fill(doc, C.cream);
  stroke(doc, C.maroon);
  doc.setLineWidth(heavy ? px(2) : px(1.4));
  doc.circle(cx, cy, r, 'FD');
  if (heavy) {
    fill(doc, '#FFF8EA');
    doc.circle(cx, cy, r - px(4), 'F');
  }
}

function drawStrip(doc: jsPDF, c: PlayerCharacter, y: number): number {
  const fr = CONTENT_W / 5.4;
  const pad = px(10);
  const label = capsOpts(8.5, C.muted, 0.12);
  const labelBase = y + px(8) + ascent(8.5);
  const valueBase = labelBase + px(3) + ptMm(fs(28)) * 0.78;

  // Slot block: pact slots as big bubbles; others one column per slot level.
  const slotsX = PAGE.margin + 3 * fr;
  const slotsW = 2.4 * fr - 2 * pad;
  const levels = Object.entries(c.spell_slots ?? {})
    .map(([l, n]) => [parseInt(l, 10), n ?? 0] as const)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a - b);
  const pact = isPact(c);
  const bigR = px(11);
  const colW = levels.length > 0 ? slotsW / levels.length : slotsW;
  const most = Math.max(1, ...levels.map(([, n]) => n));
  const perRow = most <= 4 || colW >= most * px(18) ? most : Math.ceil(most / 2);
  const smallR = Math.min(px(8), (colW - px(6)) / perRow / 2 - px(1.5));
  const bubbleRows = pact ? 1 : Math.ceil(most / perRow);
  const bubblesTop = labelBase + px(6);
  const bubblesH = pact ? 2 * bigR : bubbleRows * (2 * smallR + px(3));
  const subBase = bubblesTop + bubblesH + px(5) + ascent(10.5);
  const height = Math.max(valueBase + px(8), subBase + px(8)) - y;

  rect(doc, PAGE.margin, y, CONTENT_W, height, { fill: C.cream, stroke: C.maroon, lw: px(1.5) });
  for (let i = 1; i <= 3; i++) vline(doc, PAGE.margin + i * fr, y + px(1), y + height - px(1), C.rule);

  const big: [string, string, number][] = [
    ['Spell save DC', String(spellSaveDc(c)), 28],
    ['Spell attack', modString(spellAttackBonus(c)), 28],
    ['Ability', (c.spellcasting_ability ?? '—').toUpperCase(), 16],
  ];
  big.forEach(([l, v, size], i) => {
    const cx = PAGE.margin + i * fr + fr / 2;
    const caps = l.toUpperCase();
    text(doc, caps, cx, labelBase, { ...fitText(doc, caps, fr - px(8), label), align: 'center' });
    const base = size === 28 ? valueBase : labelBase + px(7) + ptMm(fs(size)) * 0.9;
    text(doc, v, cx, base, { size: fs(size), style: 'bold', color: C.maroon, font: FONT.display, align: 'center' });
  });

  const sx = slotsX + pad;
  const sub = (s: string) => text(doc, s, sx, subBase, { ...fitText(doc, s, slotsW, { size: fs(10.5), color: C.muted }) });
  if (pact) {
    const ord = ORDINAL[c.pact_slot_level!];
    text(doc, `PACT SLOTS · ALL CAST AT ${ord.toUpperCase()} LEVEL`, sx, labelBase, label);
    for (let i = 0; i < c.pact_slot_count!; i++) slotBubble(doc, sx + bigR + i * (2 * bigR + px(8)), bubblesTop + bigR, bigR, true);
    const cunning = allFeatures(c).some((f) => featureKey(f.name) === 'magical cunning');
    const back = Math.ceil(c.pact_slot_count! / 2);
    const note = `regain on a short rest${cunning ? ` · Magical Cunning restores ${back === 1 ? 'one' : back}, 1/long rest` : ''}`;
    sub(note);
  } else if (levels.length > 0) {
    text(doc, 'SPELL SLOTS', sx, labelBase, label);
    levels.forEach(([lvl, n], i) => {
      const x0 = sx + i * colW;
      text(doc, ORDINAL[lvl], x0, bubblesTop + smallR + ascent(10) / 2, { size: fs(10), style: 'bold', color: C.maroon });
      const bx = x0 + px(20);
      for (let k = 0; k < n; k++) {
        const row = Math.floor(k / perRow);
        const col = k % perRow;
        slotBubble(doc, bx + smallR + col * (2 * smallR + px(3)), bubblesTop + smallR + row * (2 * smallR + px(3)), smallR, false);
      }
    });
    sub('slots return on a long rest');
  } else {
    text(doc, 'NO SPELL SLOTS', sx, labelBase, label);
  }
  return y + height;
}

// ──────────────────────────────────────────────────────────────────────────
// Legend and index table
// ──────────────────────────────────────────────────────────────────────────

const LEGEND: Record<string, string> = {
  slot: 'costs a spell slot',
  'then slot': 'after the free cast, a slot',
  'at will': 'no slot, ever',
  ritual: 'as a ritual, no slot, +10 min',
  C: 'concentration',
};

function legendRuns(c: PlayerCharacter, rows: SpellEntry[]): Run[] {
  const present = new Map<string, { text: string; variant: ChipVariant }>();
  for (const s of rows) for (const ch of spellChips(s)) present.set(ch.variant === 'free' ? 'free' : ch.text, ch);
  const runs: Run[] = [];
  const order = ['slot', 'free', 'then slot', 'at will', 'ritual', 'C'];
  for (const key of order) {
    const ch = present.get(key);
    if (!ch) continue;
    const meaning =
      key === 'free' ? 'once per rest without a slot' : key === 'slot' && isPact(c) ? 'costs a pact slot' : LEGEND[key];
    runs.push({ kind: 'chip', text: ch.text, variant: ch.variant });
    runs.push({ kind: 'text', text: ` ${meaning}    `, color: C.muted });
  }
  return runs;
}

const COLS: { label: string; f: number }[] = [
  { label: 'Spell', f: 0.34 },
  { label: 'Time', f: 0.08 },
  { label: 'Range', f: 0.17 },
  { label: 'Hit / DC', f: 0.1 },
  { label: 'Duration', f: 0.11 },
  { label: 'From', f: 0.2 },
];
const PAD = px(6);

interface Unit {
  height: number;
  keepWithNext?: boolean;
  draw: (y: number) => void;
}

function tableHeader(doc: jsPDF): Unit {
  const h = px(6) + ptMm(fs(8.5)) + px(3);
  return {
    height: h,
    draw: (y) => {
      rect(doc, PAGE.margin, y, CONTENT_W, h, { fill: C.maroon });
      let x = PAGE.margin;
      for (const col of COLS) {
        text(doc, col.label.toUpperCase(), x + PAD, y + h - px(4), capsOpts(8.5, C.bandText, 0.1, 'bold'));
        x += col.f * CONTENT_W;
      }
    },
  };
}

function levelDivider(doc: jsPDF, level: number, c: PlayerCharacter): Unit {
  const label = (level === 0 ? 'Cantrips' : `${ORDINAL[level]} level`) + (isPact(c) && level === c.pact_slot_level ? ' · pact slots cast here' : '');
  const caps = label.toUpperCase();
  const opts = capsOpts(10, C.maroon, 0.14);
  return {
    height: px(9) + ptMm(fs(10)) + px(4),
    keepWithNext: true,
    draw: (y) => {
      const base = y + px(9) + ascent(10);
      const w = text(doc, caps, PAGE.w / 2, base, { ...opts, align: 'center' });
      const mid = base - ascent(10) / 2;
      hline(doc, PAGE.margin, PAGE.w / 2 - w / 2 - px(8), mid, C.maroon);
      hline(doc, PAGE.w / 2 + w / 2 + px(8), PAGE.margin + CONTENT_W, mid, C.maroon);
    },
  };
}

function spellRow(doc: jsPDF, c: PlayerCharacter, s: SpellEntry, shaded: boolean): Unit {
  const size = fs(11.5);
  const step = lineH(11.5, 1.3);
  const widths = COLS.map((col) => col.f * CONTENT_W - 2 * PAD);
  const nameRuns: Run[] = [
    { kind: 'text', text: s.name, style: 'bold' },
    ...spellChips(s).map((ch) => ({ kind: 'chip' as const, text: ch.text, variant: ch.variant })),
  ];
  const name = layoutRich(doc, nameRuns, widths[0], size);
  const hit = hitOrDc(s.save_or_atk);
  const cells = [timeLabel(s.casting_time), rangeLabel(s.range), hit, durationLabel(s.duration), fromLabel(c, s)].map((v, i) =>
    wrap(doc, v, widths[i + 1], { size, style: i === 2 && hit !== '—' ? 'bold' : 'normal' }),
  );
  const height = Math.max(name.length, ...cells.map((l) => l.length)) * step + px(6);
  return {
    height,
    draw: (y) => {
      if (shaded) rect(doc, PAGE.margin, y, CONTENT_W, height, { fill: C.rowTint });
      const base = y + px(3) + ascent(11.5);
      drawRich(doc, name, PAGE.margin + PAD, base, step, size);
      let x = PAGE.margin + COLS[0].f * CONTENT_W;
      cells.forEach((lines, i) => {
        lines.forEach((line, k) =>
          text(doc, line, x + PAD, base + k * step, { size, style: i === 2 && hit !== '—' ? 'bold' : 'normal' }),
        );
        x += COLS[i + 1].f * CONTENT_W;
      });
      hline(doc, PAGE.margin, PAGE.margin + CONTENT_W, y + height, C.rowRule);
    },
  };
}

/**
 * The index pages: strip, legend, and the table, continued on a second page
 * (header repeated) when it runs long. Cards start on the page after.
 */
export function drawSpellIndexPages(doc: jsPDF, c: PlayerCharacter, lookup: SpellLookup): void {
  const groups = spellsByLevel(c, lookup);
  const all = groups.flatMap(([, list]) => list);
  const newPage = (title: string): number => {
    doc.addPage();
    rect(doc, 0, 0, PAGE.w, PAGE.h, { fill: C.parchment });
    return drawBand(doc, c, title, indexDetail(c)) + px(16);
  };

  let y = newPage('Spell index');
  y = drawStrip(doc, c, y) + px(10);
  const legend = layoutRich(doc, legendRuns(c, all), CONTENT_W, fs(10.5));
  y = drawRich(doc, legend, PAGE.margin, y + ascent(10.5), lineH(10.5, 1.6), fs(10.5)) - ascent(10.5) + px(4);

  const header = tableHeader(doc);
  header.draw(y);
  y += header.height;
  const units: Unit[] = [];
  for (const [level, list] of groups) {
    units.push(levelDivider(doc, level, c));
    list.forEach((s, i) => units.push(spellRow(doc, c, s, i % 2 === 1)));
  }
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const need = u.height + (u.keepWithNext && units[i + 1] ? units[i + 1].height : 0);
    if (y + need > BOTTOM - px(14)) {
      y = newPage('Spell index (cont.)');
      header.draw(y);
      y += header.height;
    }
    u.draw(y);
    y += u.height;
  }
  const foot = 'Full descriptions follow, grouped the same way.';
  text(doc, foot, PAGE.w / 2, Math.min(BOTTOM, y + px(18)), { size: fs(9.5), style: 'italic', color: C.muted, align: 'center' });
}

/** Header facts for a description card: the export's per-spell fields first, the library's otherwise. */
export function cardFacts(s: SpellEntry | undefined, lib: SrdSpell | null) {
  const time = s?.casting_time
    ? s.casting_time
        .replace(/^(\d+)\s*BA$/i, '$1 bonus action')
        .replace(/^(\d+)\s*A$/i, '$1 action')
        .replace(/^(\d+)\s*R$/i, '$1 reaction')
        .replace(/^1\s*m$/i, '1 minute')
        .replace(/^(\d+)\s*m$/i, '$1 minutes')
        .replace(/^1\s*h$/i, '1 hour')
        .replace(/^(\d+)\s*h$/i, '$1 hours')
    : lib?.casting_time ?? '';
  const range = s?.range ? s.range.replace(/\//g, ', ') : lib?.range ?? '';
  const components = s?.components ? s.components.replace(/\s*,\s*/g, ', ') : (lib?.components ?? []).join(', ');
  const duration = s?.duration || (lib ? `${lib.concentration ? 'Concentration, ' : ''}${lib.duration}` : '');
  return { time, range, components, duration };
}
