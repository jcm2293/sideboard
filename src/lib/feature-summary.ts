// The one-line clause a feature shows in "Your turn" and on its Features-page
// heading (sheet spec v3 §2, §5.1). The reference table's `short` wins; else
// the clause is seeded from the text: first sentence, cut at a clause boundary,
// at most ~90 characters, never mid-word and never with a trailing ellipsis.
// The parser stores the result in `summary`, the DM can edit it, and the
// renderer re-seeds anything that still looks like a pre-v3 paragraph.

import type { ActionType, FeatureActivation, FeatureEntry, PlayerCharacter } from '@/types';
import { featureKey } from '@/data/class-reference';
import { MASTERY_EFFECTS, MASTERY_PROPERTIES } from '@/data/weapons';
import { shortFor, type ShortContext } from '@/data/feature-shorts';
import { abilityModifier, deriveClasses } from '@/lib/character';

export const SUMMARY_MAX = 90;
/** A seeded clause this close to the limit stays whole rather than losing its last word. */
const SOFT_MAX = SUMMARY_MAX + 10;

// A period after these doesn't end a sentence ("a Cha. (Deception…) check").
const ABBREVIATION = /\b(?:Str|Dex|Con|Int|Wis|Cha|Prof|e\.g|i\.e|vs)\.$/i;
// A run-in heading standing as the first "sentence": "Luck Points."
const RUN_IN_HEADING = /^[A-Z][\w'’-]*(?:\s+(?:of|the|and|or|[A-Z][\w'’-]*)){0,4}\.$/;
// A first sentence that only pays for the feature: "As a Magic action, you can expend one use of your Channel Divinity."
const COST_ONLY = /^(?:As (?:a|an) [\w ]+?,\s*)?you can (?:expend|spend) (?:one|a|\d+) uses? of (?:your |this class's )?[\w’']+(?: [\w’']+){0,3}\.$/i;
const SENTENCE_END = /[.!?](?=\s+[A-Z•]|$)/g;
// Words a seeded clause may start with that aren't names, so they can be lowercased.
const COMMON_START =
  /^(?:You|When|Whenever|While|If|Once|Each|Every|Until|After|Before|As|At|In|On|For|The|A|An|Your|This|That|These|Those|It|Its|Choose|Make|Take|Add|Gain|Roll|Spend|Expend|Reduce|Increase|Deal|Use|Cast|Move|Touch|Create|Teleport|Regain|Restore|Become|Briefly|Instead|Immediately|Also|Then|Resistance|Advantage|Disadvantage|Proficiency|Immunity|Darkvision)\b/;

/** Sentences of a text, abbreviation-aware, with "• " bullets as their own sentences. */
function sentences(text: string): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  const out: string[] = [];
  let start = 0;
  for (const m of t.matchAll(SENTENCE_END)) {
    const end = (m.index ?? 0) + 1;
    const piece = t.slice(start, end).trim();
    if (ABBREVIATION.test(piece)) continue;
    out.push(piece.replace(/^•\s*/, ''));
    start = end;
  }
  const rest = t.slice(start).trim().replace(/^•\s*/, '');
  if (rest) out.push(rest);
  return out;
}

/** The first sentence that says something: skips a run-in heading ("Luck Points.") and a cost-only opener. */
function firstSentence(text: string): string {
  const all = sentences(text);
  let i = 0;
  if (all.length > i + 1 && RUN_IN_HEADING.test(all[i])) i++;
  if (all.length > i + 1 && COST_ONLY.test(all[i])) i++;
  return all[i] ?? '';
}

/**
 * Cut at the latest clause boundary within max (after a closing bracket,
 * before ",", ";", ":" or a joining word) and never inside brackets; failing
 * that, at a word. A dangling joiner ("…and", "…to the") is trimmed.
 */
function cutAtBoundary(s: string, max: number): string {
  const min = Math.floor(max * 0.4);
  let best = -1;
  let word = -1;
  let depth = 0;
  for (let i = 0; i < s.length && i <= max; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[') {
      depth++;
    } else if (ch === ')' || ch === ']') {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && i + 1 >= min) best = i + 1;
    } else if (depth === 0) {
      if ((ch === ',' || ch === ';' || ch === ':') && i >= min) best = i;
      if (ch === ' ') {
        word = i;
        if (i >= min && /^ (?:and|but|or|so|while|which|unless|until|then) /.test(s.slice(i, i + 9))) best = i;
      }
    }
  }
  const cut = best > 0 ? s.slice(0, best) : word > 0 ? s.slice(0, word) : s.slice(0, max);
  return cut
    .replace(/[\s,;:(]+$/, '')
    .replace(/\s+(?:and|or|but|to|the|a|an|of|with|for|in|on|at|by|your|its|their|that|which|as|from|into)$/i, '');
}

const ACTION_PHRASE: Partial<Record<ActionType, RegExp>> = {
  action: /,? as (?:an|a Magic) action\b/gi,
  bonus: /,? as a Bonus Action\b/gi,
  reaction: /,? as a Reaction\b/gi,
};
const REQUIRED_SPEND = /\b(?:you can )?expend \d+ \w+ Points? to /i;
const HEADING_PARAGRAPH = /^([A-Z][\w'’-]*(?:\s+(?:of|the|and|or|[A-Z][\w'’-]*)){0,4})\.\s/;

