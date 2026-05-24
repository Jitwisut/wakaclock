import { Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function HeroCard() {
  return (
    <Card className="relative h-[320px] overflow-hidden border-0">
      <img
        alt="Fitness motivation"
        className="absolute inset-0 h-full w-full object-cover"
        src="https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      <div className="relative flex h-full flex-col justify-end space-y-2 px-4">
        <h2 className="text-3xl font-bold text-balance text-white">Ignite Your Momentum</h2>
        <p className="text-sm text-white/90">Daily habits that compound into lasting results.</p>
      </div>
      <Button
        className="text-primary absolute top-6 right-6 rounded-full"
        size="icon"
        variant="outline"
      >
        <Play className="h-5 w-5 fill-current" />
      </Button>
    </Card>
  );
}
