/** Calendar dates in the organization's timezone, independent of the host timezone. */
export function closedWeeks(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) => Number(parts.find((p) => p.type === name)?.value);
  const today = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const date = (d: Date) => d.toISOString().slice(0, 10);
  return Array.from({ length: 51 }, (_, index) => {
    const start = new Date(monday);
    start.setUTCDate(start.getUTCDate() - 7 * (index + 1));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return { start: date(start), end: date(end) };
  });
}
