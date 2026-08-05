/**
 * Every key includes userId so switching users in the header never serves
 * stale cached data from another uuid.
 */
export const wakaclockKeys = {
  all: ['wakaclock'] as const,
  statusBar: (userId: string) => [...wakaclockKeys.all, 'status-bar', userId] as const,
  allTime: (userId: string) => [...wakaclockKeys.all, 'all-time', userId] as const,
  stats: (userId: string, range: string) =>
    [...wakaclockKeys.all, 'stats', userId, range] as const,
  summaries: (userId: string, start: string, end: string) =>
    [...wakaclockKeys.all, 'summaries', userId, start, end] as const,
  durations: (userId: string, date: string) =>
    [...wakaclockKeys.all, 'durations', userId, date] as const,
  projects: (userId: string, start: string, end: string) =>
    [...wakaclockKeys.all, 'projects', userId, start, end] as const,
  insights: (userId: string, type: string, range: string) =>
    [...wakaclockKeys.all, 'insights', userId, type, range] as const,
  aiStats: (userId: string, start: string, end: string) =>
    [...wakaclockKeys.all, 'ai-stats', userId, start, end] as const,
  keystrokeStats: (userId: string, start: string, end: string) =>
    [...wakaclockKeys.all, 'keystroke-stats', userId, start, end] as const,
  currentUser: (userId: string) => [...wakaclockKeys.all, 'user', userId] as const,
  heartbeats: (userId: string, date: string) =>
    [...wakaclockKeys.all, 'heartbeats', userId, date] as const,
  projectRules: (userId: string) => [...wakaclockKeys.all, 'project-rules', userId] as const,
  projectMerges: (userId: string) => [...wakaclockKeys.all, 'project-merges', userId] as const,
};
