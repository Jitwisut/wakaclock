'use client';

import { X } from 'lucide-react';
import Image from 'next/image';

import type { CartItem } from '@/app/dashboard/(auth)/apps/pos-system/store';
import { useStore } from '@/app/dashboard/(auth)/apps/pos-system/store';
import { Button } from '@/components/ui/button';

type CartListItemProps = {
  product: CartItem;
};

export default function CartListItem({ product }: CartListItemProps) {
  const { updateQuantity, removeFromCart } = useStore();

  return (
    <div className="relative flex gap-3" key={product.product.id}>
      <div className="relative size-10 shrink-0 lg:size-14">
        <Button
          className="absolute -start-1 -bottom-1 z-10 size-5 rounded-full p-0"
          onClick={() => removeFromCart(product.product.id)}
          size="icon"
          variant="destructive"
        >
          <X />
        </Button>
        <Image
          alt={product.product.name}
          className="rounded object-cover"
          fill
          src={product.product.image || '/placeholder.svg'}
        />
      </div>
      <div className="flex flex-1 flex-col items-start gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="mb-0 space-y-1 lg:mb-1">
          <h3 className="font-semibold">{product.product.name}</h3>
          <p>${(product.product.price * product.quantity).toFixed(2)}</p>
        </div>
        <div className="bg-background inline-flex overflow-hidden rounded-md border">
          <Button
            onClick={() => {
              if (product.quantity > 1) {
                updateQuantity(product.product.id, product.quantity - 1);
              } else {
                removeFromCart(product.product.id);
              }
            }}
            size="icon"
            variant="ghost"
          >
            <span className="sr-only">Decrease</span>
            <span>-</span>
          </Button>
          <div className="flex w-8 items-center justify-center text-sm">{product.quantity}</div>
          <Button
            onClick={() => updateQuantity(product.product.id, product.quantity + 1)}
            size="icon"
            variant="ghost"
          >
            <span className="sr-only">Increase</span>
            <span>+</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
