import { NextRequest, NextResponse } from 'next/server';
import { createBrewfatherService } from '@/lib/brewfather/api';
import { ApiResponse, SearchResult } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = searchParams.get('sort') as 'created' | 'name' | 'abv' | 'ibu' || 'created';
    const order = searchParams.get('order') as 'asc' | 'desc' || 'desc';

    // Validate parameters
    if (limit > 100 || limit < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Limit must be between 1 and 100',
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Offset must be non-negative',
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // Create Brewfather service
    const brewfatherService = createBrewfatherService();

    // Search Recipe Library (public recipes)
    const result = await brewfatherService.searchRecipeLibrary({
      query,
      limit,
      offset,
      sort,
      order,
    });

    return NextResponse.json({
      success: true,
      data: result,
    } as ApiResponse<SearchResult>);

  } catch (error) {
    console.error('Recipe search error:', error);
    
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
      
      if (error.message.includes('Brewfather API error')) {
        return NextResponse.json(
          {
            success: false,
            error: 'External API error',
            message: 'Failed to fetch recipes from Brewfather',
          } as ApiResponse<never>,
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while searching recipes',
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