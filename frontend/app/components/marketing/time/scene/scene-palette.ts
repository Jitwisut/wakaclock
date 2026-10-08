/**
 * The /time scene's palette: the brand's deep forest green ground with its mint, amber and
 * lime accents (the homepage's former "dusk" palette). Human and AI stay distinguishable by
 * hue, and the scene also patterns them differently.
 */
export const SCENE = {
  bg: '#07110d',
  ink: '#d8e8dc',
  human: '#9be5b5',
  ai: '#f2b25c',
  unattributed: '#50635a',
  highlight: '#c3ee8a',
} as const;

/**
 * Daylight: the same scene once the story has handed over to the light page — the
 * marketing site's ivory and forest ink, with the day palette's deeper kind colours so
 * the ring still reads on a pale ground.
 */
export const DAY = {
  bg: '#f1efe7',
  ink: '#1b3429',
  human: '#176447',
  ai: '#b4601c',
  unattributed: '#a7ada5',
  highlight: '#176447',
} as const;
