// D&D Beyond character-sheet parser: PDF form fields in, character out
// (docs/character-sheet-spec-v3.md §3). Pure — no I/O; the upload route and
// scripts/parse-fixtures.ts both feed it extractFormFields' output.
//
// Lossless and structured: nothing is summarised here, the renderer decides
// what to show. The export supplies the character's selections and computed
// numbers; the class reference table fills what the export omits.

import { getProgressionForClasses } from '@/data/spell-progression';
import {
  classReferenceFor,
  featureKey,
  isClassFeature,
  type Ability,
  type AbilityMods,
  type ClassReference,
} from '@/data/class-reference';
import { MASTERY_PROPERTIES, standardWeapon } from '@/data/weapons';
import type {
  ActionType,
  AttackEntry,
  ClassLevel,
  ClassResource,
  EquipmentEntry,
  FeatureActivation,
  FeatureDc,
  FeatureEntry,
  FeatureUses,
  PlayerCharacter,
  ProficiencyLevel,
  SpellEntry,
  WeaponMastery,
} from '@/types';
import type { PdfFormFields } from './pdf-form-fields';

export type ParsedCharacter = Omit<PlayerCharacter, 'id' | 'campaign_id' | 'created_at' | 'updated_at' | 'pdf_url'>;

export interface ParseResult {
  character: ParsedCharacter;
  /** What the DM should know about this import: gaps filled, lines merged, Beyond-side problems. */
  notices: string[];
}

type Fields = Record<string, string>;

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_NAMES = new Set(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']);
const ORDINAL = ['cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const PREPARED_CASTERS = ['cleric', 'druid', 'paladin', 'wizard', 'artificer'];

// ──────────────────────────────────────────────────────────────────────────
// Small helpers
// ──────────────────────────────────────────────────────────────────────────

function int(val: string | undefined, fallback = 0): number {
  if (!val) return fallback;
  const n = parseInt(val.replace(/[^-\d]/g, ''), 10);
  return isNaN(n) ? fallback : n;
}

function field(fields: Fields, ...names: string[]): string {
  for (const name of names) {
    if (fields[name]) return fields[name];
  }
  return '';
}

/** Field lookup ignoring the stray spaces Beyond leaves in some names ("Wpn2 AtkBonus  "). */
function looseField(fields: Fields, name: string): string {
  const want = name.replace(/\s+/g, '').toLowerCase();
  for (const [k, v] of Object.entries(fields)) {
    if (k.replace(/\s+/g, '').toLowerCase() === want) return v;
  }
  return '';
}

const abilityMod = (score: number) => Math.floor((score - 10) / 2);
const modStr = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Of|The|And)\b/g, (w, _m, offset) => (offset === 0 ? w : w.toLowerCase()));
}

/** Strip a trailing source tag: "Path of the Storm Herald (XGtE)" → "Path of the Storm Herald". */
function stripSourceTag(s: string): string {
  return s.replace(/\s*\([A-Za-z0-9-]+\)\s*$/, '').trim();
}

function toAction(raw: string): ActionType | null {
  const t = raw.trim().toLowerCase();
  if (/^(1\s+)?bonus action$/.test(t)) return 'bonus';
  if (/^(1\s+)?reaction$/.test(t)) return 'reaction';
  if (/^(1\s+)?action$/.test(t)) return 'action';
  if (t === 'special') return 'special';
  if (t === 'no action' || /^\d+\s+(minute|minutes|hour|hours)$/.test(t)) return 'none';
  return null;
}

/**
 * Join FeaturesTraits1..N (or Actions1..N). Beyond splits fields mid-sentence,
 * so most boundaries join with a space — but a heading or `|` line on either
 * side of the boundary must stay on its own line, as must a field that opens
 * with an entry for `startsEntry` (the Actions block's unindented names).
 */
function joinFields(fields: Fields, prefix: string, startsEntry?: (firstLine: string) => boolean): string {
  const STRUCTURAL = /^\s*(\*|\||===)/;
  let out = '';
  for (let i = 1; i <= 30; i++) {
    const part = fields[`${prefix}${i}`];
    if (!part) continue;
    if (!out) {
      out = part;
      continue;
    }
    const lastLine = out.slice(out.lastIndexOf('\n') + 1);
    const firstLine = part.split('\n', 1)[0].trim();
    const newLine = STRUCTURAL.test(lastLine) || STRUCTURAL.test(firstLine) || Boolean(startsEntry?.(firstLine));
    out = out.replace(/\s+$/, '') + (newLine ? '\n' : ' ') + part.replace(/^\s+/, '');
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Identity, abilities, proficiencies
// ──────────────────────────────────────────────────────────────────────────

/** "Wizard 5 / Rogue 3" (older exports: "Fighter 3 (Eldritch Knight)"). */
function parseClasses(raw: string): ClassLevel[] {
  return raw
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const subclass = part.match(/\(([^)]+)\)/)?.[1]?.trim() ?? '';
      const m = part.replace(/\([^)]*\)/g, '').trim().match(/^(.+?)\s+(\d+)$/);
      return m
        ? { class_name: m[1].trim(), level: parseInt(m[2], 10), subclass }
        : { class_name: part, level: 1, subclass };
    });
}

const SKILLS: Record<string, { field: string; prof: string; ability: Ability }> = {
  acrobatics: { field: 'Acrobatics', prof: 'AcrobaticsProf', ability: 'dex' },
  animal_handling: { field: 'Animal', prof: 'AnimalHandlingProf', ability: 'wis' },
  arcana: { field: 'Arcana', prof: 'ArcanaProf', ability: 'int' },
  athletics: { field: 'Athletics', prof: 'AthleticsProf', ability: 'str' },
  deception: { field: 'Deception', prof: 'DeceptionProf', ability: 'cha' },
  history: { field: 'History', prof: 'HistoryProf', ability: 'int' },
  insight: { field: 'Insight', prof: 'InsightProf', ability: 'wis' },
  intimidation: { field: 'Intimidation', prof: 'IntimidationProf', ability: 'cha' },
  investigation: { field: 'Investigation', prof: 'InvestigationProf', ability: 'int' },
  medicine: { field: 'Medicine', prof: 'MedicineProf', ability: 'wis' },
  nature: { field: 'Nature', prof: 'NatureProf', ability: 'int' },
  perception: { field: 'Perception', prof: 'PerceptionProf', ability: 'wis' },
  performance: { field: 'Performance', prof: 'PerformanceProf', ability: 'cha' },
  persuasion: { field: 'Persuasion', prof: 'PersuasionProf', ability: 'cha' },
  religion: { field: 'Religion', prof: 'ReligionProf', ability: 'int' },
  sleight_of_hand: { field: 'SleightofHand', prof: 'SleightOfHandProf', ability: 'dex' },
  stealth: { field: 'Stealth', prof: 'StealthProf', ability: 'dex' },
  survival: { field: 'Survival', prof: 'SurvivalProf', ability: 'wis' },
};

