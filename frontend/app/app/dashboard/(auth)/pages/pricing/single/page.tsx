'use client';

import { useState } from 'react';

import { Check } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

const FONT_MEDIUM = 'font-medium';
const TEXT_MUTED = 'text-muted-foreground';

const features = [
  'Unlimited access to all courses',
  'Personalized learning paths',
  'Progress tracking and analytics',
  'Offline viewing on mobile app',
  'Certificate of completion',
  '24/7 customer support',
];

const faqs = [
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit components, including Visa, MasterCard, American Express, and Discover. We also support PayPal for your convenience.',
  },
  {
    question: 'Can I cancel my subscription at any time?',
    answer:
      "Yes, you can cancel your subscription at any time. If you cancel, you'll continue to have access to the platform until the end of your current billing period.",
  },
  {
    question: 'Is there a limit to how many courses I can take?',
    answer:
      "No, there's no limit. With our Premium Plan, you have unlimited access to all courses on our platform. You can take as many courses as you like, at your own pace.",
  },
  {
    question: 'Do you offer a free trial?',
    answer:
      'We offer a 7-day free trial for new users. This allows you to explore our platform and content before committing to a subscription. No credit card is required for the trial.',
  },
  {
    question: 'Are the courses downloadable for offline viewing?',
    answer:
      'Yes, our mobile app allows you to download courses for offline viewing. This feature is available for both iOS and Android devices.',
  },
];

export default function Page() {
  const [isAnnual, setIsAnnual] = useState(false);

  const monthlyPrice = 14.99;
  const annualPrice = 149.99;

  const currentPrice = isAnnual ? annualPrice : monthlyPrice;
  const savings = (((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100).toFixed(0);

  return (
    <div className="lg:py-16">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 space-y-2 lg:mb-6">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
            Choose Your Learning Journey
          </h1>
          <p className="text-muted-foreground">
            Unlock a world of knowledge with our comprehensive e-learning platform
          </p>
        </div>
        <Card>
          <CardContent className="relative">
            <div className="flex flex-col lg:flex-row">
              {/* Left side: Content */}
              <div className="lg:w-2/3">
                <h2 className="mb-2 text-2xl font-bold">Pro Plan</h2>
                <p className="text-muted-foreground mb-6">
                  Everything you need to master new skills
                </p>

                <div className="block space-y-4 lg:hidden">
                  <div>
                    <span className="text-4xl font-bold">${currentPrice}</span>
                    <span className="text-muted-foreground ml-2">
                      /{isAnnual ? 'year' : 'month'}
                    </span>
                  </div>

                  <div className="mb-6 flex items-start justify-start space-x-4">
                    <span
                      className={`text-sm ${FONT_MEDIUM} ${!isAnnual ? FONT_MEDIUM : TEXT_MUTED}`}
                    >
                      Monthly
                    </span>
                    <Switch
                      aria-label="Toggle annual pricing"
                      checked={isAnnual}
                      onCheckedChange={setIsAnnual}
                    />
                    <span
                      className={`text-sm ${FONT_MEDIUM} ${isAnnual ? FONT_MEDIUM : TEXT_MUTED}`}
                    >
                      Annual
                    </span>
                  </div>
                </div>

                <ul className="mb-6 space-y-3">
                  {features.map((feature) => (
                    <li className="flex items-center" key={`feature-${feature}`}>
                      <Check className="mr-2 size-5 shrink-0 text-green-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground text-sm">
                  All subscriptions come with a 30-day money-back guarantee. Cancel anytime.
                </p>
              </div>

              <div className="flex flex-col justify-center space-y-6 md:w-1/3 lg:relative lg:border-s lg:ps-6">
                <div className="hidden space-y-4 lg:block">
                  <div className="text-center">
                    <span className="font-display text-4xl">${currentPrice}</span>
                    <span className="text-muted-foreground ml-2">
                      /{isAnnual ? 'year' : 'month'}
                    </span>
                  </div>

                  <div className="mb-6 flex items-center justify-center space-x-4">
                    <span
                      className={`text-sm ${FONT_MEDIUM} ${!isAnnual ? FONT_MEDIUM : TEXT_MUTED}`}
                    >
                      Monthly
                    </span>
                    <Switch
                      aria-label="Toggle annual pricing"
                      checked={isAnnual}
                      onCheckedChange={setIsAnnual}
                    />
                    <span
                      className={`text-sm ${FONT_MEDIUM} ${isAnnual ? FONT_MEDIUM : TEXT_MUTED}`}
                    >
                      Annual
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-2 lg:mt-0">
                  <Button className="w-full">Start Plan</Button>

                  {isAnnual && (
                    <Badge className="absolute end-4 top-2" variant="success">
                      Save {savings}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="my-6 lg:my-12">
          <h2 className="mb-4 text-xl font-semibold">Why Choose Our Platform?</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="lg:text-xl">Comprehensive Library</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Access thousands of courses across various disciplines
                </p>
              </CardContent>
            </Card>
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="lg:text-xl">Expert Instructors</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Learn from industry professionals and thought leaders
                </p>
              </CardContent>
            </Card>
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="lg:text-xl">Flexible Learning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Study at your own pace, anytime and anywhere
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion className="w-full" collapsible type="single">
              {faqs.map((faq) => (
                <AccordionItem key={`faq-${faq.question}`} value={`faq-${faq.question}`}>
                  <AccordionTrigger className="text-start">{faq.question}</AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
