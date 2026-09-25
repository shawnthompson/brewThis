// Shared guards for the recipe write routes (POST/PATCH/DELETE).
import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/types';
import { RecipeInputError } from './recipeInput';

// The app has no login, so writes are only accepted from its own pages:
// a browser sends Origin on POST/PATCH/DELETE, and another site's Origin
// will not match. Requests without Origin (curl) are not from a browser.
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

export function fail(status: number, error: string, message?: string) {
  return NextResponse.json({ success: false, error, message } as ApiResponse<never>, { status });
}

export function forbiddenOrigin() {
  return fail(403, 'Forbidden', 'Recipe changes are only accepted from this app.');
}

// Maps a thrown error to a response. Brewfather's error body is passed on
// for validation failures (it names the bad field); it never holds the key.
export function writeErrorResponse(error: unknown, action: string) {
  if (error instanceof RecipeInputError) return fail(400, 'Invalid recipe', error.message);
  if (error instanceof SyntaxError) return fail(400, 'Invalid recipe', 'Request body is not valid JSON');

  if (error instanceof Error) {
    if (error.message.includes('Missing Brewfather API configuration')) {
      return fail(500, 'Server configuration error', 'Brewfather API not properly configured');
    }
    const match = error.message.match(/^Brewfather API error \((\d+)\): ([\s\S]*)$/);
    if (match) {
      const status = Number(match[1]);
      if (status === 401 || status === 403) {
        return fail(
          502,
          'Brewfather refused the change',
          'The Brewfather API key needs the recipes.write and recipes.delete scopes. Create a new key in Brewfather (Settings → API) and put it in .env.'
        );
      }
      if (status === 404) return fail(404, 'Recipe not found', 'Brewfather has no recipe with this ID.');
      if (status === 400) return fail(400, 'Brewfather rejected the recipe', match[2].slice(0, 500));
      if (status === 429) return fail(429, 'Rate limited', 'Brewfather allows 500 calls per hour. Try again shortly.');
      return fail(502, 'External API error', `Failed to ${action} in Brewfather`);
    }
  }
  return fail(500, 'Internal server error', `An unexpected error occurred while trying to ${action}`);
}
