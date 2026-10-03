// PDF character sheet renderer. Pure — no I/O: the export route and
// scripts/export-fixtures.ts both call renderCharacterPdf.
//
// Pages:
//   1. Combat reference  — page-combat.ts
//   2. Features          — page-features.ts (two columns of full text)
//   3. Spells            — page-spells.ts (stats strip, slot bubbles, index), then the
//                          description cards below; not for species-only casters, whose
//                          spells sit on the Features page
//   4. Inventory         — only when it doesn't fit inline on page 1
//
// jsPDF's built-in fonts (helvetica, times, courier) don't carry full Unicode,
// so we draw bubbles/circles with doc.circle() instead of using ●/○ glyphs.
// "times" is the closest serif fallback to Cinzel/Crimson per the spec.

import { jsPDF } from 'jspdf';
import type { CustomSpell, PlayerCharacter, SpellEntry, SrdSpell } from '@/types';
import { spellKey } from '@/lib/character';
import { drawBand, drawCombatPage } from './page-combat';
import { drawFeaturesPages, innateSpellsOnly } from './page-features';
import { cardFacts, cardsDetail, drawSpellIndexPages, spellsByLevel } from './page-spells';
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

interface SpellCardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Shrink a card fact until it fits its half of the card. */
function fitFact(doc: jsPDF, value: string, maxW: number): void {
  let size = 7.5;
  doc.setFontSize(size);
  while (doc.getTextWidth(value) > maxW && size > 5.5) {
    size -= 0.25;
    doc.setFontSize(size);
  }
}

/** Body text for a card: the export's own description when the import had one, else the library's. */
function cardBody(s: SpellEntry | undefined, srd: SrdSpell | null): { desc: string; higher: string } {
  if (s?.description) return { desc: s.description.replace(/\n+/g, ' '), higher: '' };
  return { desc: srd ? srd.desc.join(' ') : '', higher: srd?.higher_level?.join(' ') ?? '' };
}

const NO_TEXT = 'No description in the spell library; add it under custom spells.';

function measureSpellCard(doc: jsPDF, s: SpellEntry | undefined, srd: SrdSpell | null, width: number): number {
  if (!srd && !s) return 11;
  const { desc, higher } = cardBody(s, srd);
  let h = 5 + 4 + 4 + 4 + 1; // name, school/level line, two fact rows, gap
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(7.5);
  h += (doc.splitTextToSize(desc || NO_TEXT, width - 6) as string[]).length * 3.2;
  if (higher) {
    h += 2.5;
    h += (doc.splitTextToSize(higher, width - 6) as string[]).length * 3.2;
  }
  return h + 4;
}

function drawSpellCard(
  doc: jsPDF,
  s: SpellEntry | undefined,
  name: string,
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
  doc.text(name.toUpperCase(), x + 3, cy);

  // Prepared: a dot only, right-aligned inside the card's padding.
  if (showPreparedDot) dot(doc, x + width - 3 - 1.4, cy - 1.5, 1.4, isPrepared);
  cy += 4;

  // School/level line: the library's, else the level from the export.
  setText(doc, MUTED);
  doc.setFont(SERIF, 'italic');
  doc.setFontSize(8);
  const level = srd?.level ?? s?.level ?? 0;
  const ord = `${level}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[level] || 'th'}`;
  const ritual = srd?.ritual ?? s?.ritual;
  const schoolLine = srd
    ? level === 0
      ? `${srd.school} cantrip`
      : `${ord}-level ${srd.school.toLowerCase()}${ritual ? ' (ritual)' : ''}`
    : level === 0
      ? 'cantrip'
      : `${ord}-level spell${ritual ? ' (ritual)' : ''}`;
  doc.text(schoolLine, x + 3, cy);
  cy += 4;

  // Facts: the export's per-spell fields when present (homebrew spells get a full header too).
  const facts = cardFacts(s, srd);
  const half = width / 2 - 4;
  setText(doc, BODY);
  doc.setFont(SERIF, 'bold');
  doc.setFontSize(7.5);
  doc.text('Casting Time:', x + 3, cy);
  doc.text('Range:', x + width / 2 + 1, cy);
  doc.setFont(SERIF, 'normal');
  fitFact(doc, facts.time, half - 22);
  doc.text(facts.time, x + 3 + 22, cy);
  fitFact(doc, facts.range, half - 12);
  doc.text(facts.range, x + width / 2 + 1 + 12, cy);
  cy += 4;

  doc.setFont(SERIF, 'bold');
  doc.setFontSize(7.5);
  doc.text('Components:', x + 3, cy);
  doc.text('Duration:', x + width / 2 + 1, cy);
  doc.setFont(SERIF, 'normal');
  const duration = facts.duration.replace(/^Concentration,\s*/i, 'C, ');
  fitFact(doc, facts.components, half - 22);
  doc.text(facts.components, x + 3 + 22, cy);
  fitFact(doc, duration, half - 16);
  doc.text(duration, x + width / 2 + 1 + 16, cy);
  cy += 4.5;

  // Description, or the spec's note for spells the library doesn't have.
  const { desc, higher } = cardBody(s, srd);
  doc.setFont(SERIF, desc ? 'normal' : 'italic');
  doc.setFontSize(7.5);
  setText(doc, desc ? BODY : MUTED);
  cy = drawWrapped(doc, desc || NO_TEXT, x + 3, cy, width - 6, 3.2);

  if (higher) {
    cy += 1.5;
    doc.setFont(SERIF, 'bolditalic');
    setText(doc, MAROON);
    doc.text('At Higher Levels: ', x + 3, cy);
    const labelW = doc.getTextWidth('At Higher Levels: ');
    doc.setFont(SERIF, 'normal');
    setText(doc, BODY);
    drawWrapped(doc, higher, x + 3 + labelW, cy, width - 6 - labelW, 3.2);
  }
}

