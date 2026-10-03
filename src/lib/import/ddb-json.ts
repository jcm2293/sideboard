// D&D Beyond character-service JSON (character/v5/character/{id}) as an
// overlay on the PDF parse. The PDF stays the source of the character: the
// JSON only replaces rules text (features, chosen options, spells) with
// Beyond's untruncated descriptions and sets limited uses from its computed
// actions. It never adds a feature or spell the PDF doesn't have.

import type { FeatureEntry, FeatureUses } from '@/types';
import { spellKey } from '@/lib/character';
import { featureKey, type Ability, type AbilityMods } from '@/data/class-reference';
import { activationSummary, featureSummary, optionSummary, summaryContext } from '@/lib/feature-summary';
import type { ParsedCharacter } from './ddb-parser';

// ──────────────────────────────────────────────────────────────────────────
// HTML → text
// ──────────────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', times: '×', minus: '−', deg: '°', frac12: '½', frac14: '¼', frac34: '¾',
  bull: '•', middot: '·',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/**
 * Beyond's description HTML as the parser's text shape: paragraphs joined
 * by a blank line, list items as "• " lines, table cells joined with " · ".
 * A leading "Prerequisite: …" line or category label ("Origin Feat") is dropped.
 */
export function htmlToText(html: string): string {
  const text = decodeEntities(
    html
      .replace(/\r\n?/g, '\n')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*li[^>]*>/gi, '\n• ')
      .replace(/<\/\s*li\s*>/gi, '')
      .replace(/<\/\s*t[dh]\s*>/gi, ' · ')
      .replace(/<\/?\s*(?:p|div|h\d|tr|ul|ol|table|thead|tbody|blockquote)\b[^>]*>/gi, '\n\n')
      .replace(/<[^>]+>/g, ''),
  );
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) =>
      p
        .split('\n')
        .map((l) => l.replace(/[ \t ]+/g, ' ').replace(/\s*·\s*$/, '').trim())
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean);
  // Neither a "Prerequisite: …" line nor a bare category label ("Origin Feat") is play text.
  while (paragraphs.length > 1 && (/^Prerequisites?\b/i.test(paragraphs[0]) || /^(?:[\w-]+ ){0,3}Feat$/i.test(paragraphs[0]))) paragraphs.shift();
  return paragraphs.join('\n\n');
}

