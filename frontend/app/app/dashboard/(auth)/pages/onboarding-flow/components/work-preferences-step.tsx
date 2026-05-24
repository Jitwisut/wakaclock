'use client';

import { Briefcase } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { useOnboardingStore } from '../store';

export function WorkPreferencesStep() {
  const { data, updateWorkPreferences, nextStep, prevStep } = useOnboardingStore();

  const handleNext = () => {
    const { workStyle, experience, availability } = data.workPreferences;
    if (workStyle && experience && availability) {
      nextStep();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <div className="bg-primary flex size-8 items-center justify-center rounded-full">
          <Briefcase className="text-primary-foreground size-4" />
        </div>
        <h1 className="text-2xl font-bold">Tell us about your work style</h1>
      </div>

      <div className="space-y-8">
        <div className="space-y-4">
          <div className="font-medium">Preferred work style</div>
          <RadioGroup
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
            onValueChange={(value) => updateWorkPreferences({ workStyle: value })}
            value={data.workPreferences.workStyle}
          >
            {[
              { value: 'remote', label: 'Remote', desc: 'Work from anywhere', icon: '🏠' },
              { value: 'hybrid', label: 'Hybrid', desc: 'Mix of remote and office', icon: '🔄' },
              {
                value: 'office',
                label: 'In-office',
                desc: 'Traditional office setting',
                icon: '🏢',
              },
            ].map((option) => (
              <div className="relative" key={option.value}>
                <RadioGroupItem className="peer sr-only" id={option.value} value={option.value} />
                <Label
                  className="peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:border-primary hover:border-primary flex cursor-pointer flex-col items-center justify-center rounded-md border p-4 text-base"
                  htmlFor={option.value}
                >
                  <span className="text-2xl">{option.icon}</span>
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-muted-foreground text-center text-sm">{option.desc}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <div className="font-medium">Experience level</div>
          <RadioGroup
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
            onValueChange={(value) => updateWorkPreferences({ experience: value })}
            value={data.workPreferences.experience}
          >
            {[
              { value: 'entry', label: 'Entry Level', desc: '0-2 years experience', icon: '🌱' },
              { value: 'mid', label: 'Mid Level', desc: '3-5 years experience', icon: '🚀' },
              { value: 'senior', label: 'Senior Level', desc: '6+ years experience', icon: '⭐' },
            ].map((option) => (
              <div className="relative" key={option.value}>
                <RadioGroupItem className="peer sr-only" id={option.value} value={option.value} />
                <Label
                  className="peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:border-primary hover:border-primary flex cursor-pointer flex-col items-center justify-center rounded-md border p-4 text-base"
                  htmlFor={option.value}
                >
                  <span className="text-2xl">{option.icon}</span>
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-muted-foreground text-center text-sm">{option.desc}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <div className="font-medium">Availability</div>
          <RadioGroup
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
            onValueChange={(value) => updateWorkPreferences({ availability: value })}
            value={data.workPreferences.availability}
          >
            {[
              { value: 'full-time', label: 'Full-time', desc: '40+ hours per week', icon: '⏰' },
              {
                value: 'part-time',
                label: 'Part-time',
                desc: '20-30 hours per week',
                icon: '⏳',
              },
              { value: 'contract', label: 'Contract', desc: 'Project-based work', icon: '📋' },
            ].map((option) => (
              <div className="relative" key={option.value}>
                <RadioGroupItem className="peer sr-only" id={option.value} value={option.value} />
                <Label
                  className="peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:border-primary hover:border-primary flex cursor-pointer flex-col items-center justify-center rounded-md border p-4 text-base"
                  htmlFor={option.value}
                >
                  <span className="text-2xl">{option.icon}</span>
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-muted-foreground text-center text-sm">{option.desc}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex justify-between">
          <Button onClick={prevStep} variant="outline">
            Back
          </Button>
          <Button onClick={handleNext} size="lg">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
