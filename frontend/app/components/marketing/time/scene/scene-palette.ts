import { PALETTE } from '../../experience/scene/palette-tokens';

/**
 * The /time scene uses the homepage's "dusk" palette — the brand's deep forest green with
 * its mint, amber and lime accents — on a near-black green ground.
 */
export const SCENE = {
  bg: '#07110d',
  ink: PALETTE.dusk.ink,
  human: PALETTE.dusk.human,
  ai: PALETTE.dusk.ai,
  unattributed: PALETTE.dusk.unknown,
  highlight: PALETTE.dusk.highlight,
} as const;
