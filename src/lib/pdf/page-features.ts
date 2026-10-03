// Features pages (sheet spec v3 §5.2): full rules text in two columns,
// grouped by class (in `classes` order, subclass in the header), then species
// traits, then feats. Mechanical features get a heading with their tags and
// summary; ribbons share one "Also" paragraph per group. No page refs.

import type { jsPDF } from 'jspdf';
import type { FeatureEntry, FeatureUses, PlayerCharacter, SpellEntry } from '@/types';
import { featureDc, grappleShoveDc } from '@/lib/character';
import { clauseOf, summaryContext } from '@/lib/feature-summary';
import { featureKey } from '@/data/class-reference';
import { MASTERY_EFFECTS, MASTERY_PROPERTIES } from '@/data/weapons';
import { C, CONTENT_W, PAGE, capsOpts, drawRich, fitText, fs, hline, layoutRich, ptMm, px, rect, text, type Run } from './sheet-kit';
import { classesOf, spellDetailsOf } from './sheet-data';
import { drawBand, drawResources } from './page-combat';

const COL_GAP = px(16);
const COL_W = (CONTENT_W - COL_GAP) / 2;
const BOTTOM = PAGE.h - PAGE.margin - px(6);
const BODY = fs(11);
const BODY_STEP = ptMm(BODY) * 1.38;
const HEAD = fs(12.5);
const HEAD_STEP = ptMm(HEAD) * 1.3;
const ascent = (size: number) => ptMm(size) * 0.72;

/** One line-sized piece of the flow. Headings keep with what follows them. */
interface Unit {
  height: number;
  draw: (x: number, y: number) => void;
  gapBefore?: number;
  keepWithNext?: boolean;
}

/** Rich lines → one unit per line, so long paragraphs can break across columns. */
function lineUnits(doc: jsPDF, lines: ReturnType<typeof layoutRich>, size: number, step: number, indent = 0, gapBefore = 0): Unit[] {
  return lines.map((line, i) => ({
    height: step,
    gapBefore: i === 0 ? gapBefore : 0,
    draw: (x, y) => drawRich(doc, [line], x + indent, y + ascent(size), step, size),
  }));
}

const RUN_IN = /^([A-Z][\w'’-]*(?:\s+(?:of|the|and|or|a|[A-Z][\w'’-]*)){0,4}\.)\s+(.*)$/;

/** A paragraph: a bold run-in heading when it opens with one, bullets as hanging-indented lines. */
function paragraphUnits(doc: jsPDF, para: string, gapBefore: number): Unit[] {
  const units: Unit[] = [];
  const lines = para.split('\n');
  lines.forEach((raw, i) => {
    const gap = i === 0 ? gapBefore : px(1);
    const bullet = raw.match(/^•\s*(.*)$/);
    if (bullet) {
      const laid = layoutRich(doc, [{ kind: 'text', text: bullet[1] }], COL_W - px(10), BODY);
      const first = lineUnits(doc, laid, BODY, BODY_STEP, px(10), gap);
      const draw0 = first[0].draw;
      first[0].draw = (x, y) => {
        text(doc, '•', x + px(2), y + ascent(BODY), { size: BODY, color: C.maroon });
        draw0(x, y);
      };
      units.push(...first);
      return;
    }
    const m = raw.match(RUN_IN);
    const runs: Run[] = m
      ? [
          { kind: 'text', text: m[1], style: 'bold', color: C.maroonInk },
          { kind: 'text', text: ` ${m[2]}` },
        ]
      : [{ kind: 'text', text: raw }];
    units.push(...lineUnits(doc, layoutRich(doc, runs, COL_W, BODY), BODY, BODY_STEP, 0, gap));
  });
  return units;
}

function usesLabel(u: FeatureUses): string {
  const per = u.per === 'turn' ? 'turn' : u.per === 'day' ? 'day' : `${u.per} rest`;
  if (u.pool) return `${u.count}-point pool / ${per}`;
  if (u.label && /points?$/i.test(u.label)) return `${u.count} points / ${per}`;
  return `${u.count} / ${per}`;
}

const ACTION_LABEL: Record<string, string> = { action: 'action', bonus: 'bonus action', reaction: 'reaction' };

/** The feature's own action; else the shared type of several activations (Deflect Attacks), not one sub-use's. */
function actionLabel(f: FeatureEntry): string {
  if (f.action && ACTION_LABEL[f.action]) return ACTION_LABEL[f.action];
  const acts = f.activations ?? [];
  const kinds = new Set(acts.map((a) => a.action));
  const only = acts.length >= 2 && kinds.size === 1 ? [...kinds][0] : undefined;
  return only && ACTION_LABEL[only] ? ACTION_LABEL[only] : '';
}

const MASTERY_OPTION = new RegExp(`^(.+?)\\s*\\((${MASTERY_PROPERTIES.join('|')})\\)$`, 'i');

