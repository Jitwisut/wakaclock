'use client';

import { useState } from 'react';

import type { EnumTableStatus } from '@/app/dashboard/(auth)/apps/pos-system/enums';
import { EnumTableStatusColor } from '@/app/dashboard/(auth)/apps/pos-system/enums';
import type { Table, TableCategory } from '@/app/dashboard/(auth)/apps/pos-system/store';
import { useStore } from '@/app/dashboard/(auth)/apps/pos-system/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type AssignOrderToTableProps = {
  open: boolean;
  setOpen: (e: boolean) => void;
  tableCategories: TableCategory[];
  tables: Table[];
};

export default function AssignOrderToTable({
  open,
  setOpen,
  tableCategories,
  tables,
}: AssignOrderToTableProps) {
  const { orders, assignOrderToTable } = useStore();

  const [selectedCategory] = useState(tables[0]?.id);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Order to Table</DialogTitle>
          <DialogDescription>Please select a table to assign this order</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Tabs className="w-full" defaultValue={selectedCategory}>
            <TabsList className="h-auto w-full flex-col lg:h-9 lg:flex-row">
              {tableCategories.map((category) => (
                <TabsTrigger className="w-full lg:w-auto" key={category.id} value={category.id}>
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {tableCategories.map((c) => (
              <TabsContent key={c.id} value={c.id}>
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {tables
                    .filter((table) => table.category === c.id)
                    .map((table) => {
                      const tableOrder = orders.find((t) => t.tableId === table.id);

                      if (tableOrder) {
                        table.status = 'occupied';
                      }

                      return (
                        <Button
                          className="flex h-16 flex-col"
                          disabled={table.status === 'occupied'}
                          key={table.id}
                          onClick={() => {
                            assignOrderToTable(table.id);
                            setOpen(false);
                          }}
                          variant="outline"
                        >
                          <span>{table.name}</span>
                          <span
                            className={cn(
                              'text-xs capitalize',
                              EnumTableStatusColor[table.status as EnumTableStatus].text
                            )}
                          >
                            {table.status}
                          </span>
                        </Button>
                      );
                    })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
