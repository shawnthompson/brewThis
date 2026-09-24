import { BrewfatherRecipe, BrewfatherBatch, SearchResult } from '@/types';
import { searchSampleRecipes } from '@/lib/sampleRecipes';

const BREWFATHER_CACHE_SECONDS = 600;

export interface BrewfatherConfig {
  userId: string;
  apiKey: string;
  baseUrl: string;
}

export interface RecipeSearchParams {
  query?: string;
  limit?: number;
  start_after?: string;
  order_by?: string;
  order_by_direction?: 'asc' | 'desc';
  complete?: boolean;
  include?: string[];
}

export interface BatchSearchParams {
  status?: 'Planning' | 'Brewing' | 'Fermenting' | 'Conditioning' | 'Completed' | 'Archived';
  limit?: number;
  start_after?: string;
  order_by?: string;
  order_by_direction?: 'asc' | 'desc';
  complete?: boolean;
  include?: string[];
}

export class BrewfatherService {
  private config: BrewfatherConfig;
  
  constructor(config: BrewfatherConfig) {
    this.config = config;
  }

  /**
   * Creates the Authorization header for Brewfather API
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.config.userId}:${this.config.apiKey}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Makes a read-only request to the Brewfather API.
   * The API key is read-only and rate limited to 500 calls/hour, so responses
   * are cached by Next.js for BREWFATHER_CACHE_SECONDS.
   */
  private async makeRequest(endpoint: string): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      next: { revalidate: BREWFATHER_CACHE_SECONDS },
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brewfather API error (${response.status}): ${errorText}`);
    }

    return response;
  }

  /**
   * Search your personal recipes in Brewfather
   * Note: The Brewfather API only provides access to your personal recipes, not the public Recipe Library
   */
  async searchMyRecipes(params: RecipeSearchParams = {}): Promise<SearchResult> {
    const searchParams = new URLSearchParams();
    
    // Set default parameters according to Brewfather API docs
    const limit = Math.min(params.limit || 10, 50); // Max 50 according to docs
    
    searchParams.append('limit', limit.toString());
    
    // Include complete recipe data by default
    if (params.complete !== false) {
      searchParams.append('complete', 'true');
    }
    
    if (params.start_after) {
      searchParams.append('start_after', params.start_after);
    }
    
    if (params.order_by) {
      searchParams.append('order_by', params.order_by);
    }
    
    if (params.order_by_direction) {
      searchParams.append('order_by_direction', params.order_by_direction);
    }
    
    if (params.include && params.include.length > 0) {
      searchParams.append('include', params.include.join(','));
    }

    try {
      const response = await this.makeRequest(`/v2/recipes?${searchParams.toString()}`);
      const recipes: BrewfatherRecipe[] = await response.json();
      
      // Filter by query if provided (since API doesn't support text search)
      let filteredRecipes = recipes;
      if (params.query) {
        const query = params.query.toLowerCase();
        filteredRecipes = recipes.filter(recipe => 
          recipe.name?.toLowerCase().includes(query) ||
          recipe.style?.name?.toLowerCase().includes(query) ||
          recipe.notes?.toLowerCase().includes(query)
        );
      }
      
      // If no recipes found from Brewfather API, fall back to sample recipes for demonstration
      if (filteredRecipes.length === 0) {
        console.log('No personal Brewfather recipes found, using sample recipes for demonstration');
        const sampleResults = searchSampleRecipes(params.query || '');
        
        return {
          recipes: sampleResults.slice(0, limit),
          total: sampleResults.length,
          page: 1,
          limit,
          hasMore: sampleResults.length > limit,
        };
      }
      
      return {
        recipes: filteredRecipes,
        total: filteredRecipes.length,
        page: 1, // Brewfather API uses cursor-based pagination with start_after
        limit,
        hasMore: recipes.length === limit, // If we got the max, there might be more
      };
    } catch (error) {
      console.error('Error searching my recipes:', error);
      throw error;
    }
  }

  /**
   * Get a specific recipe by ID
   */
  async getRecipeById(id: string): Promise<BrewfatherRecipe> {
    try {
      const response = await this.makeRequest(`/v2/recipes/${id}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching recipe ${id}:`, error);
      throw error;
    }
  }


  /**
   * Get your batches from Brewfather
   */
  async getBatches(params: BatchSearchParams = {}): Promise<SearchResult> {
    const searchParams = new URLSearchParams();
    
    // Set default parameters according to Brewfather API docs
    const limit = Math.min(params.limit || 10, 50); // Max 50 according to docs
    
    searchParams.append('limit', limit.toString());
    
    if (params.status) {
      searchParams.append('status', params.status);
    }
    
    // Include complete batch data by default
    if (params.complete !== false) {
      searchParams.append('complete', 'true');
    }
    
    if (params.start_after) {
      searchParams.append('start_after', params.start_after);
    }
    
    if (params.order_by) {
      searchParams.append('order_by', params.order_by);
    }
    
    if (params.order_by_direction) {
      searchParams.append('order_by_direction', params.order_by_direction);
    }
    
    if (params.include && params.include.length > 0) {
      searchParams.append('include', params.include.join(','));
    }

    try {
      const response = await this.makeRequest(`/v2/batches?${searchParams.toString()}`);
      const batches: BrewfatherBatch[] = await response.json();
      
      return {
        recipes: batches as unknown as BrewfatherRecipe[], // Type casting since SearchResult expects recipes but we're returning batches
        total: batches.length,
        page: 1, // Brewfather API uses cursor-based pagination with start_after
        limit,
        hasMore: batches.length === limit,
      };
    } catch (error) {
      console.error('Error fetching batches:', error);
      throw error;
    }
  }

  /**
   * Get a specific batch by ID
   */
  async getBatchById(id: string): Promise<BrewfatherBatch> {
    try {
      const response = await this.makeRequest(`/v2/batches/${id}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching batch ${id}:`, error);
      throw error;
    }
  }
}

/**
 * Create a configured Brewfather service instance
 */
export function createBrewfatherService(): BrewfatherService {
  const config: BrewfatherConfig = {
    userId: process.env.BREWFATHER_USERID!,
    apiKey: process.env.BREWFATHER_API!,
    baseUrl: process.env.BREWFATHER_API_URL!,
  };

  if (!config.userId || !config.apiKey || !config.baseUrl) {
    throw new Error('Missing Brewfather API configuration. Check environment variables.');
  }

  return new BrewfatherService(config);
}