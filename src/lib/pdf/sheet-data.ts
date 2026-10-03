// What page 1 of the character sheet shows, derived from a PlayerCharacter
// (sheet spec v3 §5.1). Pure — no drawing. The v3 fields are optional, so
// older and homebrew-wizard characters fall back to the basic columns.

import type { AttackEntry, EquipmentEntry, FeatureEntry, PlayerCharacter, ProficiencyLevel, SpellEntry } from '@/types';
import { abilityModifier, deriveClasses, featureDc, grappleShoveDc, modString, spellAttackBonus, spellKey } from '@/lib/character';
import {
  activationSummary,
  clauseOf,
  expendCost,
  optionText,
  runInParagraph,
  seedClause,
  summaryContext,
} from '@/lib/feature-summary';
import { CANTRIP_DAMAGE } from '@/data/cantrip-damage';
import { classReferenceFor, featureKey, type Ability } from '@/data/class-reference';
import { MASTERY_EFFECTS, standardWeapon } from '@/data/weapons';
import type { ChipVariant } from './sheet-kit';
import type { SpellLookup } from './spell-library';

type Char = PlayerCharacter;

// ──────────────────────────────────────────────────────────────────────────
// Band and vitals
// ──────────────────────────────────────────────────────────────────────────

export function classesOf(c: Char) {
  return c.classes?.length ? c.classes : deriveClasses(c.class_name ?? '', c.level ?? 1, c.subclass ?? '');
}

/** "Dhampir · Warlock 5, Fiend Patron · Bejeweled Conclave Spy · played by Jake", as (text, emphasis) parts. */
export function bandParts(c: Char): { text: string; strong?: boolean; italic?: boolean }[] {
  const classes = classesOf(c);
  const classLine = classes.map((k) => `${k.class_name} ${k.level}`).join(' / ');
  const subclasses = classes.map((k) => k.subclass).filter(Boolean).join(' · ');
  const parts: { text: string; strong?: boolean; italic?: boolean }[] = [];
  const sep = () => parts.length > 0 && parts.push({ text: ' · ' });
  if (c.species) parts.push({ text: c.species, strong: true });
  if (classLine) {
    sep();
    parts.push({ text: classLine, strong: true });
    if (subclasses) parts.push({ text: `, ${subclasses}` });
  }
  if (c.background) {
    sep();
    parts.push({ text: c.background });
  }
  if (c.player_name) {
    sep();
    parts.push({ text: `played by ${c.player_name}`, italic: true });
  }
  return parts;
}

export interface VitalCell {
  label: string;
  value: string;
  sub: string[];
}

const SPEED_SHORT: Record<string, string> = {
  walking: 'walk',
  climbing: 'climb',
  swimming: 'swim',
  flying: 'fly',
  burrowing: 'burrow',
};
const feet = (s: string) => s.match(/\d+/)?.[0] ?? s;

function abilityLabel(ability: string | null | undefined): string {
  const a = (ability ?? '').toLowerCase();
  return a ? a[0].toUpperCase() + a.slice(1, 3) : '';
}

