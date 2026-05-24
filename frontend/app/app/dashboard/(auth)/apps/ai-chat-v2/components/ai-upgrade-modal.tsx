'use client';

import React, { useState } from 'react';

import { Check, Crown, Sparkles, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const AIUpgradePricingModal = ({ children }: { children: React.ReactNode }) => {
  const [selectedPlan, setSelectedPlan] = useState<null | string>(null);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: '/month',
      description: 'Perfect for getting started',
      icon: <Sparkles className="h-5 w-5" />,
      features: ['10 messages per day', 'Basic AI models', 'Standard support', 'Web access only'],
      current: true,
      buttonText: 'Current Plan',
      buttonVariant: 'outline' as const,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$20',
      period: '/month',
      description: 'For power users and professionals',
      icon: <Zap className="h-5 w-5" />,
      features: [
        'Unlimited messages',
        'Advanced AI models (iBeeBot 4o)',
        'Priority support',
        'API access',
        'Custom integrations',
        'Advanced analytics',
      ],
      popular: true,
      buttonText: 'Upgrade to Pro',
      buttonVariant: 'default' as const,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$99',
      period: '/month',
      description: 'For teams and organizations',
      icon: <Crown className="h-5 w-5" />,
      features: [
        'Everything in Pro',
        'Team collaboration',
        'SSO & advanced security',
        'Dedicated support',
        'Custom models',
        'On-premise deployment',
      ],
      buttonText: 'Contact Sales',
      buttonVariant: 'outline' as const,
    },
  ];

  const handleUpgrade = (planId: string) => {
    setSelectedPlan(planId);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-screen max-w-(--breakpoint-sm) overflow-y-scroll md:max-w-5xl lg:overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upgrade Your iBeeBot Experience</DialogTitle>
          <DialogDescription>
            Choose the perfect plan to unlock the full potential of AI-powered conversations
          </DialogDescription>
        </DialogHeader>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              className={`relative rounded-lg border p-6 transition-all hover:shadow-lg ${
                plan.popular
                  ? 'border-primary scale-105 shadow-lg'
                  : 'border-border hover:border-primary/50'
              }`}
              key={plan.id}
            >
              {plan.popular && (
                <Badge className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}

              <div className="mb-4 flex items-center gap-2">
                <div
                  className={`rounded-md p-2 ${plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                  {plan.icon}
                </div>
                <h3 className="text-lg font-semibold">{plan.name}</h3>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{plan.description}</p>
              </div>

              <ul className="mb-6 space-y-3">
                {plan.features.map((feature) => (
                  <li className="flex items-start gap-2" key={`${plan.id}-${feature}`}>
                    <Check className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                disabled={plan.current || selectedPlan === plan.id}
                onClick={() => handleUpgrade(plan.id)}
                variant={plan.buttonVariant}
              >
                {selectedPlan === plan.id ? 'Processing...' : plan.buttonText}
              </Button>
            </div>
          ))}
        </div>

        <div className="text-muted-foreground mt-8 text-center text-sm">
          <p>All plans include a 14-day free trial. Cancel anytime.</p>
          <p className="mt-1">
            Need a custom solution?{' '}
            <span className="text-primary cursor-pointer hover:underline">Contact us</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
