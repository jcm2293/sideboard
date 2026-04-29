'use client';

import { use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { findHomebrewClass } from '@/data/homebrew-classes';
import { WizardProvider, useWizard } from '@/components/homebrew-wizard/WizardContext';
import StepIdentity from '@/components/homebrew-wizard/StepIdentity';
import StepClassChoices from '@/components/homebrew-wizard/StepClassChoices';
import StepAbilities from '@/components/homebrew-wizard/StepAbilities';
import StepLevels from '@/components/homebrew-wizard/StepLevels';
import StepManual from '@/components/homebrew-wizard/StepManual';
import StepReview from '@/components/homebrew-wizard/StepReview';
import AdvisorSidebar from '@/components/homebrew-wizard/AdvisorSidebar';
import { assembleFromWizardState } from '@/lib/homebrew/assemble-character';
import { validateStep } from '@/lib/homebrew/validation';
import {
  WIZARD_STEPS,
  STEP_LABELS,
  type WizardStep,
} from '@/lib/homebrew/wizard-reducer';
import { useState } from 'react';

export default function NewHomebrewCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = use(params);
  const search = useSearchParams();
  const classId = search.get('class') ?? '';
  const classDef = findHomebrewClass(classId);
  const router = useRouter();

  if (!classDef) {
    return (
      <div className="max-w-3xl px-4 py-8">
        <p className="text-sm text-muted">
          Unknown homebrew class: <code>{classId || '(none)'}</code>.{' '}
          <button
            onClick={() => router.push(`/campaign/${campaignId}/players`)}
            className="text-accent hover:underline"
          >
            Back to Players
          </button>
        </p>
      </div>
    );
  }

  return (
    <WizardProvider classId={classId}>
      <WizardShell campaignId={campaignId} />
    </WizardProvider>
  );
}

function WizardShell({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const { state } = useWizard();
  const [step, setStep] = useState<WizardStep>('identity');
  const classDef = findHomebrewClass(state.classId);
  if (!classDef) return null;

  const validation = validateStep(state, step);
  const idx = WIZARD_STEPS.indexOf(step);
  const prev = idx > 0 ? WIZARD_STEPS[idx - 1] : null;
  const next = idx < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[idx + 1] : null;

  function handleCreate() {
    const assembled = assembleFromWizardState(state);
    sessionStorage.setItem('parsedCharacter', JSON.stringify(assembled));
    router.push(`/campaign/${campaignId}/players/new?parsed=true`);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-xs text-muted uppercase tracking-wider">{classDef.source}</p>
        <h1 className="font-display text-2xl text-accent">Create a {classDef.name}</h1>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        {WIZARD_STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`px-3 py-1.5 rounded ${
              step === s ? 'bg-accent text-amber-50' : 'bg-surface-light text-muted hover:text-foreground'
            }`}
          >
            {i + 1}. {STEP_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Decisions remaining banner */}
      {!validation.ok && validation.remaining.length > 0 && (
        <div className="mb-4 p-3 border border-amber-500/40 bg-amber-50/40 rounded text-xs">
          <strong>Still to decide on this step:</strong> {validation.remaining.join(' · ')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Main step body */}
        <div className="card-parchment rounded-lg p-6">
          {step === 'identity' && <StepIdentity />}
          {step === 'class' && <StepClassChoices />}
          {step === 'abilities' && <StepAbilities />}
          {step === 'levels' && <StepLevels />}
          {step === 'manual' && <StepManual />}
          {step === 'review' && <StepReview />}
        </div>

        {/* Advisor sidebar */}
        <div className="lg:order-2">
          <AdvisorSidebar step={step} />
        </div>
      </div>

      {/* Nav buttons */}
      <div className="mt-6 flex gap-2 justify-between">
        <button
          onClick={() => router.push(`/campaign/${campaignId}/players`)}
          className="btn-ghost px-4 py-2 rounded text-sm"
        >
          Cancel
        </button>
        <div className="flex gap-2">
          {prev && (
            <button onClick={() => setStep(prev)} className="btn-ghost px-4 py-2 rounded text-sm">
              ← Back
            </button>
          )}
          {step === 'review' ? (
            <button
              onClick={handleCreate}
              className="btn-primary px-4 py-2 rounded text-sm"
            >
              Create Character →
            </button>
          ) : (
            next && (
              <button
                onClick={() => setStep(next)}
                disabled={!validation.ok}
                className="btn-primary px-4 py-2 rounded text-sm disabled:opacity-50"
                title={validation.ok ? '' : `Pending: ${validation.remaining.join('; ')}`}
              >
                Next →
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