function featureUnits(doc: jsPDF, c: PlayerCharacter, f: FeatureEntry, group: string | undefined): Unit[] {
  const units: Unit[] = [];
  // Pre-v3 records keep their text in `summary`; a v3 feature the export left empty has only its summary.
  const body = (f.full_text ?? f.summary ?? '').trim();
  const ctx = summaryContext(c, group);

  // Heading: name · parent · uses · action, then the summary when the text is long enough to need one.
  const tags = [f.parent, f.uses ? usesLabel(f.uses) : '', actionLabel(f)].filter(Boolean) as string[];
  const runs: Run[] = [{ kind: 'text', text: f.name, style: 'bold', color: C.maroon, size: HEAD }];
  if (tags.length > 0) runs.push({ kind: 'text', text: ` · ${tags.join(' · ')}`, color: C.muted, size: fs(10.5) });
  const summary = f.full_text != null && (body.length > 300 || body.length === 0) ? clauseOf({ ...f, group }, ctx) : '';
  if (summary) runs.push({ kind: 'text', text: ` · ${summary}`, style: 'italic', color: C.muted, size: fs(10.5) });
  const head = layoutRich(doc, runs, COL_W, HEAD);
  units.push({
    height: head.length * HEAD_STEP,
    gapBefore: px(9),
    keepWithNext: true,
    draw: (x, y) => drawRich(doc, head, x, y + ascent(HEAD), HEAD_STEP, HEAD),
  });

  body.split('\n\n').filter(Boolean).forEach((p, i) => units.push(...paragraphUnits(doc, p, i === 0 ? px(1.5) : px(4))));

  // Chosen options under the parent: masteries as one line plus their effects; others with their text.
  const masteries = (f.options ?? []).map((o) => o.match(MASTERY_OPTION)).filter((m): m is RegExpMatchArray => m != null);
  if (masteries.length > 0) {
    const line: Run[] = masteries.flatMap((m, i) => [
      ...(i > 0 ? [{ kind: 'text' as const, text: ' · ', color: C.muted }] : []),
      { kind: 'text' as const, text: `${m[1]}: ` },
      { kind: 'text' as const, text: m[2], style: 'bold' as const, color: C.maroonInk },
    ]);
    units.push(...lineUnits(doc, layoutRich(doc, line, COL_W, BODY), BODY, BODY_STEP, 0, px(4)));
    const seen = new Set<string>();
    for (const m of masteries) {
      const mastery = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase();
      if (seen.has(mastery) || !MASTERY_EFFECTS[mastery]) continue;
      seen.add(mastery);
      const def: Run[] = [
        { kind: 'text', text: mastery, style: 'bold', color: C.maroonInk },
        { kind: 'text', text: ` · ${MASTERY_EFFECTS[mastery]}` },
      ];
      units.push(...lineUnits(doc, layoutRich(doc, def, COL_W - px(10), BODY), BODY, BODY_STEP, px(10), px(1)));
    }
  }
  for (const option of (f.options ?? []).filter((o) => !MASTERY_OPTION.test(o))) {
    const detail = f.option_details?.find((o) => featureKey(o.name) === featureKey(option));
    if (detail?.text) {
      units.push(...paragraphUnits(doc, `${option}. ${detail.text.replace(/\n\n/g, ' ')}`, px(4)));
    } else {
      const chosen: Run[] = [{ kind: 'text', text: `Chosen: ${option}`, style: 'italic', color: C.muted }];
      units.push(...lineUnits(doc, layoutRich(doc, chosen, COL_W, BODY), BODY, BODY_STEP, 0, px(3)));
    }
  }
  return units;
}

/** The ribbons of a group in one paragraph: "Also. Fast Movement · +10 ft speed…; Danger Sense · …". */
function alsoUnits(doc: jsPDF, c: PlayerCharacter, ribbons: FeatureEntry[], group: string | undefined): Unit[] {
  if (ribbons.length === 0) return [];
  const ctx = summaryContext(c, group);
  const runs: Run[] = [{ kind: 'text', text: 'Also.', style: 'bold', color: C.maroon }];
  ribbons.forEach((f, i) => {
    const clause = clauseOf({ ...f, group }, ctx);
    runs.push({ kind: 'text', text: i === 0 ? ' ' : '; ' });
    runs.push({ kind: 'text', text: f.name, style: 'bold', color: C.maroonInk });
    if (clause) runs.push({ kind: 'text', text: ` · ${clause}` });
  });
  return lineUnits(doc, layoutRich(doc, runs, COL_W, BODY), BODY, BODY_STEP, 0, px(9));
}

function groupHeader(doc: jsPDF, title: string): Unit {
  const caps = title.toUpperCase();
  const opts = capsOpts(11, C.maroon, 0.14, 'bold');
  return {
    height: ptMm(opts.size) * 0.8 + px(4) + px(4),
    gapBefore: px(14),
    keepWithNext: true,
    draw: (x, y) => {
      const base = y + ptMm(opts.size) * 0.8;
      text(doc, caps, x, base, fitText(doc, caps, COL_W, opts));
      hline(doc, x, x + COL_W, base + px(4), C.maroon, px(1.5));
    },
  };
}

