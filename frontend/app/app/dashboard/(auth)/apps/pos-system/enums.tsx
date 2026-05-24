export enum EnumTableStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
}

export const EnumTableStatusColor: Record<
  EnumTableStatus,
  {
    badge: 'destructive' | 'info' | 'success';
    card: string;
    text: string;
  }
> = {
  [EnumTableStatus.AVAILABLE]: {
    badge: 'success',
    card: 'border-green-500 bg-green-50 dark:border-green-900 dark:bg-green-950/70',
    text: 'text-green-600',
  },
  [EnumTableStatus.RESERVED]: {
    badge: 'info',
    card: 'border-blue-500 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/70',
    text: 'text-blue-600',
  },
  [EnumTableStatus.OCCUPIED]: {
    badge: 'destructive',
    card: 'border-red-500 bg-red-50 dark:border-red-900 dark:bg-red-950/70',
    text: 'text-red-600',
  },
};
