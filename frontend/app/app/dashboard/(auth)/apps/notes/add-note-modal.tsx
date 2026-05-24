'use client';

import React from 'react';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ArchiveIcon, Check, ImageIcon, PenSquare, Tag, Trash2Icon } from 'lucide-react';
import Image from 'next/image';

import { noteLabels } from '@/app/dashboard/(auth)/apps/notes/data';
import type { NoteLabel } from '@/app/dashboard/(auth)/apps/notes/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { MinimalTiptapEditor } from '@/components/ui/custom/minimal-tiptap';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { Content } from '@tiptap/react';

export function AddNoteModal() {
  const [imagePreview, setImagePreview] = React.useState<null | string>(null);
  const [value, setValue] = React.useState<Content>('');
  const [selectedTags, setSelectedTags] = React.useState<NoteLabel[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full">
          <PenSquare />
          <span className="hidden md:block">Add Note</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-screen max-w-(--breakpoint-sm) overflow-y-scroll p-0 lg:overflow-y-auto">
        {imagePreview && (
          <figure>
            <Image
              alt="shadcn/ui"
              className="aspect-video w-full rounded-tl-md rounded-tr-md object-cover"
              height={200}
              src={imagePreview}
              unoptimized
              width={200}
            />
          </figure>
        )}
        <VisuallyHidden>
          <DialogTitle>Add Note</DialogTitle>
        </VisuallyHidden>

        <form className={cn({ 'p-6': !imagePreview, 'p-6 pt-0': imagePreview })}>
          <div className="space-y-6">
            <Input
              className="mb-4 rounded-none border-0 px-0 text-xl focus-visible:ring-0"
              name="title"
              placeholder="Title"
            />

            <MinimalTiptapEditor
              autofocus
              className="w-full"
              editable
              editorClassName="focus:outline-hidden"
              editorContentClassName="p-5"
              onChange={setValue}
              output="html"
              placeholder="Enter note description..."
              value={value}
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Input
                        accept="image/*"
                        className="hidden"
                        id="picture"
                        onChange={handleFileChange}
                        type="file"
                      />
                      <Button size="icon" type="button" variant="ghost">
                        <label className="cursor-pointer" htmlFor="picture">
                          <ImageIcon className="size-4" />
                        </label>
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Add image</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <Tag className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                          <Command>
                            <CommandInput className="h-9" placeholder="Search tags..." />
                            <CommandList>
                              <CommandEmpty>No labels found.</CommandEmpty>
                              <CommandGroup className="p-2">
                                {noteLabels &&
                                  noteLabels.length > 0 &&
                                  noteLabels.map((label) => (
                                    <CommandItem
                                      className="flex items-center py-2"
                                      key={label.id}
                                      onSelect={() => {
                                        if (selectedTags.includes(label)) {
                                          return setSelectedTags(
                                            selectedTags.filter((item) => item.id !== label.id)
                                          );
                                        }

                                        return setSelectedTags(
                                          [...noteLabels].filter((u) =>
                                            [...selectedTags, label].includes(u)
                                          )
                                        );
                                      }}
                                    >
                                      <div className="flex grow items-center gap-2">
                                        <span
                                          className={cn('block size-3 rounded-full', label.color)}
                                        />
                                        <span className="text-sm leading-none">{label.title}</span>
                                        {selectedTags.includes(label) ? (
                                          <Check className="text-primary ms-auto size-3" />
                                        ) : null}
                                      </div>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Add tag</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <ArchiveIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Archive</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Button>Add Note</Button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <Badge key={tag.id} variant="outline">
                {tag.title}
              </Badge>
            ))}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
