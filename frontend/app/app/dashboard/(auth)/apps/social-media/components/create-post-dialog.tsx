'use client';

import { useState } from 'react';

import { ImageIcon, Plus, Video } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export function CreatePostDialog() {
  const [newPostType, setNewPostType] = useState<'image' | 'text' | 'video'>('text');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="mt-4 w-full" variant="outline">
          <Plus />
          Create Post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* User Header */}
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src="https://i.pravatar.cc/150?img=13" />
              <AvatarFallback>XA</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">Toby Belhome</p>
              <p className="text-muted-foreground text-xs">Public</p>
            </div>
          </div>

          {/* Post Type Selection */}
          <div className="flex gap-2">
            <Button
              onClick={() => setNewPostType('text')}
              size="sm"
              variant={newPostType === 'text' ? 'default' : 'outline'}
            >
              Text
            </Button>
            <Button
              onClick={() => setNewPostType('image')}
              size="sm"
              variant={newPostType === 'image' ? 'default' : 'outline'}
            >
              <ImageIcon />
              Photo
            </Button>
            <Button
              onClick={() => setNewPostType('video')}
              size="sm"
              variant={newPostType === 'video' ? 'default' : 'outline'}
            >
              <Video />
              Video
            </Button>
          </div>

          {/* Text Area */}
          <Textarea className="min-h-32 resize-none" placeholder="What's on your mind?" />

          {/* Media Preview */}
          {newPostType === 'image' && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <ImageIcon className="text-muted-foreground/50 mx-auto size-8" />
              <p className="text-muted-foreground mt-2 text-sm">Add photos to your post</p>
              <Button className="mt-2" size="sm" variant="outline">
                Upload Photo
              </Button>
            </div>
          )}

          {newPostType === 'video' && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Video className="text-muted-foreground/50 mx-auto size-8" />
              <p className="text-muted-foreground mt-2 text-sm">Add video to your post</p>
              <Button className="mt-2" size="sm" variant="outline">
                Upload Video
              </Button>
            </div>
          )}

          {/* Action Icons */}
          <div className="flex items-center justify-end">
            <Button>Post</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
