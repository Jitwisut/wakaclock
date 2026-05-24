'use client';

import React, { useState } from 'react';

import { PlusIcon } from '@radix-ui/react-icons';
import { Check, Edit2, Trash2, X } from 'lucide-react';

import { noteLabels } from '@/app/dashboard/(auth)/apps/notes/data';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  children: React.ReactNode;
}

export function EditLabelsModal({ children }: Props) {
  const [editingLabelId, setEditingLabelId] = useState<null | number>(null);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('bg-red-500');

  const availableColors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-blue-500',
    'bg-indigo-500',
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-screen max-w-96 overflow-y-scroll lg:overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Labels</DialogTitle>
        </DialogHeader>

        <div>
          {/* Existing labels */}
          <div className="space-y-1">
            {noteLabels.map((label) => (
              <div className="flex items-center justify-between rounded-md py-1" key={label.id}>
                {editingLabelId && editingLabelId === label.id ? (
                  <div className="flex flex-1 items-center">
                    <Input className="me-2 h-8" defaultValue={label.title} />
                    <Button onClick={() => setEditingLabelId(null)} size="icon" variant="ghost">
                      <Check />
                    </Button>
                    <Button onClick={() => setEditingLabelId(null)} size="icon" variant="ghost">
                      <X />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className={`size-3 shrink-0 rounded-full ${label.color}`} />
                      <span>{label.title}</span>
                      <span className="text-muted-foreground text-xs">6</span>
                    </div>
                    <div className="flex items-center">
                      <Button
                        onClick={() => setEditingLabelId(label.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Edit2 />
                      </Button>
                      <Button size="icon" variant="ghost">
                        <Trash2 className="text-red-500" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new label */}
          <div className="border-t pt-6">
            <h4 className="mb-2 text-sm font-medium">Add New Label</h4>
            <div className="relative flex items-center gap-2">
              <div className="absolute start-3 shrink-0">
                <div className={`size-3 rounded-full ${newLabelColor}`} />
              </div>
              <Input
                className="flex-1 ps-9"
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="New label name"
                value={newLabelName}
              />
              <Button disabled={!newLabelName.trim()} size="icon">
                <PlusIcon />
              </Button>
            </div>

            {/* Color picker */}
            <div className="mt-4 flex items-center gap-2">
              <Label className="text-muted-foreground block text-xs">Select color</Label>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((color) => (
                  <button
                    className={`size-5 rounded-full ${color} ${
                      newLabelColor === color ? 'ring-primary ring-2 ring-offset-2' : ''
                    }`}
                    key={color}
                    onClick={() => setNewLabelColor(color)}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
