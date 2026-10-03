// Page 1 of the character sheet: the combat reference (sheet spec v3 §5.1,
// docs/sheet-mockup-v3.html). Laid out by what the player is doing: the DM
// asks for a roll (left rail), it's my turn (right column), something happens
// to me (vitals strip).

import type { jsPDF } from 'jspdf';
import type { PlayerCharacter } from '@/types';
import { modString, spellAttackBonus, spellSaveDc } from '@/lib/character';
import {
  C,
  CONTENT_W,
  FONT,
  PAGE,
  bubble,
  capsOpts,
  diamond,
  dottedLine,
  drawRich,
  fitText,
  fs,
  hline,
  layoutRich,
  measure,
  profDot,
  ptMm,
  px,
  rect,
  sectionHead,
  text,
  vline,
  wrap,
  type Run,
} from './sheet-kit';
import {
  abilityBlocks,
  attackTable,
  bandParts,
  defenseLines,
  inventoryOf,
  passiveLine,
  proficiencyLines,
  resourceLines,
  vitalCells,
  yourTurn,
  type AttackRow,
  type AttackTable,
  type TurnGroup,
  type TurnItem,
  type VitalCell,
} from './sheet-data';
import type { SpellLookup } from './spell-library';

const RAIL_W = 46;
const GAP = px(16);
const RIGHT_X = PAGE.margin + RAIL_W + GAP;
const RIGHT_W = CONTENT_W - RAIL_W - GAP;
const BOTTOM = PAGE.h - PAGE.margin;
const SECTION_GAP = px(13);

const lineH = (sizePx: number, leading: number) => ptMm(fs(sizePx)) * leading;
const ascent = (sizePx: number) => ptMm(fs(sizePx)) * 0.72;

/** A section measured before it's drawn, so the right column can decide what moves off the page. */
interface Block {
  height: number;
  draw: (y: number) => void;
}

// ──────────────────────────────────────────────────────────────────────────
// Band
// ──────────────────────────────────────────────────────────────────────────

/** Full-bleed maroon band with the gold top rule; returns its bottom y. */
export function drawBand(doc: jsPDF, c: PlayerCharacter, pageTitle: string, pageDetail: string): number {
  const nameSize = fs(26);
  const subSize = fs(14.5);
  const rightW = Math.max(
    measure(doc, pageTitle.toUpperCase(), capsOpts(11, C.goldSoft, 0.14)),
    measure(doc, pageDetail, { size: fs(13) }),
  );
  const runs: Run[] = bandParts(c).map((p) => ({
    kind: 'text',
    text: p.text,
    style: p.strong ? 'bold' : p.italic ? 'italic' : 'normal',
    color: p.strong ? C.bandText : C.bandSub,
  }));
  const subLines = layoutRich(doc, runs, CONTENT_W - rightW - px(16), subSize);

  const top = px(4);
  const nameBase = top + px(14) + ptMm(nameSize) * 0.78;
  const subBase = nameBase + px(6) + ptMm(subSize) * 0.95;
  const subLineH = ptMm(subSize) * 1.25;
  const lastSub = subBase + (subLines.length - 1) * subLineH;
  const bottom = lastSub + px(12);

  rect(doc, 0, 0, PAGE.w, top, { fill: C.gold });
  rect(doc, 0, top, PAGE.w, bottom - top, { fill: C.maroon });
  text(doc, c.name || 'Unnamed', PAGE.margin, nameBase, { size: nameSize, style: 'bold', color: C.bandText, font: FONT.display });
  drawRich(doc, subLines, PAGE.margin, subBase, subLineH, subSize);

  const right = PAGE.w - PAGE.margin;
  text(doc, pageDetail, right, lastSub, { size: fs(13), color: C.bandSub, align: 'right' });
  text(doc, pageTitle.toUpperCase(), right, lastSub - ptMm(fs(13)) * 1.3, { ...capsOpts(11, C.goldSoft, 0.14), align: 'right' });
  return bottom;
}

// ──────────────────────────────────────────────────────────────────────────
// Vitals strip
// ──────────────────────────────────────────────────────────────────────────