const SAVES: Record<Ability, { field: string; prof: string }> = {
  str: { field: 'ST Strength', prof: 'StrProf' },
  dex: { field: 'ST Dexterity', prof: 'DexProf' },
  con: { field: 'ST Constitution', prof: 'ConProf' },
  int: { field: 'ST Intelligence', prof: 'IntProf' },
  wis: { field: 'ST Wisdom', prof: 'WisProf' },
  cha: { field: 'ST Charisma', prof: 'ChaProf' },
};

/** Beyond's proficiency codes: P proficient, E expertise, H half (Jack of All Trades), • on saves. */
function profFromCode(code: string): ProficiencyLevel {
  const c = code.trim().toUpperCase();
  if (c === 'E') return 'expertise';
  if (c === 'H') return 'half';
  if (c === 'P' || c === '•') return 'proficient';
  return 'none';
}

/** Fallback for exports without *Prof fields: infer from the modifier's distance above the ability mod. */
function inferProficiency(total: number, abilityModifier: number, pb: number): ProficiencyLevel {
  const delta = total - abilityModifier;
  if (delta >= pb * 2 - Math.floor(pb / 2)) return 'expertise';
  if (delta >= pb - Math.floor(pb / 2)) return 'proficient';
  if (delta >= 1 && pb >= 2) return 'half';
  return 'none';
}

function parseProficiencies(fields: Fields, mods: AbilityMods, pb: number) {
  const skillMods: Record<string, number> = {};
  const saveMods: Record<string, number> = {};
  for (const [key, s] of Object.entries(SKILLS)) {
    if (fields[s.field]) skillMods[key] = int(fields[s.field]);
  }
  for (const ab of ABILITIES) saveMods[ab] = int(fields[SAVES[ab].field]);

  // Beyond's *Prof fields are authoritative when the export has them at all
  // (a missing one then means no proficiency); older exports need inference.
  const hasFlags = Object.keys(fields).some((k) => /Prof$/.test(k) && k !== 'ProfBonus');
  const skillProfs: Record<string, ProficiencyLevel> = {};
  for (const [key, s] of Object.entries(SKILLS)) {
    skillProfs[key] = hasFlags
      ? profFromCode(fields[s.prof] ?? '')
      : skillMods[key] == null
        ? 'none'
        : inferProficiency(skillMods[key], mods[s.ability], pb);
  }
  const saveProfs: Record<string, ProficiencyLevel> = {};
  for (const ab of ABILITIES) {
    saveProfs[ab] = hasFlags
      ? profFromCode(fields[SAVES[ab].prof] ?? '')
      : saveMods[ab] - mods[ab] >= pb - 1
        ? 'proficient'
        : 'none';
  }
  return { skillMods, saveMods, skillProfs, saveProfs };
}

/** Armor, weapons, tools, and languages from the ProficienciesLang block. */
function parseProficiencyBlock(fields: Fields) {
  const raw = field(fields, 'ProficienciesLang');
  const armor: Record<string, boolean> = { light: false, medium: false, heavy: false, shields: false };
  const weapons: Record<string, boolean> = { simple: false, martial: false };
  let languages = '';
  let tools = '';

  const sections = new Map<string, string>();
  const re = /===\s*(\w+)\s*===([\s\S]*?)(?====|$)/g;
  let m;
  while ((m = re.exec(raw)) !== null) sections.set(m[1].toUpperCase(), m[2].trim());

  // Items are comma-separated, but Beyond names some crossbows "Crossbow, Hand".
  const items = (text: string) => {
    const parts = text.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
    const out: string[] = [];
    for (const p of parts) {
      if (/^(hand|light|heavy)$/i.test(p) && out.length && /^crossbow$/i.test(out[out.length - 1])) {
        out[out.length - 1] = `${p} Crossbow`;
      } else out.push(p);
    }
    return out;
  };

  for (const item of items(sections.get('ARMOR') ?? '')) {
    const key = item.toLowerCase();
    if (/^light armor$/.test(key)) armor.light = true;
    else if (/^medium armor$/.test(key)) armor.medium = true;
    else if (/^heavy armor$/.test(key)) armor.heavy = true;
    else if (/^shields?$/.test(key)) armor.shields = true;
    else armor[key] = true;
  }
  // Specific weapons ride along as extra keys next to the simple/martial flags.
  for (const item of items(sections.get('WEAPONS') ?? '')) {
    const key = item.toLowerCase();
    if (/^simple weapons$/.test(key)) weapons.simple = true;
    else if (/^martial weapons$/.test(key)) weapons.martial = true;
    else weapons[key] = true;
  }
  if (sections.has('LANGUAGES')) languages = sections.get('LANGUAGES')!.replace(/\s*\n\s*/g, ' ');
  if (sections.has('TOOLS')) tools = sections.get('TOOLS')!.replace(/\s*\n\s*/g, ', ');
  return { armor, weapons, languages, tools };
}

function parseDefenses(fields: Fields) {
  const raw = field(fields, 'Defenses');
  let resistances = '';
  let immunities = '';
  let conditionImmunities = '';
  if (raw && !/^none$/i.test(raw.trim())) {
    for (const line of raw.split('\n').map((l) => l.trim())) {
      if (line.startsWith('Resistances -')) {
        resistances = line.replace('Resistances -', '').trim();
      } else if (line.startsWith('Immunities -')) {
        const val = line.replace('Immunities -', '').trim();
        // Beyond lists condition immunities ("Magical Sleep") on the same line as damage ones.
        if (/sleep|charmed|frightened|poisoned|paralyzed|stunned|exhaustion/i.test(val)) conditionImmunities = val;
        else immunities = val;
      }
    }
  }
  return { resistances, immunities, conditionImmunities };
}

function parseSpeed(raw: string): Record<string, string> {
  const speeds: Record<string, string> = {};
  for (const part of raw.split(',').map((s) => s.trim())) {
    const match = part.match(/(\d+\s*ft\.?)\s*\((\w+)\)/i);
    if (match) speeds[match[2].toLowerCase()] = match[1];
    else if (/\d+\s*ft/.test(part)) speeds.walking = part;
  }
  if (Object.keys(speeds).length === 0) speeds.walking = raw || '30 ft.';
  return speeds;
}

// ──────────────────────────────────────────────────────────────────────────
// Feature grammar (§3.2)
// ──────────────────────────────────────────────────────────────────────────

type SectionKind = 'class' | 'species' | 'feats' | 'other';
/** A paragraph's lines: one run of prose, or one line per "• bullet". */
type Paragraph = string[];

interface RawOption {
  name: string;
  paras: Paragraph[];
}

interface RawFeature {
  name: string;
  ref: string;
  group: string;
  section: SectionKind;
  parent?: string;
  paras: Paragraph[];
  options: RawOption[];
  activations: FeatureActivation[];
  masteries: WeaponMastery[];
  uses?: FeatureUses;
  action?: ActionType;
  subclassChoice?: string;
  kind?: FeatureEntry['kind'];
}

