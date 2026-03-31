import { jsPDF } from 'jspdf';
import { NextRequest } from 'next/server';
import type { PlayerCharacter } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function modStr(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Ability → skill mapping (5e SRD)
const ABILITY_SKILLS: Record<string, string[]> = {
  STR: ['Athletics'],
  DEX: ['Acrobatics', 'Sleight of Hand', 'Stealth'],
  CON: [],
  INT: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'],
  WIS: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'],
  CHA: ['Deception', 'Intimidation', 'Performance', 'Persuasion'],
};

const ABILITY_KEYS: { key: string; score: keyof PlayerCharacter }[] = [
  { key: 'STR', score: 'str_score' },
  { key: 'DEX', score: 'dex_score' },
  { key: 'CON', score: 'con_score' },
  { key: 'INT', score: 'int_score' },
  { key: 'WIS', score: 'wis_score' },
  { key: 'CHA', score: 'cha_score' },
];

// Colors
const PARCHMENT = '#F4E4C1';
const MAROON = '#58180D';
const BODY = '#1a1a1a';
const MUTED = '#6b6b6b';

// Page dimensions (US Letter mm)
const PW = 215.9;
const PH = 279.4;
const MARGIN = 10;

// ---------------------------------------------------------------------------
// Utility drawing helpers
// ---------------------------------------------------------------------------

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

function setTextCol(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function setDrawCol(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}

/** Draw a filled circle (for proficiency dots). */
function filledCircle(doc: jsPDF, x: number, y: number, r: number) {
  doc.circle(x, y, r, 'F');
}

/** Draw a stroked circle. */
function emptyCircle(doc: jsPDF, x: number, y: number, r: number) {
  doc.circle(x, y, r, 'S');
}

/** Wrap text to fit a width and draw it, returning the new Y. */
function drawWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Page backgrounds
// ---------------------------------------------------------------------------

function drawParchmentBg(doc: jsPDF) {
  setFill(doc, PARCHMENT);
  doc.rect(0, 0, PW, PH, 'F');
}

// ---------------------------------------------------------------------------
// PAGE 1
// ---------------------------------------------------------------------------

function drawPage1(doc: jsPDF, c: PlayerCharacter) {
  drawParchmentBg(doc);

  // ---- TOP BAND ----
  setFill(doc, MAROON);
  doc.rect(0, 10, PW, 20, 'F');

  setTextCol(doc, '#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(c.name, MARGIN, 22);

  doc.setFontSize(12);
  const classLine = c.subclass
    ? `${c.class_name} \u2014 ${c.subclass}`
    : c.class_name;
  doc.text(classLine, MARGIN, 28);

  doc.setFontSize(16);
  doc.text(`Level ${c.level}`, PW - MARGIN, 22, { align: 'right' });

  // Below band — passives row
  let y = 34;
  doc.setFontSize(8);
  setTextCol(doc, MUTED);
  doc.setFont('helvetica', 'normal');

  const passives: string[] = [
    `Prof Bonus: ${modStr(c.proficiency_bonus)}`,
    `Passive Perception: ${c.passive_perception}`,
  ];
  if (c.passive_insight != null) passives.push(`Insight: ${c.passive_insight}`);
  if (c.passive_investigation != null) passives.push(`Investigation: ${c.passive_investigation}`);
  if (c.senses) passives.push(`Senses: ${c.senses}`);

  doc.text(passives.join('   |   '), MARGIN, y);
  y += 4;

  // Thin rule
  setDrawCol(doc, MAROON);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 3;

  // ---- LEFT COLUMN — Ability Scores ----
  const leftX = MARGIN;
  const leftW = 65;
  let leftY = y;

  for (const ab of ABILITY_KEYS) {
    const score = c[ab.score] as number;
    const mod = abilityMod(score);
    const saveMod = c.save_modifiers?.[ab.key.toLowerCase()] ?? mod;

    // Ability name (small caps style — just uppercase + small font)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTextCol(doc, MAROON);
    doc.text(ab.key, leftX, leftY);

    // Save on the right side of ability header
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setTextCol(doc, BODY);
    doc.text(`Save: ${modStr(saveMod)}`, leftX + leftW - 2, leftY, { align: 'right' });

    leftY += 5;

    // Large modifier
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    setTextCol(doc, BODY);
    doc.text(modStr(mod), leftX + 2, leftY);

    // Score (smaller, next to modifier)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setTextCol(doc, MUTED);
    doc.text(`(${score})`, leftX + 16, leftY);

    leftY += 5;

    // Skills for this ability
    const skills = ABILITY_SKILLS[ab.key] || [];
    doc.setFontSize(8);
    setTextCol(doc, BODY);
    doc.setFont('helvetica', 'normal');
    for (const skill of skills) {
      const skillKey = skill.toLowerCase().replace(/ /g, '_');
      const skillMod = c.skill_modifiers?.[skillKey] ?? mod;
      doc.text(`${modStr(skillMod)} ${skill}`, leftX + 4, leftY);
      leftY += 3.5;
    }

    leftY += 3;
  }

  // ---- CENTER-RIGHT AREA ----
  const rightX = 80;
  const rightW = PW - MARGIN - rightX;
  let rightY = y;

  // -- Combat Stats --
  setTextCol(doc, MAROON);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('COMBAT', rightX, rightY);
  rightY += 5;

  // Grid of combat stats (3 columns x 2 rows)
  const colW = rightW / 3;
  const statGrid = [
    [`AC: ${c.armor_class}`, c.ac_source ? `(${c.ac_source})` : ''],
    [`Init: ${modStr(c.initiative_modifier)}`, ''],
    [`HP: ${c.hp_max}`, ''],
    [`Hit Dice: ${c.hit_dice_total}`, ''],
    [
      `Speed: ${
        typeof c.speeds === 'object'
          ? Object.entries(c.speeds)
              .map(([k, v]) => (k === 'walk' ? v : `${k} ${v}`))
              .join(', ')
          : String(c.speeds)
      }`,
      '',
    ],
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setTextCol(doc, BODY);
  let gridX = rightX;
  let gridY = rightY;
  let colIdx = 0;
  for (const [main, sub] of statGrid) {
    doc.setFont('helvetica', 'bold');
    doc.text(main, gridX, gridY);
    if (sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      setTextCol(doc, MUTED);
      doc.text(sub, gridX, gridY + 3.5);
      setTextCol(doc, BODY);
      doc.setFontSize(9);
    }
    colIdx++;
    if (colIdx % 3 === 0) {
      gridX = rightX;
      gridY += 9;
    } else {
      gridX += colW;
    }
  }
  rightY = gridY + 9;

  // Thin rule
  setDrawCol(doc, MAROON);
  doc.line(rightX, rightY, PW - MARGIN, rightY);
  rightY += 4;

  // -- Attacks Table --
  if (c.attacks && c.attacks.length > 0) {
    setTextCol(doc, MAROON);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('ATTACKS', rightX, rightY);
    rightY += 5;

    // Header
    doc.setFontSize(7);
    setTextCol(doc, MUTED);
    const atkCols = [rightX, rightX + 45, rightX + 62, rightX + 90];
    doc.text('Name', atkCols[0], rightY);
    doc.text('Atk', atkCols[1], rightY);
    doc.text('Damage', atkCols[2], rightY);
    doc.text('Type', atkCols[3], rightY);
    rightY += 4;

    doc.setFont('helvetica', 'normal');
    setTextCol(doc, BODY);
    doc.setFontSize(8);

    for (let i = 0; i < c.attacks.length; i++) {
      const atk = c.attacks[i];
      // alternating shading
      if (i % 2 === 0) {
        setFill(doc, '#EAD8A8');
        doc.rect(rightX - 1, rightY - 3, rightW + 2, 4.5, 'F');
      }
      setTextCol(doc, BODY);
      doc.text(atk.name, atkCols[0], rightY);
      doc.text(atk.atk_bonus, atkCols[1], rightY);
      doc.text(atk.damage, atkCols[2], rightY);
      doc.text(atk.damage_type, atkCols[3], rightY);
      rightY += 4.5;
    }
    rightY += 3;
  }

  // -- Class Resources --
  if (c.class_resources && c.class_resources.length > 0) {
    setDrawCol(doc, MAROON);
    doc.line(rightX, rightY, PW - MARGIN, rightY);
    rightY += 4;

    setTextCol(doc, MAROON);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CLASS RESOURCES', rightX, rightY);
    rightY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setTextCol(doc, BODY);

    for (const res of c.class_resources) {
      const diePart = res.die ? ` (${res.die})` : '';
      doc.text(
        `${res.name}: ${res.uses} uses${diePart} \u2014 ${res.recovery}`,
        rightX,
        rightY,
      );
      rightY += 4;
    }
    rightY += 3;
  }

  // -- Proficiencies --
  setDrawCol(doc, MAROON);
  doc.line(rightX, rightY, PW - MARGIN, rightY);
  rightY += 4;

  setTextCol(doc, MAROON);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PROFICIENCIES', rightX, rightY);
  rightY += 5;

  doc.setFontSize(8);
  setTextCol(doc, BODY);
  doc.setFont('helvetica', 'normal');

  // Armor proficiencies
  const armorTypes = ['Light', 'Medium', 'Heavy', 'Shields'];
  let profLine = 'Armor: ';
  for (const at of armorTypes) {
    const key = at.toLowerCase();
    const has = c.armor_proficiencies?.[key] ?? false;
    profLine += `${at} ${has ? '\u25CF' : '\u25CB'} `;
  }
  doc.text(profLine.trim(), rightX, rightY);
  rightY += 4;

  // Weapon proficiencies
  const weaponTypes = ['Simple', 'Martial'];
  let weapLine = 'Weapons: ';
  for (const wt of weaponTypes) {
    const key = wt.toLowerCase();
    const has = c.weapon_proficiencies?.[key] ?? false;
    weapLine += `${wt} ${has ? '\u25CF' : '\u25CB'} `;
  }
  doc.text(weapLine.trim(), rightX, rightY);
  rightY += 4;

  if (c.languages) {
    doc.text(`Languages: ${c.languages}`, rightX, rightY);
    rightY += 4;
  }
  if (c.tool_proficiencies) {
    doc.text(`Tools: ${c.tool_proficiencies}`, rightX, rightY);
    rightY += 4;
  }
  rightY += 2;

  // -- Defenses --
  const defenses: string[] = [];
  if (c.damage_resistances) defenses.push(`Resistances: ${c.damage_resistances}`);
  if (c.damage_immunities) defenses.push(`Immunities: ${c.damage_immunities}`);
  if (c.condition_immunities) defenses.push(`Condition Imm: ${c.condition_immunities}`);

  if (defenses.length > 0) {
    setDrawCol(doc, MAROON);
    doc.line(rightX, rightY, PW - MARGIN, rightY);
    rightY += 4;

    setTextCol(doc, MAROON);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DEFENSES', rightX, rightY);
    rightY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setTextCol(doc, BODY);
    for (const d of defenses) {
      doc.text(d, rightX, rightY);
      rightY += 4;
    }
    rightY += 2;
  }

  // ---- BOTTOM SECTION ----
  // Start below whichever column is taller
  let bottomY = Math.max(leftY, rightY) + 4;

  // Guard against page overflow — if we're already past ~250, skip or truncate
  if (bottomY > 260) bottomY = 260;

  setDrawCol(doc, MAROON);
  doc.line(MARGIN, bottomY, PW - MARGIN, bottomY);
  bottomY += 4;

  // -- Class Features (two columns) --
  if (c.class_features && c.class_features.length > 0) {
    setTextCol(doc, MAROON);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CLASS FEATURES', MARGIN, bottomY);
    bottomY += 4;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    setTextCol(doc, BODY);

    const col1X = MARGIN;
    const col2X = MARGIN + (PW - 2 * MARGIN) / 2 + 2;
    const featureColW = (PW - 2 * MARGIN) / 2 - 4;
    const half = Math.ceil(c.class_features.length / 2);
    let fy1 = bottomY;
    let fy2 = bottomY;

    for (let i = 0; i < c.class_features.length; i++) {
      const f = c.class_features[i];
      const x = i < half ? col1X : col2X;
      const fy = i < half ? fy1 : fy2;

      doc.setFont('helvetica', 'bold');
      const featureText = `${f.name}. `;
      doc.text(featureText, x, fy);
      const nameW = doc.getTextWidth(featureText);
      doc.setFont('helvetica', 'normal');

      const newY = drawWrappedText(doc, f.summary, x + nameW, fy, featureColW - nameW, 3);
      // If the summary wrapped, move past it
      const advanceY = Math.max(newY - fy, 3.5);

      if (i < half) {
        fy1 = fy + advanceY + 0.5;
      } else {
        fy2 = fy + advanceY + 0.5;
      }
    }
    bottomY = Math.max(fy1, fy2) + 2;
  }

  // -- Racial Traits --
  if (c.racial_traits && c.racial_traits.length > 0 && bottomY < PH - 20) {
    setTextCol(doc, MAROON);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('RACIAL TRAITS', MARGIN, bottomY);
    bottomY += 4;

    doc.setFontSize(7);
    setTextCol(doc, BODY);
    for (const t of c.racial_traits) {
      if (bottomY > PH - 10) break;
      doc.setFont('helvetica', 'bold');
      const label = `${t.name}. `;
      doc.text(label, MARGIN, bottomY);
      doc.setFont('helvetica', 'normal');
      doc.text(t.summary, MARGIN + doc.getTextWidth(label), bottomY);
      bottomY += 3.5;
    }
    bottomY += 2;
  }

  // -- Feats --
  if (c.feats && c.feats.length > 0 && bottomY < PH - 20) {
    setTextCol(doc, MAROON);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('FEATS', MARGIN, bottomY);
    bottomY += 4;

    doc.setFontSize(7);
    setTextCol(doc, BODY);
    for (const f of c.feats) {
      if (bottomY > PH - 10) break;
      doc.setFont('helvetica', 'bold');
      const label = `${f.name}. `;
      doc.text(label, MARGIN, bottomY);
      doc.setFont('helvetica', 'normal');
      doc.text(f.summary, MARGIN + doc.getTextWidth(label), bottomY);
      bottomY += 3.5;
    }
    bottomY += 2;
  }

  // -- Inventory --
  if ((c.equipment && c.equipment.length > 0) && bottomY < PH - 15) {
    setDrawCol(doc, MAROON);
    doc.line(MARGIN, bottomY, PW - MARGIN, bottomY);
    bottomY += 4;

    setTextCol(doc, MAROON);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('INVENTORY', MARGIN, bottomY);
    bottomY += 4;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    setTextCol(doc, BODY);

    const invCol1X = MARGIN;
    const invCol2X = MARGIN + (PW - 2 * MARGIN) / 2 + 2;
    const invHalf = Math.ceil(c.equipment.length / 2);
    let iy1 = bottomY;
    let iy2 = bottomY;

    for (let i = 0; i < c.equipment.length; i++) {
      const eq = c.equipment[i];
      const x = i < invHalf ? invCol1X : invCol2X;
      const iy = i < invHalf ? iy1 : iy2;
      if (iy > PH - 10) break;

      const weightPart = eq.weight ? ` (${eq.weight})` : '';
      doc.text(`${eq.qty}\u00D7 ${eq.name}${weightPart}`, x, iy);

      if (i < invHalf) iy1 += 3.5;
      else iy2 += 3.5;
    }
    bottomY = Math.max(iy1, iy2) + 2;
  }

  // Currency line
  if (bottomY < PH - 8) {
    doc.setFontSize(7);
    setTextCol(doc, MUTED);
    doc.text(
      `CP: ${c.cp}  |  SP: ${c.sp}  |  EP: ${c.ep}  |  GP: ${c.gp}  |  PP: ${c.pp}`,
      MARGIN,
      Math.min(bottomY, PH - 8),
    );
  }
}

// ---------------------------------------------------------------------------
// PAGE 2 — SPELLS
// ---------------------------------------------------------------------------

function drawPage2(doc: jsPDF, c: PlayerCharacter) {
  doc.addPage();
  drawParchmentBg(doc);

  // Header band
  setFill(doc, MAROON);
  doc.rect(0, 10, PW, 16, 'F');

  setTextCol(doc, '#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`${c.name} \u2014 ${c.class_name} Spells`, MARGIN, 21);

  let y = 30;

  // Spellcasting stats
  doc.setFontSize(11);
  setTextCol(doc, MAROON);
  doc.setFont('helvetica', 'bold');

  const scStats: string[] = [];
  if (c.spell_attack_bonus != null) scStats.push(`Spell Attack: ${modStr(c.spell_attack_bonus)}`);
  if (c.spell_save_dc != null) scStats.push(`Spell Save DC: ${c.spell_save_dc}`);
  if (c.spellcasting_ability) scStats.push(`Ability: ${c.spellcasting_ability}`);

  doc.text(scStats.join('     '), MARGIN, y);
  y += 7;

  // Spell Slots
  setTextCol(doc, BODY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SPELL SLOTS', MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  if (c.spell_slots) {
    const slotBoxSize = 14;
    let sx = MARGIN;
    for (let lvl = 1; lvl <= 9; lvl++) {
      const key = String(lvl);
      const count = c.spell_slots[key] ?? 0;
      if (count === 0 && lvl > 5) continue; // skip empty high-level slots

      setFill(doc, '#FFFFFF');
      setDrawCol(doc, MAROON);
      doc.rect(sx, y, slotBoxSize, slotBoxSize, 'FD');

      setTextCol(doc, MUTED);
      doc.setFontSize(6);
      const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
      doc.text(ordinals[lvl], sx + slotBoxSize / 2, y + 4, { align: 'center' });

      setTextCol(doc, BODY);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(String(count), sx + slotBoxSize / 2, y + 11, { align: 'center' });
      doc.setFont('helvetica', 'normal');

      sx += slotBoxSize + 3;
    }
    y += slotBoxSize + 4;
  }

  // Pact slots (warlock)
  if (c.pact_slot_count != null && c.pact_slot_level != null) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    setTextCol(doc, MAROON);
    const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
    doc.text(
      `Pact Slots: ${c.pact_slot_count} \u00D7 ${ordinals[c.pact_slot_level] ?? c.pact_slot_level + 'th'} level`,
      MARGIN,
      y,
    );
    y += 6;
  }

  // Spell list by level
  if (c.spells) {
    const levelNames: Record<string, string> = {
      '0': 'CANTRIPS',
      '1': '1ST LEVEL',
      '2': '2ND LEVEL',
      '3': '3RD LEVEL',
      '4': '4TH LEVEL',
      '5': '5TH LEVEL',
      '6': '6TH LEVEL',
      '7': '7TH LEVEL',
      '8': '8TH LEVEL',
      '9': '9TH LEVEL',
    };

    const sortedLevels = Object.keys(c.spells).sort(
      (a, b) => parseInt(a) - parseInt(b),
    );

    // Use two columns for spell list
    const spellCol1X = MARGIN;
    const spellCol2X = MARGIN + (PW - 2 * MARGIN) / 2 + 2;
    const spellColW = (PW - 2 * MARGIN) / 2 - 4;
    let col = 0;
    let sy1 = y;
    let sy2 = y;

    for (const lvlKey of sortedLevels) {
      const spellNames = c.spells[lvlKey];
      if (!spellNames || spellNames.length === 0) continue;

      // Decide which column to use — pick the shorter one
      const useCol2 = sy1 > sy2 + 5;
      const sx = useCol2 ? spellCol2X : spellCol1X;
      let sy = useCol2 ? sy2 : sy1;

      // Check for page overflow
      if (sy > PH - 20) {
        doc.addPage();
        drawParchmentBg(doc);
        sy = MARGIN;
        sy1 = MARGIN;
        sy2 = MARGIN;
      }

      // Level header
      setTextCol(doc, MAROON);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(levelNames[lvlKey] ?? `LEVEL ${lvlKey}`, sx, sy);
      sy += 4;

      // Spell names
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setTextCol(doc, BODY);

      for (const spell of spellNames) {
        if (sy > PH - 10) break;
        const isPrepared =
          c.is_prepared_caster && c.prepared_spells?.includes(spell);
        const prefix = c.is_prepared_caster
          ? isPrepared
            ? '\u25CF '
            : '\u25CB '
          : '';
        doc.text(`${prefix}${spell}`, sx + 2, sy);
        sy += 3.5;
      }
      sy += 2;

      if (useCol2) sy2 = sy;
      else sy1 = sy;
      col++;
    }
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const character = (await req.json()) as PlayerCharacter;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    drawPage1(doc, character);

    if (character.is_spellcaster) {
      drawPage2(doc, character);
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
