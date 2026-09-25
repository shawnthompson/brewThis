import { describe, expect, it } from 'vitest';
import { isSampleRecipeId, parseRecipeWrite, RecipeInputError } from './recipeInput';

describe('parseRecipeWrite', () => {
  it('accepts a minimal create and trims the name', () => {
    expect(parseRecipeWrite({ name: '  Citra IPA ' }, { requireName: true })).toEqual({ name: 'Citra IPA' });
  });

  it('requires a name on create but not on update', () => {
    expect(() => parseRecipeWrite({}, { requireName: true })).toThrow(RecipeInputError);
    expect(() => parseRecipeWrite({ name: '   ' }, { requireName: true })).toThrow(/name/);
    expect(parseRecipeWrite({ notes: 'x' }, { requireName: false })).toEqual({ notes: 'x' });
  });

  it('rejects fields the app does not edit, including server-managed ones', () => {
    expect(() => parseRecipeWrite({ name: 'A', _id: 'x' }, { requireName: true })).toThrow(/_id/);
    expect(() => parseRecipeWrite({ name: 'A', og: 1.05 }, { requireName: true })).toThrow(/og/);
    expect(() => parseRecipeWrite({ name: 'A', water: {} }, { requireName: true })).toThrow(/water/);
  });

  it('bounds batch size, boil time and efficiency', () => {
    expect(() => parseRecipeWrite({ batchSize: 0 }, { requireName: false })).toThrow(/batchSize/);
    expect(() => parseRecipeWrite({ boilTime: 500 }, { requireName: false })).toThrow(/boilTime/);
    expect(() => parseRecipeWrite({ efficiency: '70' }, { requireName: false })).toThrow(/efficiency/);
    expect(parseRecipeWrite({ batchSize: 19, boilTime: 60, efficiency: 72 }, { requireName: false })).toEqual({
      batchSize: 19,
      boilTime: 60,
      efficiency: 72,
    });
  });

  it('checks ingredient amounts but passes other Brewfather fields through', () => {
    const hops = [{ name: 'Citra', amount: 50, time: 20, use: 'Aroma', inventory: -10 }];
    expect(parseRecipeWrite({ hops }, { requireName: false })).toEqual({ hops });
    expect(() => parseRecipeWrite({ hops: [{ name: 'Citra', amount: -5 }] }, { requireName: false })).toThrow(
      /hops 1: amount/
    );
    expect(() => parseRecipeWrite({ fermentables: {} }, { requireName: false })).toThrow(/list/);
  });

  it('checks mash and fermentation steps', () => {
    expect(() =>
      parseRecipeWrite({ mash: { steps: [{ stepTemp: 'hot' }] } }, { requireName: false })
    ).toThrow(/mash step 1: stepTemp/);
    const mash = { name: 'Single', steps: [{ stepTemp: 66.7, stepTime: 60 }] };
    expect(parseRecipeWrite({ mash }, { requireName: false })).toEqual({ mash });
  });

  it('rejects non-object bodies', () => {
    expect(() => parseRecipeWrite([], { requireName: true })).toThrow(RecipeInputError);
    expect(() => parseRecipeWrite(null, { requireName: true })).toThrow(RecipeInputError);
  });
});

describe('isSampleRecipeId', () => {
  it('recognises the built-in sample recipes', () => {
    expect(isSampleRecipeId('sample-ipa-001')).toBe(true);
    expect(isSampleRecipeId('GRmqTXbCbaXxFE3PsDlDoYtDfmlNJa')).toBe(false);
  });
});
