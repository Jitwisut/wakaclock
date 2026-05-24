import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function BestSellingProducts() {
  const products = [
    {
      id: 1,
      image: `/images/products/01.jpeg`,
      name: 'Sports Shoes',
      price: 316,
      sold: 316,
      sales: 10,
    },
    {
      id: 2,
      image: `/images/products/02.jpeg`,
      name: 'Black T-Shirt',
      price: 274,
      sold: 274,
      sales: 20,
    },
    {
      id: 3,
      image: `/images/products/03.jpeg`,
      name: 'Jeans',
      price: 195,
      sold: 195,
      sales: 15,
    },
    {
      id: 4,
      image: `/images/products/04.jpeg`,
      name: 'Red Sneakers',
      price: 402,
      sold: 402,
      sales: 40,
    },
    {
      id: 5,
      image: `/images/products/05.jpeg`,
      name: 'Red Scarf',
      price: 280,
      sold: 280,
      sales: 37,
    },
    {
      id: 6,
      image: `/images/products/06.jpeg`,
      name: 'Kitchen Accessory',
      price: 150,
      sold: 150,
      sales: 18,
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Best Selling Product</CardTitle>
        <CardDescription>Top-Selling Products at a Glance</CardDescription>
        <CardAction>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline">
                  <ChevronRight />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View All</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.map((product) => (
          <Link
            className="hover:bg-muted flex items-center justify-between rounded-md border px-4 py-3"
            href="/dashboard/pages/products/1"
            key={product.name}
          >
            <div className="flex items-center gap-4">
              <Image
                alt="..."
                className="rounded-md!"
                height={40}
                src={product.image}
                unoptimized
                width={40}
              />
              <div>
                <div className="font-medium">{product.name}</div>
              </div>
            </div>
            <div className="text-sm text-green-600">{product.sold} items sold</div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
