// PDF character sheet renderer. Pure — no I/O: the export route and
// scripts/export-fixtures.ts both call renderCharacterPdf.
//
// Pages:
//   1. Combat reference  — the v3 page (page-combat.ts)
//   2. Features          — interim: the old feature list until the v3 page lands
//   3. Spells            — stats bar, slot boxes, full spell cards w/ SRD descriptions
//   4. Inventory         — only when it doesn't fit inline on page 1
//
// jsPDF's built-in fonts (helvetica, times, courier) don't carry full Unicode,
// so we draw bubbles/circles with doc.circle() instead of using ●/○ glyphs.
// "times" is the closest serif fallback to Cinzel/Crimson per the spec.

import { jsPDF } from 'jspdf';
import type { CustomSpell, FeatureEntry, PlayerCharacter, SrdSpell } from '@/types';
import { spellSaveDc, spellAttackBonus } from '@/lib/character';
import { drawCombatPage, drawResources } from './page-combat';
import { hardenPdfText } from './sheet-kit';
import { createSpellLookup, type SpellLookup } from './spell-library';

// ──────────────────────────────────────────────────────────────────────────
// Style tokens
// ──────────────────────────────────────────────────────────────────────────

const PARCHMENT = '#F4E4C1';
const PARCHMENT_ALT = '#EDD6A8';
const MAROON = '#58180D';
const BODY = '#1A1210';
const MUTED = '#6b6b6b';
const CREAM = '#FDF1DC';

// US Letter, mm
const PW = 215.9;
const PH = 279.4;
const MARGIN = 12.7; // 0.5 inch

const SERIF = 'times';

