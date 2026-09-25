import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { BREWFATHER_CACHE_TAG, createBrewfatherService } from '@/lib/brewfather/api';
import { withDerivedValues } from '@/lib/brewfather/recipeCalc';
import { isSampleRecipeId, parseRecipeWrite } from '@/lib/brewfather/recipeInput';
import { fail, forbiddenOrigin, isSameOrigin, writeErrorResponse } from '@/lib/brewfather/writeRoute';
import { ApiResponse, BrewfatherRecipe } from '@/types';

// The version a recipe was loaded at: Brewfather's _rev, else its timestamp.
function recipeVersion(recipe: BrewfatherRecipe): string | undefined {
  return recipe._rev ?? (recipe._timestamp_ms !== undefined ? String(recipe._timestamp_ms) : undefined);
}

// Update a recipe. Body: { recipe: {...editable fields}, baseVersion }.
// PATCH replaces ingredient lists wholesale, so a save based on an older
// version would silently discard edits made in Brewfather since: refuse it.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  try {
    const { id } = await params;
    if (isSampleRecipeId(id)) return fail(400, 'Sample recipe', 'Sample recipes are not in Brewfather and cannot be edited.');

    const body = await request.json();
    const changes = parseRecipeWrite(body?.recipe, { requireName: false });
    const baseVersion: unknown = body?.baseVersion;

    const service = createBrewfatherService();
    const current = await service.getRecipeById(id, { fresh: true });
    const currentVersion = recipeVersion(current);
    if (typeof baseVersion !== 'string' || (currentVersion !== undefined && baseVersion !== currentVersion)) {
      return fail(
        409,
        'Recipe changed in Brewfather',
        'This recipe was changed in Brewfather after you opened it. Reload the page to edit the latest version.'
      );
    }

    // Brewfather does not recalculate on API writes; derive from the merged recipe.
    await service.updateRecipe(id, withDerivedValues(changes, current));
    revalidateTag(BREWFATHER_CACHE_TAG);
    return NextResponse.json({ success: true, data: { id } } as ApiResponse<{ id: string }>);
  } catch (error) {
    console.error('Error updating recipe:', error);
    return writeErrorResponse(error, 'update the recipe');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  try {
    const { id } = await params;
    if (isSampleRecipeId(id)) return fail(400, 'Sample recipe', 'Sample recipes are not in Brewfather and cannot be deleted.');

    await createBrewfatherService().deleteRecipe(id);
    revalidateTag(BREWFATHER_CACHE_TAG);
    return NextResponse.json({ success: true, data: { id } } as ApiResponse<{ id: string }>);
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return writeErrorResponse(error, 'delete the recipe');
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid recipe ID',
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // Create Brewfather service
    const brewfatherService = createBrewfatherService();

    // Get the specific recipe
    const recipe = await brewfatherService.getRecipeById(id);

    return NextResponse.json({
      success: true,
      data: recipe,
    } as ApiResponse<BrewfatherRecipe>);

  } catch (error) {
    console.error(`Error fetching recipe:`, error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Missing Brewfather API configuration')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Server configuration error',
            message: 'Brewfather API not properly configured',
          } as ApiResponse<never>,
          { status: 500 }
        );
      }
      
      if (error.message.includes('Brewfather API error (404)')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Recipe not found',
            message: 'The requested recipe could not be found',
          } as ApiResponse<never>,
          { status: 404 }
        );
      }
      
      if (error.message.includes('Brewfather API error')) {
        return NextResponse.json(
          {
            success: false,
            error: 'External API error',
            message: 'Failed to fetch recipe from Brewfather',
          } as ApiResponse<never>,
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching the recipe',
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}

// Handle CORS for development
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}