// Simple Beyond template tokens ("{{savedc:cha}}", "{{modifier:dex@min:1#unsigned}}"); anything
// more involved is dropped rather than printed as braces.
function resolveTemplates(text: string, vars: { pb: number; mods: AbilityMods; level: number; classLevel: number }): string {
  return text.replace(/\{\{([^}]*)\}\}/g, (_m, raw: string) => {
    const [expr, ...mods] = raw.split(/[@#]/);
    const ability = (key: string) => (['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(key) ? (key as Ability) : null);
    let value: number | null = null;
    const m = expr.trim().match(/^(proficiency|classlevel|characterlevel|modifier:(\w+)|savedc:(\w+))$/);
    if (m) {
      if (m[1] === 'proficiency') value = vars.pb;
      else if (m[1] === 'classlevel') value = vars.classLevel;
      else if (m[1] === 'characterlevel') value = vars.level;
      else if (m[2] && ability(m[2])) value = vars.mods[ability(m[2])!];
      else if (m[3] && ability(m[3])) value = 8 + vars.pb + vars.mods[ability(m[3])!];
    }
    if (value == null) return '';
    const min = raw.match(/min:(-?\d+)/)?.[1];
    if (min != null) value = Math.max(value, parseInt(min, 10));
    const signed = mods.some((x) => /signed/.test(x) && !/unsigned/.test(x)) || (/^(proficiency|modifier)/.test(expr) && !/unsigned/.test(raw));
    return signed && value >= 0 ? `+${value}` : String(value);
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Reading the JSON
// ──────────────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const STAT_BY_ID: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SECTIONS = ['class', 'race', 'feat', 'item', 'background'];
/** "8: Ability Score Improvement" → "Ability Score Improvement". */
const bare = (name: string) => name.replace(/^\d+:\s*/, '').trim();
const keyOf = (name: string) => featureKey(bare(name));

interface JsonOption {
  name: string;
  text: string;
  /** The feature or feat the option belongs to, when the JSON says. */
  parent: string;
}

export interface DdbJsonOverlay {
  characterName: string;
  /** featureKey(name) → text, for class features (at or below the class level), species traits, and feats. */
  features: Map<string, string>;
  options: JsonOption[];
  /** spellKey(name) → description and a free cast, if a copy has one. */
  spells: Map<string, { description: string; free?: { count: number; per: 'short' | 'long' } }>;
  /** featureKey(owning feature) → uses, from the actions Beyond computes. */
  uses: Map<string, FeatureUses & { from: string }>;
  /** spellKey of class spells marked prepared or always prepared; empty when the JSON marks none. */
  prepared: Set<string>;
}

/** Limited uses as Beyond counts them: a proficiency-based count is the bonus itself; a stat adds its modifier. */
function usesCount(lu: Json, pb: number, mods: AbilityMods): number | null {
  if (lu.useProficiencyBonus === true) return pb;
  const stat = num(lu.statModifierUsesId);
  const max = num(lu.maxUses) ?? 0;
  if (stat && STAT_BY_ID[stat - 1]) return Math.max(1, max + mods[STAT_BY_ID[stat - 1]]);
  return max > 0 ? max : null;
}

const RESET: Record<number, 'short' | 'long'> = { 1: 'short', 2: 'long' };

export function readDdbJson(raw: unknown, pb: number, mods: AbilityMods): DdbJsonOverlay | null {
  const root = obj(obj(raw).data ?? raw);
  const classes = arr(root.classes);
  if (!str(root.name) || classes.length === 0) return null;
  const level = classes.reduce((sum, c) => sum + (num(c.level) ?? 0), 0);
  const vars = (classLevel: number) => ({ pb, mods, level, classLevel });

  const features = new Map<string, string>();
  const ids = new Map<number, string>(); // definition id → feature or feat name, for actions and options
  const put = (def: Json, classLevel: number) => {
    const name = bare(str(def.name));
    const id = num(def.id);
    if (id != null) ids.set(id, name);
    const text = htmlToText(resolveTemplates(str(def.description), vars(classLevel)));
    if (name && text && !features.has(featureKey(name))) features.set(featureKey(name), text);
  };
  for (const c of classes) {
    const classLevel = num(c.level) ?? 0;
    for (const cf of arr(c.classFeatures)) {
      const def = obj(cf.definition);
      if ((num(def.requiredLevel) ?? 0) <= classLevel) put(def, classLevel);
    }
  }
  for (const t of arr(obj(root.race).racialTraits)) put(obj(t.definition), level);
  for (const f of arr(root.feats)) put(obj(f.definition), level);

  const options: JsonOption[] = [];
  for (const section of SECTIONS) {
    for (const o of arr(obj(root.options)[section])) {
      const def = obj(o.definition);
      const text = htmlToText(resolveTemplates(str(def.description), vars(level)));
      if (str(def.name) && text) options.push({ name: str(def.name), text, parent: ids.get(num(o.componentId) ?? -1) ?? '' });
    }
  }

  const spells = new Map<string, { description: string; free?: { count: number; per: 'short' | 'long' } }>();
  const prepared = new Set<string>();
  for (const s of arr(root.classSpells).flatMap((cs) => arr(cs.spells))) {
    if (s.prepared === true || s.alwaysPrepared === true) prepared.add(spellKey(str(obj(s.definition).name)));
  }
  // Spells a feat, species, item, or background grants are always castable (Magic Initiate's).
  if (prepared.size > 0) {
    for (const section of SECTIONS.filter((x) => x !== 'class')) {
      for (const s of arr(obj(root.spells)[section])) prepared.add(spellKey(str(obj(s.definition).name)));
    }
  }
  const spellEntries = [
    ...arr(root.classSpells).flatMap((cs) => arr(cs.spells)),
    ...SECTIONS.flatMap((section) => arr(obj(root.spells)[section])),
  ];
  for (const s of spellEntries) {
    const def = obj(s.definition);
    const key = spellKey(str(def.name));
    if (!key) continue;
    const lu = obj(s.limitedUse);
    const count = num(lu.maxUses);
    const per = RESET[num(lu.resetType) ?? 0];
    const free = count && count > 0 && per ? { count, per } : undefined;
    const prior = spells.get(key);
    spells.set(key, {
      description: prior?.description || htmlToText(str(def.description)),
      ...(prior?.free ?? free ? { free: prior?.free ?? free } : {}),
    });
  }

  const uses = new Map<string, FeatureUses & { from: string }>();
  for (const section of SECTIONS) {
    for (const a of arr(obj(root.actions)[section])) {
      const lu = obj(a.limitedUse);
      const per = RESET[num(lu.resetType) ?? 0];
      const count = per ? usesCount(lu, pb, mods) : null;
      if (!count || !per) continue;
      const name = str(a.name);
      const owner = ids.get(num(a.componentId) ?? -1) ?? name.split(':')[0].trim();
      const label = name.split(':').pop()!.trim();
      uses.set(featureKey(owner), {
        count,
        per,
        from: name,
        ...(featureKey(label) !== featureKey(owner) ? { label } : {}),
        ...(/pool/i.test(name) ? { pool: true } : {}),
      });
    }
  }
  return { characterName: str(root.name), features, options, spells, uses, prepared };
}

// ──────────────────────────────────────────────────────────────────────────
// Applying it to a parsed character
// ──────────────────────────────────────────────────────────────────────────

const usesText = (u: FeatureUses) => `${u.count}/${u.per === 'short' ? 'SR' : 'LR'}`;

/**
 * Lay the JSON over a parsed character: rules text by name, limited uses from
 * Beyond's actions, spell descriptions. Summaries are re-seeded from the new
 * text (table shorts still win). A JSON for a different character is ignored.
 */
export function applyDdbJson(character: ParsedCharacter, raw: unknown): { character: ParsedCharacter; notices: string[] } {
  const ctx = summaryContext(character);
  const overlay = readDdbJson(raw, ctx.pb, ctx.mods);
  if (!overlay) return { character, notices: ['The JSON is not a D&D Beyond character export; it was ignored.'] };
  if (featureKey(overlay.characterName) !== featureKey(character.name ?? '')) {
    return {
      character,
      notices: [`The JSON is for "${overlay.characterName}" but the PDF is "${character.name}"; the JSON was ignored.`],
    };
  }

  let texts = 0;
  let optionTexts = 0;
  const missing: string[] = [];
  const usesChanged: string[] = [];

  const overlayFeature = (f: FeatureEntry): FeatureEntry => {
    const next: FeatureEntry = { ...f };
    let touched = false;
    // Invocations and similar children are options in the JSON, under their parent feature.
    const text = overlay.features.get(keyOf(f.name)) ?? overlay.options.find((o) => keyOf(o.name) === keyOf(f.name))?.text;
    if (text && text !== f.full_text) {
      next.full_text = text;
      next.text_source = 'json';
      touched = true;
      texts++;
    } else if (!text && f.kind !== 'container') {
      missing.push(f.name);
    }

    if (f.options?.length) {
      const details = [...(f.option_details ?? [])];
      for (const name of f.options) {
        const candidates = overlay.options.filter((o) => keyOf(o.name) === keyOf(name));
        const pick = candidates.find((o) => keyOf(o.parent) === keyOf(f.name)) ?? (candidates.length === 1 ? candidates[0] : undefined);
        if (!pick) continue;
        const i = details.findIndex((d) => keyOf(d.name) === keyOf(name));
        if (i >= 0 && details[i].text === pick.text) continue;
        if (i >= 0) details[i] = { ...details[i], text: pick.text };
        else details.push({ name, text: pick.text });
        touched = true;
        optionTexts++;
      }
      if (details.length > 0) next.option_details = details;
    }

    const u = overlay.uses.get(keyOf(f.name));
    if (u && (!f.uses || f.uses.count !== u.count || f.uses.per !== u.per)) {
      usesChanged.push(`${f.name} ${f.uses ? `${usesText(f.uses)} → ` : ''}${usesText(u)}`);
      next.uses = { ...(f.uses ?? {}), count: u.count, per: u.per, ...(u.label ? { label: u.label } : {}), ...(u.pool ? { pool: true } : {}) };
    }

    if (touched) {
      const fctx = summaryContext(character, next.group);
      next.option_details = next.option_details?.map((o) => ({ ...o, summary: optionSummary(o.name, o.text, next.group, fctx) }));
      next.summary = featureSummary(next, fctx);
      next.activations = next.activations?.map((a) => {
        const { summary: _old, ...rest } = a;
        void _old;
        const summary = activationSummary(next, rest, fctx);
        return summary ? { ...rest, summary } : rest;
      });
    }
    return next;
  };

  const out: ParsedCharacter = {
    ...character,
    class_features: character.class_features.map(overlayFeature),
    racial_traits: (character.racial_traits ?? []).map(overlayFeature),
    feats: (character.feats ?? []).map(overlayFeature),
  };

  // Resources follow the same counts (by feature name or Beyond's resource label).
  out.class_resources = (character.class_resources ?? []).map((r) => {
    const u = overlay.uses.get(featureKey(r.name)) ?? [...overlay.uses.values()].find((x) => x.label && featureKey(x.label) === featureKey(r.name));
    if (!u || (u.count === r.uses && u.per === (/short/i.test(r.recovery) && !/long/i.test(r.recovery) ? 'short' : 'long'))) return r;
    return { ...r, uses: u.count, ...(u.pool ? { pool: true } : {}) };
  });

  let spellTexts = 0;
  if (character.spell_details) {
    out.spell_details = Object.fromEntries(
      Object.entries(character.spell_details).map(([k, s]) => {
        const o = overlay.spells.get(spellKey(s.name));
        if (!o?.description) return [k, s];
        spellTexts++;
        return [k, { ...s, description: o.description, ...(!s.free_uses && o.free ? { free_uses: o.free } : {}) }];
      }),
    );
  }

  // Beyond's PDF can mark every spell a prepared caster could prepare; the JSON knows which are.
  let preparedNote = '';
  if (character.is_prepared_caster && overlay.prepared.size > 0 && character.spell_details) {
    const names = Object.values(out.spell_details ?? character.spell_details)
      .filter((s) => s.level > 0 && (s.always_prepared || overlay.prepared.has(spellKey(s.name))))
      .map((s) => s.name);
    if (names.length > 0) {
      preparedNote = `Prepared spells from the JSON: ${names.length} (the PDF marked ${character.prepared_spells?.length ?? 0}).`;
      out.prepared_spells = names;
    }
  }

  const notices = [
    `Beyond JSON: rules text for ${texts} feature${texts === 1 ? '' : 's'}${optionTexts ? ` and ${optionTexts} option${optionTexts === 1 ? '' : 's'}` : ''}, descriptions for ${spellTexts} spell${spellTexts === 1 ? '' : 's'}.`,
  ];
  if (usesChanged.length) notices.push(`Uses from the JSON: ${usesChanged.join('; ')}.`);
  if (preparedNote) notices.push(preparedNote);
  if (missing.length) notices.push(`No JSON text for: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? `, and ${missing.length - 8} more` : ''}.`);
  return { character: out, notices };
}
