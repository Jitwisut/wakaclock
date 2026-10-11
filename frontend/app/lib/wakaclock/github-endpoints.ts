import { unwrapV2, wakaclockV2Client } from './client-v2';

import type { WorkReceipt } from './team-types';
import type { V2Envelope } from './types';

export interface GithubConnection {
  can_manage: boolean;
  configured: boolean;
  health: { last_success_at?: null | string; reason: string; status: string };
  identity: { github_user_id: number; login: string } | null;
  repositories: Array<{
    coverage: string;
    enabled: boolean;
    error_code: null | string;
    full_name: string;
    github_repository_id: number;
    last_success_at: null | string;
    repository_id: string;
  }>;
}
export interface GithubInstallations {
  install_url: string;
  installations: Array<{ account: { login: string }; id: number; suspended: boolean }>;
}
export interface GithubRepositoryChoice {
  full_name: string;
  id: number;
  permissions?: { admin: boolean };
}
export interface GithubProjects {
  projects: Array<{ name: string; project_id: string }>;
  repositories: Array<{ full_name: string; repository_id: string }>;
}
export interface GithubSuggestion {
  candidates: Array<{ external_id: number; number: number }>;
  evidence: string;
  repository_id: string;
  session_id: string;
  status: string;
}
const root = (org: string) => `/organizations/${org}/integrations/github`;
export const getGithubConnection = async (org: string) =>
  unwrapV2(await wakaclockV2Client.get<V2Envelope<GithubConnection>>(root(org)));
export const startGithubAuthorization = async (org: string) =>
  unwrapV2(
    await wakaclockV2Client.post<V2Envelope<{ authorize_url: string }>>(`${root(org)}/authorize`)
  );
export const finishGithubAuthorization = async (state: string, code: string) =>
  unwrapV2(
    await wakaclockV2Client.post<V2Envelope<{ login: string; organization_id: string }>>(
      '/me/github/oauth/callback',
      { state, code }
    )
  );
export const getGithubInstallations = async (org: string) =>
  unwrapV2(
    await wakaclockV2Client.get<V2Envelope<GithubInstallations>>(`${root(org)}/installations`)
  );
export const getGithubRepositoryChoices = async (org: string, installation: number) =>
  unwrapV2(
    await wakaclockV2Client.get<V2Envelope<GithubRepositoryChoice[]>>(
      `${root(org)}/installations/${installation}/repositories`
    )
  );
export const selectGithubRepositories = async (
  org: string,
  installation: number,
  ids: number[],
  teamId?: string
) =>
  unwrapV2(
    await wakaclockV2Client.put<V2Envelope<GithubConnection>>(`${root(org)}/repositories`, {
      installation_id: installation,
      repository_ids: ids,
      team_id: teamId,
    })
  );
export const syncGithub = async (org: string) => wakaclockV2Client.post(`${root(org)}/sync`);
export const disconnectGithub = async (org: string) => wakaclockV2Client.delete(root(org));
export const getGithubProjects = async (org: string) =>
  unwrapV2(
    await wakaclockV2Client.get<V2Envelope<GithubProjects>>(
      `/organizations/${org}/me/github/project-bindings`
    )
  );
export const bindGithubProject = async (org: string, project: string, repository: string) =>
  wakaclockV2Client.put(`/organizations/${org}/me/github/project-bindings`, {
    project_id: project,
    repository_id: repository,
  });
export const getGithubSuggestions = async (org: string) =>
  unwrapV2(
    await wakaclockV2Client.get<V2Envelope<GithubSuggestion[]>>(
      `/organizations/${org}/me/github/suggestions`
    )
  );
export const proposeGithubLink = async (
  org: string,
  session: string,
  repository: string,
  work: number
) =>
  unwrapV2(
    await wakaclockV2Client.post<V2Envelope<{ id: string; revision: number }>>(
      `/organizations/${org}/me/session-links`,
      { session_id: session, repository_id: repository, work_item_id: work }
    )
  );
export const decideGithubLink = async (
  org: string,
  link: string,
  status: 'confirmed' | 'rejected' | 'withdrawn',
  expectedRevision?: number
) =>
  wakaclockV2Client.put(`/organizations/${org}/me/session-links/${link}`, {
    status,
    expected_revision: expectedRevision,
  });

