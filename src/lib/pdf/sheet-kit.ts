// Drawing kit for the v3 character sheet (docs/sheet-mockup-v3.html): colour
// and type tokens, the mockup's px measurements scaled onto Letter with 0.5 in
// margins, and primitives — spaced labels, chips, dots, bubbles, section heads,
// and rich text that wraps across styles.

import type { jsPDF } from 'jspdf';

export const PAGE = { w: 215.9, h: 279.4, margin: 12.7 };
export const CONTENT_W = PAGE.w - 2 * PAGE.margin;

/** The mockup's content box is 764 px wide; ours is CONTENT_W mm. */
const MM_PER_PX = CONTENT_W / 764;
/** A mockup length in px → mm. */
export const px = (n: number) => n * MM_PER_PX;
/** A mockup font size in px → pt, at the same scale. */
export const fs = (n: number) => n * MM_PER_PX * (72 / 25.4);
/** pt → mm, for line heights. */
export const ptMm = (pt: number) => (pt * 25.4) / 72;

export const C = {
  parchment: '#F4E4C1',
  cream: '#FDF1DC',
  maroon: '#58180D',
  maroonInk: '#3E1109',
  gold: '#B8860B',
  goldSoft: '#D9B35C',
  ink: '#1A1210',
  muted: '#6E5F4E',
  rule: '#C9A96E',
  bandText: '#F6EAD0',
  bandSub: '#E6D4B0',
  // The mockup's translucent tints, pre-blended onto their backgrounds.
  headTint: '#F5E4C2', // rgba(237,214,168,.5) on cream
  rowTint: '#F0DCB3', // rgba(237,214,168,.55) on parchment
  rowRule: '#E1C99C', // rgba(201,169,110,.45) on parchment
};

// Times stands in for Cinzel (display) and Crimson Pro (body) until the
// embedded fonts land; everything measures through jsPDF, so a font swap
// reflows without layout changes.
export const FONT = { display: 'times', body: 'times' };

export type Style = 'normal' | 'bold' | 'italic' | 'bolditalic';

// ──────────────────────────────────────────────────────────────────────────
// Text encoding
// ──────────────────────────────────────────────────────────────────────────

// The built-in Times font only covers WinAnsi (CP1252). Any character outside
// it garbles jsPDF's output — mojibake plus broken glyph-width math that
// stretches the whole line — so every string is transliterated first.
const WINANSI_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const NON_WINANSI_MAP: Record<string, string> = {
  '→': '->', '⇒': '->', '←': '<-', '↔': '<->',
  '−': '-', '‐': '-', '‑': '-',
  '●': '•', '○': 'o', '▪': '•', '★': '*', '☆': '*',
  '✓': 'x', '✔': 'x', '✗': 'x',
  '≤': '<=', '≥': '>=', '≠': '!=',
  '′': "'", '″': '"', 'ʼ': "'",
  'ﬁ': 'fi', 'ﬂ': 'fl',
  '\u00a0': ' ', '\u2009': ' ', '\u202f': ' ', '\u200b': '',
};

export function sanitizeWinAnsi(text: string): string {
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

/** Route every string through sanitizeWinAnsi at jsPDF's text entry points. */
export function hardenPdfText(doc: jsPDF): jsPDF {
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
  const origWidth = doc.getTextWidth.bind(doc);
  doc.getTextWidth = ((text: string) => origWidth(sanitizeWinAnsi(text))) as typeof doc.getTextWidth;
  return doc;
}

// ──────────────────────────────────────────────────────────────────────────
// Colour and primitive shapes
// ──────────────────────────────────────────────────────────────────────────

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export const fill = (doc: jsPDF, hex: string) => doc.setFillColor(...rgb(hex));
export const stroke = (doc: jsPDF, hex: string) => doc.setDrawColor(...rgb(hex));
export const ink = (doc: jsPDF, hex: string) => doc.setTextColor(...rgb(hex));

export function rect(doc: jsPDF, x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; lw?: number }) {
  if (o.fill) fill(doc, o.fill);
  if (o.stroke) {
    stroke(doc, o.stroke);
    doc.setLineWidth(o.lw ?? px(1));
  }
  doc.rect(x, y, w, h, o.fill && o.stroke ? 'FD' : o.fill ? 'F' : 'S');
}

export function hline(doc: jsPDF, x1: number, x2: number, y: number, color: string, lw = px(1)) {
  stroke(doc, color);
  doc.setLineWidth(lw);
  doc.line(x1, y, x2, y);
}

export function vline(doc: jsPDF, x: number, y1: number, y2: number, color: string, lw = px(1)) {
  stroke(doc, color);
  doc.setLineWidth(lw);
  doc.line(x, y1, x, y2);
}

