import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { BREWFATHER_CACHE_TAG, createBrewfatherService } from '@/lib/brewfather/api';
import { withDerivedValues } from '@/lib/brewfather/recipeCalc';
import { parseRecipeWrite } from '@/lib/brewfather/recipeInput';
import { forbiddenOrigin, isSameOrigin, writeErrorResponse } from '@/lib/brewfather/writeRoute';
import { ApiResponse } from '@/types';

// Create a recipe in Brewfather.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  try {
    const body = await request.json();
    const preserveUnknownFg = body?.preserveUnknownFg === true;
    const recipe = parseRecipeWrite(body?.recipe ?? body, { requireName: true });
    // Brewfather does not calculate OG/FG/ABV/IBU/colour on API writes.
    const id = await createBrewfatherService().createRecipe(
      withDerivedValues(recipe, undefined, {
        includeFg: !preserveUnknownFg,
        includeAbv: !preserveUnknownFg,
      })
    );
    revalidateTag(BREWFATHER_CACHE_TAG);

    return NextResponse.json({ success: true, data: { id } } as ApiResponse<{ id: string }>, {
      status: 201,
    });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return writeErrorResponse(error, 'create the recipe');
  }
}
