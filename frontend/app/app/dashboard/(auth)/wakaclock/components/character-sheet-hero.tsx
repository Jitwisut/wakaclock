/*
 * Theme facade: Cinema renders the `character-sheet-hero.native` layout, every other preset the
 * `character-sheet-hero.classic` one (the layout before the theme redesigns).
 */

import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

import * as Classic from './character-sheet-hero.classic';
import * as Native from './character-sheet-hero.native';

export function CharacterSheetHero() {
  return (
    <LayoutSwitch classic={<Classic.CharacterSheetHero />} native={<Native.CharacterSheetHero />} />
  );
}
