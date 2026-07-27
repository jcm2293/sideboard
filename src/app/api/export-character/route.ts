// PDF character sheet export.
//
// Three pages:
//   1. Combat reference  — header, quick stats, ability/skill grid, attacks,
//                          senses/defenses, class resources, proficiencies, features
//   2. Inventory         — table + currency block + notes (only if items exist)
//   3. Spells            — stats bar, slot boxes, full spell cards w/ SRD descriptions
//
// jsPDF's built-in fonts (helvetica, times, courier) don't carry full Unicode,
// so we draw bubbles/circles with doc.circle() instead of using ●/○ glyphs.
// "times" is the closest serif fallback to Cinzel/Crimson per the spec.

import { jsPDF } from 'jspdf';
import { NextRequest } from 'next/server';
import type { PlayerCharacter, SrdSpell, CustomSpell } from '@/types';
import srdSpellsData from '@/data/spells.json';
import { spellSaveDc, spellAttackBonus } from '@/lib/character';

const SRD_SPELLS: SrdSpell[] = srdSpellsData as SrdSpell[];
const SRD_BY_NAME = new Map<string, SrdSpell>();
for (const s of SRD_SPELLS) {
  SRD_BY_NAME.set(s.name.toLowerCase().trim(), s);
}

// Bridge custom spells onto the SrdSpell shape so the renderer doesn't care which library a spell came from.
function customToSrdShape(c: CustomSpell): SrdSpell {
  const components: string[] = [];
  if (c.components_v) components.push('V');
  if (c.components_s) components.push('S');
  if (c.components_m) components.push('M');
  return {
    index: c.id,
    name: c.name,
    desc: c.description ? [c.description] : [],
    higher_level: c.higher_levels ? [c.higher_levels] : [],
    range: c.range,
    components,
    material: c.material_description,
    ritual: c.ritual,
    duration: c.duration,
    concentration: c.concentration,
    casting_time: c.casting_time,
    level: c.level,
    school: c.school,
    classes: c.classes || [],
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Style tokens
// ──────────────────────────────────────────────────────────────────────────

const PARCHMENT = '#F4E4C1';
const PARCHMENT_ALT = '#EDD6A8';
const MAROON = '#58180D';
const GOLD = '#B8860B';
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
// The built-in Times font only covers WinAnsi (CP1252). Any character outside
// it garbles jsPDF's output — mojibake plus broken glyph-width math that
// stretches the whole line — so every string is transliterated before it
// reaches the PDF.
const WINANSI_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const NON_WINANSI_MAP: Record<string, string> = {
  '→': '->', '⇒': '->', '←': '<-', '↔': '<->',
  '−': '-', '‐': '-', '‑': '-',
  '●': '•', '○': 'o', '▪': '•', '★': '*', '☆': '*',
  '✓': 'x', '✔': 'x', '✗': 'x',
  '≤': '<=', '≥': '>=', '≠': '!=',
  '′': "'", '″': '"', 'ʼ': "'",
  'ﬁ': 'fi', 'ﬂ': 'fl',
  ' ': ' ', ' ': ' ', '​': '',
};
function sanitizeWinAnsi(text: string): string {
  let out = '';
  for (const ch of text) {
    if (ch.charCodeAt(0) <= 0xff || WINANSI_EXTRAS.has(ch)) {
      out += ch;
      continue;
    }
    const mapped = NON_WINANSI_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    // Last resort: strip diacritics (é-style chars survive as base letters);
    // anything still unencodable becomes '?'.
    const stripped = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    out += stripped !== ch && [...stripped].every((c) => c.charCodeAt(0) <= 0xff) ? stripped : '?';
  }
  return out;
}

/** Route every string through sanitizeWinAnsi at the two jsPDF text entry points. */
function hardenPdfText(doc: jsPDF): jsPDF {
  const san = (t: unknown): unknown =>
    typeof t === 'string'
      ? sanitizeWinAnsi(t)
      : Array.isArray(t)
        ? t.map((s) => (typeof s === 'string' ? sanitizeWinAnsi(s) : s))
        : t;
  const origText = doc.text.bind(doc);
  doc.text = ((...args: Parameters<typeof origText>) => {
    args[0] = san(args[0]) as (typeof args)[0];
    return origText(...args);
  }) as typeof doc.text;
  const origSplit = doc.splitTextToSize.bind(doc);
  doc.splitTextToSize = ((...args: Parameters<typeof origSplit>) => {
    args[0] = san(args[0]) as (typeof args)[0];
    return origSplit(...args);
  }) as typeof doc.splitTextToSize;
  return doc;
}

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
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

/** Diamond ornament drawn as 4-point path. */
function drawDiamond(doc: jsPDF, cx: number, cy: number, half: number, color: string) {
  setFill(doc, color);
  setDraw(doc, color);
  // jsPDF lines() takes an array of [dx, dy] vertices relative to start
  doc.lines(
    [
      [half, -half],
      [half, half],
      [-half, half],
      [-half, -half],
    ],
    cx - half,
    cy,
    [1, 1],
    'F',
    true,
  );
}

/** Decorative section divider: thin rule with centered diamond. */
function ornamentDivider(doc: jsPDF, x1: number, x2: number, y: number) {
  setDraw(doc, GOLD);
  doc.setLineWidth(0.2);
  const cx = (x1 + x2) / 2;
  doc.line(x1, y, cx - 3, y);
  doc.line(cx + 3, y, x2, y);
  drawDiamond(doc, cx, y, 1.2, GOLD);
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

const ABILITIES: { key: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'; label: string; full: string }[] = [
  { key: 'str', label: 'STR', full: 'STRENGTH' },
  { key: 'dex', label: 'DEX', full: 'DEXTERITY' },
  { key: 'con', label: 'CON', full: 'CONSTITUTION' },
  { key: 'int', label: 'INT', full: 'INTELLIGENCE' },
  { key: 'wis', label: 'WIS', full: 'WISDOM' },
  { key: 'cha', label: 'CHA', full: 'CHARISMA' },
];

const SKILLS_BY_ABILITY: Record<string, { key: string; label: string }[]> = {
  str: [{ key: 'athletics', label: 'Athletics' }],
  dex: [
    { key: 'acrobatics', label: 'Acrobatics' },
    { key: 'sleight_of_hand', label: 'Sleight of Hand' },
    { key: 'stealth', label: 'Stealth' },
  ],
  con: [],
  int: [
    { key: 'arcana', label: 'Arcana' },
    { key: 'history', label: 'History' },
    { key: 'investigation', label: 'Investigation' },
    { key: 'nature', label: 'Nature' },
    { key: 'religion', label: 'Religion' },
  ],
  wis: [
    { key: 'animal_handling', label: 'Animal Handling' },
    { key: 'insight', label: 'Insight' },
    { key: 'medicine', label: 'Medicine' },
    { key: 'perception', label: 'Perception' },
    { key: 'survival', label: 'Survival' },
  ],
  cha: [
    { key: 'deception', label: 'Deception' },
    { key: 'intimidation', label: 'Intimidation' },
    { key: 'performance', label: 'Performance' },
    { key: 'persuasion', label: 'Persuasion' },
  ],
};

function abilityScoreOf(c: PlayerCharacter, key: typeof ABILITIES[number]['key']): number {
  switch (key) {
    case 'str': return c.str_score;
    case 'dex': return c.dex_score;
    case 'con': return c.con_score;
    case 'int': return c.int_score;
    case 'wis': return c.wis_score;
    case 'cha': return c.cha_score;
  }
}

/** One ability box with header + save + skills. Returns the computed height. */
function drawAbilityBox(
  doc: jsPDF,
  c: PlayerCharacter,
  ability: typeof ABILITIES[number],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const score = abilityScoreOf(c, ability.key);
  const mod = abilityMod(score);
  const skills = SKILLS_BY_ABILITY[ability.key];
  const saveMod = c.save_modifiers?.[ability.key] ?? mod;

  // Container
  setFill(doc, CREAM);
  setDraw(doc, MAROON);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, 'FD');

  // Header strip
  setText(doc, MAROON);
  doc.setFont(SERIF, 'bold');
  doc.setFontSize(8);
  doc.text(ability.full, x + w / 2, y + 4.5, { align: 'center' });

  // Big modifier
  doc.setFont(SERIF, 'bold');
  doc.setFontSize(20);
  setText(doc, BODY);
  doc.text(modStr(mod), x + w / 2, y + 13, { align: 'center' });

  // Score
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(8);
  setText(doc, MUTED);
  doc.text(String(score), x + w / 2, y + 17.5, { align: 'center' });

  // Divider
  setDraw(doc, MAROON);
  doc.setLineWidth(0.2);
  doc.line(x + 2, y + 20, x + w - 2, y + 20);

  // Save row
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(8);
  setText(doc, BODY);
  doc.text('Save', x + 2, y + 24);
  doc.setFont(SERIF, 'bold');
  doc.text(modStr(saveMod), x + w - 2, y + 24, { align: 'right' });

  // Skills
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(7.5);
  let sy = y + 28;
  for (const s of skills) {
    if (sy > y + h - 1) break;
    const sm = c.skill_modifiers?.[s.key] ?? mod;
    setText(doc, BODY);
    doc.text(s.label, x + 2, sy);
    doc.setFont(SERIF, 'bold');
    doc.text(modStr(sm), x + w - 2, sy, { align: 'right' });
    doc.setFont(SERIF, 'normal');
    sy += 3.5;
  }
}

function drawAbilityGrid(doc: jsPDF, c: PlayerCharacter, x: number, y: number, w: number): number {
  const colGap = 3;
  const rowGap = 3;
  const colW = (w - colGap) / 2;
  // Tallest box must fit WIS (5 skills) or CHA (4 skills). 28mm header + 4mm/skill ≈ 48mm
  const boxH = 50;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const i = row * 2 + col;
      const ab = ABILITIES[i];
      const bx = x + col * (colW + colGap);
      const by = y + row * (boxH + rowGap);
      drawAbilityBox(doc, c, ab, bx, by, colW, boxH);
    }
  }
  return y + 3 * (boxH + rowGap) - rowGap;
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

function drawAttacksTable(
  doc: jsPDF,
  attacks: PlayerCharacter['attacks'],
  x: number,
  y: number,
  w: number,
): number {
  if (!attacks || attacks.length === 0) return y;
  y = drawSectionHeader(doc, 'ATTACKS', x, y, w);

  // Column widths — 5 columns. Sum to 1.0. Sized for Times-Roman 8pt body:
  // Name fits weapon names through ~"Eldritch Blast"; Damage fits "1d10+5";
  // Type fits "Bludgeoning" (longest 5e damage type, 11 chars);
  // Range fits "30 ft./120 ft." (longest typical thrown-weapon range).
  const cols = [
    { label: 'Name', w: 0.30 },
    { label: 'Atk', w: 0.10 },
    { label: 'Damage', w: 0.18 },
    { label: 'Type', w: 0.20 },
    { label: 'Range', w: 0.22 },
  ];

  // Header row
  const rowH = 5;
  setFill(doc, MAROON);
  doc.rect(x, y, w, rowH, 'F');
  setText(doc, '#FFFFFF');
  doc.setFont(SERIF, 'bold');
  doc.setFontSize(8);
  let cx = x;
  for (const col of cols) {
    const colWidth = w * col.w;
    doc.text(col.label, cx + 1, y + 3.5);
    cx += colWidth;
  }
  y += rowH;

  // Body rows
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(8);
  for (let i = 0; i < attacks.length; i++) {
    const atk = attacks[i];
    if (i % 2 === 0) {
      setFill(doc, PARCHMENT_ALT);
      doc.rect(x, y, w, rowH, 'F');
    }
    setText(doc, BODY);
    cx = x;
    const cells = [atk.name, atk.atk_bonus, atk.damage, atk.damage_type, atk.range || ''];
    for (let j = 0; j < cols.length; j++) {
      const colWidth = w * cols[j].w;
      const text = doc.splitTextToSize(cells[j] || '', colWidth - 2)[0] || '';
      doc.text(text, cx + 1, y + 3.5);
      cx += colWidth;
    }
    y += rowH;
  }

  // Bottom border
  setDraw(doc, MAROON);
  doc.setLineWidth(0.3);
  doc.line(x, y, x + w, y);

  return y + 3;
}

/** Compute a passive value from raw stats when char.passive_* is null. */
function computePassive(
  c: PlayerCharacter,
  ability: 'wis_score' | 'int_score',
  skillKey: string,
): number {
  const score = (c[ability] as number | undefined) ?? 10;
  const mod = Math.floor((score - 10) / 2);
  const pb = c.proficiency_bonus ?? 2;
  const profLevel = c.skill_proficiencies?.[skillKey] ?? 'none';
  const profBonus =
    profLevel === 'expertise' ? pb * 2 :
    profLevel === 'proficient' ? pb :
    profLevel === 'half' ? Math.floor(pb / 2) :
    0;
  return 10 + mod + profBonus;
}

function drawSensesAndDefenses(
  doc: jsPDF,
  c: PlayerCharacter,
  x: number,
  y: number,
  w: number,
): number {
  const lines: { label: string; value: string }[] = [];
  if (c.senses) lines.push({ label: 'Senses', value: c.senses });

  // Three passive stats — full word "Passive", auto-calc when missing.
  const pp = c.passive_perception ?? computePassive(c, 'wis_score', 'perception');
  const pi = c.passive_insight ?? computePassive(c, 'wis_score', 'insight');
  const piv = c.passive_investigation ?? computePassive(c, 'int_score', 'investigation');
  lines.push({ label: 'Passive Perception', value: String(pp) });
  lines.push({ label: 'Passive Insight', value: String(pi) });
  lines.push({ label: 'Passive Investigation', value: String(piv) });

  if (c.damage_resistances) lines.push({ label: 'Resistances', value: c.damage_resistances });
  if (c.damage_immunities) lines.push({ label: 'Damage Immunities', value: c.damage_immunities });
  if (c.condition_immunities) lines.push({ label: 'Condition Immunities', value: c.condition_immunities });
  if (lines.length === 0) return y;

  y = drawSectionHeader(doc, 'SENSES & DEFENSES', x, y, w);
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(8);
  for (const ln of lines) {
    setText(doc, MAROON);
    doc.setFont(SERIF, 'bold');
    doc.text(`${ln.label}:`, x, y);
    const labelW = doc.getTextWidth(`${ln.label}: `);
    doc.setFont(SERIF, 'normal');
    setText(doc, BODY);
    y = drawWrapped(doc, ln.value, x + labelW, y, w - labelW, 3.5);
    y += 0.5;
  }
  return y + 2;
}

function drawClassResources(
  doc: jsPDF,
  resources: PlayerCharacter['class_resources'],
  x: number,
  y: number,
  w: number,
): number {
  if (!resources || resources.length === 0) return y;
  y = drawSectionHeader(doc, 'CLASS RESOURCES', x, y, w);
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(8);
  for (const r of resources) {
    const die = r.die ? ` (${r.die})` : '';
    setText(doc, MAROON);
    doc.setFont(SERIF, 'bold');
    doc.text(r.name, x, y);
    setText(doc, BODY);
    doc.setFont(SERIF, 'normal');
    const usesText = `${r.uses} ${r.uses === 1 ? 'use' : 'uses'}${die}`;
    const usesX = x + w * 0.55;
    doc.text(usesText, usesX, y);
    setText(doc, MUTED);
    // Long recovery strings ("Long Rest (regain 1 on Short Rest)") collide
    // with the uses column when right-aligned on the same line — measure and
    // wrap to their own line instead of overlapping.
    const collides = x + w - doc.getTextWidth(r.recovery) < usesX + doc.getTextWidth(usesText) + 2;
    if (collides) y += 3.5;
    doc.text(r.recovery, x + w, y, { align: 'right' });
    y += 4;
  }
  return y + 2;
}

function drawProficiencies(
  doc: jsPDF,
  c: PlayerCharacter,
  x: number,
  y: number,
  w: number,
): number {
  y = drawSectionHeader(doc, 'PROFICIENCIES', x, y, w);
  doc.setFont(SERIF, 'normal');
  doc.setFontSize(8);

  const armorTypes: { key: string; label: string }[] = [
    { key: 'light', label: 'Light' },
    { key: 'medium', label: 'Medium' },
    { key: 'heavy', label: 'Heavy' },
    { key: 'shields', label: 'Shields' },
  ];
  const weaponTypes: { key: string; label: string }[] = [
    { key: 'simple', label: 'Simple' },
    { key: 'martial', label: 'Martial' },
  ];

  // Armor row — drawn dots, not Unicode glyphs
  setText(doc, BODY);
  doc.setFont(SERIF, 'bold');
  doc.text('Armor:', x, y);
  let cx = x + 14;
  doc.setFont(SERIF, 'normal');
  for (const a of armorTypes) {
    const has = c.armor_proficiencies?.[a.key] ?? false;
    dot(doc, cx, y - 1, 1.1, has);
    doc.text(a.label, cx + 2, y);
    cx += doc.getTextWidth(a.label) + 7;
  }
  y += 4.5;

  // Weapons row
  doc.setFont(SERIF, 'bold');
  doc.text('Weapons:', x, y);
  cx = x + 17;
  doc.setFont(SERIF, 'normal');
  for (const wp of weaponTypes) {
    const has = c.weapon_proficiencies?.[wp.key] ?? false;
    dot(doc, cx, y - 1, 1.1, has);
    doc.text(wp.label, cx + 2, y);
    cx += doc.getTextWidth(wp.label) + 7;
  }
  y += 4.5;

  if (c.languages) {
    doc.setFont(SERIF, 'bold');
    doc.text('Languages:', x, y);
    doc.setFont(SERIF, 'normal');
    y = drawWrapped(doc, c.languages, x + 20, y, w - 20, 3.5) + 0.5;
  }
  if (c.tool_proficiencies) {
    doc.setFont(SERIF, 'bold');
    doc.text('Tools:', x, y);
    doc.setFont(SERIF, 'normal');
    y = drawWrapped(doc, c.tool_proficiencies, x + 12, y, w - 12, 3.5) + 0.5;
  }

  return y + 2;
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
// PAGE 1
// ──────────────────────────────────────────────────────────────────────────

function drawPage1(doc: jsPDF, c: PlayerCharacter) {
  drawParchmentBg(doc);
  drawPageHeader(doc, c);

  // Quick stats
  const speedStr = (() => {
    if (typeof c.speeds === 'object' && c.speeds) {
      const w = c.speeds.walking || c.speeds.walk;
      if (w) return w;
      const first = Object.values(c.speeds)[0];
      return first || '30 ft.';
    }
    return '30 ft.';
  })();

  // Six boxes — passive stats live in Senses & Defenses now.
  const stats: QuickStat[] = [
    { label: 'Proficiency Bonus', value: modStr(c.proficiency_bonus) },
    { label: 'Initiative', value: modStr(c.initiative_modifier) },
    { label: 'Armor Class', value: String(c.armor_class ?? '—') },
    { label: 'Max HP', value: String(c.hp_max ?? '—') },
    { label: 'Hit Dice', value: c.hit_dice_total || '—' },
    { label: 'Speed', value: speedStr },
  ];

  let y = 30;
  y = drawQuickStatsBar(doc, stats, y);

  // Two-column layout: ability grid (left ~46%) + stacked blocks (right ~54%)
  const leftX = MARGIN;
  const leftW = (PW - 2 * MARGIN) * 0.45;
  const rightX = leftX + leftW + 5;
  const rightW = PW - MARGIN - rightX;

  const gridBottomY = drawAbilityGrid(doc, c, leftX, y, leftW);

  // Right column: stat blocks first, then Racial Traits + Feats fill remaining space.
  // Racial/Feats live here (rather than below) so we use the previously-blank area
  // under Proficiencies before Class Features takes the full width.
  let ry = y;
  ry = drawAttacksTable(doc, c.attacks, rightX, ry, rightW);
  ry = drawSensesAndDefenses(doc, c, rightX, ry, rightW);
  ry = drawClassResources(doc, c.class_resources, rightX, ry, rightW);
  ry = drawProficiencies(doc, c, rightX, ry, rightW);

  // Right-column feature blocks: page-break-aware in case they grow long.
  const startPage = doc.getNumberOfPages();
  let rx = rightX;
  const rightOpts: FeatureListOpts = {
    width: rightW,
    pageTopY: 30,
    bottomMargin: 8,
    fontSize: 7.5,
    onPageBreak: () => {
      doc.addPage();
      drawParchmentBg(doc);
      drawPageHeader(doc, c, 'Continued');
      // A continuation page has no left column — release the half-width
      // constraint and continue at full page width.
      rightOpts.width = PW - 2 * MARGIN;
      rx = MARGIN;
      return { x: MARGIN, y: 30 };
    },
  };
  if (c.racial_traits && c.racial_traits.length > 0) {
    ry = drawFeatureSection(doc, 'Racial / Species Traits', c.racial_traits, rx, ry + 1, rightOpts);
  }
  if (c.feats && c.feats.length > 0) {
    ry = drawFeatureSection(doc, 'Feats', c.feats, rx, ry + 1, rightOpts);
  }
  // If the right column overflowed onto a new page, gridBottomY (from page 1) is
  // no longer relevant — Class Features should start from ry on the current page.
  const rightOverflowed = doc.getNumberOfPages() > startPage;

  // Class Features: full-width single-column below the larger of (left, right) columns.
  // Page-break aware — never splits a feature.
  let by = rightOverflowed ? ry + 4 : Math.max(gridBottomY, ry) + 4;
  if (by > PH - 25) {
    // No room left for any class features on this page — start a fresh page
    doc.addPage();
    drawParchmentBg(doc);
    drawPageHeader(doc, c, 'Continued');
    by = 30;
  } else {
    ornamentDivider(doc, MARGIN, PW - MARGIN, by);
    by += 4;
  }

  const fullW = PW - 2 * MARGIN;
  let inContinuation = false;
  const cfOpts: FeatureListOpts = {
    width: fullW,
    pageTopY: 30,
    bottomMargin: 12,
    fontSize: 8,
    onPageBreak: () => {
      doc.addPage();
      drawParchmentBg(doc);
      drawPageHeader(doc, c, 'Continued');
      inContinuation = true;
      const top = 30;
      // Repeat header with "(continued)" so the reader knows context.
      const headerY = drawSectionHeader(doc, 'CLASS FEATURES (CONTINUED)', MARGIN, top, fullW);
      return { x: MARGIN, y: headerY };
    },
  };

  if (c.class_features && c.class_features.length > 0) {
    by = drawFeatureSection(doc, inContinuation ? 'Class Features (Continued)' : 'Class Features', c.class_features, MARGIN, by, cfOpts);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// PAGE 2: Inventory
// ──────────────────────────────────────────────────────────────────────────

function drawInventoryPage(doc: jsPDF, c: PlayerCharacter) {
  doc.addPage();
  drawParchmentBg(doc);
  drawPageHeader(doc, c, 'Inventory');

  let y = 32;

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

/** Look up a spell by name across SRD library + per-character custom spells. */
function findSpell(name: string, customByName: Map<string, SrdSpell>): SrdSpell | null {
  if (!name) return null;
  // D&D Beyond sheets append bracketed markers to spell names ("Ceremony [R]");
  // strip them so ritual spells still match the SRD/custom libraries.
  const lower = name.replace(/\s*\[[^\]]*\]\s*$/, '').toLowerCase().trim();
  const directCustom = customByName.get(lower);
  if (directCustom) return directCustom;
  const direct = SRD_BY_NAME.get(lower);
  if (direct) return direct;
  // Fuzzy fallback: strip apostrophes/hyphens, compare
  const norm = lower.replace(/['-]/g, '').replace(/\s+/g, ' ');
  for (const [k, v] of customByName) {
    if (k.replace(/['-]/g, '').replace(/\s+/g, ' ') === norm) return v;
  }
  for (const [k, v] of SRD_BY_NAME) {
    if (k.replace(/['-]/g, '').replace(/\s+/g, ' ') === norm) return v;
  }
  return null;
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

function drawSpellsPage(doc: jsPDF, c: PlayerCharacter, customByName: Map<string, SrdSpell>) {
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
      const srd = findSpell(name, customByName);
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
// Route handler
// ──────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Accept either a bare PlayerCharacter or { character, customSpells }.
    // The wrapper form lets the client pass campaign-scoped custom spells so the
    // PDF can render their full descriptions.
    const body = await req.json();
    const character = (body.character ?? body) as PlayerCharacter;
    const rawCustom = (body.customSpells ?? []) as CustomSpell[];

    const customByName = new Map<string, SrdSpell>();
    for (const c of rawCustom) {
      customByName.set(c.name.toLowerCase().trim(), customToSrdShape(c));
    }

    const doc = hardenPdfText(
      new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      })
    );

    drawPage1(doc, character);

    if (character.equipment && character.equipment.length > 0) {
      drawInventoryPage(doc, character);
    }

    if (character.is_spellcaster) {
      drawSpellsPage(doc, character, customByName);
    }

    const pdfOutput = doc.output('arraybuffer');
    return new Response(pdfOutput, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${character.name || 'character'}-sheet.pdf"`,
      },
    });
  } catch (err) {
    console.error('PDF export error:', err);
    return new Response(JSON.stringify({ error: 'Failed to generate PDF' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
