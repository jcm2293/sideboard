'use client';

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import {
  wizardReducer,
  makeInitialState,
  type WizardState,
  type WizardAction,
} from '@/lib/homebrew/wizard-reducer';

interface WizardCtx {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}

const Ctx = createContext<WizardCtx | null>(null);

export function WizardProvider({
  classId,
  children,
}: {
  classId: string;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(wizardReducer, undefined, () => makeInitialState(classId));
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useWizard(): WizardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWizard must be inside <WizardProvider>');
  return ctx;
}
