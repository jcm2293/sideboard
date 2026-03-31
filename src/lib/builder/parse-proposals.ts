import type { ProposedElement, ProposalType } from '@/types';

const VALID_TYPES: ProposalType[] = ['location', 'npc', 'faction', 'lore', 'plot_arc', 'world_meta'];

const SAVE_BLOCK_REGEX = /:::save:(\w+)\s*\n([\s\S]*?)\n:::/g;

export function parseProposals(content: string): ProposedElement[] {
  const proposals: ProposedElement[] = [];
  let match;

  while ((match = SAVE_BLOCK_REGEX.exec(content)) !== null) {
    const type = match[1] as ProposalType;
    const jsonStr = match[2].trim();

    if (!VALID_TYPES.includes(type)) continue;

    try {
      const data = JSON.parse(jsonStr);
      proposals.push({ type, data });
    } catch {
      // Skip malformed JSON
    }
  }

  return proposals;
}

export interface ContentSegment {
  type: 'text' | 'proposal';
  content?: string;
  proposal?: ProposedElement;
  proposalIndex?: number;
}

export function segmentContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match;
  let proposalIndex = 0;

  const regex = /:::save:(\w+)\s*\n([\s\S]*?)\n:::/g;

  while ((match = regex.exec(content)) !== null) {
    // Text before this block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: 'text', content: text });
    }

    const type = match[1] as ProposalType;
    const jsonStr = match[2].trim();

    if (VALID_TYPES.includes(type)) {
      try {
        const data = JSON.parse(jsonStr);
        segments.push({
          type: 'proposal',
          proposal: { type, data },
          proposalIndex: proposalIndex++,
        });
      } catch {
        // Show as text if JSON is invalid
        segments.push({ type: 'text', content: match[0] });
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) segments.push({ type: 'text', content: text });
  }

  return segments;
}
