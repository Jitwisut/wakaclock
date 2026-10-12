/**
 * Every key includes userId so switching users in the header never serves
 * stale cached data from another uuid.
 */
const TEAM_GITHUB_KEY = 'team-github';
export const wakaclockKeys = {
  all: ['wakaclock'] as const,
  deliveryStatus: (userId: string) => [...wakaclockKeys.all, 'delivery-status', userId] as const,
  teamSessionRepository: (userId: string, org: string, session: string, revision?: number) =>
    [...wakaclockKeys.teamGithub(userId, org), 'session-repository', session, revision] as const,
  copilotSelfDay: (userId: string, org: string, day: string) =>
    [...wakaclockKeys.teamGithub(userId, org), 'copilot-self-day', day] as const,
  teamGithubSessions: (userId: string, org: string, after?: string) =>
    [...wakaclockKeys.all, TEAM_GITHUB_KEY, userId, org, 'sessions', after] as const,
  teamGithubOwnWork: (userId: string, org: string, after?: string) =>
    [...wakaclockKeys.all, TEAM_GITHUB_KEY, userId, org, 'own-work', after] as const,
  teamGithubHistory: (userId: string, org: string, link: string, after?: string) =>
    [...wakaclockKeys.all, TEAM_GITHUB_KEY, userId, org, 'link-history', link, after] as const,
  teamGithub: (userId: string, organizationId: string) =>
    [...wakaclockKeys.all, TEAM_GITHUB_KEY, userId, organizationId] as const,
  // No userId: describes the server deployment, not an account — see useCapabilities.
  capabilities: () => [...wakaclockKeys.all, 'capabilities'] as const,
  organizations: (userId: string) => ['organizations', userId] as const,
  teamReceipt: (
    userId: string,
    organizationId: string,
    repositoryId: string,
    itemId: number,
    teamId?: string
  ) =>
    [
      ...wakaclockKeys.all,
      'team-receipt',
      userId,
      organizationId,
      repositoryId,
      itemId,
      teamId,
    ] as const,
  teamHealth: (userId: string, organizationId: string) =>
    [...wakaclockKeys.all, 'team-health', userId, organizationId] as const,
  teamConsent: (userId: string, organizationId: string) =>
    [...wakaclockKeys.all, 'team-consent', userId, organizationId] as const,
  teamInsights: (
    userId: string,
    organizationId: string,
    start: string,
    end: string,
    timezone: string,
    teamId?: string
  ) =>
    [
      ...wakaclockKeys.all,
      'team-insights',
      userId,
      organizationId,
      start,
      end,
      timezone,
      teamId,
    ] as const,
  teamWorkItems: (userId: string, organizationId: string, teamId?: string) =>
    [...wakaclockKeys.all, 'team-work-items', userId, organizationId, teamId] as const,
  organizationTeams: (userId: string, organizationId: string) =>
    [...wakaclockKeys.all, 'organization-teams', userId, organizationId] as const,
  organizationMembers: (userId: string, organizationId: string) =>
    [...wakaclockKeys.all, 'organization-members', userId, organizationId] as const,
  organizationInvites: (userId: string, organizationId: string) =>
    [...wakaclockKeys.all, 'organization-invites', userId, organizationId] as const,
  myOrganizationInvites: (userId: string) =>
    [...wakaclockKeys.all, 'my-organization-invites', userId] as const,
  teamMembers: (userId: string, organizationId: string, teamId: string) =>
    [...wakaclockKeys.all, 'team-members', userId, organizationId, teamId] as const,
  statusBar: (userId: string, timezone?: string) =>
    [...wakaclockKeys.all, 'status-bar', userId, timezone] as const,
  allTime: (userId: string, timezone?: string) =>
    [...wakaclockKeys.all, 'all-time', userId, timezone] as const,
  stats: (userId: string, range: string, timezone?: string) =>
    [...wakaclockKeys.all, 'stats', userId, range, timezone] as const,
  summaries: (userId: string, start: string, end: string, timezone?: string) =>
    [...wakaclockKeys.all, 'summaries', userId, start, end, timezone] as const,
  durations: (userId: string, date: string, timezone?: string) =>
    [...wakaclockKeys.all, 'durations', userId, date, timezone] as const,
  projects: (userId: string, start: string, end: string, timezone?: string) =>
    [...wakaclockKeys.all, 'projects', userId, start, end, timezone] as const,
  insights: (userId: string, type: string, range: string, timezone?: string) =>
    [...wakaclockKeys.all, 'insights', userId, type, range, timezone] as const,
  aiStats: (userId: string, start: string, end: string) =>
    [...wakaclockKeys.all, 'ai-stats', userId, start, end] as const,
  aiDiagnostics: (userId: string) => [...wakaclockKeys.all, 'ai-diagnostics', userId] as const,
  aiDiagnosticsV2: (userId: string) => [...wakaclockKeys.all, 'ai-diagnostics-v2', userId] as const,
  dashboardAnalytics: (userId: string, start: string, end: string, timezone: string) =>
    [...wakaclockKeys.all, 'dashboard-analytics', userId, start, end, timezone] as const,
  keystrokeStats: (userId: string, start: string, end: string) =>
    [...wakaclockKeys.all, 'keystroke-stats', userId, start, end] as const,
  currentUser: (userId: string) => [...wakaclockKeys.all, 'user', userId] as const,
  heartbeats: (userId: string, date: string, timezone?: string) =>
    [...wakaclockKeys.all, 'heartbeats', userId, date, timezone] as const,
  projectRules: (userId: string) => [...wakaclockKeys.all, 'project-rules', userId] as const,
  projectMerges: (userId: string) => [...wakaclockKeys.all, 'project-merges', userId] as const,
  projectAnalytics: (userId: string, start: string, end: string, timezone?: string) =>
    [...wakaclockKeys.all, 'project-analytics', userId, start, end, timezone] as const,
  topProjects: (userId: string, start: string, end: string, limit: number, timezone?: string) =>
    [...wakaclockKeys.all, 'top-projects', userId, start, end, limit, timezone] as const,
  analyticsExplorer: (
    userId: string,
    start: string,
    end: string,
    timezone: string,
    projectId?: string,
    language?: string,
    editor?: string,
    category?: string,
    source?: string,
    operatingSystem?: string,
    actorType?: string
  ) =>
    [
      ...wakaclockKeys.all,
      'analytics-explorer',
      userId,
      start,
      end,
      timezone,
      projectId,
      language,
      editor,
      category,
      source,
      operatingSystem,
      actorType,
    ] as const,
  goals: (userId: string) => [...wakaclockKeys.all, 'goals', userId] as const,
  goalProgress: (userId: string, goalId: string) =>
    [...wakaclockKeys.all, 'goal-progress', userId, goalId] as const,
  leaderboards: (userId: string) => [...wakaclockKeys.all, 'leaderboards', userId] as const,
  leaderboardMembers: (userId: string, boardId: string) =>
    [...wakaclockKeys.all, 'leaderboard-members', userId, boardId] as const,
  projectAnalyticsDetail: (
    userId: string,
    projectId: string,
    start: string,
    end: string,
    timezone?: string,
    branch?: string
  ) =>
    [
      ...wakaclockKeys.all,
      'project-analytics-detail',
      userId,
      projectId,
      start,
      end,
      timezone,
      branch,
    ] as const,
};