/**
 * Seed a clause from rules text. `action` drops the wording the "Your turn"
 * group already says ("as a Bonus Action"); a required spend moves out of the
 * clause because the cost parenthetical carries it.
 */
export function seedClause(text: string, opts: { max?: number; action?: ActionType } = {}): string {
  const max = opts.max ?? SUMMARY_MAX;
  let clause = firstSentence(text)
    .replace(/^As (?:a|an) (?:Bonus Action|Reaction|Magic action|action|Utilize action),\s*/i, '')
    .replace(/^On your turn,\s*/i, '')
    .replace(/^You (?:have|gain)\s+/i, '')
    .replace(/^you can\s+/i, '')
    .replace(/\b(Str|Dex|Con|Int|Wis|Cha|Prof)\.(?=\s)/g, '$1')
    .replace(/\bft\.(?=[\s,;)]|$)/g, 'ft')
    .replace(/,(?=[A-Za-z])/g, ', ')
    .replace(/[.!?:]$/, '');
  const phrase = opts.action ? ACTION_PHRASE[opts.action] : undefined;
  if (phrase) clause = clause.replace(phrase, '');
  const spend = clause.match(REQUIRED_SPEND);
  if (spend && !/\b(?:or|alternatively,)\s*$/i.test(clause.slice(0, spend.index))) clause = clause.replace(REQUIRED_SPEND, '');

  // A pointer sentence ("…the benefits below") gets the run-in headings it points at.
  if (/\b(?:below|the following(?: \w+)?)$/.test(clause)) {
    const headings = text.split('\n\n').slice(1).map((p) => p.match(HEADING_PARAGRAPH)?.[1]).filter(Boolean);
    if (headings.length > 0) {
      clause = /^the following(?: \w+)?$/i.test(clause)
        ? headings.join(', ')
        : `${clause.replace(/\s+below$/, '')}: ${headings.join(', ')}`;
    }
  }
  const limit = Math.max(max, opts.max ? max : SOFT_MAX);
  if (clause.length > limit) {
    // Keep the effect, not the trigger (the feature's name usually implies it):
    // the part after "…, you can", or the main clause after a leading "If …,".
    const i = clause.lastIndexOf(', you can ');
    const main = clause.match(/^(?:If|When|Whenever|While|Once per turn,? (?:when|if)|Immediately after)\b[^,]*,\s*(.+)$/i);
    if (i > 0 && clause.length - i > 30) clause = clause.slice(i + ', you can '.length);
    else if (main && main[1].length >= 25) clause = main[1].replace(/^you (?:can |have |gain )?/i, '');
    clause = clause.replace(/^take (?:a|an) (?:Bonus Action|Reaction|Magic action|action) to\s+/i, '');
  }
  if (clause.length > limit) clause = cutAtBoundary(clause, max);
  if (COMMON_START.test(clause)) clause = clause[0].toLowerCase() + clause.slice(1);
  return clause.trim();
}

/** Context for shorts that carry numbers: the class level for class features, else the total level. */
export function summaryContext(c: Partial<PlayerCharacter>, group?: string): ShortContext {
  const classes = c.classes?.length ? c.classes : deriveClasses(c.class_name ?? '', c.level ?? 1, c.subclass ?? '');
  const cls = classes.find((k) => k.class_name.toLowerCase() === (group ?? '').trim().toLowerCase());
  return {
    level: cls?.level ?? c.level ?? 1,
    mods: {
      str: abilityModifier(c.str_score ?? 10),
      dex: abilityModifier(c.dex_score ?? 10),
      con: abilityModifier(c.con_score ?? 10),
      int: abilityModifier(c.int_score ?? 10),
      wis: abilityModifier(c.wis_score ?? 10),
      cha: abilityModifier(c.cha_score ?? 10),
    },
    pb: c.proficiency_bonus ?? 2,
  };
}

