'use client';

import React from 'react';

import { DialogDescription } from '@radix-ui/react-dialog';
import { CirclePlusIcon } from 'lucide-react';

import { StarRating } from '@/app/dashboard/(auth)/pages/products/[id]/star-rating';
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
import { Textarea } from '@/components/ui/textarea';

export default function SubmitReviewForm() {
  const [rating, setRating] = React.useState(0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CirclePlusIcon /> Submit Review
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Leave a Review</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Share your thoughts about this product.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-4 grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Enter your name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" placeholder="Enter your email" type="email" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="comment">Comment</Label>
            <Textarea id="comment" placeholder="Share your thoughts..." rows={4} />
          </div>
          <div className="flex gap-2">
            <StarRating onRatingChangeAction={setRating} rating={rating} />
          </div>
          <Button className="w-full">Submit Review</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
