import { NextRequest, NextResponse } from 'next/server';
import { createBrewfatherService } from '@/lib/brewfather/api';
import { ApiResponse, BrewfatherRecipe } from '@/types';

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