const MASTERY_SELECTION = new RegExp(`^(.+?)\\s*\\((${MASTERY_PROPERTIES.join('|')})\\)\\s*•\\s*(.*)$`, 'i');
const MASTERY_ACTIVATION = new RegExp(`^(${MASTERY_PROPERTIES.join('|')})\\s*\\(.+\\)$`, 'i');
/** Inline run-in heading that starts its own paragraph: "Drain. You regain…", "Smooth Talker. When…". */
const RUN_IN = /^[A-Z][\w’']*(?:\s+(?:[A-Z][\w’']*|of|the|and|a)){0,4}\.\s+[A-Z[]/;

function sectionFor(title: string, classes: ClassLevel[], species: string): { kind: SectionKind; group: string } {
  let m = title.match(/^(.+?)\s+FEATURES$/i);
  if (m) {
    const name = m[1];
    const cls = classes.find((c) => c.class_name.toLowerCase() === name.toLowerCase());
    return { kind: 'class', group: cls?.class_name ?? titleCase(name) };
  }
  m = title.match(/^(.+?)\s+(?:SPECIES|RACIAL)\s+TRAITS$/i);
  if (m) {
    return { kind: 'species', group: species.toLowerCase() === m[1].toLowerCase() ? species : titleCase(m[1]) };
  }
  if (/^FEATS$/i.test(title)) return { kind: 'feats', group: 'Feats' };
  return { kind: 'other', group: titleCase(title) };
}

function appendBody(target: { paras: Paragraph[] }, line: string, afterBlank: boolean) {
  const paras = target.paras;
  const current = paras[paras.length - 1];
  const lastIsBullet = current ? current[current.length - 1].startsWith('• ') : false;
  const bullet = line.match(/^•\s*(.*)$/);
  if (bullet) {
    if (!current || (afterBlank && !lastIsBullet)) paras.push([`• ${bullet[1]}`]);
    else current.push(`• ${bullet[1]}`);
  } else if (!current || afterBlank || lastIsBullet || RUN_IN.test(line)) {
    paras.push([line]);
  } else {
    current[current.length - 1] += ` ${line}`;
  }
}

function parseFeatureText(text: string, classes: ClassLevel[], species: string): RawFeature[] {
  const features: RawFeature[] = [];
  let section = { kind: 'other' as SectionKind, group: '' };
  let top: RawFeature | null = null; // latest "*" heading
  let owner: RawFeature | null = null; // latest "*" heading or "|" child feature
  let body: { paras: Paragraph[] } | null = null;
  let afterBlank = false;

  const newFeature = (name: string, ref: string): RawFeature => ({
    // "4: Weapon Mastery" is Beyond's level-4 entry for the same feature.
    name: name.replace(/^\d+:\s*/, '').trim(),
    ref: ref.trim(),
    group: section.group,
    section: section.kind,
    paras: [],
    options: [],
    activations: [],
    masteries: [],
  });

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      afterBlank = true;
      continue;
    }

    const sec = line.match(/^===\s*(.+?)\s*===$/);
    if (sec) {
      section = sectionFor(sec[1], classes, species);
      top = owner = null;
      body = null;
      afterBlank = false;
      continue;
    }

    const head = line.match(/^\*\s+(.+?)\s*(?:•\s*(.*))?$/);
    if (head) {
      const f = newFeature(head[1], head[2] ?? '');
      features.push(f);
      top = owner = f;
      body = f;
      afterBlank = false;
      continue;
    }

    const pipe = line.match(/^\|\s*(.*)$/);
    if (pipe && top && owner) {
      const content = pipe[1].trim();
      afterBlank = false;
      let m;

      // "| 3 / Long Rest • Special"
      if ((m = content.match(/^(\d+)\s*\/\s*(Long|Short)\s+Rest\s*•\s*(.*)$/i))) {
        owner.uses = { count: parseInt(m[1], 10), per: m[2].toLowerCase() as 'long' | 'short' };
        owner.action ??= toAction(m[3]) ?? undefined;
        continue;
      }
      // "| Luck Points: 3 / Long Rest • Special", "| Lay On Hands: Healing Pool: 25 / Long Rest • 1 Bonus Action"
      if ((m = content.match(/^(.+?):\s*(\d+)\s*\/\s*(Long|Short)\s+Rest\s*•\s*(.*)$/i))) {
        const label = m[1].split(':').pop()!.trim();
        owner.uses = { count: parseInt(m[2], 10), per: m[3].toLowerCase() as 'long' | 'short', label };
        if (/pool/i.test(m[1])) owner.uses.pool = true;
        owner.action ??= toAction(m[4]) ?? undefined;
        continue;
      }
      // "| Greatsword (Graze) •" — a weapon mastery selection
      if ((m = content.match(MASTERY_SELECTION))) {
        const mastery = MASTERY_PROPERTIES.find((p) => p.toLowerCase() === m![2].toLowerCase())!;
        owner.masteries.push({ weapon: m[1].trim(), mastery });
        const opt: RawOption = { name: `${m[1].trim()} (${mastery})`, paras: [] };
        owner.options.push(opt);
        body = opt;
        continue;
      }
      // "| Thirsting Blade • br-2024" (child feature) or "| Sea •" (chosen option)
      if ((m = content.match(/^(.+?)\s*•\s*(.*)$/))) {
        const name = m[1].trim();
        const ref = m[2].trim();
        if (ref && !ABILITY_NAMES.has(name.toLowerCase())) {
          const child = newFeature(name, ref);
          child.parent = top.name;
          features.push(child);
          owner = child;
          body = child;
        } else {
          const opt: RawOption = { name, paras: [] };
          owner.options.push(opt);
          body = opt;
        }
        continue;
      }
      // "| Flurry of Blows: 1 Bonus Action", "| Storm Aura: Sea: 1 Bonus Action"
      const colon = content.lastIndexOf(':');
      if (colon > 0) {
        const label = content.slice(0, colon).trim();
        const action = toAction(content.slice(colon + 1));
        // "Graze (Greatsword): 1 Action" restates a weapon property; "Slow (Whip):" gives no action.
        if (action && !MASTERY_ACTIVATION.test(label)) owner.activations.push({ label, action });
        continue;
      }
      // "| 1 Bonus Action"
      const bare = toAction(content);
      if (bare) {
        owner.action ??= bare;
        continue;
      }
      // "| Path of the Storm Herald (XGtE)" under "* Barbarian Subclass"
      if (/\bSubclass$/i.test(top.name)) {
        top.subclassChoice = stripSourceTag(content);
        continue;
      }
      const opt: RawOption = { name: content, paras: [] };
      owner.options.push(opt);
      body = opt;
      continue;
    }

    if (body) appendBody(body, line.replace(/\s{2,}/g, ' '), afterBlank);
    afterBlank = false;
  }
  return features;
}

const textOf = (paras: Paragraph[]) => paras.map((p) => p.join('\n')).join('\n\n');
const textLength = (paras: Paragraph[]) => textOf(paras).length;

/** Fold `from` into `into`: union options/activations/masteries, keep the longer body. */
function mergeInto(into: RawFeature, from: RawFeature) {
  if (textLength(from.paras) > textLength(into.paras)) into.paras = from.paras;
  for (const opt of from.options) {
    const existing = into.options.find((o) => featureKey(o.name) === featureKey(opt.name));
    if (!existing) into.options.push(opt);
    else if (textLength(opt.paras) > textLength(existing.paras)) existing.paras = opt.paras;
  }
  for (const a of from.activations) {
    if (!into.activations.some((b) => featureKey(b.label) === featureKey(a.label) && b.action === a.action)) {
      into.activations.push(a);
    }
  }
  for (const wm of from.masteries) {
    if (!into.masteries.some((x) => featureKey(x.weapon) === featureKey(wm.weapon))) into.masteries.push(wm);
  }
  into.uses ??= from.uses;
  into.action ??= from.action;
  into.ref ||= from.ref;
  into.subclassChoice ??= from.subclassChoice;
}

