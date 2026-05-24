'use client';

import React from 'react';

import { History } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { ImageGallery } from './image-gallery';

import type { GeneratedImage } from './generated-image';

export default function HistorySheet() {
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const historicalImages: GeneratedImage[] = [
    {
      id: 'hist-1',
      url: 'https://picsum.photos/512/512?random=2001',
      prompt: 'Medieval castle on a misty mountain with dragons flying overhead',
      style: 'fantasy',
      aspectRatio: '16:9',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'hist-2',
      url: 'https://picsum.photos/512/512?random=2002',
      prompt: 'Steampunk airship floating above Victorian London cityscape',
      style: 'digital-art',
      aspectRatio: '1:1',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'hist-3',
      url: 'https://picsum.photos/512/512?random=2003',
      prompt: 'Bioluminescent forest with glowing mushrooms and fairy lights',
      style: 'fantasy',
      aspectRatio: '9:16',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'hist-4',
      url: 'https://picsum.photos/512/512?random=2004',
      prompt: 'Underwater coral reef with tropical fish and sea creatures',
      style: 'photographic',
      aspectRatio: '4:3',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
    {
      id: 'hist-5',
      url: 'https://picsum.photos/512/512?random=2005',
      prompt: 'Space station orbiting Earth with astronauts doing spacewalk',
      style: 'realistic',
      aspectRatio: '16:9',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  ];

  return (
    <Sheet onOpenChange={setHistoryOpen} open={historyOpen}>
      <SheetTrigger asChild>
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline">
                <History />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>History</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SheetTrigger>
      <SheetContent className="md:max-w-3xl" side="right">
        <SheetHeader>
          <SheetTitle>Image History</SheetTitle>
          <SheetDescription>Your previously generated images</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <ImageGallery
            images={historicalImages}
            isGenerating={false}
            onDeleteImage={() => toast.success('Historical image deleted')}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
