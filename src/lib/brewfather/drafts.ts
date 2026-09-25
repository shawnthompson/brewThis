// Empty drafts: recipes started in Brewfather's app ("New recipe") and never
// filled in. Pure; no I/O.
import type { BrewfatherRecipe } from '@/types';
import { isSampleRecipeId } from './recipeInput';

const isBlank = (value: unknown) => typeof value !== 'string' || value.trim() === '';
const isEmptyList = (value: unknown) => !Array.isArray(value) || value.length === 0;

/**
 * True only when there is nothing to lose: no name, no notes and no
 * ingredients. Brewfather's default mash, equipment, batch size and boil time
 * are ignored, since every new recipe gets them. Anything named or with any
 * ingredient is never a draft.
 */
export function isEmptyDraft(recipe: Partial<BrewfatherRecipe>): boolean {
  if (recipe._id && isSampleRecipeId(recipe._id)) return false;
  return (
    isBlank(recipe.name) &&
    isBlank(recipe.notes) &&
    isEmptyList(recipe.fermentables) &&
    isEmptyList(recipe.hops) &&
    isEmptyList(recipe.yeasts) &&
    isEmptyList(recipe.miscs)
  );
}

// Brewfather timestamps come as { _seconds } or epoch milliseconds (sometimes a string).
export function createdAt(recipe: Partial<BrewfatherRecipe> & { _created?: { _seconds?: number } }): Date | undefined {
  if (recipe._created?._seconds !== undefined) return new Date(recipe._created._seconds * 1000);
  const ms = Number(recipe._timestamp_ms);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms) : undefined;
}
