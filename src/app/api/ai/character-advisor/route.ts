// LLM advisor for the homebrew character creation wizard.
//
// Uses Claude Sonnet 4.6 — Opus is overkill for short build advice and slower.
// One-shot, non-streaming. Front-end fires on relevant state changes (debounced)
// and on manual refresh; the response is rendered as a small advisor card.

import Anthropic from '@anthropic-ai/sdk';
import type { WizardState, WizardStep } from '@/lib/homebrew/wizard-reducer';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a D&D 5e character build advisor. The user is creating a character through a wizard. Based on the current state of the character, provide CONCISE, OPINIONATED suggestions for the decision they're about to make.

Rules:
- Maximum 3 sentences per suggestion. No preamble. No "great question" — just the suggestion.
- Be specific and tactical. Mention actual game mechanics, not generic advice.
- Reference the character's class, subclass, race, and current ability scores when relevant.
- If multiple good options exist, briefly mention the tradeoff. Don't be wishy-washy.
- If the user has already made a choice that locks something in, acknowledge it.
- NEVER tell the user what they MUST do. Use phrases like "consider", "I'd lean toward", "good options here".
- If the situation is ambiguous or there's no clear best choice, say so honestly.

Be the friend who plays a lot of D&D and gives quick, useful advice. Not a rules lawyer. Not a hand-holder.`;

function summarizeState(state: WizardState): string {
  const lines: string[] = [];
  lines.push(`Class: ${state.classId} (level ${state.level})`);
  if (state.subclassId) lines.push(`Subclass: ${state.subclassId}`);
  if (state.raceId) lines.push(`Race: ${state.raceId}`);
  if (state.background.name) lines.push(`Background: ${state.background.name}`);

  const allBonuses = [
    ...state.raceChoices.abilityIncreases,
    ...state.background.abilityIncreases,
  ];
  const finalScores = (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((ab) => {
    const bonus = allBonuses.filter((b) => b.ability === ab).reduce((s, b) => s + b.amount, 0);
    return `${ab} ${state.baseAbilities[ab]}${bonus ? `+${bonus}` : ''}`;
  });
  lines.push(`Abilities (base+racial): ${finalScores.join(', ')}`);

  if (state.classSkillProficiencies.length) {
    lines.push(`Class skills: ${state.classSkillProficiencies.join(', ')}`);
  }
  if (state.fightingStyleId) lines.push(`Fighting style: ${state.fightingStyleId}`);
  if (state.cantripsKnown.length) {
    lines.push(`Cantrips: ${state.cantripsKnown.join(', ')}`);
  }
  const knownSpells = Object.entries(state.spellsKnownByLevel)
    .filter(([, arr]) => arr.length > 0)
    .map(([lvl, arr]) => `L${lvl}: ${arr.join(', ')}`);
  if (knownSpells.length) lines.push(`Spells: ${knownSpells.join('; ')}`);

  const asiSummary = Object.entries(state.asiChoices).map(([lvl, ch]) => {
    if (ch.type === 'ability_2') return `L${lvl}: +2 ${ch.ability}`;
    if (ch.type === 'ability_1_1') return `L${lvl}: +1 ${ch.abilityA}, +1 ${ch.abilityB}`;
    if (ch.type === 'feat') return `L${lvl}: feat (${ch.feat.name || 'unnamed'})`;
    return `L${lvl}: undecided`;
  });
  if (asiSummary.length) lines.push(`ASI choices: ${asiSummary.join('; ')}`);

  return lines.join('\n');
}

const STEP_DECISION: Record<WizardStep, string> = {
  identity: 'Choosing race, subclass, and filling in background details.',
  class: 'Picking class skill proficiencies, fighting style, cantrips, and spells known.',
  abilities: 'Allocating ability scores via point buy or standard array.',
  levels: 'Making per-level decisions, especially ASI choices (ability boost vs feat).',
  manual: 'Filling in equipment and currency.',
  review: 'Reviewing the final character before creation.',
};

export async function POST(request: Request) {
  try {
    const { wizardState, currentStep } = (await request.json()) as {
      wizardState: WizardState;
      currentStep: WizardStep;
    };

    const userPrompt = `${summarizeState(wizardState)}

The user is on Step "${currentStep}": ${STEP_DECISION[currentStep] ?? 'making a choice'}.
Provide 1–3 sentences of advice for this decision.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return Response.json({ suggestion: text });
  } catch (err) {
    const errorText = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: errorText }, { status: 500 });
  }
}
