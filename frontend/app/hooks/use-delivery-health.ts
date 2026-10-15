'use client';

import { useQuery } from '@tanstack/react-query';

import { deliveryHealth } from '@/lib/wakaclock/delivery-health';
import { getDeliveryStatus } from '@/lib/wakaclock/endpoints-v2';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function useDeliveryHealth() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const query = useQuery({
    queryKey: wakaclockKeys.deliveryStatus(userId),
    queryFn: getDeliveryStatus,
    enabled: Boolean(userId),
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: false,
    gcTime: 0,
  });
  return {
    ...deliveryHealth(query.error || !userId ? undefined : query.data, Boolean(query.error)),
    devices: query.error || !userId ? [] : (query.data?.devices ?? []),
  };
}