function drawVitals(doc: jsPDF, cells: VitalCell[], y: number): number {
  const cellW = CONTENT_W / cells.length;
  const subLines = Math.max(1, ...cells.map((c) => c.sub.length));
  const labelBase = y + px(7) + ascent(8.5);
  const valueBase = labelBase + px(2) + ptMm(fs(19)) * 0.98;
  const subStep = lineH(10.5, 1.15);
  const height = valueBase - y + subLines * subStep + px(6);

  rect(doc, PAGE.margin, y, CONTENT_W, height, { fill: C.cream, stroke: C.maroon, lw: px(1.5) });
  cells.forEach((cell, i) => {
    const x0 = PAGE.margin + i * cellW;
    const cx = x0 + cellW / 2;
    if (i > 0) vline(doc, x0, y + px(1), y + height - px(1), C.rule);
    const inner = cellW - px(8);
    const label = cell.label.toUpperCase();
    text(doc, label, cx, labelBase, { ...fitText(doc, label, inner, capsOpts(8.5, C.muted, 0.12)), align: 'center' });
    text(doc, cell.value, cx, valueBase, { size: fs(19), style: 'bold', color: C.maroon, font: FONT.display, align: 'center' });
    cell.sub.forEach((s, j) => {
      text(doc, s, cx, valueBase + subStep * (j + 1), { ...fitText(doc, s, inner, { size: fs(10.5), color: C.muted }), align: 'center' });
    });
  });
  return y + height;
}

// ──────────────────────────────────────────────────────────────────────────
// Left rail
// ──────────────────────────────────────────────────────────────────────────

function drawAbilities(doc: jsPDF, c: PlayerCharacter, y: number): number {
  const x = PAGE.margin;
  const w = RAIL_W;
  y = sectionHead(doc, 'Abilities & skills', x, y, w, 'proficient', true);

  const skillStep = lineH(11, 1.45);
  for (const block of abilityBlocks(c)) {
    const modBase = y + px(3) + ascent(17);
    const saveBase = modBase + lineH(10, 1.25);
    const headH = saveBase - y + px(3);
    const skillsH = block.skills.length > 0 ? px(2) + block.skills.length * skillStep + px(1) : 0;
    const boxH = headH + skillsH;

    rect(doc, x, y, w, boxH, { fill: C.cream });
    rect(doc, x, y, w, headH, { fill: C.headTint });
    if (block.skills.length > 0) hline(doc, x, x + w, y + headH, C.rule);
    rect(doc, x, y, w, boxH, { stroke: C.maroon });

    // Label and modifier on one baseline, the score right-aligned on it, the save beneath.
    const keyW = text(doc, block.key, x + px(6), modBase, capsOpts(9.5, C.maroon, 0.12));
    text(doc, modString(block.mod), x + px(6) + keyW + px(5), modBase, { size: fs(17), style: 'bold', color: C.maroon, font: FONT.display });
    text(doc, String(block.score), x + w - px(6), modBase, { size: fs(10), color: C.muted, align: 'right' });
    const saveW = text(doc, `save ${modString(block.save)}`, x + w - px(6), saveBase, { size: fs(10), align: 'right' });
    profDot(doc, x + w - px(6) - saveW - px(6), saveBase - ascent(10) / 2, block.saveProf ? 'proficient' : 'none');

    // Skills: dot, name, then modifier and any feature die on the right.
    let sy = y + headH + px(2) + ascent(11);
    for (const s of block.skills) {
      const proficient = s.prof === 'proficient' || s.prof === 'expertise';
      profDot(doc, x + px(6) + px(3.5), sy - ascent(11) / 2, s.prof);
      text(doc, s.label, x + px(6) + px(11), sy, { size: fs(11) });
      let right = x + w - px(6);
      if (s.bonus) right -= text(doc, s.bonus, right, sy, { size: fs(9), color: C.muted, align: 'right' }) + px(3);
      text(doc, modString(s.mod), right, sy, { size: fs(11), style: 'bold', color: proficient ? C.maroon : C.ink, align: 'right' });
      sy += skillStep;
    }
    y += boxH + px(5);
  }
  const passive = passiveLine(c);
  text(doc, passive, x, y + ascent(10.5), fitText(doc, passive, w, { size: fs(10.5), color: C.muted }));
  return y + lineH(10.5, 1.3) + SECTION_GAP;
}