// ──────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ──────────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
function setFill(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}
function setText(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}
function setDraw(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}
function modStr(mod: number | null | undefined): string {
  if (mod == null) return '—';
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function drawParchmentBg(doc: jsPDF) {
  setFill(doc, PARCHMENT);
  doc.rect(0, 0, PW, PH, 'F');
}

/** Filled circle for proficiency dots — draws a real circle, no Unicode glyph dependency. */
function dot(doc: jsPDF, x: number, y: number, r: number, filled: boolean) {
  setDraw(doc, MAROON);
  setFill(doc, MAROON);
  doc.circle(x, y, r, filled ? 'F' : 'S');
}

/** Wrap and draw multi-line text; returns updated y. */
function drawWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  if (!text) return y;
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

/** Header for any page: maroon top band + character name + class line. */
function drawPageHeader(doc: jsPDF, c: PlayerCharacter, subtitle?: string) {
  // Thin top accent
  setFill(doc, MAROON);
  doc.rect(0, 0, PW, 1.5, 'F');

  // Main band
  setFill(doc, MAROON);
  doc.rect(0, 1.5, PW, 24, 'F');

  // Character name
  doc.setFont(SERIF, 'bold');
  doc.setFontSize(20);
  setText(doc, '#FFFFFF');
  doc.text(c.name || 'Unnamed', MARGIN, 14);

  // Player name (italic, smaller)
  if (c.player_name) {
    doc.setFont(SERIF, 'italic');
    doc.setFontSize(9);
    setText(doc, '#E8D8B8');
    doc.text(c.player_name, MARGIN, 21);
  }

  // Right side: class — subclass — level
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(12);
  setText(doc, '#FFFFFF');
  const classBits: string[] = [];
  if (c.class_name) classBits.push(c.class_name);
  if (c.subclass) classBits.push(c.subclass);
  classBits.push(`Level ${c.level || 1}`);
  doc.text(classBits.join(' — '), PW - MARGIN, 14, { align: 'right' });

  if (subtitle) {
    doc.setFont(SERIF, 'italic');
    doc.setFontSize(11);
    doc.text(subtitle, PW - MARGIN, 21, { align: 'right' });
  }

  // Bottom accent line
  setFill(doc, MAROON);
  doc.rect(0, 25.5, PW, 1, 'F');
}

// ──────────────────────────────────────────────────────────────────────────
// Page 1: Combat reference
// ──────────────────────────────────────────────────────────────────────────

interface QuickStat {
  label: string;
  value: string;
}

function drawQuickStatsBar(doc: jsPDF, stats: QuickStat[], y: number): number {
  const x0 = MARGIN;
  const totalW = PW - 2 * MARGIN;
  const h = 14;
  const colW = totalW / stats.length;

  // Background
  setFill(doc, CREAM);
  setDraw(doc, MAROON);
  doc.setLineWidth(0.3);
  doc.rect(x0, y, totalW, h, 'FD');

  // Vertical separators + labels + values
  for (let i = 0; i < stats.length; i++) {
    const cx = x0 + i * colW + colW / 2;

    if (i > 0) {
      setDraw(doc, MAROON);
      doc.setLineWidth(0.15);
      doc.line(x0 + i * colW, y + 2, x0 + i * colW, y + h - 2);
    }

    // Label — fontSize 7 since 6 boxes (vs the prior 9) leave more horizontal room.
    setText(doc, MUTED);
    doc.setFont(SERIF, 'normal');
    doc.setFontSize(7);
    doc.text(stats[i].label.toUpperCase(), cx, y + 4.5, { align: 'center' });

    // Value
    setText(doc, MAROON);
    doc.setFont(SERIF, 'bold');
    doc.setFontSize(11);
    doc.text(stats[i].value, cx, y + 11, { align: 'center' });
  }

  return y + h + 3;
}

// ──────────────────────────────────────────────────────────────────────────
// Right column blocks
// ──────────────────────────────────────────────────────────────────────────

function drawSectionHeader(doc: jsPDF, label: string, x: number, y: number, w: number): number {
  setText(doc, MAROON);
  doc.setFont(SERIF, 'bold');
  doc.setFontSize(10);
  doc.text(label, x, y);
  // Underline
  setDraw(doc, MAROON);
  doc.setLineWidth(0.4);
  doc.line(x, y + 1, x + w, y + 1);
  return y + 5;
}

// ──────────────────────────────────────────────────────────────────────────
// Feature list rendering — single column, name on its own line.
//
// Each feature renders as:
//   <Feature Name>.        ← bold italic, own line
//   <description text...>  ← wraps left-aligned with the name
//   (4pt vertical gap before the next feature)
//
// The renderer is page-break aware: if a feature won't fit on the current page,
// it calls onPageBreak() (caller decides whether to addPage and re-render a
// "(continued)" header) and continues from the new top.

interface FeatureListOpts {
  /** Width to wrap descriptions at. */
  width: number;
  /** Top-of-feature-area y on the current page (used for overflow detection). */
  pageTopY: number;
  /** Bottom margin on the page (don't draw past PH - bottomMargin). */
  bottomMargin?: number;
  /** Called when a feature would overflow; returns the new (x, y) to continue at. */
  onPageBreak: () => { x: number; y: number };
  /** Font size for feature text (description). Default 8. */
  fontSize?: number;
}

function drawFeatureBlock(
  doc: jsPDF,
  feature: { name: string; summary: string },
  x: number,
  y: number,
  opts: FeatureListOpts,
): { x: number; y: number } {
  const fontSize = opts.fontSize ?? 8;
  const lineH = fontSize * 0.45;
  const descW = opts.width;
  const bottomMargin = opts.bottomMargin ?? MARGIN;

  // Establish a clean rendering context BEFORE measurement.
  // splitTextToSize wraps based on the currently-active font/size, so we must
  // pin both. Without this, prior section headers (bold 10pt) leak into the
  // line-width math.
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(fontSize);
  let wrappedDesc = doc.splitTextToSize(feature.summary || '', descW) as string[];
  const blockH =
    lineH +                       // name line
    wrappedDesc.length * lineH +  // description lines
    1.5;                          // small bottom pad

  // Page break if we'd overflow. The callback may render its own header
  // (which mutates font state) — we'll re-establish the body context below.
  if (y + blockH > PH - bottomMargin) {
    const next = opts.onPageBreak();
    x = next.x;
    y = next.y;
    // The callback may have released a column constraint (mutating
    // opts.width) — re-wrap this feature at the current width.
    doc.setFont(SERIF, 'normal');
    doc.setFontSize(fontSize);
    wrappedDesc = doc.splitTextToSize(feature.summary || '', opts.width) as string[];
  }

  // Re-establish font state explicitly for every draw operation. Both size
  // and style are set so the callback's font choices can't leak through.
  setText(doc, MAROON);
  doc.setFont(SERIF, 'bolditalic');
  doc.setFontSize(fontSize);
  doc.text(`${feature.name}.`, x, y);
  y += lineH;

  setText(doc, BODY);
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(fontSize);
  for (const line of wrappedDesc) {
    doc.text(line, x, y);
    y += lineH;
  }

  // 4pt gap before next feature
  return { x, y: y + 1.4 };
}

/** Render a list of features with a section header. Returns final y. */
function drawFeatureSection(
  doc: jsPDF,
  title: string,
  features: { name: string; summary: string }[] | null,
  x: number,
  y: number,
  opts: FeatureListOpts,
): number {
  if (!features || features.length === 0) return y;

  // Header at current position
  y = drawSectionHeader(doc, title.toUpperCase(), x, y, opts.width);

  for (const f of features) {
    const result = drawFeatureBlock(doc, f, x, y, opts);
    x = result.x;
    y = result.y;
  }

  return y + 1.5;
}

// ──────────────────────────────────────────────────────────────────────────
// Interim features page: the old feature list, until the v3 Features page
// (spec §5.2) replaces it.
// ──────────────────────────────────────────────────────────────────────────

function drawFeaturesPage(doc: jsPDF, c: PlayerCharacter, withResources: boolean) {
  const sections: [string, FeatureEntry[] | null][] = [
    ['Class Features', c.class_features],
    ['Species Traits', c.racial_traits],
    ['Feats', c.feats],
  ];
  if (!withResources && !sections.some(([, f]) => f && f.length > 0)) return;

  const newPage = (subtitle: string) => {
    doc.addPage();
    drawParchmentBg(doc);
    drawPageHeader(doc, c, subtitle);
  };
  newPage('Features');
  const opts: FeatureListOpts = {
    width: PW - 2 * MARGIN,
    pageTopY: 30,
    bottomMargin: 12,
    fontSize: 8,
    onPageBreak: () => {
      newPage('Features (cont.)');
      return { x: MARGIN, y: 32 };
    },
  };
  // Resources that didn't fit on page 1 lead page 2.
  let y = withResources ? drawResources(doc, c, 32) : 32;
  for (const [title, features] of sections) {
    y = drawFeatureSection(doc, title, features, MARGIN, y, opts);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// PAGE 2: Inventory
// ──────────────────────────────────────────────────────────────────────────

function drawInventoryPage(doc: jsPDF, c: PlayerCharacter) {
  doc.addPage();
  drawParchmentBg(doc);
  drawPageHeader(doc, c, 'Inventory');

  const y = 32;

  // Two-column layout
  const leftX = MARGIN;
  const leftW = (PW - 2 * MARGIN) * 0.62;
  const rightX = leftX + leftW + 5;
  const rightW = PW - MARGIN - rightX;

  // INVENTORY TABLE
  const ly0 = drawSectionHeader(doc, 'INVENTORY', leftX, y, leftW);

  const cols = [
    { label: 'Item', w: 0.50 },
    { label: 'Qty', w: 0.10 },
    { label: 'Weight', w: 0.18 },
    { label: 'Notes', w: 0.22 },
  ];
  const rowH = 5;

  // Header
  setFill(doc, MAROON);
  doc.rect(leftX, ly0, leftW, rowH, 'F');
  setText(doc, '#FFFFFF');
  doc.setFont(SERIF, 'bold');
  doc.setFontSize(8);
  let cx = leftX;
  for (const col of cols) {
    doc.text(col.label, cx + 1.5, ly0 + 3.5);
    cx += leftW * col.w;
  }
  let ly = ly0 + rowH;

  doc.setFont(SERIF, 'normal');
  doc.setFontSize(8);

  const equipment = c.equipment || [];
  for (let i = 0; i < equipment.length; i++) {
    if (ly > PH - MARGIN - 15) break;
    const item = equipment[i];
    if (i % 2 === 0) {
      setFill(doc, PARCHMENT_ALT);
      doc.rect(leftX, ly, leftW, rowH, 'F');
    }
    setText(doc, BODY);
    cx = leftX;
    const cells = [item.name, String(item.qty), item.weight || '', item.notes || ''];
    for (let j = 0; j < cols.length; j++) {
      const colWidth = leftW * cols[j].w;
      const text = doc.splitTextToSize(cells[j] || '', colWidth - 2)[0] || '';
      doc.text(text, cx + 1.5, ly + 3.5);
      cx += colWidth;
    }
    ly += rowH;
  }
  setDraw(doc, MAROON);
  doc.setLineWidth(0.3);
  doc.line(leftX, ly, leftX + leftW, ly);

  // CURRENCY block (right)
  let ry = drawSectionHeader(doc, 'CURRENCY', rightX, y, rightW);
  const coins: { label: string; key: 'cp' | 'sp' | 'ep' | 'gp' | 'pp' }[] = [
    { label: 'CP', key: 'cp' },
    { label: 'SP', key: 'sp' },
    { label: 'EP', key: 'ep' },
    { label: 'GP', key: 'gp' },
    { label: 'PP', key: 'pp' },
  ];
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(9);
  for (const coin of coins) {
    setText(doc, MAROON);
    doc.setFont(SERIF, 'bold');
    doc.text(coin.label, rightX, ry);
    setText(doc, BODY);
    doc.setFont(SERIF, 'normal');
    doc.text(String(c[coin.key] ?? 0), rightX + rightW, ry, { align: 'right' });
    ry += 5;
  }

  // Total wealth in GP equivalent: 1gp = 100cp = 10sp = 2ep = 0.1pp
  const totalGp =
    (c.cp ?? 0) / 100 +
    (c.sp ?? 0) / 10 +
    (c.ep ?? 0) / 2 +
    (c.gp ?? 0) +
    (c.pp ?? 0) * 10;
  ry += 1;
  setDraw(doc, MAROON);
  doc.setLineWidth(0.3);
  doc.line(rightX, ry, rightX + rightW, ry);
  ry += 3.5;
  setText(doc, MAROON);
  doc.setFont(SERIF, 'bold');
  doc.setFontSize(9);
  doc.text('Total (GP)', rightX, ry);
  setText(doc, BODY);
  doc.text(totalGp.toFixed(1), rightX + rightW, ry, { align: 'right' });
  ry += 8;

  // NOTES block — empty space the player CAN write in
  ry = drawSectionHeader(doc, 'NOTES', rightX, ry, rightW);
  setDraw(doc, MUTED);
  doc.setLineWidth(0.15);
  while (ry < PH - MARGIN - 5) {
    doc.line(rightX, ry, rightX + rightW, ry);
    ry += 5;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// PAGE 3: Spells
// ──────────────────────────────────────────────────────────────────────────

function levelLabel(level: string): string {
  if (level === '0') return 'Cantrips';
  const n = parseInt(level, 10);
  const suffix: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${n}${suffix[n] || 'th'} Level`;
}

function drawSpellSlots(doc: jsPDF, c: PlayerCharacter, x: number, y: number, w: number): number {
  const isWarlock = c.pact_slot_count != null && c.pact_slot_level != null;

  if (isWarlock) {
    y = drawSectionHeader(doc, 'PACT SLOTS', x, y, w);
    const boxSize = 18;
    setFill(doc, CREAM);
    setDraw(doc, MAROON);
    doc.setLineWidth(0.3);
    doc.rect(x, y, boxSize, boxSize, 'FD');
    setText(doc, MUTED);
    doc.setFont(SERIF, 'normal');
    doc.setFontSize(7);
    const ord = ['', '1st', '2nd', '3rd', '4th', '5th'][c.pact_slot_level!] || `${c.pact_slot_level}th`;
    doc.text(ord, x + boxSize / 2, y + 5, { align: 'center' });
    setText(doc, MAROON);
    doc.setFont(SERIF, 'bold');
    doc.setFontSize(16);
    doc.text(String(c.pact_slot_count), x + boxSize / 2, y + 13, { align: 'center' });
    // Pact Magic legend — warlock lists mix slot-consuming spells with at-will
    // invocations, tome rituals, and racial free casts; spell names carry
    // bracket markers and this explains them.
    let ly = y + boxSize + 4;
    setText(doc, MUTED);
    doc.setFont(SERIF, 'italic');
    doc.setFontSize(7);
    const legend =
      `All Pact Magic spells are cast at ${ord} level; expended slots return on a Short or Long Rest. ` +
      'Leveled spells expend a pact slot unless marked — [At Will]: invocation, no slot. ' +
      '[R]: may be cast as a ritual, no slot (+10 min). [1/LR]: free casting from a trait, once per Long Rest.';
    for (const line of doc.splitTextToSize(legend, w) as string[]) {
      doc.text(line, x, ly);
      ly += 3.2;
    }
    return ly + 3;
  }

  if (!c.spell_slots) return y;

  y = drawSectionHeader(doc, 'SPELL SLOTS', x, y, w);

  const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
  const boxSize = 16;
  const gap = 2;
  let bx = x;

  for (let lvl = 1; lvl <= 9; lvl++) {
    const count = c.spell_slots[String(lvl)] ?? 0;
    setFill(doc, count > 0 ? CREAM : '#E8DCB8');
    setDraw(doc, MAROON);
    doc.setLineWidth(0.25);
    doc.rect(bx, y, boxSize, boxSize, 'FD');

    setText(doc, MUTED);
    doc.setFont(SERIF, 'normal');
    doc.setFontSize(6.5);
    doc.text(ordinals[lvl], bx + boxSize / 2, y + 4, { align: 'center' });

    setText(doc, count > 0 ? MAROON : MUTED);
    doc.setFont(SERIF, 'bold');
    doc.setFontSize(13);
    doc.text(String(count), bx + boxSize / 2, y + 11.5, { align: 'center' });

    bx += boxSize + gap;
  }
  return y + boxSize + 5;
}

interface SpellCardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

function measureSpellCard(doc: jsPDF, name: string, srd: SrdSpell | null, width: number): number {
  // No-description case: just name + light padding (a row in the level group).
  if (!srd) return 11;

  let h = 5; // top padding + name
  h += 4; // school/level line
  h += 4; // casting time / range
  h += 4; // components / duration
  h += 1; // gap
  const desc = srd.desc.join(' ');
  const lines = doc.splitTextToSize(desc, width - 6).length;
  h += lines * 3.2;
  if (srd.higher_level && srd.higher_level.length > 0) {
    h += 2.5;
    const upLines = doc.splitTextToSize(srd.higher_level.join(' '), width - 6).length;
    h += upLines * 3.2;
  }
  return h + 4;
}

function drawSpellCard(
  doc: jsPDF,
  spellName: string,
  srd: SrdSpell | null,
  isPrepared: boolean,
  showPreparedDot: boolean,
  layout: SpellCardLayout,
) {
  const { x, y, width, height } = layout;

  // Card background
  setFill(doc, CREAM);
  setDraw(doc, MAROON);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, height, 'FD');

  let cy = y + 5;

  // Spell name
  setText(doc, MAROON);
  doc.setFont(SERIF, 'bold');
  doc.setFontSize(11);
  doc.text(spellName.toUpperCase(), x + 3, cy);

  // Prepared indicator (right side, drawn dot)
  if (showPreparedDot) {
    dot(doc, x + width - 8, cy - 1.5, 1.4, isPrepared);
    setText(doc, MUTED);
    doc.setFont(SERIF, 'italic');
    doc.setFontSize(7);
    doc.text(isPrepared ? 'Prepared' : 'Known', x + width - 5, cy, { align: 'left' });
  }
  cy += 4;

  if (srd) {
    // School/level italic line
    setText(doc, MUTED);
    doc.setFont(SERIF, 'italic');
    doc.setFontSize(8);
    const schoolLine = srd.level === 0
      ? `${srd.school} cantrip`
      : `${srd.level}${({1:'st',2:'nd',3:'rd'} as Record<number,string>)[srd.level] || 'th'}-level ${srd.school.toLowerCase()}${srd.ritual ? ' (ritual)' : ''}`;
    doc.text(schoolLine, x + 3, cy);
    cy += 4;

    // Two-column row: Casting Time | Range
    setText(doc, BODY);
    doc.setFont(SERIF, 'bold');
    doc.setFontSize(7.5);
    doc.text('Casting Time:', x + 3, cy);
    doc.text('Range:', x + width / 2 + 1, cy);
    doc.setFont(SERIF, 'normal');
    doc.text(srd.casting_time, x + 3 + 22, cy);
    doc.text(srd.range, x + width / 2 + 1 + 12, cy);
    cy += 4;

    // Components | Duration
    doc.setFont(SERIF, 'bold');
    doc.text('Components:', x + 3, cy);
    doc.text('Duration:', x + width / 2 + 1, cy);
    doc.setFont(SERIF, 'normal');
    const compStr = (srd.components || []).join(', ') + (srd.material ? ' (M)' : '');
    doc.text(compStr, x + 3 + 22, cy);
    const durStr = (srd.concentration ? 'C, ' : '') + srd.duration;
    doc.text(durStr, x + width / 2 + 1 + 16, cy);
    cy += 4.5;

    // Description
    doc.setFont(SERIF, 'normal');
    doc.setFontSize(7.5);
    setText(doc, BODY);
    cy = drawWrapped(doc, srd.desc.join(' '), x + 3, cy, width - 6, 3.2);

    // At higher levels
    if (srd.higher_level && srd.higher_level.length > 0) {
      cy += 1.5;
      doc.setFont(SERIF, 'bolditalic');
      setText(doc, MAROON);
      doc.text('At Higher Levels: ', x + 3, cy);
      const labelW = doc.getTextWidth('At Higher Levels: ');
      doc.setFont(SERIF, 'normal');
      setText(doc, BODY);
      cy = drawWrapped(doc, srd.higher_level.join(' '), x + 3 + labelW, cy, width - 6 - labelW, 3.2);
    }
  }
  // No-description case: card stays minimal — name + "Known/Prepared" indicator only.
  // Cleaner than a "not in SRD library" footnote on a finished sheet.
}

function drawSpellsPage(doc: jsPDF, c: PlayerCharacter, lookup: SpellLookup) {
  if (!c.is_spellcaster) return;

  doc.addPage();
  drawParchmentBg(doc);
  drawPageHeader(doc, c, 'Spells');

  let y = 32;

  // Spell stats bar — calculated from PB + ability mod, falling back to override columns.
  const stats: QuickStat[] = [
    { label: 'Spell Atk', value: modStr(spellAttackBonus(c)) },
    { label: 'Spell DC', value: String(spellSaveDc(c)) },
    { label: 'Ability', value: c.spellcasting_ability || '—' },
  ];
  y = drawQuickStatsBar(doc, stats, y);

  y = drawSpellSlots(doc, c, MARGIN, y, PW - 2 * MARGIN);

  // Spell cards by level
  if (!c.spells) return;

  const cardWidth = (PW - 2 * MARGIN - 4) / 2;
  const colGap = 4;
  const rowGap = 3;

  let leftY = y;
  let rightY = y;

  const sortedLevels = Object.keys(c.spells).sort((a, b) => parseInt(a) - parseInt(b));

  for (const lvlKey of sortedLevels) {
    const names = c.spells[lvlKey] || [];
    if (names.length === 0) continue;

    // Level header (full width)
    const headerY = Math.max(leftY, rightY) + 2;
    if (headerY > PH - MARGIN - 30) {
      doc.addPage();
      drawParchmentBg(doc);
      drawPageHeader(doc, c, 'Spells (cont.)');
      leftY = 32;
      rightY = 32;
    }

    const useY = Math.max(leftY, rightY) + 2;
    leftY = rightY = useY;

    // Level header banner
    setText(doc, MAROON);
    doc.setFont(SERIF, 'bold');
    doc.setFontSize(11);
    const headerLabel = levelLabel(lvlKey).toUpperCase();
    const labelW = doc.getTextWidth(headerLabel);
    const cx = PW / 2;
    setDraw(doc, MAROON);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, leftY + 1, cx - labelW / 2 - 3, leftY + 1);
    doc.line(cx + labelW / 2 + 3, leftY + 1, PW - MARGIN, leftY + 1);
    doc.text(headerLabel, cx, leftY + 2.5, { align: 'center' });
    leftY += 8;
    rightY = leftY;

    // Cards in two columns
    for (const name of names) {
      const srd = lookup(name);
      const isPrepared = c.is_prepared_caster && (c.prepared_spells?.includes(name) ?? false);
      const showDot = !!c.is_prepared_caster && lvlKey !== '0';

      // Choose shorter column
      const useLeft = leftY <= rightY;
      const cx = useLeft ? MARGIN : MARGIN + cardWidth + colGap;
      let cy = useLeft ? leftY : rightY;

      const cardH = measureSpellCard(doc, name, srd, cardWidth);

      // Page break check
      if (cy + cardH > PH - MARGIN - 5) {
        doc.addPage();
        drawParchmentBg(doc);
        drawPageHeader(doc, c, 'Spells (cont.)');
        leftY = 32;
        rightY = 32;
        cy = useLeft ? leftY : rightY;
      }

      drawSpellCard(doc, name, srd, isPrepared, showDot, {
        x: cx, y: cy, width: cardWidth, height: cardH,
      });

      if (useLeft) leftY = cy + cardH + rowGap;
      else rightY = cy + cardH + rowGap;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────────────────────────────────

/** Render a character sheet. `customSpells` supply descriptions for spells the SRD library lacks. */
export function renderCharacterPdf(
  character: PlayerCharacter,
  customSpells: CustomSpell[] = [],
  exportedOn: Date = new Date(),
): ArrayBuffer {
  const lookup = createSpellLookup(customSpells);
  const doc = hardenPdfText(
    new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    })
  );

  const { inventoryOverflow, resourcesOverflow } = drawCombatPage(doc, character, lookup, exportedOn);
  drawFeaturesPage(doc, character, resourcesOverflow);
  if (character.is_spellcaster) {
    drawSpellsPage(doc, character, lookup);
  }
  if (inventoryOverflow) {
    drawInventoryPage(doc, character);
  }

  return doc.output('arraybuffer');
}
