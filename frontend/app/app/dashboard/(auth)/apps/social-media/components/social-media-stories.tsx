'use client';

import { useState } from 'react';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { HeartIcon, PlusIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Reel,
  ReelContent,
  ReelControls,
  ReelFooter,
  ReelImage,
  ReelItem,
  ReelMuteButton,
  ReelNavigation,
  ReelPlayButton,
  ReelProgress,
  ReelVideo,
} from '@/components/ui/reel';
import { cn } from '@/lib/utils';

import { reels } from '../data';

export function SocialMediaStories() {
  const [showReel, setShowReel] = useState(false);
  const [activeReelId, setActiveReelId] = useState<number | string>();

  /*
  This code snippet moves the clicked reel item to the very top, so when
   the reel modal opens, the story I selected is shown first.
   */
  const orderedReels = activeReelId
    ? [
        reels.find((reel) => reel.id === activeReelId)!,
        ...reels.filter((reel) => reel.id !== activeReelId),
      ]
    : reels;

  function handleReelClick(id: number | string) {
    setActiveReelId(id);
    setShowReel(true);
  }

  return (
    <>
      <Carousel
        className="w-full"
        opts={{
          align: 'start',
          dragFree: true,
        }}
      >
        <CarouselContent className="ml-0 py-1.5 select-none">
          <div className="group flex cursor-pointer flex-col items-center gap-2 px-2">
            <Avatar className="ring-muted group-hover:ring-primary/10 size-10 ring-2 lg:size-14">
              <AvatarFallback>
                <PlusIcon className="opacity-50" />
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground max-w-16 truncate text-xs">Create</span>
          </div>
          {reels.map((reel) => (
            <div key={reel.id} onClick={() => handleReelClick(reel.id)}>
              <div className="flex cursor-pointer flex-col items-center gap-2 px-1 hover:opacity-80 lg:px-2">
                <Avatar
                  className={cn('size-10 outline-2 outline-offset-3 lg:size-14', {
                    'outline-green-600': !reel.isRead,
                    'outline-black/20 dark:outline-white/20': reel.isRead,
                  })}
                >
                  <AvatarImage src={reel.avatar} />
                  <AvatarFallback>{reel.username[0]}</AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground max-w-16 truncate text-xs">
                  {reel.username}
                </span>
              </div>
            </div>
          ))}
        </CarouselContent>
      </Carousel>

      <Dialog onOpenChange={setShowReel} open={showReel}>
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle />
          </DialogHeader>
        </VisuallyHidden>
        <DialogContent className="overflow-hidden border-0 p-0" showCloseIcon={false}>
          <Reel data={orderedReels}>
            <ReelProgress />
            <ReelContent>
              {(reel) => (
                <ReelItem key={reel.id}>
                  {reel.type === 'video' && <ReelVideo src={reel.src} />}
                  {reel.type === 'image' && <ReelImage alt="" src={reel.src} />}
                  <ReelFooter className="flex justify-between">
                    <div className="text-white">
                      <h5 className="text-lg font-semibold">{reel.title}</h5>
                      <p className="text-sm opacity-90">{reel.description}</p>
                    </div>
                    <Button className="rounded-full bg-white/30" size="icon-lg" variant="secondary">
                      <HeartIcon className="fill-white/80 text-white/80" />
                    </Button>
                  </ReelFooter>
                </ReelItem>
              )}
            </ReelContent>
            <ReelNavigation />
            <ReelControls className="end-0 top-0 bottom-auto left-auto bg-transparent">
              <div className="flex gap-2">
                <ReelPlayButton />
                <ReelMuteButton />
              </div>
            </ReelControls>
          </Reel>
        </DialogContent>
      </Dialog>
    </>
  );
}
