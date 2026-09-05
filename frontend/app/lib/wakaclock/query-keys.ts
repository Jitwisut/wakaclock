/**
 * Every key includes userId so switching users in the header never serves
 * stale cached data from another uuid.
 */
export const wakaclockKeys = {
  all: ['wakaclock'] as const,
  // No userId: describes the server deployment, not an account — see useCapabilities.
  capabilities: () => [...wakaclockKeys.all, 'capabilities'] as const,
  statusBar: (userId: string) => [...wakaclockKeys.all, 'status-bar', userId] as const,
  allTime: (userId: string) => [...wakaclockKeys.all, 'all-time', userId] as const,
  stats: (userId: string, range: string) => [...wakaclockKeys.all, 'stats', userId, range] as const,
  summaries: (userId: string, start: string, end: string) =>
    [...wakaclockKeys.all, 'summaries', userId, start, end] as const,
  durations: (userId: string, date: string, timezone?: string) =>
    [...wakaclockKeys.all, 'durations', userId, date, timezone] as const,
  projects: (userId: string, start: string, end: string) =>
    [...wakaclockKeys.all, 'projects', userId, start, end] as const,
  insights: (userId: string, type: string, range: string) =>
    [...wakaclockKeys.all, 'insights', userId, type, range] as const,
  aiStats: (userId: string, start: string, end: string) =>
    [...wakaclockKeys.all, 'ai-stats', userId, start, end] as const,
  aiDiagnostics: (userId: string) => [...wakaclockKeys.all, 'ai-diagnostics', userId] as const,
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
