import { useState } from 'react';

import { FileSearchIcon, LayoutGridIcon, ListIcon, MenuIcon, Search } from 'lucide-react';

import { AddNoteModal } from '@/app/dashboard/(auth)/apps/notes/add-note-modal';
import { notes } from '@/app/dashboard/(auth)/apps/notes/data';
import NoteListItem from '@/app/dashboard/(auth)/apps/notes/note-list-item';
import { NoteMobileSidebar } from '@/app/dashboard/(auth)/apps/notes/note-sidebar';
import type { Note } from '@/app/dashboard/(auth)/apps/notes/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function NoteContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'masonry'>('masonry');

  const filteredNotes = notes.filter((note: Note) =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative flex max-w-md flex-1 space-x-3 xl:space-x-0">
          <NoteMobileSidebar>
            <Button className="flex shrink-0 xl:hidden" size="icon" variant="outline">
              <MenuIcon />
            </Button>
          </NoteMobileSidebar>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
            <Input
              className="w-full pl-10"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes"
              value={searchQuery}
            />
          </div>
        </div>
        <div className="flex">
          <div className="hidden overflow-hidden rounded-md border xl:flex">
            <Button
              className="rounded-none"
              onClick={() => setViewMode('masonry')}
              size="sm"
              variant={viewMode === 'masonry' ? 'default' : 'ghost'}
            >
              <LayoutGridIcon className="h-4 w-4" />
            </Button>
            <Button
              className="rounded-none"
              onClick={() => setViewMode('list')}
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="block xl:hidden">
            <AddNoteModal />
          </div>
        </div>
      </div>

      {searchQuery && filteredNotes.length === 0 && (
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-muted/30 mb-4 rounded-full p-6">
            <FileSearchIcon className="text-muted-foreground h-12 w-12" />
          </div>
          <h3 className="mb-2 text-xl font-medium">No notes found</h3>
          <p className="text-muted-foreground max-w-md">
            {`We couldn't find any notes matching "${searchQuery}".`}
          </p>
          {searchQuery && (
            <Button className="mt-4" variant="outline">
              Clear all filters
            </Button>
          )}
        </div>
      )}

      <div
        className={cn('group', {
          'box-border columns-1 gap-4 [column-fill:_balance] group-data-[theme-content-layout=centered]/layout:columns-3 group-data-[theme-content-layout=full]/layout:columns-1 sm:group-data-[theme-content-layout=full]:columns-2 md:group-data-[theme-content-layout=full]/layout:columns-3 lg:columns-2 xl:group-data-[theme-content-layout=full]/layout:columns-4':
            viewMode === 'masonry',
        })}
        data-view-mode={viewMode}
      >
        {filteredNotes.map((note: Note) => (
          <NoteListItem key={note.id} note={note} />
        ))}
      </div>
    </div>
  );
}
