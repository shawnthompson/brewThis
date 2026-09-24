import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navigation from '@/components/Navigation';
import BrewSheet from '@/components/brewsheet/BrewSheet';
import { createBrewfatherService } from '@/lib/brewfather/api';
import { parseOverride } from '@/lib/brewsheet/fromRecipe';
import type { BrewfatherRecipe } from '@/types';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { title: 'Brew Sheet — BrewThis' };

async function loadRecipe(id: string): Promise<BrewfatherRecipe | null> {
  try {
    return await createBrewfatherService().getRecipeById(id);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Brewfather API error (404)')) {
      return null;
    }
    throw new Error('Failed to load recipe from Brewfather');
  }
}

export default async function BrewSheetPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;

  const recipe = await loadRecipe(id);
  if (!recipe) notFound();

  const overrides = {
    batchSizeL: parseOverride(query.batch, 1, 30),
    mashTempC: parseOverride(query.mash, 60, 75),
    grainTempC: parseOverride(query.grain, 0, 40),
    strikeWaterL: parseOverride(query.strike, 5, 30),
  };

  return (
    <>
      <Navigation className="d-print-none" />
      <BrewSheet recipe={recipe} overrides={overrides} />
    </>
  );
}
