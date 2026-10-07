'use client';

import { useQuery } from '@tanstack/react-query';

import { deliveryHealth } from '@/lib/wakaclock/delivery-health';
import { getDeliveryStatus } from '@/lib/wakaclock/endpoints-v2';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function useDeliveryHealth() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const query = useQuery({
    queryKey: ['delivery-status', userId],
    queryFn: getDeliveryStatus,
    enabled: Boolean(userId),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  return {
    ...deliveryHealth(query.data, Boolean(query.error)),
    devices: query.data?.devices ?? [],
  };
}
