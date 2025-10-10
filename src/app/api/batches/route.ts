import { NextRequest, NextResponse } from 'next/server';
import { createBrewfatherService } from '@/lib/brewfather/api';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 50);
    const statusParam = searchParams.get('status');
    const status = statusParam && ['Planning', 'Brewing', 'Fermenting', 'Conditioning', 'Completed', 'Archived'].includes(statusParam)
      ? statusParam as 'Planning' | 'Brewing' | 'Fermenting' | 'Conditioning' | 'Completed' | 'Archived'
      : undefined;
    const complete = searchParams.get('complete') !== 'false'; // Default to true
    const start_after = searchParams.get('start_after') || undefined;
    const order_by = searchParams.get('order_by') || '_created';
    const order_by_direction = searchParams.get('order_by_direction') as 'asc' | 'desc' || 'desc';
    const include = searchParams.get('include')?.split(',') || [];

    // Create Brewfather service
    const brewfatherService = createBrewfatherService();

    // Get batches from Brewfather
    const result = await brewfatherService.getBatches({
      limit,
      status,
      complete,
      start_after,
      order_by,
      order_by_direction,
      include: include.length > 0 ? include : undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    } as ApiResponse<typeof result>);

  } catch (error) {
    console.error('Error fetching batches:', error);
    
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
            message: 'Failed to fetch batches from Brewfather',
          } as ApiResponse<never>,
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching batches',
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