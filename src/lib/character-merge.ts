// Re-upload merge: folds a freshly parsed D&D Beyond PDF into a character
// that's already on the sheet.
//
// The PDF is authoritative for the numbers that move on a level-up: level, HP,
// ability scores, saves/skills, attack bonuses, resource uses, spell slots,
// currency. Everything the DM wrote or decided stays: player and reskinned
// names, edited feature summaries, attack ranges/notes, spell markers, extra
// proficiencies. List items are matched by name. Sheet-only items are kept;
// PDF-only items are offered, not added — on a curated sheet most of them are
// boilerplate the DM already trimmed or pre-reskin originals. Every difference
// lands in the report, and nothing is saved until the DM clicks Save.

import type {
  AttackEntry,
  ClassResource,
  EquipmentEntry,
  FeatureEntry,
  PlayerCharacter,
  ProficiencyLevel,
  SpellEntry,
} from '@/types';
import {
  deriveClasses,
  modString,
  normalizeFlagKeys,
  normalizeSaveKeys,
  normalizeSkillKeys,
  normalizeSpeedKeys,
  spellKey,
} from '@/lib/character';
import { featureSummary, summaryContext } from '@/lib/feature-summary';

export interface FieldChange {
  label: string;
  from: string;
  to: string;
}

export interface ListDiff {
  section: string;
  names: string[];
}

export interface PdfSpell {
  name: string;
  level: string;
  /** The import's details for the spell, added to spell_details when the DM adds the spell. */
  detail?: SpellEntry;
}

/** Items the PDF has and the sheet doesn't, grouped by the sheet section they'd go into. */
export type PdfOnlyGroup =
  | { section: 'attacks'; label: string; items: AttackEntry[] }
  | { section: 'class_resources'; label: string; items: ClassResource[] }
  | { section: 'class_features' | 'racial_traits' | 'feats'; label: string; items: FeatureEntry[] }
  | { section: 'equipment'; label: string; items: EquipmentEntry[] }
  | { section: 'spells'; label: string; items: PdfSpell[] };

export interface ReuploadReport {
  /** Signs the PDF is the wrong file or an old export. */
  warnings: string[];
  /** Values the PDF changed. */
  updated: FieldChange[];
  /** Sheet values kept where the PDF disagrees — `from` is the sheet, `to` the PDF. */
  kept: FieldChange[];
  /** In the PDF but not on the sheet — offered for adding. */
  pdfOnly: PdfOnlyGroup[];
  /** On the sheet but not in the PDF — kept, but possibly obsolete. */
  notInPdf: ListDiff[];
}

export function spellLevelLabel(level: string): string {
  return ORDINALS[Number(level)] ?? `level ${level}`;
}

/** Report with some of a section's PDF-only items removed (once they've been added to the sheet). */
export function withoutPdfOnly(
  report: ReuploadReport,
  section: PdfOnlyGroup['section'],
  indexes: number[],
): ReuploadReport {
  const drop = new Set(indexes);
  const pdfOnly = report.pdfOnly
    .map((g) =>
      g.section === section ? ({ ...g, items: g.items.filter((_, i) => !drop.has(i)) } as PdfOnlyGroup) : g,
    )
    .filter((g) => g.items.length > 0);
  return { ...report, pdfOnly };
}

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const ORDINALS = ['cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

type TextField =
  | 'species'
  | 'background'
  | 'name'
  | 'player_name'
  | 'subclass'
  | 'ac_source'
  | 'senses'
  | 'languages'
  | 'tool_proficiencies'
  | 'damage_resistances'
  | 'damage_immunities'
  | 'condition_immunities'
  | 'spellcasting_ability';

/** List-matching key: ignores case, punctuation, and bracket markers ("Ceremony [R]" matches "Ceremony"). */
const keyOf = spellKey;

// Structure the v3 import adds to features. The edit page doesn't expose
// these, so on a matched feature the import's values replace the sheet's.
const FEATURE_V3_KEYS = [
  'full_text', 'text_source', 'kind', 'group', 'parent', 'action', 'uses', 'source_ref', 'options', 'option_details', 'activations',
] as const;

function enrich<T extends object>(sheetItem: T, pdfItem: T, keys: readonly (keyof T)[]): T {
  const out = { ...sheetItem };
  for (const k of keys) {
    if (out[k] == null && pdfItem[k] != null) out[k] = pdfItem[k];
  }
  return out;
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  return norm(a) === norm(b);
}

function titleCase(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b(?!of\b)\w/g, (c) => c.toUpperCase());
}

