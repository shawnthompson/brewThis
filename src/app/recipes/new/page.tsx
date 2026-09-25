import type { Metadata } from 'next';
import Navigation from '@/components/Navigation';
import RecipeEditor from '@/components/recipeEditor/RecipeEditor';

export const metadata: Metadata = { title: 'New Recipe — BrewThis' };

export default function NewRecipePage() {
  return (
    <>
      <Navigation />
      <RecipeEditor />
    </>
  );
}