/** Dotted rule (the resources rows). */
export function dottedLine(doc: jsPDF, x1: number, x2: number, y: number, color: string) {
  stroke(doc, color);
  doc.setLineWidth(px(1));
  doc.setLineDashPattern([px(1), px(2)], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

/** Proficiency dot: hollow for none/half, filled for proficient, filled with a ring for expertise. */
export function profDot(doc: jsPDF, cx: number, cy: number, level: 'none' | 'half' | 'proficient' | 'expertise') {
  const r = px(3.5);
  stroke(doc, C.maroon);
  doc.setLineWidth(px(1));
  if (level === 'proficient' || level === 'expertise') {
    fill(doc, C.maroon);
    doc.circle(cx, cy, level === 'expertise' ? r * 0.7 : r, 'F');
    if (level === 'expertise') doc.circle(cx, cy, r, 'S');
  } else {
    doc.circle(cx, cy, r, 'S');
    if (level === 'half') {
      fill(doc, C.maroon);
      doc.circle(cx, cy, r * 0.35, 'F');
    }
  }
}

/** Empty "mark as used" bubble. */
export function bubble(doc: jsPDF, cx: number, cy: number, r = px(5)) {
  fill(doc, C.cream);
  stroke(doc, C.maroon);
  doc.setLineWidth(px(1.2));
  doc.circle(cx, cy, r, 'FD');
}

export function diamond(doc: jsPDF, cx: number, cy: number, half: number, color: string) {
  fill(doc, color);
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

// ──────────────────────────────────────────────────────────────────────────
// Text
// ──────────────────────────────────────────────────────────────────────────

export interface TextOpts {
  size: number;
  style?: Style;
  color?: string;
  font?: string;
  align?: 'left' | 'center' | 'right';
  /** Letter spacing in mm. */
  spacing?: number;
}

function setFont(doc: jsPDF, o: TextOpts) {
  doc.setFont(o.font ?? FONT.body, o.style ?? 'normal');
  doc.setFontSize(o.size);
}

// jsPDF's getTextWidth applies the font's kerning pairs, but text() draws
// unkerned, so "HP, you" measured short and the next word overlapped the
// comma. Measure the way it draws.
type UnitWidthOptions = Parameters<jsPDF['getStringUnitWidth']>[1];

export function measure(doc: jsPDF, s: string, o: TextOpts): number {
  setFont(doc, o);
  const text = sanitizeWinAnsi(s);
  const units = doc.getStringUnitWidth(text, { doKerning: false } as UnitWidthOptions);
  return (units * doc.getFontSize()) / doc.internal.scaleFactor + (o.spacing ?? 0) * Math.max(0, text.length - 1);
}

/** Draw at baseline y. Alignment is computed here so letter spacing is included. */
export function text(doc: jsPDF, s: string, x: number, y: number, o: TextOpts): number {
  const width = measure(doc, s, o);
  const left = o.align === 'right' ? x - width : o.align === 'center' ? x - width / 2 : x;
  setFont(doc, o);
  ink(doc, o.color ?? C.ink);
  // jsPDF only emits Tc when a char space is set, and Tc persists in the PDF
  // text state, so spacing would leak into every later string. Set it, draw,
  // and reset to an explicit 0.
  if (o.spacing) {
    doc.setCharSpace(o.spacing);
    doc.text(s, left, y);
    doc.setCharSpace(0);
  } else doc.text(s, left, y);
  return width;
}

/** Shrink letter spacing, then size, until a single line fits maxW. */
export function fitText(doc: jsPDF, s: string, maxW: number, o: TextOpts): TextOpts {
  let opts = o;
  while (measure(doc, s, opts) > maxW && (opts.spacing ?? 0) > 0.05) opts = { ...opts, spacing: (opts.spacing ?? 0) * 0.7 };
  while (measure(doc, s, opts) > maxW && opts.size > 4.5) opts = { ...opts, size: opts.size - 0.25 };
  return opts;
}

/** Wrapped plain text, greedy by word with the same metrics as measure(); returns the lines. */
export function wrap(doc: jsPDF, s: string, maxWidth: number, o: TextOpts): string[] {
  const lines: string[] = [];
  for (const para of sanitizeWinAnsi(s).split('\n')) {
    let line = '';
    for (const word of para.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(doc, next, o) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** Display-face caps label, letter-spaced (the mockup's Cinzel labels). */
export function capsOpts(sizePx: number, color: string, trackingEm: number, style: Style = 'normal'): TextOpts {
  const size = fs(sizePx);
  return { size, style, color, font: FONT.display, spacing: ptMm(size) * trackingEm };
}

// ──────────────────────────────────────────────────────────────────────────
// Chips
// ──────────────────────────────────────────────────────────────────────────

export type ChipVariant = 'plain' | 'slot' | 'free';
const CHIP = () => capsOpts(7.5, C.maroonInk, 0.1);

export function chipWidth(doc: jsPDF, label: string): number {
  return measure(doc, label.toUpperCase(), CHIP()) + px(8);
}

/** A chip whose text baseline sits at y. Returns its width. */
export function chip(doc: jsPDF, label: string, x: number, y: number, variant: ChipVariant = 'plain'): number {
  const o = CHIP();
  const w = chipWidth(doc, label);
  const h = ptMm(o.size) + px(3);
  const top = y - ptMm(o.size) * 0.78 - px(1.5);
  const slot = variant === 'slot';
  fill(doc, slot ? C.maroon : C.cream);
  stroke(doc, slot || variant === 'free' ? C.maroon : C.gold);
  doc.setLineWidth(px(1));
  doc.roundedRect(x, top, w, h, px(2), px(2), 'FD');
  text(doc, label.toUpperCase(), x + px(4), y, { ...o, color: slot ? C.bandText : C.maroonInk });
  return w;
}

// ──────────────────────────────────────────────────────────────────────────
// Rich text: runs of mixed style that wrap as one paragraph
// ──────────────────────────────────────────────────────────────────────────

export type Run =
  | { kind: 'text'; text: string; style?: Style; color?: string; size?: number }
  | { kind: 'chip'; text: string; variant?: ChipVariant };

interface Placed {
  run: Run;
  x: number;
  width: number;
}

export function layoutRich(doc: jsPDF, runs: Run[], maxWidth: number, baseSize: number): Placed[][] {
  const lines: Placed[][] = [[]];
  let x = 0;
  const place = (run: Run, width: number, isSpace: boolean) => {
    if (isSpace && x === 0) return; // no leading spaces
    if (!isSpace && x > 0 && x + width > maxWidth) {
      // Trailing space on the line we're leaving doesn't count.
      const line = lines[lines.length - 1];
      const last = line[line.length - 1];
      if (last && last.run.kind === 'text' && !last.run.text.trim()) line.pop();
      lines.push([]);
      x = 0;
    }
    lines[lines.length - 1].push({ run, x, width });
    x += width;
  };

  for (const run of runs) {
    if (run.kind === 'chip') {
      place({ kind: 'text', text: ' ' }, measure(doc, ' ', { size: baseSize }), true);
      place(run, chipWidth(doc, run.text), false);
      continue;
    }
    const o: TextOpts = { size: run.size ?? baseSize, style: run.style };
    // A no-break space glues a token ("60\u00a0ft"); it's drawn as a plain
    // space because jsPDF mis-measures U+00A0.
    for (const token of run.text.split(/([ \t\n]+)/)) {
      if (!token) continue;
      const isSpace = !token.trim();
      const piece: Run = { ...run, text: isSpace ? ' ' : token.replace(/\u00a0/g, ' ') };
      place(piece, measure(doc, piece.text, o), isSpace);
    }
  }
  return lines.filter((l) => l.length > 0);
}

/** Draw laid-out rich lines from baseline y; returns the baseline after the last line. */
export function drawRich(doc: jsPDF, lines: Placed[][], x: number, y: number, lineHeight: number, baseSize: number): number {
  for (const line of lines) {
    for (const p of line) {
      if (p.run.kind === 'chip') chip(doc, p.run.text, x + p.x, y, p.run.variant);
      else if (p.run.text.trim()) {
        text(doc, p.run.text, x + p.x, y, { size: p.run.size ?? baseSize, style: p.run.style, color: p.run.color });
      }
    }
    y += lineHeight;
  }
  return y;
}

// ──────────────────────────────────────────────────────────────────────────
// Section heading (the mockup's h3): spaced caps, maroon rule, optional note
// ──────────────────────────────────────────────────────────────────────────

/**
 * Draws the heading with its top at y; returns the y where content starts.
 * The title gives up letter spacing before it collides with the note;
 * `noteDot` puts a proficiency dot before the note (the abilities legend).
 */
export function sectionHead(doc: jsPDF, title: string, x: number, y: number, w: number, note?: string, noteDot = false): number {
  const caps = title.toUpperCase();
  const base0 = capsOpts(11, C.maroon, 0.14, 'bold');
  const noteOpts: TextOpts = { size: fs(10.5), color: C.muted, align: 'right' };
  const noteTextW = note ? measure(doc, note, noteOpts) : 0;
  const noteW = note ? noteTextW + (noteDot ? px(11) : 0) + px(8) : 0;
  const base = y + ptMm(base0.size) * 0.8;
  text(doc, caps, x, base, fitText(doc, caps, w - noteW, base0));
  if (note) {
    text(doc, note, x + w, base, noteOpts);
    if (noteDot) profDot(doc, x + w - noteTextW - px(4) - px(3.5), base - ptMm(noteOpts.size) * 0.3, 'proficient');
  }
  const ruleY = base + px(4);
  hline(doc, x, x + w, ruleY, C.maroon, px(1.5));
  return ruleY + px(5);
}
