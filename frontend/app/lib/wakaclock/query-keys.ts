/**
 * Every key includes userId so switching users in the header never serves
 * stale cached data from another uuid.
 */
export const wakaclockKeys = {
  all: ['wakaclock'] as const,
  capabilities: () => [...wakaclockKeys.all, 'capabilities'] as const,
  goals: (userId: string) => [...wakaclockKeys.all, 'goals', userId] as const,
  goalProgress: (userId: string, goalId: string) =>
    [...wakaclockKeys.all, 'goal-progress', userId, goalId] as const,
  leaderboards: (userId: string) => [...wakaclockKeys.all, 'leaderboards', userId] as const,
  leaderboardMembers: (userId: string, leaderboardId: string) =>
    [...wakaclockKeys.all, 'leaderboard-members', userId, leaderboardId] as const,
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
  keystrokeStats: (userId: string, start: string, end: string) =>
    [...wakaclockKeys.all, 'keystroke-stats', userId, start, end] as const,
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
    operatingSystem?: string
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
    ] as const,
  currentUser: (userId: string) => [...wakaclockKeys.all, 'user', userId] as const,
  heartbeats: (userId: string, date: string, timezone?: string) =>
    [...wakaclockKeys.all, 'heartbeats', userId, date, timezone] as const,
  projectRules: (userId: string) => [...wakaclockKeys.all, 'project-rules', userId] as const,
  projectMerges: (userId: string) => [...wakaclockKeys.all, 'project-merges', userId] as const,
  projectAnalytics: (userId: string, start: string, end: string, timezone?: string) =>
    [...wakaclockKeys.all, 'project-analytics', userId, start, end, timezone] as const,
  /**
   * Deliberately a distinct root segment rather than a discriminator appended to
   * `projectAnalytics`. The projects page keys its *infinite* query as
   * `[...projectAnalytics(...), sort]` with `sort` defaulting to 'duration'; the overview
   * panel reads the same endpoint with the same default 30-day window and the same sort,
   * so an appended-discriminator key would collide byte-for-byte. The two cache entries
   * hold different shapes — `{ pages: [...] }` vs a bare response — and whichever query
   * mounted second would read the other's data and render nothing.
   */
  topProjects: (userId: string, start: string, end: string, limit: number, timezone?: string) =>
    [...wakaclockKeys.all, 'top-projects', userId, start, end, limit, timezone] as const,
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
