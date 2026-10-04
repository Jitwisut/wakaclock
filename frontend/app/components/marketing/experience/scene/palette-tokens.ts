/*
 * Plain hex tokens, kept free of three.js imports so the server-rendered still scene can
 * use them without pulling the WebGL bundle into the page's first load.
 */

/**
 * Scene colours, derived from the marketing tokens (ivory, forest ink) and the product's
 * own dashboard hero (the deep green card and its lime accent), so the 3D world and the
 * interface it becomes in chapter 4 read as one material.
 *
 * Two lights: daylight for the opening and the product, dusk for Human + AI. Kind colours
 * are chosen so human vs AI stays distinguishable by hue *and* by the shader's pattern.
 */
export const PALETTE = {
  day: {
    bg: '#f1efe7',
    ink: '#1b3429',
    human: '#176447',
    ai: '#b4601c',
    unknown: '#a7ada5',
    highlight: '#7fb13c',
    line: '#b4601c',
  },
  dusk: {
    bg: '#0f2019',
    ink: '#d8e8dc',
    human: '#9be5b5',
    ai: '#f2b25c',
    unknown: '#50635a',
    highlight: '#c3ee8a',
    line: '#f2b25c',
  },
} as const;
