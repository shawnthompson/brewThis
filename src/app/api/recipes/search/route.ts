import { NextRequest, NextResponse } from 'next/server';
import { createBrewfatherService } from '@/lib/brewfather/api';
import { ApiResponse, SearchResult } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');
    const start_after = searchParams.get('start_after') || undefined;
    const order_by = searchParams.get('order_by') || undefined;
    const order_by_direction = searchParams.get('order_by_direction') as 'asc' | 'desc' || 'asc';

    // Validate parameters
    if (limit > 50 || limit < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Limit must be between 1 and 50 (Brewfather API maximum)',
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // Create Brewfather service
    const brewfatherService = createBrewfatherService();

    // Search your personal recipes (Brewfather API only provides personal recipes, not public library)
    const result = await brewfatherService.searchMyRecipes({
      query,
      limit,
      start_after,
      order_by,
      order_by_direction,
      complete: true,
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