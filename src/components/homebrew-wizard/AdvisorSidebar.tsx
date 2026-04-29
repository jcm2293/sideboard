'use client';

import { useEffect, useRef, useState } from 'react';
import { useWizard } from './WizardContext';
import type { WizardStep } from '@/lib/homebrew/wizard-reducer';

interface Props {
  step: WizardStep;
}

// Cheap stable signature of state-fields-relevant-to-advice. Used to debounce re-fetches.
function relevantSignature(state: ReturnType<typeof useWizard>['state'], step: WizardStep): string {
  const parts = [
    state.classId,
    state.level,
    state.subclassId ?? '',
    state.raceId ?? '',
    JSON.stringify(state.baseAbilities),
    state.fightingStyleId ?? '',
    state.classSkillProficiencies.sort().join(','),
    JSON.stringify(state.asiChoices),
    step,
  ];
  return parts.join('|');
}

export default function AdvisorSidebar({ step }: Props) {
  const { state } = useWizard();
  const [suggestion, setSuggestion] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSig = useRef<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Skip advisor on identity (mostly bookkeeping) and review (final summary).
  const enabled = step === 'class' || step === 'abilities' || step === 'levels';

  async function fetchSuggestion() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/character-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wizardState: state, currentStep: step }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `Advisor failed (${res.status})`);
      } else {
        setSuggestion(data.suggestion ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  // Debounced auto-refresh on state change relevant to advice.
  useEffect(() => {
    if (!enabled) return;
    const sig = relevantSignature(state, step);
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetchSuggestion();
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, state, step]);

  if (!enabled) return null;

  return (
    <aside className="card-parchment rounded-lg p-4 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-display text-sm text-accent">Sideboard&apos;s Suggestions</h3>
        <button
          onClick={fetchSuggestion}
          disabled={loading}
          title="Refresh suggestion"
          className="text-xs text-muted hover:text-accent disabled:opacity-50"
        >
          {loading ? '…' : '↻'}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : loading && !suggestion ? (
        <p className="text-xs text-muted italic">Thinking…</p>
      ) : suggestion ? (
        <p className="text-xs leading-relaxed whitespace-pre-wrap">{suggestion}</p>
      ) : (
        <p className="text-xs text-muted italic">Make a few choices and I&apos;ll chime in.</p>
      )}
    </aside>
  );
}
