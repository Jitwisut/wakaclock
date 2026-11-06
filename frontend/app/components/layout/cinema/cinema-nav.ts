import type { NavGroup } from '@/components/layout/sidebar/nav-items';

/** One numbered entry in the Cinema rail ("scene 01", "scene 02", …). */
export type CinemaScene = {
  /** The navigation entry the scene renders. */
  item: NavGroup['items'][number];
  /** Two-digit scene number, counted over the visible entries only. */
  number: string;
};

/**
 * Flattens the visible navigation into numbered scenes. Numbers follow what this
 * deployment shows, so a hidden Goals entry does not leave a gap in the sequence.
 */
export function cinemaScenes(groups: NavGroup[]): CinemaScene[] {
  return groups
    .flatMap((group) => group.items)
    .map((item, index) => ({ item, number: String(index + 1).padStart(2, '0') }));
}

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The scene that owns `pathname`, and the sub-view inside it. Longest href wins, so
 * `/analytics/projects/x` belongs to Analytics → Projects rather than to Overview, whose
 * href is a prefix of every dashboard path.
 */
export function activeScene(
  pathname: string,
  scenes: CinemaScene[]
): { scene: CinemaScene | null; subHref: null | string } {
  let scene: CinemaScene | null = null;
  let subHref: null | string = null;
  let best = -1;
  for (const candidate of scenes) {
    const hrefs = [candidate.item.href, ...(candidate.item.items ?? []).map((sub) => sub.href)];
    for (const href of hrefs) {
      if (matches(pathname, href) && href.length > best) {
        best = href.length;
        scene = candidate;
        subHref = href === candidate.item.href && !candidate.item.items ? null : href;
      }
    }
  }
  return { scene, subHref };
}
