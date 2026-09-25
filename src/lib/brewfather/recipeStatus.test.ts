import { describe, expect, it } from 'vitest';
import type { BrewfatherRecipe } from '@/types';
import { isClonedRecipe, plannedRecipeIds } from './recipeStatus';

describe('isClonedRecipe', () => {
  it('is true when Brewfather recorded a source recipe', () => {
    // e.g. "Behemoth Hopportunity - Clone", cloned from Pig Den Brewing's recipe
    expect(isClonedRecipe({ _origin: 'fVF4FN1NtkNnnnQUe5OE5sDgghr7yI' })).toBe(true);
  });

  it('is false for recipes written from scratch', () => {
    expect(isClonedRecipe({ _origin: null })).toBe(false);
    expect(isClonedRecipe({})).toBe(false);
    expect(isClonedRecipe({ _origin: '  ' })).toBe(false);
  });
});

describe('plannedRecipeIds', () => {
  const recipe = (id: string) => ({ _id: id, name: id }) as BrewfatherRecipe;

  it('collects recipes with a batch in Planning', () => {
    const ids = plannedRecipeIds([
      { status: 'Planning', recipe: recipe('a') },
      { status: 'planning', recipe: recipe('b') },
      { status: 'Completed', recipe: recipe('c') },
      { status: 'Fermenting', recipe: recipe('d') },
      { status: 'Planning' },
    ]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('counts a recipe once however many batches are planned', () => {
    expect(plannedRecipeIds([
      { status: 'Planning', recipe: recipe('a') },
      { status: 'Planning', recipe: recipe('a') },
    ]).size).toBe(1);
  });
});
