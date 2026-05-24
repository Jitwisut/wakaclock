import Image from 'next/image';

import { noteLabels } from '@/app/dashboard/(auth)/apps/notes/data';
import type { Note } from '@/app/dashboard/(auth)/apps/notes/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export default function NoteListItem({ note }: { note: Note }) {
  return (
    <Card className="relative mb-4 block break-inside-avoid gap-0 overflow-hidden rounded-md transition-shadow group-data-[view-mode=list]:py-0 group-data-[view-mode=masonry]:pt-0 hover:shadow-lg md:group-data-[view-mode=list]:flex md:group-data-[view-mode=list]:flex-row">
      {note.type === 'image' && note.image && (
        <figure className="top-0 h-full shrink-0 md:group-data-[view-mode=list]:w-62">
          <Image
            alt="shadcn/ui"
            className="aspect-square h-full w-full object-cover group-data-[view-mode=list]:md:absolute md:group-data-[view-mode=list]:w-62"
            height={150}
            src={note.image}
            unoptimized
            width={200}
          />
        </figure>
      )}
      <CardContent className="pt-6 group-data-[view-mode=list]:pb-6">
        <div className="space-y-4">
          <h3 className="font-display text-xl lg:text-2xl">{note.title}</h3>
          <p className="text-muted-foreground text-sm">{note.content}</p>
          {note.type === 'checklist' && note.items && (
            <ul className="peer space-y-4">
              {note.items.map((item) => (
                <li
                  className={cn('flex items-center space-x-2', {
                    'text-muted-foreground line-through': item.checked,
                  })}
                  key={item.text}
                >
                  <Checkbox
                    className="peer"
                    defaultChecked={item.checked}
                    id={`checklist_${item.text}`}
                  />
                  <label
                    className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 aria-checked:line-through"
                    htmlFor={`checklist_${item.text}`}
                  >
                    {item.text}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {note.type === 'text' && note.content && (
            <p className="text-muted-foreground whitespace-pre-line">{note.content}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {note.labels.map((labelId) => {
              const label = noteLabels.find((e) => e.id === labelId);
              if (!label) return null;
              return (
                <Badge key={labelId} variant="outline">
                  <span className={cn('me-1 size-2 shrink-0 rounded-full', label.color)} />
                  {label.title}
                </Badge>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
