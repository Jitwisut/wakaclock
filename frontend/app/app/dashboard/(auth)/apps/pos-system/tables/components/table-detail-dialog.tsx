import Image from 'next/image';

import type { Order, Table } from '@/app/dashboard/(auth)/apps/pos-system/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TableDetailDialogProps = {
  open: boolean;
  order?: Order;
  setOpen: (e: boolean) => void;
  table: Table;
};

export default function TableDetailDialog({ table, order, open, setOpen }: TableDetailDialogProps) {
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {table?.name} {order && <>- Order #{order?.id.split('-')[1]}</>}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {order ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="success">{order.items.length} items</Badge>
                <div className="text-muted-foreground text-sm">
                  Created: {order.createdAt.toLocaleString()}
                </div>
              </div>

              <div className="overflow-hidden rounded-md border">
                <table className="w-full">
                  <thead className="">
                    <tr>
                      <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium tracking-wider uppercase">
                        Item
                      </th>
                      <th className="text-muted-foreground px-4 py-2 text-center text-xs font-medium tracking-wider uppercase">
                        Qty
                      </th>
                      <th className="text-muted-foreground px-4 py-2 text-right text-xs font-medium tracking-wider uppercase">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.items.map((item) => (
                      <tr key={item.product.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="relative mr-3 h-10 w-10 overflow-hidden rounded">
                              <Image
                                alt={item.product.name}
                                className="object-cover"
                                fill
                                src={item.product.image || '/placeholder.svg'}
                              />
                            </div>
                            <div>
                              <p>{item.product.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">
                          ${(item.product.price * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="">
                    <tr>
                      <td className="px-4 py-2 text-right" colSpan={2}>
                        Subtotal:
                      </td>
                      <td className="px-4 py-2 text-right">${(order.total / 1.05).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-right" colSpan={2}>
                        Tax (5%):
                      </td>
                      <td className="px-4 py-2 text-right">
                        ${(order.total - order.total / 1.05).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-right font-bold" colSpan={2}>
                        Total:
                      </td>
                      <td className="px-4 py-2 text-right font-bold">${order.total.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center">There is no order at this table..</div>
          )}
        </div>
        <DialogFooter className="flex-row">
          {table?.status === 'occupied' && (
            <Button
              className="mr-auto"
              onClick={() => {
                // clearTable(selectedTable.id);
                setOpen(false);
              }}
              variant="destructive"
            >
              Clear Table
            </Button>
          )}
          <Button onClick={() => setOpen(false)} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