function describeSlots(c: Partial<PlayerCharacter>): string {
  if (c.pact_slot_level != null && c.pact_slot_count != null) {
    return `${c.pact_slot_count} × ${ORDINALS[c.pact_slot_level] ?? c.pact_slot_level}-level pact`;
  }
  const counts = Object.entries(c.spell_slots ?? {})
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, n]) => n);
  return counts.length > 0 ? counts.join('/') : 'none';
}

/**
 * Matches sheet and PDF items by name: matched items get `refresh`ed, sheet-only
 * items stay, PDF-only items are returned for the report instead of appended.
 */
function mergeByName<T extends { name: string }>(
  label: string,
  sheetItems: T[] | null | undefined,
  pdfItems: T[] | null | undefined,
  report: ReuploadReport,
  refresh?: (sheetItem: T, pdfItem: T) => T,
): { merged: T[]; pdfOnly: T[] } {
  const sheetList = sheetItems ?? [];
  const pdfList = pdfItems ?? [];
  const pdfByKey = new Map(pdfList.map((p) => [keyOf(p.name), p]));
  const sheetKeys = new Set(sheetList.map((s) => keyOf(s.name)));

  const merged = sheetList.map((s) => {
    const p = pdfByKey.get(keyOf(s.name));
    return p && refresh ? refresh(s, p) : s;
  });
  const pdfOnly = pdfList.filter((p) => p.name.trim() && !sheetKeys.has(keyOf(p.name)));
  const missing = sheetList.filter((s) => s.name.trim() && !pdfByKey.has(keyOf(s.name)));
  // An empty PDF section usually means the parser found nothing, not that every item is gone.
  if (missing.length > 0 && pdfList.length > 0) {
    report.notInPdf.push({ section: label, names: missing.map((m) => m.name) });
  }
  return { merged, pdfOnly };
}

function diffSpells(
  sheetSpells: Record<string, string[]> | null,
  pdfSpells: Record<string, string[]> | null | undefined,
  pdfDetails: Record<string, SpellEntry> | null | undefined,
  report: ReuploadReport,
): PdfSpell[] {
  if (!pdfSpells) return [];
  // Matched across levels and without bracket markers, so the DM's "[At Will]"
  // and DDB's "[R]" variants of the same spell line up.
  const onSheet = new Set(Object.values(sheetSpells ?? {}).flat().map(keyOf));
  const inPdf = new Set(Object.values(pdfSpells).flat().map(keyOf));

  const pdfOnly: PdfSpell[] = [];
  for (const [level, names] of Object.entries(pdfSpells)) {
    for (const name of names) {
      if (!name.trim() || onSheet.has(keyOf(name))) continue;
      onSheet.add(keyOf(name));
      const detail = Object.values(pdfDetails ?? {}).find((d) => keyOf(d.name) === keyOf(name));
      pdfOnly.push({ name, level, ...(detail ? { detail } : {}) });
    }
  }
  const missing: string[] = [];
  for (const [level, names] of Object.entries(sheetSpells ?? {})) {
    for (const name of names) {
      if (name.trim() && !inPdf.has(keyOf(name))) missing.push(`${name} (${spellLevelLabel(level)})`);
    }
  }
  if (missing.length > 0 && inPdf.size > 0) report.notInPdf.push({ section: 'Spells', names: missing });
  return pdfOnly;
}