export function vitalCells(c: Char): VitalCell[] {
  const speeds = Object.entries(c.speeds ?? {}).filter(([, v]) => v);
  const walking = c.speeds?.walking ?? speeds[0]?.[1] ?? '30 ft.';
  const speedSub =
    speeds.length > 1
      ? speeds
          .map(([k, v]) => {
            const name = SPEED_SHORT[k] ?? k;
            return feet(v) === feet(walking) ? name : `${name} ${feet(v)}`;
          })
          .join(' · ')
      : '';

  const dc = featureDc(c);
  const grapple = grappleShoveDc(c);
  const dexGrapple = grapple === 8 + (c.proficiency_bonus ?? 2) + abilityModifier(c.dex_score) &&
    abilityModifier(c.dex_score) > abilityModifier(c.str_score);
  const dcSub =
    dc.label === 'Grapple/Shove DC'
      ? [dexGrapple ? 'Dex · Martial Arts' : 'Str']
      : [
          ...(dc.label === 'Spell DC'
            ? [`atk ${modString(spellAttackBonus(c))} · ${abilityLabel(c.spellcasting_ability)}`]
            : []),
          `grapple/shove DC ${grapple}`,
        ];

  return [
    { label: 'Armor class', value: String(c.armor_class ?? '—'), sub: c.ac_source ? [c.ac_source] : [] },
    { label: 'Hit points', value: String(c.hp_max ?? '—'), sub: c.hit_dice_total ? [`${c.hit_dice_total} hit dice`] : [] },
    { label: 'Initiative', value: modString(c.initiative_modifier ?? 0), sub: [] },
    { label: 'Speed', value: feet(walking), sub: speedSub ? [speedSub] : [] },
    { label: 'Proficiency', value: modString(c.proficiency_bonus ?? 2), sub: [] },
    { label: dc.label, value: String(dc.value), sub: dcSub },
    {
      label: 'Passive perc.',
      value: String(c.passive_perception ?? 10 + (c.skill_modifiers?.perception ?? abilityModifier(c.wis_score))),
      sub: c.senses ? [c.senses.toLowerCase().replace(/\.(?=\s|,|$)/g, '')] : [],
    },
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// Left rail
// ──────────────────────────────────────────────────────────────────────────

const SKILLS: Record<string, { key: string; label: string }[]> = {
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

export interface SkillLine {
  label: string;
  mod: number;
  prof: ProficiencyLevel;
  /** A die a feature adds to this check ("+1d4" from Arcane Eloquence). */
  bonus?: string;
}

export interface AbilityBlock {
  key: string;
  mod: number;
  score: number;
  save: number;
  saveProf: boolean;
  skills: SkillLine[];
}

export function allFeatures(c: Char): FeatureEntry[] {
  return [...(c.class_features ?? []), ...(c.racial_traits ?? []), ...(c.feats ?? [])];
}

const textOf = (f: FeatureEntry) => f.full_text || f.summary || '';

/** Dice that features add to named checks: "(Deception, Intimidation, or Persuasion) check, you can roll 1d4". */
export function skillBonuses(c: Char): Record<string, string> {
  const out: Record<string, string> = {};
  const labels = Object.values(SKILLS).flat();
  for (const f of allFeatures(c)) {
    for (const m of textOf(f).matchAll(/\(([A-Za-z ,]+?)\)\s*check,?\s*you can roll (\d+d\d+)/g)) {
      for (const name of m[1].split(/,\s*(?:or\s+)?|\s+or\s+/)) {
        const skill = labels.find((s) => s.label.toLowerCase() === name.trim().toLowerCase());
        if (skill) out[skill.key] = `+${m[2]}`;
      }
    }
  }
  return out;
}

export function abilityBlocks(c: Char): AbilityBlock[] {
  const bonuses = skillBonuses(c);
  return (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((key) => {
    const score = c[`${key}_score`] ?? 10;
    const mod = abilityModifier(score);
    return {
      key: key.toUpperCase(),
      mod,
      score,
      save: c.save_modifiers?.[key] ?? mod,
      saveProf: c.save_proficiencies?.[key] === 'proficient',
      skills: SKILLS[key].map((s) => ({
        label: s.label,
        mod: c.skill_modifiers?.[s.key] ?? mod,
        prof: c.skill_proficiencies?.[s.key] ?? 'none',
        ...(bonuses[s.key] ? { bonus: bonuses[s.key] } : {}),
      })),
    };
  });
}

export function passiveLine(c: Char): string {
  const insight = c.passive_insight ?? 10 + (c.skill_modifiers?.insight ?? abilityModifier(c.wis_score));
  const investigation = c.passive_investigation ?? 10 + (c.skill_modifiers?.investigation ?? abilityModifier(c.int_score));
  return `Passive Insight ${insight} · Passive Investigation ${investigation}`;
}

export function defenseLines(c: Char): [string, string][] {
  const lines: [string, string][] = [];
  if (c.damage_resistances) lines.push(['Resistance', c.damage_resistances.toLowerCase()]);
  if (c.damage_immunities) lines.push(['Immunity', c.damage_immunities.toLowerCase()]);
  if (c.condition_immunities) lines.push(['Condition immunity', c.condition_immunities.toLowerCase()]);
  for (const sense of (c.senses ?? '').split(/,\s*/).filter(Boolean)) {
    const m = sense.match(/^([A-Za-z ]+?)\s+(\d+\s*ft)\.?$/);
    lines.push(m ? [m[1], m[2]] : [sense.replace(/\.$/, ''), '']);
  }
  for (const [k, v] of Object.entries(c.speeds ?? {})) {
    if (k !== 'walking' && v) lines.push([(SPEED_SHORT[k] ?? k).replace(/^\w/, (ch) => ch.toUpperCase()), v.replace(/\.$/, '')]);
  }
  return lines;
}

export function proficiencyLines(c: Char): [string, string][] {
  const flags = (rec: Record<string, boolean> | null | undefined, order: string[]) => {
    const on = Object.entries(rec ?? {}).filter(([, v]) => v).map(([k]) => k);
    return [...order.filter((k) => on.includes(k)), ...on.filter((k) => !order.includes(k))];
  };
  const armor = flags(c.armor_proficiencies, ['light', 'medium', 'heavy', 'shields']);
  const weapons = flags(c.weapon_proficiencies, ['simple', 'martial']);
  return [
    ['Armor', armor.join(', ') || 'none'],
    ['Weapons', weapons.join(', ') || 'none'],
    ['Tools', c.tool_proficiencies || '—'],
    ['Languages', c.languages || '—'],
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// Attacks & cantrips
// ──────────────────────────────────────────────────────────────────────────

export interface AttackRow {
  name: string;
  chips: { text: string; variant: ChipVariant }[];
  note: string;
  hit: string;
  damage: string;
  range: string;
  /** Table order: weapons, unarmed, attack cantrips, feature attacks; riders sit below. */
  kind: 'weapon' | 'unarmed' | 'spell' | 'feature' | 'rider';
}

export interface AttackTable {
  rows: AttackRow[];
  riders: AttackRow[];
  /** Chosen weapon masteries, for the line under the table. */
  masteries: { weapon: string; mastery: string }[];
}

// Wizards of the Coast source codes in Beyond page refs; anything else is third-party or homebrew.
const OFFICIAL_SOURCE =
  /^(PHB|DMG|MM|XGtE|TCoE|SCAG|EEPC|FToD|FTD|SCC|BMT|EGtW|AI|IDRotF|GGR|ERftLW|EFA|MOoT|VRGtR|WBtW|AAG|SAiS|BoMT|MPMM|VGtM|MToF|SRD|SatO|PaBTSO|TDCSR|DSotDQ|KftGV|QftIS)\b/i;

export function spellDetailsOf(c: Char): SpellEntry[] {
  return Object.values(c.spell_details ?? {});
}

export function isHomebrew(detail: SpellEntry | undefined, lookup: SpellLookup): boolean {
  if (!detail || lookup(detail.name)) return false;
  return Boolean(detail.page_ref) && !OFFICIAL_SOURCE.test(detail.page_ref);
}

/** "60 ft./5 ft. Sphere" → "60 ft, 5 ft sphere"; "Self" → "self". */
export function shortRange(range: string): string {
  return range
    .split('/')
    .map((p) => p.trim().replace(/\bfeet\b/i, 'ft').replace(/\.(?=\s|$)/g, '').toLowerCase())
    .filter(Boolean)
    .join(', ');
}

/** "WIS 16" → "Wis 16"; "+8" stays. */
export const hitOrDc = (s: string) => (s ? s.replace(/^([A-Z]{3})\b/, (a) => a[0] + a.slice(1).toLowerCase()) : '—');

/** Cantrip dice scaled by character level: more dice at 5, 11, and 17. */
function scaleCantrip(dice: string, level: number): string {
  const [n, d] = dice.split('d');
  const tier = 1 + (level >= 5 ? 1 : 0) + (level >= 11 ? 1 : 0) + (level >= 17 ? 1 : 0);
  return `${parseInt(n, 10) * tier}d${d}`;
}

/** Cantrip damage from library text ("… takes 1d10 Fire damage"), scaled. */
function cantripDamage(desc: string, level: number): string | null {
  const m = desc.match(/(\d+d\d+)\s+([A-Za-z]+)\s+damage/);
  return m ? `${scaleCantrip(m[1], level)} ${m[2].toLowerCase()}` : null;
}

/** Weapon reach or range: "20/60 ft", "10 ft" for reach weapons, else "5 ft". */
function weaponRange(a: AttackEntry): string {
  return a.range ? `${a.range} ft` : /\breach\b/i.test(a.notes ?? '') ? '10 ft' : '5 ft';
}

const ABILITY_OF: Record<string, Ability> = { str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha' };
const DAMAGE_TYPES = 'acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder';

/**
 * A feature that is itself an attack (§5.1): its text names a "ranged spell
 * attack" or "melee weapon attack" and either a damage expression or the
 * Martial Arts die. Radiant Sun Bolt: +8, 1d8 radiant, 30 ft.
 */
function featureAttack(c: Char, f: FeatureEntry): AttackRow | null {
  const text = textOf(f);
  const kind = text.match(/\b(ranged|melee) (spell|weapon) attack\b/i);
  if (!kind) return null;
  const rolled = text.match(new RegExp(`(\\d+d\\d+(?:\\s*[+-]\\s*\\d+)?)\\s+(${DAMAGE_TYPES})\\s+damage`, 'i'));
  const martialArts = /\bMartial Arts die\b/i.test(text);
  if (!rolled && !martialArts) return null;

  let dice = rolled?.[1].replace(/\s+/g, '') ?? '';
  if (!rolled) {
    const monk = classesOf(c).find((k) => /^monk$/i.test(k.class_name));
    const rider = classReferenceFor('monk')?.riders.find((r) => r.requires === 'Martial Arts');
    dice = rider?.damage(monk?.level ?? c.level ?? 1) ?? '1d6';
  }
  const type = (rolled?.[2] ?? text.match(new RegExp(`\\b(${DAMAGE_TYPES})\\s+damage\\b`, 'i'))?.[1] ?? '').toLowerCase();

  // To hit: the ability the text names; else the spell attack bonus for a spell attack; else Str or Dex.
  const pb = c.proficiency_bonus ?? 2;
  const named = text.match(/\buses? your (Str|Dex|Con|Int|Wis|Cha)\w*\.? modifier/i)?.[1].toLowerCase();
  const mod = (a: Ability) => abilityModifier(c[`${a}_score`] ?? 10);
  const hit = named
    ? mod(ABILITY_OF[named]) + pb
    : /spell/i.test(kind[2]) && c.spellcasting_ability
      ? spellAttackBonus(c)
      : Math.max(mod('str'), mod('dex')) + pb;

  const reach = text.match(/\brange of (\d+)\s*(?:ft|feet)/i)?.[1];
  return {
    name: f.name,
    chips: [],
    note: '',
    hit: modString(hit),
    damage: [dice, type].filter(Boolean).join(' '),
    range: reach ? `${reach} ft` : /melee/i.test(kind[1]) ? '5 ft' : '—',
    kind: 'feature',
  };
}

const KIND_ORDER: Record<AttackRow['kind'], number> = { weapon: 0, unarmed: 1, spell: 2, feature: 3, rider: 4 };

export function attackTable(c: Char, lookup: SpellLookup): AttackTable {
  const details = spellDetailsOf(c);
  const detailFor = (name: string) => details.find((d) => spellKey(d.name) === spellKey(name));
  const isCantrip = (name: string) => detailFor(name)?.level === 0;
  const masteries = c.weapon_masteries ?? [];

  // Weapon notes carry the damage of weapon cantrips: "Booming Blade: 1d8 Thunder".
  const weaponCantrips = new Map<string, { damage: string; range: string }>();
  for (const a of c.attacks ?? []) {
    for (const m of (a.notes ?? '').matchAll(/([A-Z][A-Za-z' ]+?):\s*(\d+d\d+)\s+([A-Za-z]+)/g)) {
      weaponCantrips.set(spellKey(m[1]), { damage: `+${m[2]} ${m[3].toLowerCase()}`, range: weaponRange(a) });
    }
  }

  const rows: AttackRow[] = [];
  const riders: AttackRow[] = [];
  const seen = new Set<string>();
  for (const a of c.attacks ?? []) {
    const kind = a.kind ?? (/unarmed strike|flurry of blows/i.test(a.name) ? 'unarmed' : isCantrip(a.name) ? 'spell' : 'weapon');
    const tags = a.tags ?? [];
    seen.add(spellKey(a.name));
    if (kind === 'rider') {
      riders.push({
        name: a.name,
        chips: tags.map((t) => ({ text: t, variant: /^slot$/i.test(t) ? 'slot' : /^free/i.test(t) ? 'free' : 'plain' })),
        note: a.notes ?? '',
        hit: '',
        damage: [a.damage, a.damage_type.toLowerCase()].filter(Boolean).join(' '),
        range: '',
        kind: 'rider',
      });
      continue;
    }
    if (kind === 'spell') {
      const detail = detailFor(a.name);
      const count = (a.notes ?? '').match(/Count:\s*(\d+)/i)?.[1];
      rows.push({
        name: a.name,
        chips: isHomebrew(detail, lookup) ? [{ text: 'homebrew', variant: 'plain' }] : [],
        note: '',
        hit: a.atk_bonus || hitOrDc(detail?.save_or_atk ?? ''),
        damage: [a.damage, a.damage_type.toLowerCase(), count && count !== '1' ? `×${count}` : ''].filter(Boolean).join(' '),
        range: shortRange(detail?.range ?? a.range ?? ''),
        kind: 'spell',
      });
      continue;
    }
    // Weapon notes: keep properties, drop the cantrip damage riders listed
    // after them, and add the effect of a chosen mastery (its chip goes, the
    // note says it).
    const weapon = standardWeapon(a.name);
    const chosen = weapon ? masteries.find((m) => standardWeapon(m.weapon) === weapon) : undefined;
    const properties = (a.notes ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && !p.includes(':') && !/^\d+d\d+\s+\w+$/.test(p))
      .join(', ');
    const effect = chosen && MASTERY_EFFECTS[chosen.mastery] ? `${chosen.mastery}: ${MASTERY_EFFECTS[chosen.mastery]}` : '';
    rows.push({
      name: a.name.replace(/,\s*(\+\d+)$/, ' $1'),
      chips: tags.filter((t) => t !== chosen?.mastery).map((t) => ({ text: t, variant: 'plain' as ChipVariant })),
      note: [properties, effect].filter(Boolean).join(' · '),
      hit: a.atk_bonus,
      damage: [a.damage, a.damage_type.toLowerCase()].filter(Boolean).join(' '),
      range: weaponRange(a),
      kind: kind === 'unarmed' ? 'unarmed' : 'weapon',
    });
  }

  // Attack cantrips the export didn't list as rows: weapon cantrips from the
  // weapon notes, the rest from library text or the non-SRD damage table.
  for (const d of details.filter((s) => s.level === 0 && !seen.has(spellKey(s.name)))) {
    const spell = lookup(d.name);
    const viaWeapon = weaponCantrips.get(spellKey(d.name));
    const known = CANTRIP_DAMAGE[d.name.toLowerCase()];
    const fromText = spell ? cantripDamage(spell.desc.join(' '), c.level ?? 1) : null;
    const fromTable = known ? `${scaleCantrip(known.dice, c.level ?? 1)} ${known.type}` : null;
    if (!d.save_or_atk || !(viaWeapon || fromText || fromTable || d.save_or_atk.startsWith('+'))) continue;
    seen.add(spellKey(d.name));
    rows.push({
      name: d.name,
      chips: isHomebrew(d, lookup) ? [{ text: 'homebrew', variant: 'plain' }] : [],
      note: viaWeapon || fromText ? '' : known?.note ?? '',
      hit: viaWeapon ? 'weapon' : hitOrDc(d.save_or_atk),
      damage: viaWeapon?.damage ?? fromText ?? fromTable ?? '—',
      range: viaWeapon?.range ?? shortRange(d.range),
      kind: 'spell',
    });
  }

  // Features that are attacks in their own right.
  for (const f of allFeatures(c)) {
    if (f.kind === 'container' || seen.has(spellKey(f.name))) continue;
    const row = featureAttack(c, f);
    if (row) {
      seen.add(spellKey(f.name));
      rows.push(row);
    }
  }
  rows.sort((x, y) => KIND_ORDER[x.kind] - KIND_ORDER[y.kind]);

  // A die that replaces weapon damage is already in a row when that row rolls it
  // (the Martial Arts die inside Unarmed Strike's 1d8+5).
  const folded = (r: AttackRow) => {
    const die = r.damage.match(/^(\d+d\d+)$/)?.[1];
    return Boolean(die) && /\bin place of\b/i.test(r.note) && rows.some((row) => row.kind === 'unarmed' && row.damage.startsWith(die!));
  };
  return { rows, riders: riders.filter((r) => !folded(r)), masteries };
}

// ──────────────────────────────────────────────────────────────────────────
// Your turn
// ──────────────────────────────────────────────────────────────────────────

export interface TurnItem {
  name: string;
  clause: string;
  /** Muted italic parenthetical: the cost ("1 Focus", "slot, concentration"), else the source feature. */
  cost: string;
  /** The clause continues the name as one phrase ("Attack twice with the pact weapon") rather than after a "·". */
  inline?: boolean;
}

export type TurnGroup = 'action' | 'bonus' | 'reaction' | 'always';
export type TurnGroups = Record<TurnGroup, TurnItem[]>;

const GROUP_OF: Record<string, TurnGroup | undefined> = {
  action: 'action',
  bonus: 'bonus',
  reaction: 'reaction',
  special: 'always',
};

function spellCost(s: SpellEntry, homebrew: boolean): string {
  const parts: string[] = homebrew ? ['homebrew'] : [];
  if (s.free_uses) parts.push(`free ${s.free_uses.count}/${s.free_uses.per === 'short' ? 'SR' : 'LR'}${s.costs_slot ? ', then a slot' : ''}`);
  else if (s.costs_slot) parts.push('slot');
  else if (s.level === 0) parts.push('cantrip');
  if (s.ritual && !s.costs_slot) parts.push('ritual');
  if (s.concentration) parts.push('concentration');
  return parts.join(', ');
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The group a feature's text belongs to for single-class records that predate `group`. */
function groupOf(c: Char, f: FeatureEntry): string | undefined {
  if (f.group) return f.group;
  const classes = classesOf(c);
  return classes.length === 1 ? classes[0].class_name : undefined;
}

/**
 * "Your turn" (§5.1). Features with an action get one line with their
 * summary. Activations with text of their own get their own line, named
 * `Parent: Option` when they are a chosen option; the ones without text that
 * share an action type collapse into one line under the feature's name.
 */
export function yourTurn(c: Char, lookup: SpellLookup, attackNames: Set<string>): TurnGroups {
  const groups: TurnGroups = { action: [], bonus: [], reaction: [], always: [] };
  const features = allFeatures(c).filter((f) => f.kind !== 'container');

  for (const f of features) {
    if (/^extra attack$/i.test(f.name)) {
      groups.action.unshift({ name: 'Attack twice', clause: 'when you take the Attack action', cost: '', inline: true });
      continue;
    }
    if (/^thirsting blade$/i.test(f.name)) {
      groups.action.unshift({ name: 'Attack twice', clause: 'with the pact weapon', cost: 'Thirsting Blade', inline: true });
      continue;
    }
    // Shown in the attacks table already (riders, Vampiric Bite).
    if (attackNames.has(f.name.toLowerCase())) continue;
    const ctx = summaryContext(c, groupOf(c, f));
    const scoped = { ...f, group: groupOf(c, f) };

    if (f.activations?.length) {
      const bare = new Map<TurnGroup, string[]>();
      for (const a of f.activations) {
        const group = GROUP_OF[a.action];
        // An attack-table row taken with the Attack action needs no line here;
        // a bonus-action attack (the monk's Unarmed Strike) still does.
        if (!group || (group === 'action' && attackNames.has(a.label.toLowerCase()))) continue;
        const summary = activationSummary(scoped, a, ctx);
        if (!summary) {
          bare.set(group, [...(bare.get(group) ?? []), a.label]);
          continue;
        }
        const option = f.options?.find((o) => featureKey(o) === featureKey(a.label));
        const own = runInParagraph(f, a.label) ?? optionText(f, a.label) ?? '';
        groups[group].push({
          name: option ? `${f.name}: ${option}` : a.label,
          clause: summary,
          cost: expendCost(own) || (option || featureKey(a.label) === featureKey(f.name) ? '' : f.name),
        });
      }
      for (const [group, labels] of bare) {
        if (labels.length === 1) {
          // A lone activation keeps its own name ("Unarmed Strike") with the feature as its source.
          const isFeature = featureKey(labels[0]) === featureKey(f.name);
          groups[group].push({ name: labels[0], clause: isFeature ? clauseOf(scoped, ctx) : '', cost: isFeature ? '' : f.name });
        } else {
          groups[group].push({ name: f.name, clause: clauseOf(scoped, ctx), cost: expendCost(textOf(f)) });
        }
      }
      continue;
    }
    const group = f.action ? GROUP_OF[f.action] : undefined;
    if (group) groups[group].push({ name: f.name, clause: clauseOf(scoped, ctx), cost: expendCost(textOf(f)) });
  }

  // Spells by casting time: bonus actions, reactions, and at-will spells get
  // their own lines; everything else is the one "Cast" line.
  const spells = spellDetailsOf(c);
  if (spells.some((s) => s.level === 0 || s.costs_slot)) {
    const attackTwice = groups.action.filter((i) => i.name === 'Attack twice').length;
    groups.action.splice(attackTwice, 0, { name: 'Cast', clause: 'a cantrip or a spell', cost: '', inline: true });
  }
  for (const s of spells) {
    const group: TurnGroup | null = /^1\s*BA$/i.test(s.casting_time)
      ? 'bonus'
      : /^1\s*R$/i.test(s.casting_time)
        ? 'reaction'
        : /^1\s*A$/i.test(s.casting_time)
          ? 'action'
          : null;
    if (!group || attackNames.has(s.name.toLowerCase())) continue;
    const atWill = s.level > 0 && !s.costs_slot && !s.free_uses && !s.ritual;
    if (atWill) {
      // Credit the feature that grants it ("Mask of Many Faces") when one says so.
      const named = new RegExp(`\\b${escapeRe(s.name)}\\b`, 'i');
      const grantor = allFeatures(c).find((f) => named.test(textOf(f)) && /at will|without expending a spell slot/i.test(textOf(f)));
      groups[group].push({ name: s.name, clause: 'at will', cost: grantor?.name ?? s.source.replace(/\s*\(.*\)$/, ''), inline: true });
      continue;
    }
    if (group === 'action') continue;
    const lib = lookup(s.name);
    groups[group].push({ name: s.name, clause: lib ? seedClause(lib.desc.join(' '), { action: group }) : '', cost: spellCost(s, isHomebrew(s, lookup)) });
  }

  // Lines that say something first; bare names ("Unarmed Strike") last.
  for (const g of Object.keys(groups) as TurnGroup[]) {
    groups[g] = [...groups[g].filter((i) => i.clause), ...groups[g].filter((i) => !i.clause)];
  }
  return groups;
}

// ──────────────────────────────────────────────────────────────────────────
// Resources and inventory
// ──────────────────────────────────────────────────────────────────────────

export interface ResourceLine {
  name: string;
  detail: string;
  uses: number;
  pool: boolean;
}

export function resourceLines(c: Char): ResourceLine[] {
  const lines = (c.class_resources ?? []).map((r) => {
    let name = r.name;
    const extra: string[] = [];
    const level = name.match(/^(.*?)\s*\((\d+(?:st|nd|rd|th)) level\)$/i);
    if (level) {
      name = level[1];
      extra.push(`${level[2]} level`);
    }
    if (/\(free cast\)$/i.test(name)) {
      name = name.replace(/\s*\(free cast\)$/i, '');
      extra.push('free cast');
    }
    if (r.die) extra.push(`${r.die} × ${r.uses}`);
    if (r.pool) extra.push('pool');
    extra.push(r.recovery.toLowerCase());
    return { name, detail: extra.join(' · '), uses: r.uses, pool: Boolean(r.pool), short: /short/i.test(r.recovery) && !/long/i.test(r.recovery) };
  });
  // Short-rest resources first (they come back mid-adventure), then long-rest.
  return [...lines.filter((l) => l.short), ...lines.filter((l) => !l.short)].map(({ short: _s, ...l }) => {
    void _s;
    return l;
  });
}

export function inventoryOf(c: Char): { rows: EquipmentEntry[]; weightLb: number; gp: number } {
  // "Shortsword, +1" → "Shortsword +1"; "2 lb." → "2 lb".
  const rows = (c.equipment ?? []).map((e) => ({
    ...e,
    name: e.name.replace(/,\s*(\+\d+)$/, ' $1'),
    weight: e.weight?.replace(/\.$/, '') ?? e.weight,
  }));
  const weightLb = rows.reduce((sum, e) => sum + (parseFloat(e.weight ?? '') || 0), 0);
  const gp = (c.cp ?? 0) / 100 + (c.sp ?? 0) / 10 + (c.ep ?? 0) / 2 + (c.gp ?? 0) + (c.pp ?? 0) * 10;
  return { rows, weightLb: Math.round(weightLb * 10) / 10, gp: Math.round(gp * 100) / 100 };
}