/** Bold label + value lines, wrapping under the label; "none" when empty. */
function drawKeyValues(doc: jsPDF, title: string, lines: [string, string][], y: number): number {
  const x = PAGE.margin;
  y = sectionHead(doc, title, x, y, RAIL_W);
  const size = fs(11.5);
  const step = lineH(11.5, 1.5);
  let base = y + ascent(11.5);
  if (lines.length === 0) {
    text(doc, 'none', x, base, { size, color: C.muted, style: 'italic' });
    base += step;
  }
  for (const [label, value] of lines) {
    const runs: Run[] = [{ kind: 'text', text: label, style: 'bold', color: C.maroonInk }];
    if (value) runs.push({ kind: 'text', text: ` ${value}` });
    base = drawRich(doc, layoutRich(doc, runs, RAIL_W, size), x, base, step, size);
  }
  return base - ascent(11.5) + SECTION_GAP;
}

// ──────────────────────────────────────────────────────────────────────────
// Right column sections
// ──────────────────────────────────────────────────────────────────────────

const CELL_PAD = px(6);
const SECTION_HEAD_H = px(22);

function chipRuns(r: AttackRow): Run[] {
  return [{ kind: 'text', text: r.name, style: 'bold' }, ...r.chips.map((ch) => ({ kind: 'chip' as const, text: ch.text, variant: ch.variant }))];
}

function attackBlock(doc: jsPDF, c: PlayerCharacter, table: AttackTable, x: number, w: number): Block | null {
  const { rows, riders, masteries } = table;
  if (rows.length === 0 && riders.length === 0) return null;
  const spellNote = c.is_spellcaster && c.spellcasting_ability
    ? `spell attack ${modString(spellAttackBonus(c))} · save DC ${spellSaveDc(c)}`
    : undefined;
  const widths = [0.4, 0.13, 0.27, 0.2].map((f) => f * w);
  const size = fs(11.5);
  const step = lineH(11.5, 1.3);
  const noteStep = lineH(10, 1.25);
  const noteOpts = { size: fs(10), color: C.muted };

  const laidRows = rows.map((r) => {
    const name = layoutRich(doc, chipRuns(r), widths[0] - 2 * CELL_PAD, size);
    const note = r.note ? wrap(doc, r.note, widths[0] - 2 * CELL_PAD, noteOpts) : [];
    const cells = [r.hit, r.damage, r.range].map((s, i) => wrap(doc, s || '—', widths[i + 1] - 2 * CELL_PAD, { size, style: 'bold' }));
    const h = Math.max(name.length * step + note.length * noteStep, ...cells.map((l) => l.length * step)) + px(7);
    return { name, note, cells, h };
  });
  // Riders: name and condition across Name + Hit, the bonus under Damage.
  const riderNameW = widths[0] + widths[1] - 2 * CELL_PAD;
  const laidRiders = riders.map((r) => {
    const name = layoutRich(doc, chipRuns(r), riderNameW, size);
    const note = r.note ? wrap(doc, r.note, riderNameW, noteOpts) : [];
    return { r, name, note, h: name.length * step + note.length * noteStep + px(6) };
  });
  const headerH = px(6) + ptMm(fs(8.5)) + px(3);
  const riderHeadH = riders.length > 0 ? px(9) + ptMm(fs(8.5)) + px(3) : 0;
  // "Masteries · Greatsword Graze · Whip Slow · Handaxe Vex" under the table.
  const masteryLabel = 'MASTERIES';
  const masteryLabelOpts = capsOpts(8.5, C.maroon, 0.12, 'bold');
  const masteryIndent = measure(doc, masteryLabel, masteryLabelOpts) + px(6);
  const masteryRuns: Run[] = masteries.flatMap((m, i) => [
    ...(i > 0 ? [{ kind: 'text' as const, text: ' · ', color: C.muted }] : []),
    { kind: 'text' as const, text: `${m.weapon} ` },
    { kind: 'text' as const, text: m.mastery, style: 'bold' as const, color: C.maroonInk },
  ]);
  const masteryLines = masteries.length > 0 ? layoutRich(doc, masteryRuns, w - masteryIndent, fs(10.5)) : [];
  const masteryStep = lineH(10.5, 1.35);
  const masteryH = masteryLines.length > 0 ? px(7) + masteryLines.length * masteryStep : 0;
  const height =
    SECTION_HEAD_H +
    headerH +
    laidRows.reduce((s, r) => s + r.h, 0) +
    riderHeadH +
    laidRiders.reduce((s, r) => s + r.h, 0) +
    masteryH +
    SECTION_GAP;

  const drawNameCell = (name: ReturnType<typeof layoutRich>, note: string[], base: number) => {
    let nb = drawRich(doc, name, x + CELL_PAD, base, step, size) - step + noteStep;
    for (const line of note) {
      text(doc, line, x + CELL_PAD, nb, noteOpts);
      nb += noteStep;
    }
  };

  return {
    height,
    draw: (y) => {
      y = sectionHead(doc, 'Attacks & cantrips', x, y, w, spellNote);
      rect(doc, x, y, w, headerH, { fill: C.maroon });
      let cx = x;
      ['Name', 'Hit / DC', 'Damage', 'Range'].forEach((h, i) => {
        text(doc, h.toUpperCase(), cx + CELL_PAD, y + headerH - px(4), capsOpts(8.5, C.bandText, 0.1, 'bold'));
        cx += widths[i];
      });
      y += headerH;
      laidRows.forEach((row, i) => {
        if (i % 2 === 1) rect(doc, x, y, w, row.h, { fill: C.rowTint });
        const base = y + px(3.5) + ascent(11.5);
        drawNameCell(row.name, row.note, base);
        let colX = x + widths[0];
        row.cells.forEach((lines, j) => {
          lines.forEach((line, k) => text(doc, line, colX + CELL_PAD, base + k * step, { size, style: 'bold' }));
          colX += widths[j + 1];
        });
        y += row.h;
        hline(doc, x, x + w, y, C.rowRule);
      });
      if (laidRiders.length > 0) {
        y += px(9);
        text(doc, 'ADDS TO A HIT', x, y + ascent(8.5), capsOpts(8.5, C.maroon, 0.12, 'bold'));
        y += ptMm(fs(8.5)) + px(3);
        hline(doc, x, x + w, y, C.maroon);
        for (const row of laidRiders) {
          const base = y + px(3) + ascent(11.5);
          drawNameCell(row.name, row.note, base);
          if (row.r.damage) text(doc, row.r.damage, x + widths[0] + widths[1] + CELL_PAD, base, { size, style: 'bold' });
          y += row.h;
          hline(doc, x, x + w, y, C.rowRule);
        }
      }
      if (masteryLines.length > 0) {
        const base = y + px(7) + ascent(10.5);
        text(doc, masteryLabel, x, base, masteryLabelOpts);
        drawRich(doc, masteryLines, x + masteryIndent, base, masteryStep, fs(10.5));
      }
    },
  };
}

