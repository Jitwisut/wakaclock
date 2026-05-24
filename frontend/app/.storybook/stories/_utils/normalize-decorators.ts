export function normalizeDecorators<T>(decorators: T | T[] | undefined): T[] {
  if (!decorators) return [];
  return Array.isArray(decorators) ? decorators : [decorators];
}
