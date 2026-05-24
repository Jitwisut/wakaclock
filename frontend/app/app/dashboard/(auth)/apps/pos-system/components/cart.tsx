'use client';

import React from 'react';

import { Utensils } from 'lucide-react';

import CartListItem from '@/app/dashboard/(auth)/apps/pos-system/components/cart-list-item';
import { useStore } from '@/app/dashboard/(auth)/apps/pos-system/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type POStSystemCartProps = {
  setShowAssignOrderDialogAction: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function POStSystemCart({ setShowAssignOrderDialogAction }: POStSystemCartProps) {
  const { cart, createOrder } = useStore();

  // Calculate subtotal
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Calculate tax (5%)
  const tax = subtotal * 0.05;

  // Calculate total
  const total = subtotal + tax;

  return (
    <div className="hidden flex-col gap-4 group-data-[theme-content-layout=centered]/layout:h-[calc(100vh-8rem)] group-data-[theme-content-layout=full]/layout:h-[calc(100vh-6rem)] lg:col-span-2 lg:flex">
      <Card className="flex-1 overflow-auto">
        <CardHeader>
          <CardTitle>Your Cart</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {cart.length === 0 ? (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="text-2xl">🍪</span>
              <span>Your cart is empty.</span>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <CartListItem key={item.product.id} product={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {cart.length > 0 && (
        <Card className="bg-muted">
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (5%)</span>
                <span className="font-medium">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button
                className="w-full"
                onClick={() => {
                  createOrder();
                  setShowAssignOrderDialogAction(true);
                }}
                size="lg"
              >
                <Utensils />
                Create Order
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