const TURN_TITLES: Record<TurnGroup, string> = { action: 'Action', bonus: 'Bonus action', reaction: 'Reaction', always: 'Always on' };
const TURN_GRID: [TurnGroup, TurnGroup][] = [
  ['action', 'bonus'],
  ['reaction', 'always'],
];

function turnBlock(doc: jsPDF, c: PlayerCharacter, lookup: SpellLookup, attackNames: Set<string>, x: number, w: number): Block | null {
  const groups = yourTurn(c, lookup, attackNames);
  const colGap = px(16);
  const colW = (w - colGap) / 2;
  const size = fs(11.5);
  const step = lineH(11.5, 1.4);
  const indent = px(10);
  const headH = ptMm(fs(9.5)) + px(4);

  const layoutItem = (item: TurnItem) => {
    const runs: Run[] = [{ kind: 'text', text: item.name, style: 'bold' }];
    if (item.clause) runs.push({ kind: 'text', text: item.inline ? ` ${item.clause}` : ` · ${item.clause}` });
    if (item.cost) runs.push({ kind: 'text', text: ` (${item.cost})`, style: 'italic', color: C.muted });
    return layoutRich(doc, runs, colW - indent, size);
  };
  const laid = Object.fromEntries((Object.keys(groups) as TurnGroup[]).map((g) => [g, groups[g].map(layoutItem)])) as Record<
    TurnGroup,
    ReturnType<typeof layoutItem>[]
  >;
  const groupH = (g: TurnGroup) => (laid[g].length === 0 ? 0 : headH + laid[g].reduce((s, l) => s + l.length * step + px(2), 0));
  const rowHeights = TURN_GRID.map(([a, b]) => Math.max(groupH(a), groupH(b)));
  const used = rowHeights.filter((h) => h > 0);
  if (used.length === 0) return null;
  const height = SECTION_HEAD_H + used.reduce((s, h) => s + h, 0) + (used.length - 1) * px(10) + SECTION_GAP;

  return {
    height,
    draw: (y) => {
      y = sectionHead(doc, 'Your turn', x, y, w);
      TURN_GRID.forEach((pair, i) => {
        if (rowHeights[i] === 0) return;
        pair.forEach((g, j) => {
          if (laid[g].length === 0) return;
          const gx = x + j * (colW + colGap);
          const tw = text(doc, TURN_TITLES[g].toUpperCase(), gx, y + ascent(9.5), capsOpts(9.5, C.maroon, 0.12, 'bold'));
          hline(doc, gx + tw + px(6), gx + colW, y + ascent(9.5) / 2 + px(0.5), C.rule);
          let base = y + headH + ascent(11.5);
          for (const lines of laid[g]) {
            diamond(doc, gx + px(3), base - ascent(11.5) / 2.2, px(2.6), C.gold);
            base = drawRich(doc, lines, gx + indent, base, step, size) + px(2);
          }
        });
        y += rowHeights[i] + px(10);
      });
    },
  };
}

