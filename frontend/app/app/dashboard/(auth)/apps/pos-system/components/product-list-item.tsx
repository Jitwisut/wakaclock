'use client';

import React from 'react';

import { ShoppingCartIcon } from 'lucide-react';
import Image from 'next/image';

import type { Product } from '@/app/dashboard/(auth)/apps/pos-system/store';
import { useStore } from '@/app/dashboard/(auth)/apps/pos-system/store';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

export default function ProductListItem({ product }: { product: Product }) {
  const { addToCart } = useStore();
  const { toast } = useToast();

  const [productQuantities, setProductQuantities] = React.useState<Record<string, number>>({});

  const getProductQuantity = (productId: string) => productQuantities[productId] || 1;

  const handleAddToCart = () => {
    const quantity = getProductQuantity(product.id);
    addToCart(product, quantity);

    // Reset quantity after adding
    setProductQuantities((prev) => ({
      ...prev,
      [product.id]: 1,
    }));
    toast({
      description: 'Product added to cart.',
    });
  };

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="relative aspect-4/3">
        <Image
          alt={product.name}
          className="object-cover"
          fill
          src={product.image || '/placeholder.svg'}
          unoptimized
        />
      </div>
      <div className="p-4">
        <h3 className="truncate font-semibold">{product.name}</h3>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">${product.price.toFixed(2)}</p>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleAddToCart} size="icon" variant="outline">
                    <ShoppingCartIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add to cart</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
