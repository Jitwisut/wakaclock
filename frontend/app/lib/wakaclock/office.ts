import type { SpriteAppearance } from '@/types/sprite';

import { unwrapV2, wakaclockV2Client } from './client-v2';

import type { V2Envelope } from './types';

export interface OfficeMessage {
  body: string;
  created_at: string;
  id: string;
  user_id: string;
  username: string;
}
export interface OfficeSprint {
  created_by: string;
  ends_at: number;
  finished: boolean;
  id: string;
  members: { completed: boolean; user_id: string }[];
  started_at: number;
  title: string;
}
export interface OfficeState {
  can_invite: boolean;
  can_manage: boolean;
  media_available: boolean;
  parent: { id: string; name: string } | null;
  profiles: Record<string, SpriteAppearance>;
  reactions: { emoji: string; id: string; user_id: string }[];
  server_time: number;
  spaces: { id: string; kind: 'floor' | 'meeting'; name: string }[];
  sprints: OfficeSprint[];
}
export type OfficeCommand =
  | { appearance: SpriteAppearance; kind: 'profile' }
  | { body: string; id: string; kind: 'message' }
  | { completed: boolean; id: string; kind: 'sprint_join' }
  | { emoji: string; kind: 'reaction' }
  | { id: string; kind: 'space_join' }
  | { id: string; kind: 'sprint_finish' }
  | { kind: 'rename'; name: string }
  | { kind: 'space'; name: string; space_kind: 'floor' | 'meeting' }
  | { kind: 'sprint'; minutes: number; title: string };
export async function getOffice(room: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<OfficeState>>(`/presence/rooms/${room}/office`)
  );
}
export async function officeCommand(room: string, command: OfficeCommand) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<{ ok: boolean; room_id?: string }>>(
      `/presence/rooms/${room}/office`,
      command
    )
  );
}
export async function officeMessages(room: string, before?: string) {
  return unwrapV2(
    await wakaclockV2Client.get<V2Envelope<{ items: OfficeMessage[]; next_cursor: null | string }>>(
      `/presence/rooms/${room}/messages`,
      { params: { before } }
    )
  );
}
export async function officeMediaToken(room: string) {
  return unwrapV2(
    await wakaclockV2Client.post<V2Envelope<{ token: string; url: string; zone_id: string }>>(
      `/presence/rooms/${room}/media-token`
    )
  );
}

export async function personalPresenceSummary(params: {
  from: string;
  timezone: string;
  to: string;
}) {
  return unwrapV2(
    await wakaclockV2Client.get<
      V2Envelope<{ activeDays: number; durationSeconds: number; sessions: number }>
    >('/presence/history/summary', { params })
  );
}
