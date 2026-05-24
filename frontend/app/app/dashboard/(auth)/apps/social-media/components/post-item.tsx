'use client';

import { useState } from 'react';

import {
  BadgeCheck,
  Bookmark,
  EyeOff,
  Flag,
  Heart,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Send,
  Share2,
  UserX,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

import type { Post } from '../data';

export function PostItem({ post }: { post: Post }) {
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set(['1']));
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  const toggleLike = (postId: string) => {
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const toggleSave = (postId: string) => {
    setSavedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const toggleCommentLike = (commentId: string) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const handleAddComment = (postId: string) => {
    const commentText = newComments[postId]?.trim();
    if (!commentText) return;

    setNewComments((prev) => ({ ...prev, [postId]: '' }));
    setExpandedComments((prev) => new Set(prev).add(postId));
  };

  return (
    <div className="space-y-3 rounded-xl border">
      <div className="space-y-3 px-4">
        {/* Post Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={post.avatar} />
              <AvatarFallback>{post.username[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold">{post.username}</span>
                {post.verified && <BadgeCheck className="text-foreground size-4" />}
              </div>
              <span className="text-muted-foreground text-xs">{post.timeAgo}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Bookmark />
                Save Post
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link2 />
                Copy Link
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share2 />
                Share to...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <EyeOff />
                Hide Post
              </DropdownMenuItem>
              <DropdownMenuItem>
                <UserX />
                Unfollow @{post.username}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Flag />
                Report Post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Post Content */}
        {post.type === 'image' && post.image && (
          <div className="overflow-hidden rounded-lg">
            <img alt="Post" className="aspect-video w-full object-cover" src={post.image} />
          </div>
        )}

        {post.type === 'video' && post.videoThumbnail && (
          <div className="relative overflow-hidden rounded-lg">
            <img
              alt="Video thumbnail"
              className="aspect-video w-full object-cover"
              src={post.videoThumbnail}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="bg-background/90 flex h-16 w-16 items-center justify-center rounded-full">
                <Play className="h-8 w-8 fill-current" />
              </div>
            </div>
          </div>
        )}

        {post.type === 'text' && post.text && (
          <div className="rounded-lg">
            <p className="text-sm whitespace-pre-line">{post.text}</p>
          </div>
        )}

        {/* Post Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              className="rounded-full"
              onClick={() => toggleLike(post.id)}
              size="icon"
              variant="ghost"
            >
              <Heart
                className={` ${likedPosts.has(post.id) ? 'fill-destructive text-destructive' : ''}`}
              />
            </Button>
            <Button
              className="rounded-full"
              onClick={() => toggleComments(post.id)}
              size="icon"
              variant="ghost"
            >
              <MessageCircle />
            </Button>
            <Button className="rounded-full" size="icon" variant="ghost">
              <Send />
            </Button>
          </div>
          <Button
            className="rounded-full"
            onClick={() => toggleSave(post.id)}
            size="icon"
            variant="ghost"
          >
            <Bookmark
              className={` ${savedPosts.has(post.id) ? 'fill-blue-500 text-blue-500' : ''}`}
            />
          </Button>
        </div>

        {/* Likes */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            <Avatar className="border-background h-5 w-5 border-2">
              <AvatarImage src="https://i.pravatar.cc/150?img=40" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <Avatar className="border-background h-5 w-5 border-2">
              <AvatarImage src="https://i.pravatar.cc/150?img=41" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          </div>
          <span className="text-sm">
            <span className="font-semibold" suppressHydrationWarning>
              {post.likeCount.toLocaleString()}
            </span>{' '}
            likes
          </span>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm">
            <span className="mr-1 font-semibold">{post.username}</span>
            {post.caption}
          </p>
        )}

        {/* Comments Link */}
        <Button
          className="text-muted-foreground hover:text-foreground h-auto p-0 text-xs font-normal"
          onClick={() => toggleComments(post.id)}
          variant="link"
        >
          {expandedComments.has(post.id)
            ? 'Hide comments'
            : `View all ${post.comments.length} comments`}
        </Button>

        {/* Comments Section */}
        {expandedComments.has(post.id) && (
          <div className="space-y-3 border-t pt-3">
            {post.comments.map((comment) => (
              <div className="flex gap-3" key={comment.id}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.avatar} />
                  <AvatarFallback>{comment.username[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-sm font-semibold">{comment.username}</span>
                      <span className="ml-2 text-sm">{comment.text}</span>
                    </div>
                    <Button
                      className="h-6 w-6"
                      onClick={() => toggleCommentLike(comment.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <Heart
                        className={`h-3 w-3 ${
                          likedComments.has(comment.id) ? 'fill-destructive text-destructive' : ''
                        }`}
                      />
                    </Button>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">{comment.timeAgo}</span>
                    <span className="text-muted-foreground text-xs">
                      {comment.likes + (likedComments.has(comment.id) ? 1 : 0)} likes
                    </span>
                    <button className="text-muted-foreground hover:text-foreground text-xs font-medium">
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Comment */}
      <div className="flex items-center gap-1 border-t px-4 pt-3">
        <Avatar>
          <AvatarImage src="https://i.pravatar.cc/150?img=50" />
          <AvatarFallback>XA</AvatarFallback>
        </Avatar>
        <Input
          className="flex-1 border-0 shadow-none focus-visible:ring-0"
          onChange={(e) => setNewComments((prev) => ({ ...prev, [post.id]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddComment(post.id);
            }
          }}
          placeholder="Add a comment..."
          value={newComments[post.id] || ''}
        />
        <Button
          disabled={!newComments[post.id]?.trim()}
          onClick={() => handleAddComment(post.id)}
          size="sm"
          variant="ghost"
        >
          Post
        </Button>
      </div>
    </div>
  );
}