function innateUnits(doc: jsPDF, spells: SpellEntry[]): Unit[] {
  if (spells.length === 0) return [];
  const units: Unit[] = [groupHeader(doc, 'Innate spells')];
  for (const s of [...spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))) {
    const bits = [
      s.level === 0 ? 'cantrip' : `level ${s.level}`,
      s.free_uses ? `free ${s.free_uses.count}/${s.free_uses.per === 'short' ? 'SR' : 'LR'}` : s.level === 0 ? '' : 'at will',
      s.source.replace(/\s*\(.*\)$/, ''),
    ].filter(Boolean);
    const runs: Run[] = [
      { kind: 'text', text: s.name, style: 'bold', color: C.maroonInk },
      { kind: 'text', text: ` · ${bits.join(' · ')}`, color: C.muted },
    ];
    units.push(...lineUnits(doc, layoutRich(doc, runs, COL_W, BODY), BODY, BODY_STEP, 0, px(3)));
  }
  return units;
}

/** Species-only (or item) spells on a character with no class, subclass, feat, or invocation spells. */
export function innateSpellsOnly(c: PlayerCharacter): SpellEntry[] {
  const spells = spellDetailsOf(c);
  return spells.length > 0 && spells.every((s) => s.origin === 'species' || s.origin === 'item') ? spells : [];
}

function buildUnits(doc: jsPDF, c: PlayerCharacter): Unit[] {
  const units: Unit[] = [];
  const classes = classesOf(c);
  const classFeatures = (c.class_features ?? []).filter((f) => f.kind !== 'container');
  const addGroup = (title: string, features: FeatureEntry[], group: string | undefined) => {
    if (features.length === 0) return;
    units.push(groupHeader(doc, title));
    for (const f of features.filter((x) => x.kind !== 'ribbon')) units.push(...featureUnits(doc, c, f, group));
    units.push(...alsoUnits(doc, c, features.filter((x) => x.kind === 'ribbon'), group));
  };

  // One group per class, in `classes` order; features without a matching group
  // (older records) go with the first class.
  const claimed = new Set<FeatureEntry>();
  classes.forEach((cls, i) => {
    const mine = classFeatures.filter(
      (f) => (f.group ?? '').toLowerCase() === cls.class_name.toLowerCase() || (i === 0 && !classes.some((k) => k.class_name.toLowerCase() === (f.group ?? '').toLowerCase())),
    );
    mine.forEach((f) => claimed.add(f));
    addGroup([`${cls.class_name} ${cls.level}`, cls.subclass].filter(Boolean).join(' · '), mine, cls.class_name);
  });
  addGroup('Class features', classFeatures.filter((f) => !claimed.has(f)), undefined);
  addGroup([c.species, 'species traits'].filter(Boolean).join(' · '), (c.racial_traits ?? []).filter((f) => f.kind !== 'container'), undefined);
  addGroup('Feats', (c.feats ?? []).filter((f) => f.kind !== 'container'), undefined);
  units.push(...innateUnits(doc, innateSpellsOnly(c)));
  return units;
}

function featuresDetail(c: PlayerCharacter): string {
  const dc = featureDc(c);
  return dc.label === 'Grapple/Shove DC' ? `${dc.label} ${dc.value}` : `${dc.label} ${dc.value} · grapple/shove DC ${grappleShoveDc(c)}`;
}

/** Draws the Features pages; resources that didn't fit on page 1 lead the first one. */
export function drawFeaturesPages(doc: jsPDF, c: PlayerCharacter, opts: { withResources: boolean }): void {
  const units = buildUnits(doc, c);
  if (units.length === 0 && !opts.withResources) return;

  const newPage = (): number => {
    doc.addPage();
    rect(doc, 0, 0, PAGE.w, PAGE.h, { fill: C.parchment });
    return drawBand(doc, c, 'Features', featuresDetail(c)) + px(14);
  };
  let top = newPage();
  if (opts.withResources) top = drawResources(doc, c, top);

  let col = 0;
  let y = top;
  const colX = () => PAGE.margin + col * (COL_W + COL_GAP);
  const nextColumn = () => {
    if (col === 0) {
      col = 1;
    } else {
      col = 0;
      top = newPage();
    }
    y = top;
  };

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    // Room for this unit and everything chained to it by keepWithNext, plus the first unit after.
    let need = (y === top ? 0 : u.gapBefore ?? 0) + u.height;
    for (let j = i; units[j]?.keepWithNext && units[j + 1]; j++) need += (units[j + 1].gapBefore ?? 0) + units[j + 1].height;
    if (y + need > BOTTOM && y > top) nextColumn();
    if (y > top) y += u.gapBefore ?? 0;
    u.draw(colX(), y);
    y += u.height;
  }
}
