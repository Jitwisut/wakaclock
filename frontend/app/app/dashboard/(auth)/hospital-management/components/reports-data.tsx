import type { ColumnDef } from '@tanstack/react-table';

function getStatusClassName(status: string): string {
  if (status === 'Paid') return 'bg-green-100 text-green-800';
  if (status === 'Pending') return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

export type ReportsData = {
  amount: number;
  date: string;
  department: string;
  id: string;
  paymentMethod: string;
  status: 'Overdue' | 'Paid' | 'Pending';
};

// Create mock data
export const reportsData: ReportsData[] = [
  {
    id: '1',
    date: '2023-06-01',
    department: 'Emergency',
    amount: 1500,
    paymentMethod: 'Credit Card',
    status: 'Paid',
  },
  {
    id: '2',
    date: '2023-06-02',
    department: 'Cardiology',
    amount: 2200,
    paymentMethod: 'Insurance',
    status: 'Pending',
  },
  {
    id: '3',
    date: '2023-06-03',
    department: 'Pediatrics',
    amount: 800,
    paymentMethod: 'Cash',
    status: 'Paid',
  },
  {
    id: '4',
    date: '2023-06-04',
    department: 'Orthopedics',
    amount: 3000,
    paymentMethod: 'Insurance',
    status: 'Overdue',
  },
  {
    id: '5',
    date: '2023-06-05',
    department: 'Neurology',
    amount: 2500,
    paymentMethod: 'Credit Card',
    status: 'Paid',
  },
  {
    id: '6',
    date: '2023-06-06',
    department: 'Oncology',
    amount: 4000,
    paymentMethod: 'Insurance',
    status: 'Pending',
  },
  {
    id: '7',
    date: '2023-06-07',
    department: 'Radiology',
    amount: 1800,
    paymentMethod: 'Cash',
    status: 'Paid',
  },
  {
    id: '8',
    date: '2023-06-08',
    department: 'Surgery',
    amount: 5500,
    paymentMethod: 'Insurance',
    status: 'Overdue',
  },
  {
    id: '9',
    date: '2023-06-09',
    department: 'Dermatology',
    amount: 1200,
    paymentMethod: 'Credit Card',
    status: 'Paid',
  },
  {
    id: '10',
    date: '2023-06-10',
    department: 'Psychiatry',
    amount: 950,
    paymentMethod: 'Cash',
    status: 'Pending',
  },
];

// Define table columns
export const columns: ColumnDef<ReportsData>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
  },
  {
    accessorKey: 'department',
    header: 'Department',
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => {
      const amount = Number.parseFloat(row.getValue('amount'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
      return <div>{formatted}</div>;
    },
  },
  {
    accessorKey: 'paymentMethod',
    header: 'Payment Method',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      return (
        <div
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusClassName(status)}`}
        >
          {status}
        </div>
      );
    },
  },
];
