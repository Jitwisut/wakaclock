import { ChevronRight, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ReviewStat {
  color: string;
  count: number;
  stars: number;
}

interface Review {
  author: string;
  content: string;
  date: string;
  id: string;
  rating: number;
  title: string;
  verified: boolean;
}

const recentReviews: Review[] = [
  {
    id: '1',
    author: 'Sarah J.',
    date: 'March 12, 2025',
    rating: 5,
    title: 'Exceeded my expectations!',
    content:
      "I was skeptical at first, but this product has completely changed my daily routine. The quality is outstanding and it's so easy to use.",
    verified: true,
  },
];

export function EcommerceCustomerReviewsCard() {
  const totalReviews = 5500;
  const averageRating = 4.5;

  const reviewStats: ReviewStat[] = [
    { stars: 5, count: 4000, color: 'bg-green-400' },
    { stars: 4, count: 2100, color: 'bg-lime-500' },
    { stars: 3, count: 800, color: 'bg-yellow-400' },
    { stars: 2, count: 631, color: 'bg-orange-400' },
    { stars: 1, count: 344, color: 'bg-red-400' },
  ];

  // Calculate percentages for progress bars
  const reviewStatsWithPercentage = reviewStats.map((stat) => ({
    ...stat,
    percentage: (stat.count / totalReviews) * 100,
  }));

  return (
    <Card className="lg:col-span-12 xl:col-span-5">
      <CardHeader>
        <CardTitle className="relative">Customer Reviews</CardTitle>
        <CardDescription>
          Based on {totalReviews.toLocaleString()} verified purchases
        </CardDescription>
        <CardAction className="relative">
          <div className="absolute end-0 top-0">
            <Button size="sm" variant="outline">
              <span className="hidden md:inline">View All</span> <ChevronRight />
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid space-y-4 lg:grid-cols-3 lg:space-y-0">
          {/* Average rating display */}
          <div className="flex flex-col items-center justify-center gap-2 lg:col-span-1">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((starNum) => (
                <Star
                  className="size-6 fill-yellow-400 text-yellow-400"
                  key={`avg-star-${starNum}`}
                />
              ))}
              <Star
                className="size-6 fill-yellow-400 text-yellow-400"
                fill="url(#half-star)"
                strokeWidth={0}
              />
            </div>
            <div className="text-3xl font-bold">{averageRating}</div>
            <div className="text-sm text-gray-500">out of 5</div>
          </div>

          {/* Rating breakdown */}
          <div className="w-full space-y-3 lg:col-span-2">
            {reviewStatsWithPercentage.map((stat) => (
              <div className="flex items-center" key={stat.stars}>
                <div className="w-8 text-sm font-medium">{stat.stars} ★</div>
                <div className="bg-muted mx-2 h-3 flex-1 overflow-hidden rounded-full">
                  <div
                    className={`h-full ${stat.color} rounded-full`}
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
                <div className="text-muted-foreground w-12 text-right text-sm font-medium">
                  {stat.count}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent reviews */}
        <div className="mt-6">
          {recentReviews.map((review) => (
            <div className="bg-muted rounded-lg border p-4" key={review.id}>
              <div className="mb-2 flex flex-col items-start justify-between md:flex-row">
                <div>
                  <div className="mb-1 flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => i + 1).map((starNum) => (
                      <Star
                        className={`h-4 w-4 ${starNum <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`}
                        key={`review-${review.id}-star-${starNum}`}
                      />
                    ))}
                  </div>
                  <h4 className="font-medium">{review.title}</h4>
                </div>
                <div className="text-muted-foreground text-xs">{review.date}</div>
              </div>
              <p className="text-muted-foreground mb-3 text-sm">{review.content}</p>
              <div className="flex items-center text-xs">
                <span className="font-medium">{review.author}</span>
                {review.verified && (
                  <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-white">
                    Verified Purchase
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
