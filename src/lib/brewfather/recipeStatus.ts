// Recipe labels and batch-derived status. Pure; no I/O.
import type { BrewfatherBatch, BrewfatherRecipe } from '@/types';

/**
 * Brewfather sets `_origin` to the source recipe's ID when a recipe is
 * cloned (e.g. from the public library or another brewer's share). Recipes
 * written from scratch have no `_origin`.
 */
export function isClonedRecipe(recipe: Pick<BrewfatherRecipe, '_origin'>): boolean {
  return typeof recipe._origin === 'string' && recipe._origin.trim() !== '';
}

/** Recipes that have at least one batch still in Brewfather's Planning status. */
export function plannedRecipeIds(batches: Pick<BrewfatherBatch, 'status' | 'recipe'>[]): Set<string> {
  return new Set(
    batches
      .filter((b) => b.status?.toLowerCase() === 'planning' && b.recipe?._id)
      .map((b) => b.recipe!._id)
  );
}
