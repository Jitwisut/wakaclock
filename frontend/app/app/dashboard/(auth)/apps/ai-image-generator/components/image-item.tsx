import { Download, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { GeneratedImage } from './generated-image';

interface ImageItemProps {
  image: GeneratedImage;
  onDeleteImage: (id: string) => void;
}

export default function ImageItem({ image, onDeleteImage }: ImageItemProps) {
  const handleDownload = async () => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `generated-image-${image.id}.png`;
      document.body.append(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
      toast.success('Image downloaded successfully!');
    } catch {
      toast.error('Failed to download image');
    }
  };

  const handleViewImage = () => {
    window.open(image.url, '_blank');
  };

  return (
    <div
      className="group bg-card relative overflow-hidden rounded-lg border transition-all duration-300 hover:shadow-md"
      key={image.id}
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          alt={image.prompt}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          src={image.url}
        />
        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20" />

        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 flex gap-1 transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">
          <Button
            className="bg-background/90 hover:bg-background h-8 w-8"
            onClick={handleViewImage}
            size="icon"
            variant="secondary"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            className="bg-background/90 hover:bg-background h-8 w-8"
            onClick={handleDownload}
            size="icon"
            variant="secondary"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            className="h-8 w-8"
            onClick={() => onDeleteImage(image.id)}
            size="icon"
            variant="destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image info */}
      <div className="space-y-2 p-3">
        <p className="text-muted-foreground line-clamp-2 text-xs">{image.prompt}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Badge className="text-xs" variant="outline">
              {image.style}
            </Badge>
            <Badge className="text-xs" variant="outline">
              {image.aspectRatio}
            </Badge>
          </div>
          <span className="text-muted-foreground text-xs" suppressHydrationWarning>
            {image.createdAt.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}
