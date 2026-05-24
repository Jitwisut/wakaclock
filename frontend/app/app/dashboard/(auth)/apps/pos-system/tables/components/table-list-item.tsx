'use client';

import React from 'react';

import {
  EnumTableStatus,
  EnumTableStatusColor,
} from '@/app/dashboard/(auth)/apps/pos-system/enums';
import type { Table } from '@/app/dashboard/(auth)/apps/pos-system/store';
import { useStore } from '@/app/dashboard/(auth)/apps/pos-system/store';
import TableDetailDialog from '@/app/dashboard/(auth)/apps/pos-system/tables/components/table-detail-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TableListItemProps = {
  table: Table;
};

export default function TableListItem({ table }: TableListItemProps) {
  const [openDialog, setOpenDialog] = React.useState(false);
  const { orders } = useStore();

  const tableOrder = orders.find((t) => t.tableId === table.id);

  if (tableOrder) {
    table.status = EnumTableStatus.OCCUPIED;
  }

  return (
    <>
      <div
        className={cn(
          'cursor-pointer overflow-hidden rounded-lg border p-4 transition-all',
          EnumTableStatusColor[table.status as EnumTableStatus].card
        )}
        key={table.id}
        onClick={() => setOpenDialog(true)}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium lg:text-lg">{table.name}</h3>
          <Badge
            className="capitalize"
            variant={EnumTableStatusColor[table.status as EnumTableStatus].badge}
          >
            {table.status}
          </Badge>
        </div>

        {tableOrder && (
          <div className="mt-2 border-t pt-2">
            <p className="text-sm font-medium">Order #{tableOrder.id.split('-')[1]}</p>
            <p className="text-muted-foreground text-xs">{tableOrder.items.length} items</p>
          </div>
        )}
      </div>

      <TableDetailDialog
        open={openDialog}
        order={tableOrder}
        setOpen={setOpenDialog}
        table={table}
      />
    </>
  );
}
