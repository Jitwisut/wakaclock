import React from 'react';

import { Image as ImageIcon } from 'lucide-react';

import ImageItem from '@/app/dashboard/(auth)/apps/ai-image-generator/components/image-item';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { GeneratedImage } from './generated-image';

interface ImageGalleryProps {
  images: GeneratedImage[];
  isGenerating: boolean;
  onDeleteImage: (id: string) => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  isGenerating,
  onDeleteImage,
}) => {
  if (images.length === 0 && !isGenerating) {
    return (
      <div className="flex items-center justify-center lg:h-full">
        <div className="space-y-4 text-center">
          <div className="bg-muted mx-auto flex h-16 w-16 items-center justify-center rounded-lg">
            <ImageIcon className="text-muted-foreground h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-muted-foreground text-lg font-medium">No Images Generated Yet</h3>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm">
              Start by entering a prompt and clicking &#34;Generate Image&#34; to create your first
              AI-generated image.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full min-h-0 *:h-full">
      <div className="space-y-4">
        <div className="space-y-4">
          {isGenerating && (
            <div className="border-muted-foreground/25 space-y-4 rounded-lg border-2 border-dashed p-8 text-center">
              <div className="mx-auto h-12 w-12">
                <div className="from-primary/20 to-primary-glow/20 flex h-full w-full animate-pulse items-center justify-center rounded-lg bg-gradient-to-br">
                  <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">
                  Generating your image...
                </p>
                <p className="text-muted-foreground text-xs">This may take a few moments</p>
              </div>
            </div>
          )}

          {images.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {images.map((image) => (
                <ImageItem image={image} key={image.id} onDeleteImage={onDeleteImage} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
};
