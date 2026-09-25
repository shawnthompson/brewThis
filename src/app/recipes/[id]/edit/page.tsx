import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navigation from '@/components/Navigation';
import RecipeEditor from '@/components/recipeEditor/RecipeEditor';
import { loadRecipeOrNull } from '@/lib/brewfather/api';
import { isSampleRecipeId } from '@/lib/brewfather/recipeInput';

export const metadata: Metadata = { title: 'Edit Recipe — BrewThis' };

// Saving replaces ingredient lists wholesale, so edit from Brewfather's
// current version, never the 10-minute read cache.
export const dynamic = 'force-dynamic';

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isSampleRecipeId(id)) notFound();

  const recipe = await loadRecipeOrNull(id, { fresh: true });
  if (!recipe) notFound();

  return (
    <>
      <Navigation />
      <RecipeEditor recipe={recipe} />
    </>
  );
}