export interface GithubWorkPage {
  items: Array<{
    ci: { required_checks: string; status: string };
    external_id: number;
    kind: string;
    lifecycle_coverage: string;
    number: number;
    ready_to_merge_seconds: { reason: null | string; value: null | number };
    repository_id: string;
    review_wait_seconds: { reason: null | string; value: null | number };
    state: string;
    synced_at: string;
    url: string;
  }>;
  next: null | string;
}
export const getGithubWorkPage = async (org: string, after?: string, teamId?: string) =>
  unwrapV2(
    await wakaclockV2Client.get<V2Envelope<GithubWorkPage>>(`${root(org)}/work-items`, {
      params: { after, team_id: teamId, limit: 50 },
    })
  );

export interface GithubSessionLink {
  id: string;
  repository_id: string;
  revision: number;
  status: string;
  work_item_id: number;
}
export interface GithubSessionPage {
  context_health: { capture_status: string; dead_letter: number; pending: number };
  items: Array<{
    candidates: Array<{
      external_id: number;
      number: number;
      repository_id: string;
      state: string;
    }>;
    last_event_at: string;
    links: GithubSessionLink[];
    reason: string;
    session_id: string;
    started_at: string;
  }>;
  next: null | string;
}
export const getGithubSessions = async (org: string, after?: string) =>
  unwrapV2(
    await wakaclockV2Client.get<V2Envelope<GithubSessionPage>>(
      `/organizations/${org}/me/github/sessions`,
      { params: { after } }
    )
  );
export const getGithubOwnWorkPage = async (org: string, after?: string) =>
  unwrapV2(
    await wakaclockV2Client.get<V2Envelope<GithubWorkPage>>(
      `/organizations/${org}/me/github/work-items`,
      { params: { after } }
    )
  );
export const replaceGithubLink = async (
  org: string,
  link: GithubSessionLink,
  repository: string,
  work: number
) =>
  unwrapV2(
    await wakaclockV2Client.post<V2Envelope<GithubSessionLink>>(
      `/organizations/${org}/me/session-links/${link.id}/replace`,
      { repository_id: repository, work_item_id: work, expected_revision: link.revision }
    )
  );
export interface GithubLinkHistory {
  items: Array<{ changed_at: string; id: string; revision: null | number; status: string }>;
  next: null | string;
}
export const getGithubLinkHistory = async (org: string, link: string, after?: string) =>
  unwrapV2(
    await wakaclockV2Client.get<V2Envelope<GithubLinkHistory>>(
      `/organizations/${org}/me/session-links/${link}/history`,
      { params: { after } }
    )
  );

export const retryGithubContexts = async (org: string) =>
  wakaclockV2Client.post(`/organizations/${org}/me/github/session-context/retry`);

export interface GithubRelationshipPage {
  coverage: string;
  items: {
    action: 'present' | 'removed';
    event_id: string;
    observed_at: string;
    provenance: string;
    related_issue_id: number;
    relationship: 'closing' | 'reference';
    source_at: null | string;
    url: null | string;
  }[];
  next: null | string;
}
export const getGithubRelationships = async (
  org: string,
  repository: string,
  item: number,
  after?: string
) =>
  unwrapV2(
    await wakaclockV2Client.get<V2Envelope<GithubRelationshipPage>>(
      `/organizations/${org}/me/github/work-items/${repository}/${item}/relationships`,
      { params: { after } }
    )
  );
export const getGithubOwnReceipt = async (
  org: string,
  repository: string,
  item: number,
  after?: string
) =>
  unwrapV2(
    await wakaclockV2Client.get<V2Envelope<WorkReceipt>>(
      `/organizations/${org}/me/github/work-items/${repository}/${item}/receipt`,
      { params: { after } }
    )
  );

export interface SessionRepositoryBinding {
  session_id: string;
  repository_id: string | null;
  revision: number;
  request_id: string;
  effective_at: string;
  provenance: 'user_confirmed';
  status: 'active' | 'unset';
}
export interface SessionRepositoryBindingPage {
  revision: number;
  current: SessionRepositoryBinding | null;
  history: SessionRepositoryBinding[];
  next: number | null;
}
export const getSessionRepositoryBinding = async (org: string, session: string, before?: number) =>
  unwrapV2(
    await wakaclockV2Client.get<V2Envelope<SessionRepositoryBindingPage>>(
      `/organizations/${org}/me/github/session-repository-bindings`,
      { params: { session_id: session, before_revision: before } }
    )
  );
export const setSessionRepositoryBinding = async (
  org: string,
  input: {
    session_id: string;
    repository_id: string | null;
    expected_revision: number;
    request_id: string;
  }
) =>
  unwrapV2(
    await wakaclockV2Client.post<V2Envelope<SessionRepositoryBinding>>(
      `/organizations/${org}/me/github/session-repository-bindings`,
      input
    )
  );