export function mergeReupload(
  sheet: PlayerCharacter,
  pdf: Partial<PlayerCharacter>,
): { merged: PlayerCharacter; report: ReuploadReport } {
  const report: ReuploadReport = { warnings: [], updated: [], kept: [], pdfOnly: [], notInPdf: [] };
  const merged: PlayerCharacter = { ...sheet };

  // ── Wrong-file and stale-export checks ──
  const firstWord = (s: string) => s.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (pdf.name && sheet.name && firstWord(pdf.name) !== firstWord(sheet.name)) {
    report.warnings.push(
      `This PDF is for “${pdf.name}”, not “${sheet.name}”. Check you picked the right file before saving.`,
    );
  }
  const drops: string[] = [];
  const checkDrop = (label: string, prev: number | null | undefined, next: number | null | undefined) => {
    if (prev != null && next != null && next < prev) drops.push(`${label} ${prev} → ${next}`);
  };
  checkDrop('Level', sheet.level, pdf.level);
  checkDrop('Max HP', sheet.hp_max, pdf.hp_max);
  checkDrop('AC', sheet.armor_class, pdf.armor_class);
  for (const ab of ABILITIES) checkDrop(ab.toUpperCase(), sheet[`${ab}_score`], pdf[`${ab}_score`]);
  if (drops.length > 0) {
    report.warnings.push(
      `Some numbers went down (${drops.join(', ')}). The PDF may be an older export than the character on D&D Beyond.`,
    );
  }

  // ── Numbers that move on a level-up: the PDF wins ──
  const takeFromPdf = <K extends keyof PlayerCharacter>(
    key: K,
    label: string,
    fmt: (v: NonNullable<PlayerCharacter[K]>) => string = String,
  ) => {
    const next = pdf[key];
    if (next == null || next === '') return;
    const prev = sheet[key];
    if (prev === next) return;
    report.updated.push({
      label,
      from: prev == null || prev === '' ? '—' : fmt(prev as NonNullable<PlayerCharacter[K]>),
      to: fmt(next as NonNullable<PlayerCharacter[K]>),
    });
    merged[key] = next as PlayerCharacter[K];
  };
  takeFromPdf('level', 'Level');
  takeFromPdf('hp_max', 'Max HP');
  takeFromPdf('hit_dice_total', 'Hit dice');
  takeFromPdf('proficiency_bonus', 'Proficiency bonus', modString);
  takeFromPdf('armor_class', 'AC');
  takeFromPdf('initiative_modifier', 'Initiative', modString);
  takeFromPdf('passive_perception', 'Passive Perception');
  takeFromPdf('passive_insight', 'Passive Insight');
  takeFromPdf('passive_investigation', 'Passive Investigation');
  for (const ab of ABILITIES) takeFromPdf(`${ab}_score` as const, ab.toUpperCase());
  for (const coin of ['cp', 'sp', 'ep', 'gp', 'pp'] as const) takeFromPdf(coin, coin.toUpperCase());
  merged.is_multiclass = Boolean(sheet.is_multiclass || pdf.is_multiclass);
  merged.is_spellcaster = Boolean(sheet.is_spellcaster || pdf.is_spellcaster);

  // Saves and skills follow the PDF. Proficiency levels are inferred from the
  // modifiers, so the PDF's inference only replaces the sheet's where the
  // modifier actually moved — a DM correction on an unchanged skill survives.
  const mergeModifiers = (
    prevRaw: Record<string, number> | undefined,
    nextRaw: Record<string, number> | undefined,
    normalize: (r: Record<string, number>) => Record<string, number>,
    label: (key: string) => string,
  ) => {
    const prev = normalize(prevRaw ?? {});
    const next = normalize(nextRaw ?? {});
    const values = { ...prev };
    const changed = new Set<string>();
    for (const [k, v] of Object.entries(next)) {
      if (prev[k] === v) continue;
      report.updated.push({ label: label(k), from: prev[k] == null ? '—' : modString(prev[k]), to: modString(v) });
      values[k] = v;
      changed.add(k);
    }
    return { values, changed };
  };
  const mergeProficiencies = (
    prev: Record<string, ProficiencyLevel> | undefined,
    next: Record<string, ProficiencyLevel> | undefined,
    changed: Set<string>,
  ) => {
    const out = { ...(next ?? {}), ...(prev ?? {}) };
    for (const k of changed) {
      if (next?.[k]) out[k] = next[k];
    }
    return out;
  };
  const saves = mergeModifiers(sheet.save_modifiers, pdf.save_modifiers, normalizeSaveKeys, (k) => `${k.toUpperCase()} save`);
  merged.save_modifiers = saves.values;
  merged.save_proficiencies = mergeProficiencies(sheet.save_proficiencies, pdf.save_proficiencies, saves.changed);
  const skills = mergeModifiers(sheet.skill_modifiers, pdf.skill_modifiers, normalizeSkillKeys, titleCase);
  merged.skill_modifiers = skills.values;
  merged.skill_proficiencies = mergeProficiencies(sheet.skill_proficiencies, pdf.skill_proficiencies, skills.changed);

  // Speeds: the PDF updates the movement types it lists; others on the sheet stay.
  const prevSpeeds = normalizeSpeedKeys(sheet.speeds);
  const nextSpeeds = normalizeSpeedKeys(pdf.speeds);
  merged.speeds = { ...prevSpeeds };
  for (const [k, v] of Object.entries(nextSpeeds)) {
    if (!v) continue;
    if (!sameText(prevSpeeds[k], v)) {
      report.updated.push({ label: `${titleCase(k)} speed`, from: prevSpeeds[k] || '—', to: v });
    }
    merged.speeds[k] = v;
  }
  for (const [k, v] of Object.entries(prevSpeeds)) {
    if (v && !nextSpeeds[k]) report.kept.push({ label: `${titleCase(k)} speed`, from: v, to: 'none' });
  }

  // Armor/weapon proficiencies only accumulate: a proficiency granted by a DM
  // ruling (and so missing on D&D Beyond) is kept.
  const unionFlags = (
    prevRaw: Record<string, boolean> | null | undefined,
    nextRaw: Record<string, boolean> | null | undefined,
    noun: string,
  ) => {
    const prev = normalizeFlagKeys(prevRaw);
    const next = normalizeFlagKeys(nextRaw);
    const label = (k: string) => (k === 'shields' ? 'Shields' : `${titleCase(k)} ${noun}`);
    const out = { ...next, ...prev };
    for (const [k, v] of Object.entries(next)) {
      if (v && !prev[k]) {
        out[k] = true;
        report.updated.push({ label: label(k), from: 'not proficient', to: 'proficient' });
      }
    }
    for (const [k, v] of Object.entries(prev)) {
      if (v && next[k] === false) report.kept.push({ label: label(k), from: 'proficient', to: 'not proficient' });
    }
    return out;
  };
  merged.armor_proficiencies = unionFlags(sheet.armor_proficiencies, pdf.armor_proficiencies, 'armor');
  merged.weapon_proficiencies = unionFlags(sheet.weapon_proficiencies, pdf.weapon_proficiencies, 'weapons');

  // ── What the DM wrote or decided: the sheet wins, blanks get filled ──
  const keepSheetText = (key: TextField, label: string) => {
    const prev = sheet[key] ?? '';
    const next = pdf[key] ?? '';
    if (!prev.trim()) {
      if (next.trim()) {
        merged[key] = next;
        report.updated.push({ label, from: '—', to: next });
      }
      return;
    }
    if (next.trim() && !sameText(prev, next)) report.kept.push({ label, from: prev, to: next });
  };
  keepSheetText('name', 'Name');
  keepSheetText('player_name', 'Player');
  keepSheetText('subclass', 'Subclass');
  keepSheetText('ac_source', 'AC source');
  keepSheetText('senses', 'Senses');
  keepSheetText('languages', 'Languages');
  keepSheetText('tool_proficiencies', 'Tools');
  keepSheetText('damage_resistances', 'Resistances');
  keepSheetText('damage_immunities', 'Damage immunities');
  keepSheetText('condition_immunities', 'Condition immunities');
  keepSheetText('spellcasting_ability', 'Spellcasting ability');
  keepSheetText('species', 'Species');
  keepSheetText('background', 'Background');

  // Class: take the PDF's line when it names the same classes (so multiclass
  // levels like "Ranger 4 / Rogue 1" stay current); a reskin keeps the sheet's.
  const pdfClass = pdf.class_name ?? '';
  if (pdfClass.trim()) {
    const classSet = (s: string) =>
      new Set(s.toLowerCase().split('/').map((p) => p.replace(/[^a-z]/g, '')).filter(Boolean));
    const pdfClasses = classSet(pdfClass);
    const reskinned = [...classSet(sheet.class_name ?? '')].some((c) => !pdfClasses.has(c));
    if (reskinned) {
      report.kept.push({ label: 'Class', from: sheet.class_name, to: pdfClass });
    } else if (!sameText(sheet.class_name, pdfClass)) {
      report.updated.push({ label: 'Class', from: sheet.class_name || '—', to: pdfClass });
      merged.class_name = pdfClass;
    }
  }

  // ── Spellcasting ──
  // Slots come from the class+level table, which only knows single-class
  // casters. Multiclass slots are set by hand, so they stay; so do the slots of
  // a reskinned or homebrew class the table doesn't recognise (PDF has none).
  const pdfHasSlots = pdf.spell_slots != null || pdf.pact_slot_level != null;
  const sheetSlots = describeSlots(sheet);
  const pdfSlots = describeSlots(pdf);
  if (pdfHasSlots && sheetSlots !== pdfSlots) {
    if (merged.is_multiclass) {
      report.kept.push({ label: 'Spell slots (multiclass — set by hand)', from: sheetSlots, to: pdfSlots });
    } else {
      report.updated.push({ label: 'Spell slots', from: sheetSlots, to: pdfSlots });
      merged.spell_slots = pdf.spell_slots ?? null;
      merged.pact_slot_level = pdf.pact_slot_level ?? null;
      merged.pact_slot_count = pdf.pact_slot_count ?? null;
    }
  }
  const spellsOnlyInPdf = diffSpells(sheet.spells, pdf.spells, pdf.spell_details, report);

  // Details for the spells on the sheet: the import's numbers win where it has
  // the spell; DM-added spells keep whatever details they had.
  const sheetSpellNames = Object.values(sheet.spells ?? {}).flat().filter((n) => n.trim());
  if (sheetSpellNames.length > 0 && (pdf.spell_details || sheet.spell_details)) {
    const details: Record<string, SpellEntry> = {};
    for (const name of sheetSpellNames) {
      const fromPdf = Object.values(pdf.spell_details ?? {}).find((d) => keyOf(d.name) === keyOf(name));
      const fromSheet = Object.values(sheet.spell_details ?? {}).find((d) => keyOf(d.name) === keyOf(name));
      const detail = fromPdf ?? fromSheet;
      // A description from an earlier Beyond JSON survives a re-upload without one.
      const description = fromPdf?.description ?? fromSheet?.description;
      if (detail) details[name] = { ...detail, name, ...(description ? { description } : {}) };
    }
    merged.spell_details = details;
  }

  if (pdf.weapon_masteries && pdf.weapon_masteries.length > 0) {
    const describe = (list: PlayerCharacter['weapon_masteries']) =>
      (list ?? []).map((m) => `${m.weapon}: ${m.mastery}`).join(', ') || 'none';
    if (describe(sheet.weapon_masteries) !== describe(pdf.weapon_masteries)) {
      report.updated.push({ label: 'Weapon masteries', from: describe(sheet.weapon_masteries), to: describe(pdf.weapon_masteries) });
    }
    merged.weapon_masteries = pdf.weapon_masteries;
  }
  // Derived numbers: the renderer recomputes their values; the import's labels and basis win.
  if (pdf.feature_dc) merged.feature_dc = pdf.feature_dc;
  if (pdf.grapple_shove_dc != null) merged.grapple_shove_dc = pdf.grapple_shove_dc;

  // ── Lists ──
  const attacks = mergeByName('Attacks', sheet.attacks, pdf.attacks, report, (s, p) => {
    const next = enrich(s, p, ['kind', 'tags']);
    if (p.atk_bonus && !sameText(s.atk_bonus, p.atk_bonus)) {
      report.updated.push({ label: `${s.name} to hit`, from: s.atk_bonus || '—', to: p.atk_bonus });
      next.atk_bonus = p.atk_bonus;
    }
    if (p.damage && !sameText(s.damage, p.damage)) {
      report.updated.push({ label: `${s.name} damage`, from: s.damage || '—', to: p.damage });
      next.damage = p.damage;
    }
    if (!s.damage_type && p.damage_type) next.damage_type = p.damage_type;
    if (!s.notes && p.notes) next.notes = p.notes;
    return next;
  });
  const resources = mergeByName('Class resources', sheet.class_resources, pdf.class_resources, report, (s, p) => {
    const next = enrich(s, p, ['pool', 'source']);
    if (p.uses == null || p.uses === s.uses) return next;
    report.updated.push({ label: `${s.name} uses`, from: String(s.uses), to: String(p.uses) });
    return { ...next, uses: p.uses };
  });
  // A summary still equal to what the seeder makes of the stored feature was
  // never edited, so it follows the import (its numbers move with level).
  // One the DM rewrote stays.
  const untouched = (s: FeatureEntry) => !s.summary || s.summary === featureSummary(s, summaryContext(sheet, s.group));
  const withStructure = (s: FeatureEntry, p: FeatureEntry): FeatureEntry => {
    const next: FeatureEntry = { ...s };
    // Text from an earlier Beyond JSON outlasts a re-upload without one (the PDF truncates).
    const keepJsonText = s.text_source === 'json' && p.text_source !== 'json';
    for (const k of FEATURE_V3_KEYS) {
      if (keepJsonText && (k === 'full_text' || k === 'text_source' || k === 'option_details')) continue;
      if (p[k] != null) (next as unknown as Record<string, unknown>)[k] = p[k];
    }
    if (p.summary && untouched(s)) next.summary = p.summary;
    return next;
  };
  const features = mergeByName('Class features', sheet.class_features, pdf.class_features, report, withStructure);
  const traits = mergeByName('Species traits', sheet.racial_traits, pdf.racial_traits, report, withStructure);
  const feats = mergeByName('Feats', sheet.feats, pdf.feats, report, withStructure);
  const equipment = mergeByName('Equipment', sheet.equipment, pdf.equipment, report, (s, p) => {
    const next = enrich(s, p, ['tags']);
    if (p.qty != null && p.qty !== s.qty) {
      report.updated.push({ label: `${s.name} quantity`, from: String(s.qty), to: String(p.qty) });
      next.qty = p.qty;
    }
    if (!s.weight && p.weight) next.weight = p.weight;
    return next;
  });
  merged.attacks = attacks.merged;
  merged.class_resources = resources.merged;
  merged.class_features = features.merged;
  merged.racial_traits = traits.merged;
  merged.feats = feats.merged;
  merged.equipment = equipment.merged;

  const offered: PdfOnlyGroup[] = [
    { section: 'class_features', label: 'Class features', items: features.pdfOnly },
    { section: 'spells', label: 'Spells', items: spellsOnlyInPdf },
    { section: 'attacks', label: 'Attacks', items: attacks.pdfOnly },
    { section: 'class_resources', label: 'Class resources', items: resources.pdfOnly },
    { section: 'feats', label: 'Feats', items: feats.pdfOnly },
    { section: 'racial_traits', label: 'Species traits', items: traits.pdfOnly },
    { section: 'equipment', label: 'Equipment', items: equipment.pdfOnly },
  ];
  report.pdfOnly = offered.filter((g) => g.items.length > 0);

  // Per-class entries always follow the merged (DM-owned) class line.
  merged.classes = deriveClasses(merged.class_name ?? '', merged.level, merged.subclass ?? '');

  return { merged, report };
}