/** Merge duplicate headings within a group, then Feats-section copies of class features (Weapon Mastery). */
function mergeDuplicates(features: RawFeature[]): RawFeature[] {
  const out: RawFeature[] = [];
  const byGroup = new Map<string, RawFeature>();
  for (const f of features) {
    const key = `${f.group}|${f.parent ?? ''}|${featureKey(f.name)}`;
    const existing = byGroup.get(key);
    if (existing) mergeInto(existing, f);
    else {
      byGroup.set(key, f);
      out.push(f);
    }
  }
  return out.filter((f) => {
    if (f.section !== 'feats' || f.parent) return true;
    const classCopy = out.find((g) => g.section === 'class' && !g.parent && featureKey(g.name) === featureKey(f.name));
    if (!classCopy) return true;
    mergeInto(classCopy, f);
    return false;
  });
}

const CONTAINER_NAMES = [/^Core \w+ Traits$/i, /^\w+ Subclass$/i, /^Spellcasting$/i, /^Pact Magic$/i, /Spells$/i];
const EXCLUDED_NAMES = [
  /Ability Score Improvement/i,
  /Ability Score Increase/i,
  /^(Creature Type|Size|Speed|Darkvision|Languages|Age)$/i,
  /^Standard Actions$/i,
];
// Markers that make a short feature worth full treatment rather than a ribbon line.
const MECHANICAL_PATTERNS: RegExp[] = [
  /\d+\s*\/\s*(?:long|short)\s*rest/i,
  /\bper\s+(?:long|short)\s+rest/i,
  /\b(?:1|one|two|three|\d+)\s+actions?\b/i,
  /\bbonus\s+actions?\b/i,
  /\breactions?\b/i,
  /\bonce\s+per\s+(?:turn|round)\b/i,
  /\bd\d+\b/i,
  /\d+d\d+/,
  /\bDC\s*\d+/i,
  /\b(?:saving|ability)\s+throws?\b/i,
  /\b(?:advantage|disadvantage)\s+(?:on|against)\b/i,
  /\b(?:resistance|immunity|immune)\s+to\b/i,
  /\b(?:flying|swimming|climbing|burrow)\s+speed\b/i,
  /\b\d+\s*(?:ft|feet|foot)\b.*\b(?:range|radius|cone|line|cube|sphere)\b/i,
  /\bregain\s+(?:hit\s+points|.*spell\s+slots?|.*pact)/i,
  /\bspell\s+slots?\b/i,
  /\b(?:add|adds|extra|bonus)\b[\s\S]{0,40}\bdamage\b/i,
  /\bspend(?:ing)?\s+\d+/i,
  /\bregain\s+\d+/i,
];

