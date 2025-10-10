import { NextRequest, NextResponse } from 'next/server';
import { searchSampleRecipes, sampleRecipes } from '@/lib/sampleRecipes';
import { ApiResponse, SearchResult } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Validate parameters
    if (limit > 50 || limit < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Limit must be between 1 and 50',
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // Search sample recipes
    const results = query ? searchSampleRecipes(query) : sampleRecipes;
    const limitedResults = results.slice(0, limit);

    const searchResult: SearchResult = {
      recipes: limitedResults,
      total: results.length,
      page: 1,
      limit,
      hasMore: results.length > limit,
    };

    return NextResponse.json({
      success: true,
      data: searchResult,
    } as ApiResponse<SearchResult>);

  } catch (error) {
    console.error('Sample recipe search error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while searching sample recipes',
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