/** Description cards, two columns, by level; each spell once. Pages carry the v3 band. */
function drawSpellCards(doc: jsPDF, c: PlayerCharacter, lookup: SpellLookup) {
  const groups = spellsByLevel(c, lookup);
  if (groups.length === 0) return;
  const newPage = (): number => {
    doc.addPage();
    drawParchmentBg(doc);
    return drawBand(doc, c, 'Spell descriptions', cardsDetail(c)) + 6;
  };
  const top = newPage();

  const cardWidth = (PW - 2 * MARGIN - 4) / 2;
  const colGap = 4;
  const rowGap = 3;
  let leftY = top;
  let rightY = top;

  for (const [level, entries] of groups) {
    // Level header (full width)
    if (Math.max(leftY, rightY) + 2 > PH - MARGIN - 30) leftY = rightY = newPage();
    leftY = rightY = Math.max(leftY, rightY) + 2;

    setText(doc, MAROON);
    doc.setFont(SERIF, 'bold');
    doc.setFontSize(11);
    const headerLabel = levelLabel(String(level)).toUpperCase();
    const labelW = doc.getTextWidth(headerLabel);
    const cx = PW / 2;
    setDraw(doc, MAROON);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, leftY + 1, cx - labelW / 2 - 3, leftY + 1);
    doc.line(cx + labelW / 2 + 3, leftY + 1, PW - MARGIN, leftY + 1);
    doc.text(headerLabel, cx, leftY + 2.5, { align: 'center' });
    leftY += 8;
    rightY = leftY;

    for (const s of entries) {
      const srd = lookup(s.name);
      // Spells that are always available count as prepared; cantrips get no dot.
      const prepared =
        (c.prepared_spells ?? []).some((n) => spellKey(n) === spellKey(s.name)) ||
        s.always_prepared ||
        ['species', 'feat', 'item', 'invocation'].includes(s.origin);
      const showDot = !!c.is_prepared_caster && level !== 0;

      const useLeft = leftY <= rightY;
      const x = useLeft ? MARGIN : MARGIN + cardWidth + colGap;
      let y = useLeft ? leftY : rightY;
      const cardH = measureSpellCard(doc, s, srd, cardWidth);
      if (y + cardH > PH - MARGIN - 5) {
        leftY = rightY = newPage();
        y = leftY;
      }
      drawSpellCard(doc, s, s.name, srd, prepared, showDot, { x, y, width: cardWidth, height: cardH });
      if (useLeft) leftY = y + cardH + rowGap;
      else rightY = y + cardH + rowGap;
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
  drawFeaturesPages(doc, character, { withResources: resourcesOverflow });
  if (character.is_spellcaster && innateSpellsOnly(character).length === 0) {
    drawSpellIndexPages(doc, character, lookup);
    drawSpellCards(doc, character, lookup);
  }
  if (inventoryOverflow) {
    drawInventoryPage(doc, character);
  }

  return doc.output('arraybuffer');
}