function canonicalTextFor(f: RawFeature, refs: ClassReference[]): string | null {
  for (const ref of refs) {
    for (const [name, text] of Object.entries(ref.canonicalText)) {
      if (featureKey(name) === featureKey(f.name)) return text;
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Actions sections as the action-economy classifier (§3.4)
// ──────────────────────────────────────────────────────────────────────────

const ACTION_SECTIONS: Record<string, ActionType> = {
  ACTIONS: 'action',
  'BONUS ACTIONS': 'bonus',
  REACTIONS: 'reaction',
  SPECIAL: 'special',
};

/** An Actions-block entry name: short, unindented, no sentence punctuation ("Fast Hands: Utilize"). */
const isActionEntryName = (line: string) => line.length > 0 && line.length <= 60 && !/[.!?,;]$/.test(line);

function applyActionsSections(fields: Fields, find: (name: string) => RawFeature | undefined) {
  const text = joinFields(fields, 'Actions', (first) => isActionEntryName(first.replace(/\s*•.*$/, '')));
  let action: ActionType | null = null;
  for (const rawLine of text.split('\n')) {
    const sec = rawLine.trim().match(/^===\s*(.+?)\s*===$/);
    if (sec) {
      action = ACTION_SECTIONS[sec[1].toUpperCase()] ?? null;
      continue;
    }
    // Entry names sit at column 0; bodies are indented. Never take body text — it truncates.
    if (!action || !rawLine.trim() || /^\s/.test(rawLine)) continue;
    const name = rawLine.replace(/\s*•.*$/, '').trim();
    if (!isActionEntryName(name) || /^Standard Actions$/i.test(name)) continue;

    const direct = find(name);
    if (direct) {
      direct.action ??= action;
      continue;
    }
    const colon = name.indexOf(':');
    if (colon > 0) {
      const parent = find(name.slice(0, colon).trim());
      const label = name.slice(colon + 1).trim();
      if (parent && !parent.activations.some((a) => featureKey(a.label) === featureKey(label))) {
        parent.activations.push({ label, action }); // e.g. "Castigate: Shackle Flare", listed only here
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Spells (§3.6)
// ──────────────────────────────────────────────────────────────────────────

interface RawSpell extends SpellEntry {
  /** Whether this copy carries a 1/LR-style free cast. */
  freeCopy: boolean;
}

function parseSpellRows(input: PdfFormFields): RawSpell[] {
  const { fields, order } = input;
  const rows: RawSpell[] = [];
  let level = 0;
  for (const name of order) {
    const header = name.match(/^spellHeader\d+$/);
    if (header) {
      const val = fields[name];
      level = /cantrip/i.test(val) ? 0 : int(val.match(/(\d+)(?:st|nd|rd|th)/i)?.[1], 0);
      continue;
    }
    const row = name.match(/^spellName(\d+)$/);
    if (!row) continue;
    const i = row[1];
    const rawName = fields[name];
    const notes = fields[`spellNotes${i}`] ?? '';
    const duration = fields[`spellDuration${i}`] ?? '';
    const free = notes.match(/\b(\d+)\/(LR|SR)\b/i);
    const saveHit = fields[`spellSaveHit${i}`] ?? '';
    rows.push({
      name: rawName.replace(/\s*\[[^\]]*\]\s*$/, '').trim(),
      level,
      source: fields[`spellSource${i}`] ?? '',
      origin: 'other',
      always_prepared: (fields[`spellPrepared${i}`] ?? '').toUpperCase() === 'P',
      costs_slot: level > 0,
      ...(free ? { free_uses: { count: parseInt(free[1], 10), per: free[2].toUpperCase() === 'SR' ? 'short' : 'long' } } : {}),
      ritual: /\[R\]\s*$/i.test(rawName),
      concentration: /^concentration/i.test(duration),
      save_or_atk: saveHit === '--' ? '' : saveHit,
      casting_time: fields[`spellCastingTime${i}`] ?? '',
      range: fields[`spellRange${i}`] ?? '',
      components: fields[`spellComponents${i}`] ?? '',
      duration,
      notes,
      page_ref: fields[`spellPage${i}`] ?? '',
      freeCopy: Boolean(free),
    } as RawSpell);
  }
  return rows;
}

/** Slot counts printed in the export's spell-level headers ("4 Slots OOOO", "2 Pact OO"). */
function exportedSlotHeaders({ fields, order }: PdfFormFields): string {
  let level = 0;
  const parts: string[] = [];
  for (const name of order) {
    if (/^spellHeader\d+$/.test(name)) level = /cantrip/i.test(fields[name]) ? 0 : int(fields[name], 0);
    else if (/^spellSlotHeader\d+$/.test(name) && level > 0) {
      const count = fields[name].match(/^(\d+)/);
      if (count) parts.push(count[1]);
    }
  }
  return parts.join('/');
}

// ──────────────────────────────────────────────────────────────────────────
// Attacks (§3.5) and equipment (§3.7)
// ──────────────────────────────────────────────────────────────────────────

function parseWeaponRows(fields: Fields): AttackEntry[] {
  const rows: AttackEntry[] = [];
  for (let i = 1; i <= 8; i++) {
    const name = field(fields, i === 1 ? 'Wpn Name' : `Wpn Name ${i}`);
    if (!name) continue;
    const damage = looseField(fields, `Wpn${i} Damage`);
    const dmg = damage.match(/^(.+?)\s+([A-Za-z]+)$/);
    let notes = looseField(fields, `Wpn Notes ${i}`);

    const range = notes.match(/Range \(([^)]+)\)/i)?.[1].replace(/\s*ft\.?$/i, '').trim() ?? '';
    const tags = MASTERY_PROPERTIES.filter((p) => new RegExp(`(^|,\\s*)${p}(\\s*,|$)`).test(notes));
    notes = notes
      .replace(/Range \([^)]+\)/i, '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s !== 'Special:' && !(MASTERY_PROPERTIES as readonly string[]).includes(s))
      .join(', ')
      .replace(/^Special:\s*/, '');

    rows.push({
      name,
      atk_bonus: looseField(fields, `Wpn${i} AtkBonus`),
      damage: dmg ? dmg[1] : damage,
      damage_type: dmg ? dmg[2] : '',
      range,
      notes,
      kind: /unarmed strike|flurry of blows/i.test(name) ? 'unarmed' : 'weapon',
      ...(tags.length ? { tags: [...tags] } : {}),
    });
  }
  return rows;
}

const ATTUNEMENT_CANDIDATE =
  /\+\d|^enspelled\b|\b(?:ring|cloak|amulet|wand|staff|rod|boots|gloves|gauntlets|bracers|belt|circlet|headband|helm|necklace|periapt|brooch|ioun stone|figurine|bag|horn|lantern|mantle|medallion|talisman|tome|manual)\s+of\b/i;

function parseEquipment(fields: Fields): { items: EquipmentEntry[]; combined: string[] } {
  const rows: EquipmentEntry[] = [];
  for (let i = 0; i <= 80; i++) {
    const name = fields[`Eq Name${i}`];
    if (!name) continue;
    const weight = fields[`Eq Weight${i}`] ?? '';
    rows.push({ name, qty: int(fields[`Eq Qty${i}`], 1), weight: weight === '--' ? '' : weight });
  }

  // Identical names group; so do unit variants ("Rations (1 day)" with "Rations").
  const UNIT = /\s*\(\d+\s*(?:day|days|feet|foot|ft\.?|pieces?)\)\s*$/i;
  const groups = new Map<string, EquipmentEntry[]>();
  for (const r of rows) {
    const key = r.name.replace(UNIT, '').trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const items: EquipmentEntry[] = [];
  const combined: string[] = [];
  for (const members of groups.values()) {
    const names = new Set(members.map((m) => m.name));
    const name = names.size === 1 ? members[0].name : members[0].name.replace(UNIT, '').trim();
    const qty = members.reduce((sum, m) => sum + m.qty, 0);
    const pounds = members.map((m) => (m.weight ? m.weight.match(/^(\d+(?:\.\d+)?)\s*lb/i)?.[1] : '0'));
    const weight = pounds.every((p) => p != null)
      ? `${Math.round(pounds.reduce((sum, p) => sum + parseFloat(p!), 0) * 100) / 100} lb.`
      : members.find((m) => m.weight)?.weight ?? '';
    const item: EquipmentEntry = { name, qty, weight: weight === '0 lb.' ? '' : weight };
    if (ATTUNEMENT_CANDIDATE.test(name)) item.tags = ['attunement?'];
    items.push(item);
    if (members.length > 1) combined.push(`${name} ×${qty}`);
  }
  return { items, combined };
}

// ──────────────────────────────────────────────────────────────────────────
// Main entry
// ──────────────────────────────────────────────────────────────────────────

export function parseDdbCharacter(input: PdfFormFields): ParseResult {
  const { fields } = input;
  const notices: string[] = [];
  // What the class reference supplied, per feature, reported as one notice each.
  const filled = new Map<string, string[]>();
  const noteFilled = (name: string, what: string) => filled.set(name, [...(filled.get(name) ?? []), what]);

  // ── Identity and core numbers ──
  const classes = parseClasses(field(fields, 'CLASS  LEVEL', 'CLASS  LEVEL2'));
  const species = field(fields, 'RACE', 'RACE2');
  const background = field(fields, 'BACKGROUND', 'BACKGROUND2');
  const totalLevel = classes.reduce((sum, c) => sum + c.level, 0) || 1;
  const pb = int(fields['ProfBonus'], 2);
  const scores = Object.fromEntries(ABILITIES.map((a) => [a, int(fields[a.toUpperCase()], 10)])) as Record<Ability, number>;
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, abilityMod(scores[a])])) as AbilityMods;
  const proficiencies = parseProficiencies(fields, mods, pb);
  const profBlock = parseProficiencyBlock(fields);
  const defenses = parseDefenses(fields);
  const equipment = parseEquipment(fields);
  if (equipment.combined.length > 0) {
    notices.push(`Combined duplicate inventory lines: ${equipment.combined.join(', ')}.`);
  }

  // ── Features ──
  // A field that opens with a run-in heading ("Step of the Wind. You can…") starts a new paragraph.
  let raw = parseFeatureText(joinFields(fields, 'FeaturesTraits', (first) => RUN_IN.test(first)), classes, species);
  for (const f of raw) {
    const m = f.name.match(/^(.+?)\s+Subclass$/i);
    if (!m || !f.subclassChoice) continue;
    const cls = classes.find((c) => c.class_name.toLowerCase() === m[1].toLowerCase()) ?? classes.find((c) => c.class_name === f.group);
    if (cls) cls.subclass = f.subclassChoice;
  }
  raw = mergeDuplicates(raw);

  const find = (name: string): RawFeature | undefined => {
    const key = featureKey(name);
    return (
      raw.find((f) => featureKey(f.name) === key) ??
      // "Deflect Attack: …" activations belong to "Deflect Attacks".
      raw.find((f) => featureKey(f.name).replace(/s$/, '') === key.replace(/s$/, ''))
    );
  };

  // Activations named "X: Y" belong to feature X, labelled Y ("Channel Divinity: Incite" sits under Incite).
  const moves: { target: RawFeature; activation: FeatureActivation }[] = [];
  for (const f of raw) {
    f.activations = f.activations.filter((a) => {
      const colon = a.label.indexOf(':');
      const target = colon > 0 ? find(a.label.slice(0, colon)) : undefined;
      if (!target) return true;
      moves.push({ target, activation: { label: a.label.slice(colon + 1).trim(), action: a.action } });
      return false;
    });
  }
  for (const { target, activation } of moves) {
    if (!target.activations.some((b) => featureKey(b.label) === featureKey(activation.label))) {
      target.activations.push(activation);
    }
  }
  applyActionsSections(fields, find);
  // Extra Attack and Thirsting Blade are what "attack twice" hangs off.
  for (const f of raw) {
    if (/^(Extra Attack|Thirsting Blade)$/i.test(f.name)) f.action ??= 'action';
  }

  const refs = classes.map((c) => classReferenceFor(c.class_name)).filter((r): r is ClassReference => r != null);
  const kept: RawFeature[] = [];
  const droppedEmpty: string[] = [];
  for (const f of raw) {
    if (EXCLUDED_NAMES.some((re) => re.test(f.name))) continue;
    const isContainer =
      CONTAINER_NAMES.some((re) => re.test(f.name)) || (/^Weapon Mastery$/i.test(f.name) && f.options.length === 0);
    const hasBody = f.paras.length > 0;
    const hasDetail = f.uses || f.action || f.activations.length > 0 || f.options.some((o) => o.paras.length > 0);
    // The empty-body test runs before any table text is added; the table rescues what it knows (Rage).
    if (!hasBody && !hasDetail) {
      const canonical = canonicalTextFor(f, refs);
      if (!canonical) {
        if (!isContainer && !f.parent) droppedEmpty.push(f.name);
        continue;
      }
      f.paras = canonical.split('\n\n').map((p) => [p]);
      noteFilled(f.name, 'description');
    }
    if (isContainer) {
      f.kind = 'container';
    } else {
      const text = textOf(f.paras);
      const mechanical =
        f.uses || f.action || f.activations.length > 0 || f.options.some((o) => o.paras.length > 0) ||
        text.length >= 160 || MECHANICAL_PATTERNS.some((re) => re.test(text) || re.test(f.name));
      f.kind = mechanical ? 'mechanical' : 'ribbon';
    }
    kept.push(f);
  }
  if (droppedEmpty.length > 0) {
    notices.push(`No text in the export, left off the sheet: ${droppedEmpty.join(', ')}.`);
  }
  // Children of containers are lifted to the group.
  for (const f of kept) {
    if (f.parent && kept.some((p) => p.kind === 'container' && featureKey(p.name) === featureKey(f.parent!))) {
      f.parent = undefined;
    }
  }

  // ── Weapon masteries: keep PHB weapons and anything the character carries ──
  const carried = new Set(
    [...equipment.items.map((e) => e.name), ...parseWeaponRows(fields).map((a) => a.name)].map((n) =>
      standardWeapon(n) ?? featureKey(n),
    ),
  );
  const weaponMasteries: WeaponMastery[] = [];
  for (const f of kept) {
    for (const wm of f.masteries) {
      const known = standardWeapon(wm.weapon) != null || carried.has(featureKey(wm.weapon));
      if (!known) {
        f.options = f.options.filter((o) => !o.name.startsWith(`${wm.weapon} (`));
        notices.push(`Ignored the ${wm.weapon} (${wm.mastery}) mastery: not a PHB weapon and not in the inventory.`);
      } else if (!weaponMasteries.some((x) => featureKey(x.weapon) === featureKey(wm.weapon))) {
        weaponMasteries.push(wm);
      }
    }
  }

  // ── Spells ──
  const invocationText = kept
    .filter((f) => featureKey(f.parent ?? '') === 'eldritch invocations')
    .map((f) => textOf(f.paras).toLowerCase());
  const spellOrigin = (source: string): SpellEntry['origin'] => {
    const base = source.replace(/\s*\(Always Prepared\)\s*$/i, '').trim();
    const key = featureKey(base);
    if (classes.some((c) => featureKey(c.class_name) === key)) return 'class';
    if (key === 'eldritch invocations') return 'invocation';
    const owner = raw.find((f) => featureKey(f.name) === key);
    if (owner?.section === 'feats') return 'feat';
    if (owner?.section === 'species' || /lineage|legacy|heritage/i.test(base)) return 'species';
    if (owner?.parent && featureKey(owner.parent) === 'eldritch invocations') return 'invocation';
    if (owner?.section === 'class') {
      const ref = classReferenceFor(owner.group);
      return ref && isClassFeature(ref, base) ? 'class' : 'subclass';
    }
    if (/Spells$/i.test(base)) return 'subclass';
    if (equipment.items.some((e) => featureKey(e.name) === key)) return 'item';
    return 'other';
  };

  const spellDetails: Record<string, SpellEntry> = {};
  const bySpell = new Map<string, RawSpell[]>();
  for (const s of parseSpellRows(input)) {
    s.origin = spellOrigin(s.source);
    if (s.level === 0) s.costs_slot = false;
    else if (s.origin === 'invocation') {
      // Pact of the Tome rituals and at-will invocations ("Mask of Many Faces") never take a slot.
      const atWill = invocationText.some(
        (t) => t.includes(`${s.name.toLowerCase()} without expending a spell slot`) || t.includes(`${s.name.toLowerCase()} at will`),
      );
      if (s.ritual || atWill) s.costs_slot = false;
    }
    bySpell.set(s.name.toLowerCase(), [...(bySpell.get(s.name.toLowerCase()) ?? []), s]);
  }
  for (const copies of bySpell.values()) {
    // Prefer the always-prepared copy's attribution ("Charm Person" via Beguiling Magic).
    const primary = copies.find((c) => c.always_prepared) ?? copies[0];
    const { freeCopy: _unused, ...entry } = primary;
    void _unused;
    entry.always_prepared = copies.some((c) => c.always_prepared);
    entry.ritual = copies.some((c) => c.ritual);
    entry.concentration = copies.some((c) => c.concentration);
    const free = copies.find((c) => c.free_uses)?.free_uses;
    if (free) entry.free_uses = free;
    else delete entry.free_uses;
    // A spell costs a slot unless every copy of it is a free cast or an at-will/ritual-only grant.
    entry.costs_slot = copies.some((c) => c.costs_slot && !c.freeCopy);
    for (const k of ['save_or_atk', 'casting_time', 'range', 'components', 'duration', 'notes', 'page_ref'] as const) {
      if (!entry[k]) entry[k] = copies.find((c) => c[k])?.[k] ?? '';
    }
    spellDetails[entry.name] = entry;
  }
  const spellList = Object.values(spellDetails);
  const spellsByLevel: Record<string, string[]> = {};
  for (const s of spellList) (spellsByLevel[String(s.level)] ??= []).push(s.name);

  // Slots always come from the class table; the export only prints levels that have a spell listed.
  const progression = getProgressionForClasses(classes);
  const exportedSlots = exportedSlotHeaders(input);
  const tableSlots = Object.values(progression.spellSlots ?? {}).filter((n) => n > 0).join('/');
  if (exportedSlots && tableSlots && exportedSlots !== tableSlots && progression.pactSlotLevel == null) {
    notices.push(`Spell slots ${tableSlots} come from the class table; the export only lists ${exportedSlots}.`);
  }
  const preparedCaster = classes.some((c) => PREPARED_CASTERS.includes(c.class_name.toLowerCase()));

  // ── Resources: export uses lines, then the class table, free casts, pact slots ──
  const recoveryOf = (per: FeatureUses['per']) => (per === 'short' ? 'Short Rest' : 'Long Rest');
  const resourceFor = (f: RawFeature): ClassResource => ({
    name: f.uses!.label && !/pool$/i.test(f.uses!.label) ? f.uses!.label : f.name,
    uses: f.uses!.count,
    recovery: recoveryOf(f.uses!.per),
    ...(f.uses!.die ? { die: f.uses!.die } : {}),
    ...(f.uses!.pool ? { pool: true } : {}),
    source: 'pdf',
  });
  const resourceOwners = new Map<ClassResource, RawFeature>();
  const resources: ClassResource[] = [];
  for (const f of kept) {
    if (!f.uses) continue;
    const r = resourceFor(f);
    resources.push(r);
    resourceOwners.set(r, f);
  }

  for (const cls of classes) {
    const ref = classReferenceFor(cls.class_name);
    if (!ref) continue;
    for (const rule of ref.resources) {
      if (rule.subclass && featureKey(rule.subclass) !== featureKey(stripSourceTag(cls.subclass))) continue;
      const count = rule.uses(cls.level, mods);
      if (count <= 0) continue;
      const featureName = rule.feature ?? rule.name;
      const die = rule.die?.(cls.level);

      // A structured "|" uses line is authoritative; the table only adds a missing die.
      const existing = resources.find(
        (r) => featureKey(r.name) === featureKey(rule.name) || featureKey(resourceOwners.get(r)?.name ?? '') === featureKey(featureName),
      );
      if (existing) {
        if (die && !existing.die) existing.die = die;
        if (rule.pool) existing.pool = true;
        continue;
      }

      let owner = kept.find((f) => featureKey(f.name) === featureKey(featureName));
      if (!owner && rule.core) {
        const text = ref.canonicalText[featureName] ?? '';
        owner = {
          name: featureName,
          ref: '',
          group: cls.class_name,
          section: 'class',
          paras: text ? text.split('\n\n').map((p) => [p]) : [],
          options: [],
          activations: [],
          masteries: [],
          kind: 'mechanical',
        };
        kept.push(owner);
        noteFilled(featureName, 'the whole feature, which the export omits');
      }
      if (!owner) continue; // never invent a feature the export doesn't name, unless it's core

      const per = /short/i.test(rule.recovery(cls.level)) && !/long/i.test(rule.recovery(cls.level)) ? 'short' : 'long';
      owner.uses ??= { count, per, ...(rule.pool ? { pool: true } : {}), ...(die ? { die } : {}) };
      if (rule.action) owner.action ??= rule.action;
      if (owner.kind === 'ribbon') owner.kind = 'mechanical';
      const r: ClassResource = {
        name: rule.name,
        uses: count,
        recovery: rule.recovery(cls.level),
        ...(die ? { die } : {}),
        ...(rule.pool ? { pool: true } : {}),
        source: 'table',
      };
      resources.push(r);
      resourceOwners.set(r, owner);
      noteFilled(owner.name, `uses (${count}, ${r.recovery})`);
    }
  }

  for (const s of spellList) {
    if (!s.free_uses || resources.some((r) => featureKey(r.name).includes(featureKey(s.name)))) continue;
    resources.push({ name: `${s.name} (free cast)`, uses: s.free_uses.count, recovery: recoveryOf(s.free_uses.per), source: 'pdf' });
  }
  if (progression.pactSlotLevel != null && progression.pactSlotCount != null) {
    resources.unshift({
      name: `Pact slots (${ORDINAL[progression.pactSlotLevel]} level)`,
      uses: progression.pactSlotCount,
      recovery: 'Short Rest',
      source: 'table',
    });
  }
  // Heroic Inspiration from Resourceful (Human) or Musician.
  if (kept.some((f) => /heroic inspiration whenever you finish a long rest/i.test(textOf(f.paras)))) {
    resources.push({ name: 'Heroic Inspiration', uses: 1, recovery: 'Long Rest', source: 'pdf' });
  }

  // ── Attacks ──
  const cantrips = new Set(spellList.filter((s) => s.level === 0).map((s) => s.name.toLowerCase()));
  let attacks = parseWeaponRows(fields).map((a): AttackEntry => {
    if (!cantrips.has(a.name.toLowerCase())) return a;
    const spell = spellDetails[spellList.find((s) => s.name.toLowerCase() === a.name.toLowerCase())!.name];
    return { ...a, kind: 'spell', range: a.range || spell.range };
  });
  attacks = attacks.filter(
    (a, i) =>
      attacks.findIndex(
        (b) => b.name === a.name && b.atk_bonus === a.atk_bonus && b.damage === a.damage && b.notes === a.notes,
      ) === i,
  );
  if (attacks.length > 1) {
    // A 0-damage Unarmed Strike is noise once the character has any other attack.
    attacks = attacks.filter((a) => !(a.kind === 'unarmed' && /^0$/.test(a.damage.trim())));
  }

  const bite = kept.find((f) => /^vampiric bite$/i.test(f.name));
  if (bite) {
    const dice = textOf(bite.paras).match(/(\d+d\d+)\s*\+\s*(\d+)/);
    const unarmed = attacks.find((a) => /^unarmed strike$/i.test(a.name));
    attacks.push({
      name: 'Vampiric Bite',
      atk_bonus: unarmed?.atk_bonus || modStr(mods.str + pb),
      damage: dice ? `${dice[1]}+${dice[2]}` : '1d4',
      damage_type: 'Piercing',
      range: '',
      notes: 'replaces an Unarmed Strike; empower with Drain or Strengthen',
      kind: 'unarmed',
      ...(bite.uses ? { tags: [`${bite.uses.count} / ${bite.uses.per} rest`] } : {}),
    });
  }

  for (const cls of classes) {
    const ref = classReferenceFor(cls.class_name);
    for (const rider of ref?.riders ?? []) {
      const feature = kept.find((f) => featureKey(f.name) === featureKey(rider.requires));
      const spell = spellList.find((s) => featureKey(s.name) === featureKey(rider.requires));
      if (!feature && !spell) continue;
      const fromText = rider.textDie && feature ? textOf(feature.paras).match(rider.textDie)?.[1] : undefined;
      const tags: string[] = [];
      if (spell?.free_uses) tags.push(`free ${spell.free_uses.count}/${spell.free_uses.per === 'short' ? 'SR' : 'LR'}`);
      if (spell?.costs_slot) tags.push('slot');
      attacks.push({
        name: rider.name,
        atk_bonus: '',
        damage: fromText ?? rider.damage(cls.level),
        damage_type: rider.name === 'Divine Smite' ? 'Radiant' : '',
        range: '',
        notes: rider.note,
        kind: 'rider',
        ...(tags.length ? { tags } : {}),
      });
    }
  }
  const KIND_ORDER = { weapon: 0, unarmed: 1, spell: 2, rider: 3 };
  attacks.sort((a, b) => KIND_ORDER[a.kind ?? 'weapon'] - KIND_ORDER[b.kind ?? 'weapon']);

  // ── DCs ──
  const martialArts = kept.some((f) => /^martial arts$/i.test(f.name));
  const grappleShoveDc = 8 + pb + (martialArts && mods.dex > mods.str ? mods.dex : mods.str);
  const primary = [...classes].sort((a, b) => b.level - a.level)[0];
  const primaryRef = primary ? classReferenceFor(primary.class_name) : null;
  const castsSpells = spellList.some((s) => s.origin !== 'species' && s.origin !== 'item');
  const spellDc = int(fields['spellSaveDC0'], 0) || 8 + pb + (mods[(field(fields, 'spellCastingAbility0').toLowerCase() || 'int') as Ability] ?? 0);
  let featureDc: FeatureDc = { label: 'Grapple/Shove DC', value: grappleShoveDc };
  const dcRule = primaryRef?.subclassFeatureDc?.[stripSourceTag(primary.subclass)] ?? primaryRef?.featureDc;
  if (castsSpells && (dcRule === 'spell' || refs.some((r) => r.featureDc === 'spell'))) {
    featureDc = { label: 'Spell DC', value: spellDc };
  } else if (dcRule && typeof dcRule === 'object') {
    const abilityMod = dcRule.ability === 'str-or-dex' ? Math.max(mods.str, mods.dex) : mods[dcRule.ability];
    featureDc = { label: dcRule.label, value: 8 + pb + abilityMod };
  }

  // ── Beyond-side problems worth fixing before re-export (§7) ──
  if (kept.some((f) => /^pact of the blade$/i.test(f.name))) {
    const chaAttack = mods.cha + pb;
    if (!attacks.some((a) => a.kind === 'weapon' && int(a.atk_bonus, -99) >= chaAttack)) {
      notices.push('Pact of the Blade is present but no weapon attack uses Charisma: bond the pact weapon in D&D Beyond and re-export.');
    }
  }

  // ── AC source: armor in the inventory, else Unarmored Defense ──
  const armor = equipment.items.find((e) => /\b(armor|mail|plate|breastplate|hide|padded)\b/i.test(e.name));
  const shield = equipment.items.some((e) => /\bshield\b/i.test(e.name));
  const acSource = armor
    ? `${armor.name}${shield ? ' + shield' : ''}`
    : kept.some((f) => /^unarmored defense$/i.test(f.name))
      ? 'Unarmored Defense'
      : 'no armor';

  // ── Assemble ──
  const toEntry = (f: RawFeature): FeatureEntry => {
    const paragraphs = f.paras.map((p) => p.join('\n'));
    const entry: FeatureEntry = {
      name: f.name,
      summary: paragraphs[0] ?? '',
      full_text: paragraphs.join('\n\n'),
      kind: f.kind,
      group: f.group,
    };
    if (f.parent) entry.parent = f.parent;
    if (f.action) entry.action = f.action;
    if (f.uses) entry.uses = f.uses;
    if (f.ref) entry.source_ref = f.ref;
    if (f.options.length > 0) {
      entry.options = f.options.map((o) => o.name);
      const details = f.options.filter((o) => o.paras.length > 0).map((o) => ({ name: o.name, text: textOf(o.paras) }));
      if (details.length > 0) entry.option_details = details;
    }
    if (f.activations.length > 0) entry.activations = f.activations;
    return entry;
  };
  const classFeatures = kept.filter((f) => f.section === 'class' || f.section === 'other').map(toEntry);
  const racialTraits = kept.filter((f) => f.section === 'species').map(toEntry);
  const feats = kept.filter((f) => f.section === 'feats').map(toEntry);

  const isMulticlass = classes.length > 1;
  const character: ParsedCharacter = {
    name: field(fields, 'CharacterName', 'CharacterName2'),
    player_name: field(fields, 'PLAYER NAME', 'PLAYER NAME2'),
    class_name: isMulticlass ? classes.map((c) => `${c.class_name} ${c.level}`).join(' / ') : classes[0]?.class_name ?? '',
    subclass: classes.map((c) => c.subclass).filter(Boolean).join(' / '),
    level: totalLevel,
    is_multiclass: isMulticlass,

    armor_class: int(fields['AC']),
    ac_source: acSource,
    initiative_modifier: int(fields['Init']),
    speeds: parseSpeed(field(fields, 'Speed')),
    hp_max: int(fields['MaxHP']),
    hit_dice_total: field(fields, 'Total'),
    proficiency_bonus: pb,

    passive_perception: int(fields['Passive1'], 10),
    passive_insight: fields['Passive2'] ? int(fields['Passive2']) : null,
    passive_investigation: fields['Passive3'] ? int(fields['Passive3']) : null,
    senses: field(fields, 'AdditionalSenses'),

    str_score: scores.str,
    dex_score: scores.dex,
    con_score: scores.con,
    int_score: scores.int,
    wis_score: scores.wis,
    cha_score: scores.cha,

    skill_modifiers: proficiencies.skillMods,
    save_modifiers: proficiencies.saveMods,
    skill_proficiencies: proficiencies.skillProfs,
    save_proficiencies: proficiencies.saveProfs,
    attacks,

    damage_resistances: defenses.resistances,
    damage_immunities: defenses.immunities,
    condition_immunities: defenses.conditionImmunities,

    armor_proficiencies: profBlock.armor,
    weapon_proficiencies: profBlock.weapons,
    languages: profBlock.languages,
    tool_proficiencies: profBlock.tools,

    is_spellcaster: spellList.length > 0,
    spellcasting_ability: field(fields, 'spellCastingAbility0') || null,
    spell_attack_bonus_override: null,
    spell_save_dc_override: null,
    spell_slots: progression.spellSlots,
    pact_slot_level: progression.pactSlotLevel,
    pact_slot_count: progression.pactSlotCount,
    spells: spellList.length > 0 ? spellsByLevel : null,
    is_prepared_caster: preparedCaster,
    prepared_spells: preparedCaster
      ? spellList.filter((s) => s.level > 0 && (s.origin === 'class' || s.origin === 'subclass')).map((s) => s.name)
      : null,

    class_resources: resources.length > 0 ? resources : null,
    class_features: classFeatures,
    racial_traits: racialTraits.length > 0 ? racialTraits : null,
    feats: feats.length > 0 ? feats : null,

    equipment: equipment.items,

    cp: int(fields['CP']),
    sp: int(fields['SP']),
    ep: int(fields['EP']),
    gp: int(fields['GP']),
    pp: int(fields['PP']),

    species,
    background,
    classes,
    spell_details: spellList.length > 0 ? spellDetails : null,
    weapon_masteries: weaponMasteries,
    grapple_shove_dc: grappleShoveDc,
    feature_dc: featureDc,
  };

  for (const [name, what] of filled) {
    notices.push(`${name}: ${what.join(' and ')} filled from the class reference — the export left it out.`);
  }

  return { character, notices };
}