function resourceBlock(doc: jsPDF, c: PlayerCharacter, x: number, w: number, footnote?: string): Block | null {
  const lines = resourceLines(c);
  if (lines.length === 0 && !footnote) return null;
  const colGap = px(16);
  const colW = (w - colGap) / 2;
  const size = fs(11.5);
  const rowH = lineH(11.5, 1.4) + px(4);
  const rows = Math.ceil(lines.length / 2);
  const height = SECTION_HEAD_H + rows * rowH + (footnote ? lineH(10.5, 1.5) : 0) + SECTION_GAP;

  return {
    height,
    draw: (y) => {
      y = sectionHead(doc, 'Resources', x, y, w, 'mark as used');
      lines.forEach((l, i) => {
        const rx = x + (i % 2) * (colW + colGap);
        const top = y + Math.floor(i / 2) * rowH;
        const base = top + px(2) + ascent(11.5);
        // Circles for up to 8 uses; a pool or a bigger count gets the number and a write-in rule.
        let markW: number;
        if (!l.pool && l.uses <= 8) {
          const r = px(5);
          markW = l.uses * (2 * r + px(3));
          for (let k = 0; k < l.uses; k++) bubble(doc, rx + colW - r - k * (2 * r + px(3)), base - ascent(11.5) / 2, r);
        } else {
          const ruleW = px(26);
          hline(doc, rx + colW - ruleW, rx + colW, base + px(1), C.maroon);
          const label = `${l.uses}${l.pool ? ' pts' : ''}`;
          markW = ruleW + px(4) + text(doc, label, rx + colW - ruleW - px(4), base, { size, style: 'bold', color: C.maroon, align: 'right' });
        }
        const nameW = text(doc, l.name, rx, base, { size, style: 'bold' });
        const room = colW - markW - px(8) - nameW - px(4);
        let detail = l.detail;
        while (detail && measure(doc, detail, { size: fs(10) }) > room) {
          const shorter = detail.replace(/\s*\S+…?$/, '…');
          if (shorter === detail || shorter === '…') {
            detail = '';
            break;
          }
          detail = shorter;
        }
        if (detail) text(doc, detail, rx + nameW + px(4), base, { size: fs(10), color: C.muted });
        dottedLine(doc, rx, rx + colW, top + rowH - px(1), C.rule);
      });
      if (footnote) text(doc, footnote, x, y + rows * rowH + px(4) + ascent(10.5), { size: fs(10.5), color: C.muted, style: 'italic' });
    },
  };
}

