import { describe, expect, it } from 'vitest';
import type { BrewfatherRecipe } from '@/types';
import { calculateDerived, withDerivedValues } from './recipeCalc';
import calibration from './__fixtures__/calibrationRecipes.json';

// Real recipes with the values Brewfather itself calculated for them.
type Fixture = { recipe: Partial<BrewfatherRecipe>; brewfather: { og: number; fg: number; abv: number; ibu: number; color: number } };
const recipes = calibration as unknown as Record<string, Fixture>;

// American IPA Centennial is kept only for its "FALSE" flags: its stored FG
// (1.011) implies ~86% attenuation against a 76.5% yeast, so it is stale.
const CALIBRATED = ['Plansmash West Coast IPA', 'Old Skool', 'Sample Blonde Ale'];

describe('calculateDerived — against Brewfather', () => {
  for (const name of CALIBRATED) {
    const { recipe, brewfather } = recipes[name];
    it(`${name}: OG ±1 pt, FG ±1 pt, ABV ±0.2, colour ±0.5 SRM, IBU ±35%`, () => {
      const d = calculateDerived(recipe as BrewfatherRecipe);
      expect(Math.abs(d.og - brewfather.og) * 1000).toBeLessThanOrEqual(1);
      expect(Math.abs(d.fg - brewfather.fg) * 1000).toBeLessThanOrEqual(1);
      expect(Math.abs(d.abv - brewfather.abv)).toBeLessThanOrEqual(0.2);
      expect(Math.abs(d.color - brewfather.color)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(d.ibu - brewfather.ibu) / brewfather.ibu).toBeLessThanOrEqual(0.35);
    });
  }

  it('reads "FALSE" string flags as false (American IPA Centennial stores them that way)', () => {
    const centennial = recipes['American IPA Centennial'].recipe;
    expect(centennial.fermentables?.[0].addAfterBoil).toBe('FALSE');
    expect(calculateDerived(centennial as BrewfatherRecipe).og).toBeGreaterThan(1.07);
  });
});

