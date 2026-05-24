'use client';

import { useOnboardingStore } from '../store';

import { AccountTypeStep } from './account-type-step';
import { InterestsStep } from './interests-step';
import { WorkPreferencesStep } from './work-preferences-step';

const steps = [InterestsStep, WorkPreferencesStep, AccountTypeStep];

export default function Onboarding() {
  const { currentStep } = useOnboardingStore();
  const CurrentStepComponent = steps[currentStep];

  return (
    <div className="mx-auto max-w-3xl lg:pt-10">
      <CurrentStepComponent />
    </div>
  );
}