function inventoryBlock(doc: jsPDF, c: PlayerCharacter, x: number, w: number): Block | null {
  const { rows, weightLb, gp } = inventoryOf(c);
  if (rows.length === 0) return null;
  const size = fs(11.5);
  const rowH = lineH(11.5, 1.3) + px(5);
  const widths = [0.55, 0.1, 0.15, 0.2].map((f) => f * w);
  return {
    height: SECTION_HEAD_H + rows.length * rowH + SECTION_GAP,
    draw: (y) => {
      y = sectionHead(doc, 'Inventory', x, y, w, `${weightLb} lb · ${gp} gp`);
      rows.forEach((item, i) => {
        if (i % 2 === 1) rect(doc, x, y, w, rowH, { fill: C.rowTint });
        const base = y + px(2.5) + ascent(11.5);
        const runs: Run[] = [{ kind: 'text', text: item.name, style: 'bold' }, ...(item.tags ?? []).map((t) => ({ kind: 'chip' as const, text: t }))];
        drawRich(doc, layoutRich(doc, runs, widths[0] - 2 * CELL_PAD, size).slice(0, 1), x + CELL_PAD, base, rowH, size);
        let cx = x + widths[0];
        [String(item.qty), item.weight ?? '', item.notes ?? ''].forEach((cell, j) => {
          text(doc, cell, cx + CELL_PAD, base, j === 2 ? { size: fs(10), color: C.muted } : { size });
          cx += widths[j + 1];
        });
        y += rowH;
        hline(doc, x, x + w, y, C.rowRule);
      });
    },
  };
}

/** Resources at full width, for when they move off page 1. Returns the y after them. */
export function drawResources(doc: jsPDF, c: PlayerCharacter, y: number): number {
  const block = resourceBlock(doc, c, PAGE.margin, CONTENT_W);
  if (!block) return y;
  block.draw(y);
  return y + block.height;
}

// ──────────────────────────────────────────────────────────────────────────
// The page
// ──────────────────────────────────────────────────────────────────────────

export interface CombatPageResult {
  /** The inventory didn't fit inline and needs its own page. */
  inventoryOverflow: boolean;
  /** Resources didn't fit either; they go at the top of page 2. */
  resourcesOverflow: boolean;
}

export function drawCombatPage(doc: jsPDF, c: PlayerCharacter, lookup: SpellLookup, exportedOn: Date): CombatPageResult {
  rect(doc, 0, 0, PAGE.w, PAGE.h, { fill: C.parchment });
  const date = exportedOn.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  let y = drawBand(doc, c, 'Combat reference', `Exported ${date}`) + px(16);
  y = drawVitals(doc, vitalCells(c), y) + px(14);
  const top = y;

  // Left rail.
  let left = drawAbilities(doc, c, top);
  left = drawKeyValues(doc, 'Defenses & senses', defenseLines(c), left);
  drawKeyValues(doc, 'Proficiencies', proficiencyLines(c), left);

  // Right column. Attacks and Your turn always stay; when space runs out the
  // inventory moves off the page first, then resources (spec §5.1).
  const table = attackTable(c, lookup);
  // Rows from the export and riders replace their Your-turn lines; a feature
  // attack (Radiant Sun Bolt) keeps its line too, for its extra options.
  const attackNames = new Set([...table.rows.filter((r) => r.kind !== 'feature'), ...table.riders].map((r) => r.name.toLowerCase()));
  const fixed = [attackBlock(doc, c, table, RIGHT_X, RIGHT_W), turnBlock(doc, c, lookup, attackNames, RIGHT_X, RIGHT_W)].filter(
    (b): b is Block => b != null,
  );
  const room = BOTTOM - px(24) - top - fixed.reduce((s, b) => s + b.height, 0);

  // Inventory goes inline whenever the table fits in what's left (measured, not counted).
  const inv = inventoryOf(c);
  const summary = `${inv.rows.length} items, ${inv.weightLb} lb · see the Inventory page`;
  let inventory = inventoryBlock(doc, c, RIGHT_X, RIGHT_W);
  let inventoryOverflow = false;
  let resources = resourceBlock(doc, c, RIGHT_X, RIGHT_W);
  if (inventory && (resources?.height ?? 0) + inventory.height > room) {
    inventory = null;
    inventoryOverflow = true;
    resources = resourceBlock(doc, c, RIGHT_X, RIGHT_W, summary);
  }
  let resourcesOverflow = false;
  if (resources && resources.height > room) {
    resources = null;
    resourcesOverflow = true;
  }

  let right = top;
  for (const b of [...fixed, resources, inventory]) {
    if (!b) continue;
    b.draw(right);
    right += b.height;
  }

  const foot = 'Full rules text for every feature and spell is on the following pages. Page references dropped from the player copy.';
  text(doc, foot, PAGE.w / 2, BOTTOM - px(2), { size: fs(9.5), style: 'italic', color: C.muted, align: 'center' });
  return { inventoryOverflow, resourcesOverflow };
}
