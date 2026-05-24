'use client';

import { StarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StarRatingProps {
  maxStars?: number;
  onRatingChangeAction?: (rating: number) => void;
  rating: number;
}

export function StarRating({ rating, onRatingChangeAction, maxStars = 5 }: StarRatingProps) {
  const handleStarClick = (index: number) => {
    if (onRatingChangeAction) {
      onRatingChangeAction(index);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxStars }, (_, i) => i + 1).map((starNum) => (
        <button
          aria-label={`Rate ${starNum} out of ${maxStars} stars`}
          className="focus:outline-none"
          key={`star-${starNum}`}
          onClick={() => handleStarClick(starNum)}
          type="button"
        >
          <StarIcon
            className={cn(
              'size-8 cursor-pointer transition-all',
              starNum <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-transparent text-gray-300 hover:text-gray-400'
            )}
          />
        </button>
      ))}
      <span className="text-muted-foreground ml-2 text-sm">
        {rating > 0 ? `${rating} out of ${maxStars}` : 'No rating selected'}
      </span>
    </div>
  );
}