type SummarySource = Pick<FeatureEntry, 'name' | 'summary' | 'full_text' | 'group' | 'action'>;

/** What the parser stores as `summary`: the table's short, else a clause seeded from the text. */
export function featureSummary(f: SummarySource, ctx: ShortContext): string {
  return shortFor(f.name, f.group, ctx) ?? seedClause(f.full_text || f.summary || '', { action: f.action });
}

/**
 * The clause to show for a stored feature. A one-line summary (the parser's or
 * the DM's) is used as written; a pre-v3 paragraph is replaced by the table's
 * short or re-seeded.
 */
export function clauseOf(f: SummarySource, ctx: ShortContext): string {
  const s = (f.summary ?? '').trim();
  if (s && s.length <= 120 && !/[.!?]$/.test(s)) return s;
  return featureSummary({ ...f, summary: s }, ctx);
}

const textOf = (f: Pick<FeatureEntry, 'full_text' | 'summary'>) => f.full_text || f.summary || '';

/** The paragraph a run-in heading introduces: "Flurry of Blows. You can expend 1 Focus Point…". */
export function runInParagraph(f: Pick<FeatureEntry, 'full_text' | 'summary'>, label: string): string | null {
  for (const p of textOf(f).split('\n\n')) {
    if (p.toLowerCase().startsWith(`${label.toLowerCase()}.`)) return p.slice(label.length + 1).trim();
  }
  return null;
}

export function optionText(f: Pick<FeatureEntry, 'option_details'>, name: string): string | null {
  return f.option_details?.find((o) => featureKey(o.name) === featureKey(name))?.text ?? null;
}

// The sentence that introduces a feature's use of one action type.
const ACTION_SENTENCE: Partial<Record<ActionType, RegExp>> = {
  action: /^As (?:a Magic|an) action\b/i,
  bonus: /^(?:As a Bonus Action\b|You can (?:take|use) a Bonus Action\b)/i,
  reaction: /^(?:As a Reaction\b|You can take a Reaction\b)/i,
};

function actionSentence(text: string, action: ActionType): string | null {
  const pattern = ACTION_SENTENCE[action];
  return pattern ? sentences(text).find((s) => pattern.test(s)) ?? null : null;
}

/**
 * The clause for one activation line, or null when the activation has no
 * text of its own (then it shares the feature's line). Its own text is, in
 * order: the table's short for the label, a run-in paragraph, the chosen
 * option's text, or, when it is the feature's only activation of its type,
 * the feature's "As a Bonus Action, …" sentence.
 */
export function activationSummary(
  f: Pick<FeatureEntry, 'full_text' | 'summary' | 'group' | 'option_details' | 'activations'>,
  a: FeatureActivation,
  ctx: ShortContext,
): string | null {
  if (a.summary) return a.summary;
  const short = shortFor(a.label, f.group, ctx);
  if (short) return short;
  const own = runInParagraph(f, a.label) ?? optionText(f, a.label);
  if (own) return seedClause(own, { action: a.action }) || null;
  if ((f.activations ?? []).filter((b) => b.action === a.action).length === 1) {
    const sentence = actionSentence(textOf(f), a.action);
    if (sentence) return seedClause(sentence, { action: a.action }) || null;
  }
  return null;
}

const MASTERY_OPTION = new RegExp(`\\((${MASTERY_PROPERTIES.join('|')})\\)$`, 'i');

/** A chosen option's clause: the mastery's one-liner for "Greatsword (Graze)", else the short or a seed. */
export function optionSummary(name: string, text: string, group: string | undefined, ctx: ShortContext): string {
  const mastery = name.match(MASTERY_OPTION)?.[1];
  if (mastery) return MASTERY_EFFECTS[mastery[0].toUpperCase() + mastery.slice(1).toLowerCase()] ?? seedClause(text);
  return shortFor(name, group, ctx) ?? seedClause(text);
}

const EXPEND = /\b(or |alternatively, )?(?:you can )?expend (\d+) (\w+) Points?\b/i;

/** "You can expend 1 Focus Point to…" → "1 Focus"; an optional spend ("…or expend…") → '' (the clause says it). */
export function expendCost(text: string): string {
  const m = text.match(EXPEND);
  return m && !m[1] ? `${m[2]} ${m[3]}` : '';
}
