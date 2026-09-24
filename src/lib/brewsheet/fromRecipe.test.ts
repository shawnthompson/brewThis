import { describe, expect, it } from 'vitest';
import type { BrewfatherRecipe } from '@/types';
import { hopsByUse, parseOverride, toBrewSheetInput } from './fromRecipe';

const recipe: BrewfatherRecipe = {
  _id: 'r1',
  name: 'Test IPA',
  batchSize: 19,
  boilTime: 60,
  fermentables: [
    { name: 'Pale Ale', type: 'Grain', amount: 4.7, grainCategory: 'Base' },
    { name: 'Flaked Oats', type: 'Adjunct', amount: 0.5 },
    { name: 'Dextrose', type: 'Sugar', amount: 0.3 },
    { name: 'Crystal 40', type: 'Grain', amount: 0.2, addAfterBoil: true },
  ],
  hops: [
    { name: 'Magnum', use: 'Boil', amount: 10, time: 60 },
    { name: 'Citra', use: 'Boil', amount: 20, time: 5 },
    { name: 'Citra', use: 'Aroma', amount: 120, time: 20 },
    { name: 'Mosaic', use: 'Whirlpool', amount: 80, time: 20 },
    { name: 'Citra', use: 'Dry Hop', amount: 100, day: 7 },
    { name: 'Mosaic', use: 'Dry Hop', amount: 50, day: 3 },
  ],
  mash: { steps: [{ stepTemp: 66.7, stepTime: 60 }, { stepTemp: 75, stepTime: 10 }] },
};

describe('toBrewSheetInput', () => {
  it('maps a recipe onto calculation inputs', () => {
    expect(toBrewSheetInput(recipe)).toEqual({
      batchSizeL: 19,
      grainKg: 5.2,
      boilMinutes: 60,
      whirlpoolHopG: 200,
      mashTempC: 66.7,
      grainTempC: 20,
      strikeWaterL: undefined,
      hasCrystalOrRoast: false,
    });
  });

  it('applies overrides', () => {
    const input = toBrewSheetInput(recipe, { batchSizeL: 21, mashTempC: 65, grainTempC: 15, strikeWaterL: 17 });
    expect(input).toMatchObject({ batchSizeL: 21, mashTempC: 65, grainTempC: 15, strikeWaterL: 17 });
  });
});

describe('hopsByUse', () => {
  it('orders boil hops by time and dry hops by day', () => {
    const h = hopsByUse(recipe);
    expect(h.boil.map((x) => x.time)).toEqual([60, 5]);
    expect(h.dryHop.map((x) => x.day)).toEqual([3, 7]);
    expect(h.whirlpool).toHaveLength(2);
  });
});

describe('parseOverride', () => {
  it('accepts in-range numbers and ignores the rest', () => {
    expect(parseOverride('21', 1, 30)).toBe(21);
    expect(parseOverride('abc', 1, 30)).toBeUndefined();
    expect(parseOverride('99', 1, 30)).toBeUndefined();
    expect(parseOverride('', 1, 30)).toBeUndefined();
    expect(parseOverride(['1', '2'], 1, 30)).toBeUndefined();
    expect(parseOverride(undefined, 1, 30)).toBeUndefined();
  });
});
