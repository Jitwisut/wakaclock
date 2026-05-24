import React, { useState } from 'react';

import { Image, Palette, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ImageGeneratorFormProps {
  isGenerating: boolean;
  onGenerate: (params: GenerationParams) => void;
}

export interface GenerationParams {
  aspectRatio: string;
  count: number;
  negativePrompt: string;
  prompt: string;
  quality: string;
  seed: string;
  style: string;
}

const styles = [
  'Realistic',
  'Digital Art',
  'Fantasy',
  'Anime',
  'Photographic',
  'Illustration',
  'Abstract',
  'Vintage',
];

const aspectRatios = [
  { value: '1:1', label: 'Square (1:1)' },
  { value: '16:9', label: 'Landscape (16:9)' },
  { value: '9:16', label: 'Portrait (9:16)' },
  { value: '4:3', label: 'Classic (4:3)' },
  { value: '3:2', label: 'Photo (3:2)' },
];

const qualities = ['Standard', 'High', 'Ultra'];

const quickPrompts = [
  { label: 'Futuristic City', icon: Sparkles },
  { label: 'Fantasy Dragon', icon: Palette },
  { label: 'Abstract Art', icon: Image },
  { label: 'Nature Scene', icon: Wand2 },
];

function CardFormContent({ onGenerate, isGenerating }: ImageGeneratorFormProps) {
  const [formData, setFormData] = useState<GenerationParams>({
    prompt: '',
    negativePrompt: '',
    style: 'Realistic',
    aspectRatio: '1:1',
    quality: 'Standard',
    count: 2,
    seed: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    onGenerate(formData);
  };

  const handleQuickPrompt = (prompt: string) => {
    setFormData((prev) => ({ ...prev, prompt }));
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Prompt */}
        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            className="min-h-[100px]"
            id="prompt"
            onChange={(e) => setFormData((prev) => ({ ...prev, prompt: e.target.value }))}
            placeholder="Describe the image you want to generate..."
            value={formData.prompt}
          />
          <p className="text-muted-foreground text-xs">
            Be specific and descriptive for better results
          </p>
        </div>

        {/* Negative Prompt */}
        <div className="space-y-2">
          <Label htmlFor="negative-prompt">Negative Prompt (Optional)</Label>
          <Textarea
            className="min-h-[80px] resize-none"
            id="negative-prompt"
            onChange={(e) => setFormData((prev) => ({ ...prev, negativePrompt: e.target.value }))}
            placeholder="What you don't want in the image..."
            value={formData.negativePrompt}
          />
        </div>

        {/* Style and Aspect Ratio */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Style</Label>
            <Select
              onValueChange={(value) => setFormData((prev) => ({ ...prev, style: value }))}
              value={formData.style}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {styles.map((style) => (
                  <SelectItem key={style} value={style}>
                    {style}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Aspect Ratio</Label>
            <Select
              onValueChange={(value) => setFormData((prev) => ({ ...prev, aspectRatio: value }))}
              value={formData.aspectRatio}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aspectRatios.map((ratio) => (
                  <SelectItem key={ratio.value} value={ratio.value}>
                    {ratio.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quality and Count */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Quality</Label>
            <Select
              onValueChange={(value) => setFormData((prev) => ({ ...prev, quality: value }))}
              value={formData.quality}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {qualities.map((quality) => (
                  <SelectItem key={quality} value={quality}>
                    {quality}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Count</Label>
            <Select
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, count: Number.parseInt(value, 10) }))
              }
              value={formData.count.toString()}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((count) => (
                  <SelectItem key={count} value={count.toString()}>
                    {count} Image{count > 1 ? 's' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Seed */}
        <div className="space-y-2">
          <Label htmlFor="seed">Seed (Optional)</Label>
          <Input
            id="seed"
            onChange={(e) => setFormData((prev) => ({ ...prev, seed: e.target.value }))}
            placeholder="Random seed for reproducibility"
            value={formData.seed}
          />
        </div>

        {/* Generate Button */}
        <Button className="w-full" disabled={isGenerating} size="lg" type="submit">
          {isGenerating ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              Generate Image
            </>
          )}
        </Button>
      </form>

      {/* Quick Prompts */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Quick Prompts</Label>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((quick) => {
            const Icon = quick.icon;
            return (
              <Button
                className="justify-start"
                key={quick.label}
                onClick={() => handleQuickPrompt(quick.label)}
                size="sm"
                variant="outline"
              >
                <Icon className="h-3 w-3" />
                {quick.label}
              </Button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export const ImageGeneratorForm: React.FC<ImageGeneratorFormProps> = ({
  onGenerate,
  isGenerating,
}) => (
  <>
    {/* Desktop */}
    <ScrollArea className="hidden h-full min-h-0 lg:block">
      <Card>
        <CardContent className="space-y-6">
          <CardFormContent isGenerating={isGenerating} onGenerate={onGenerate} />
        </CardContent>
      </Card>
    </ScrollArea>

    {/* Mobile */}
    <div className="block space-y-4 overflow-y-auto px-4 pb-4 lg:hidden">
      <CardFormContent isGenerating={isGenerating} onGenerate={onGenerate} />
    </div>
  </>
);
