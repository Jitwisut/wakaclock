'use client';

import { useState } from 'react';

import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useOnboardingStore } from '../store';

const interestOptions = [
  { name: 'Technology', emoji: '💻' },
  { name: 'Design', emoji: '🎨' },
  { name: 'Marketing', emoji: '📈' },
  { name: 'Finance', emoji: '💰' },
  { name: 'Healthcare', emoji: '🏥' },
  { name: 'Education', emoji: '📚' },
  { name: 'Sports', emoji: '⚽' },
  { name: 'Travel', emoji: '✈️' },
  { name: 'Food', emoji: '🍕' },
  { name: 'Music', emoji: '🎵' },
  { name: 'Art', emoji: '🖼️' },
  { name: 'Photography', emoji: '📸' },
  { name: 'Writing', emoji: '✍️' },
  { name: 'Gaming', emoji: '🎮' },
  { name: 'Fitness', emoji: '💪' },
  { name: 'Fashion', emoji: '👗' },
];

export function InterestsStep() {
  const { data, updateInterests, nextStep } = useOnboardingStore();
  const [selectedInterests, setSelectedInterests] = useState<string[]>(data.interests);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleNext = () => {
    updateInterests(selectedInterests);
    nextStep();
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <div className="bg-primary flex size-8 items-center justify-center rounded-full">
          <Sparkles className="text-primary-foreground size-4" />
        </div>
        <h1 className="text-2xl font-bold">What sparks your interest?</h1>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {interestOptions.map((interest) => (
            <div
              className={`hover:border-primary cursor-pointer rounded-md border px-4 py-6 ${
                selectedInterests.includes(interest.name) ? 'bg-primary/10 border-primary' : ''
              }`}
              key={interest.name}
              onClick={() => toggleInterest(interest.name)}
            >
              <div className="space-y-2 text-center">
                <div className="text-2xl">{interest.emoji}</div>
                <div>{interest.name}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-end">
        <Button disabled={selectedInterests.length === 0} onClick={handleNext} size="lg">
          Continue ({selectedInterests.length} selected)
        </Button>
      </div>
    </div>
  );
}
