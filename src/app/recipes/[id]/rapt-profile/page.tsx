import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navigation from '@/components/Navigation';
import RaptProfile from '@/components/rapt/RaptProfile';
import { loadRecipeOrNull } from '@/lib/brewfather/api';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await loadRecipeOrNull((await params).id);
  return { title: recipe ? `${recipe.name} — RAPT Profile — BrewThis` : 'RAPT Profile — BrewThis' };
}

export default async function RaptProfilePage({ params }: Props) {
  const recipe = await loadRecipeOrNull((await params).id);
  if (!recipe) notFound();
  return <><Navigation className="d-print-none" /><RaptProfile recipe={recipe} /></>;
}
