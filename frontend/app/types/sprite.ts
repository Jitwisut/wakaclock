export type SpriteAccessory = 'beanie' | 'cap' | 'glasses' | 'headset' | 'none';
export type SpriteHairStyle = 'bob' | 'bun' | 'curls' | 'spiky' | 'swept';
export type SpriteOutfit = 'hoodie' | 'jacket' | 'overalls';

export interface SpriteAppearance {
  accentColor: string;
  accessory: SpriteAccessory;
  hairColor: string;
  hairStyle: SpriteHairStyle;
  outfit: SpriteOutfit;
  shirtColor: string;
  skinColor: string;
}