describe('calculateDerived — edge cases', () => {
  it('gives Brewfather-style neutral values for an empty recipe', () => {
    expect(calculateDerived({})).toEqual({ og: 1, fg: 1, abv: 0, ibu: 0, color: 0, fermentablePercentages: [] });
  });

  it('treats a recipe without yeast as unfermented', () => {
    const d = calculateDerived({
      batchSize: 19,
      efficiency: 72,
      fermentables: [{ name: 'Pale', amount: 5.2, potential: 1.037 }],
    });
    expect(d.og).toBeGreaterThan(1.05);
    expect(d.fg).toBe(Math.round(d.og * 1000) / 1000);
    expect(d.abv).toBeLessThan(0.1);
  });

  it('adds boil sugars at full strength and skips additions after the boil', () => {
    const base = { batchSize: 20, efficiency: 70, fermentables: [{ name: 'Pale', amount: 5, potential: 1.037 }] };
    const og = calculateDerived(base).og;
    expect(calculateDerived({ ...base, fermentables: [...base.fermentables, { name: 'Dextrose', type: 'Sugar', amount: 0.5, potential: 1.046 }] }).og).toBeGreaterThan(og + 0.009);
    expect(calculateDerived({ ...base, fermentables: [...base.fermentables, { name: 'Fruit', amount: 1, potential: 1.01, addAfterBoil: true }] }).og).toBe(og);
  });

  it('gives no IBU for dry hops and less for whirlpool than boil', () => {
    const base = { batchSize: 20, efficiency: 70, fermentables: [{ name: 'Pale', amount: 5, potential: 1.037 }] };
    const hop = { name: 'Citra', alpha: 12, amount: 50 };
    const dry = calculateDerived({ ...base, hops: [{ ...hop, use: 'Dry Hop', time: 3 }] }).ibu;
    const whirlpool = calculateDerived({ ...base, hops: [{ ...hop, use: 'Aroma', time: 20 }] }).ibu;
    const boil = calculateDerived({ ...base, hops: [{ ...hop, use: 'Boil', time: 60 }] }).ibu;
    expect(dry).toBe(0);
    expect(whirlpool).toBeGreaterThan(0);
    expect(boil).toBeGreaterThan(whirlpool * 3);
  });

  // PR #2 review (P1): a missing potential used to add zero gravity.
  it('assumes the fallback potential for fermentables without one', () => {
    const base = { batchSize: 20, efficiency: 70, yeasts: [{ name: 'US-05', attenuation: 78 }] };
    const missing = calculateDerived({ ...base, fermentables: [{ name: 'Pale', amount: 5 }] });
    const explicit = calculateDerived({ ...base, fermentables: [{ name: 'Pale', amount: 5, potential: 1.037 }] });
    expect(missing).toEqual(explicit);
    expect(missing.og).toBeGreaterThan(1.04);
  });

  // PR #2 review (P2): attenuation used to apply to non-fermentables too.
  it('keeps non-fermentable gravity (lactose) in the FG', () => {
    const base = {
      batchSize: 20,
      efficiency: 70,
      yeasts: [{ name: 'US-05', attenuation: 80 }],
      fermentables: [{ name: 'Pale', amount: 5, potential: 1.037 }],
    };
    const lactose = { name: 'Lactose', type: 'Sugar', amount: 0.5, potential: 1.035 };
    const plain = calculateDerived(base);
    const flagged = calculateDerived({ ...base, fermentables: [...base.fermentables, { ...lactose, notFermentable: true }] });
    const unflagged = calculateDerived({ ...base, fermentables: [...base.fermentables, lactose] });

    const lactoseOgPoints = (flagged.og - plain.og) * 1000;
    expect(flagged.og).toBe(unflagged.og);
    // All of the lactose's points survive fermentation...
    expect((flagged.fg - plain.fg) * 1000).toBeCloseTo(lactoseOgPoints, 0);
    // ...so FG is higher and ABV lower than if it fermented.
    expect(flagged.fg).toBeGreaterThan(unflagged.fg);
    expect(flagged.abv).toBeLessThan(unflagged.abv);
  });

  it('reads the string "false" on notFermentable as fermentable', () => {
    const base = {
      batchSize: 20,
      efficiency: 70,
      yeasts: [{ name: 'US-05', attenuation: 80 }],
      fermentables: [{ name: 'Pale', amount: 5, potential: 1.037 }],
    };
    const stringFalse = calculateDerived({ ...base, fermentables: [{ ...base.fermentables[0], notFermentable: 'false' }] });
    expect(stringFalse).toEqual(calculateDerived(base));
  });

  it('sets fermentable percentages by weight', () => {
    expect(
      calculateDerived({ fermentables: [{ name: 'A', amount: 4.5 }, { name: 'B', amount: 0.5 }] }).fermentablePercentages
    ).toEqual([90, 10]);
  });
});

describe('withDerivedValues', () => {
  const current = {
    _id: 'r1',
    name: 'Test',
    batchSize: 20,
    efficiency: 70,
    fermentables: [{ name: 'Pale', amount: 5, potential: 1.037, color: 3, percentage: 50 }],
    yeasts: [{ name: 'US-05', attenuation: 78 }],
    og: 1.099,
  } as BrewfatherRecipe;

  it('recalculates from the stored recipe when only notes change', () => {
    const out = withDerivedValues({ notes: 'x' }, current);
    expect(out.notes).toBe('x');
    expect(out.og).toBeLessThan(1.07);
    expect(out.fermentables?.[0]).toMatchObject({ name: 'Pale', percentage: 100 });
  });

  it('uses the edited values over the stored ones', () => {
    const doubled = withDerivedValues({ fermentables: [{ name: 'Pale', amount: 10, potential: 1.037 }] }, current);
    expect(doubled.og).toBeGreaterThan(withDerivedValues({}, current).og! + 0.04);
  });
});
