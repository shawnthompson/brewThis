import { BrewfatherRecipe, SearchResult } from '@/types';

export interface BrewfatherConfig {
  userId: string;
  apiKey: string;
  baseUrl: string;
}

export interface RecipeSearchParams {
  query?: string;
  limit?: number;
  offset?: number;
  sort?: 'created' | 'name' | 'abv' | 'ibu';
  order?: 'asc' | 'desc';
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
   * Makes a request to the Brewfather API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brewfather API error (${response.status}): ${errorText}`);
    }

    return response;
  }

  /**
   * Search public recipes in the Brewfather Recipe Library
   */
  async searchRecipeLibrary(params: RecipeSearchParams = {}): Promise<SearchResult> {
    const searchParams = new URLSearchParams();
    
    // Set default parameters
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    
    searchParams.append('complete', 'true'); // Only complete recipes
    searchParams.append('limit', limit.toString());
    searchParams.append('offset', offset.toString());
    
    if (params.query) {
      searchParams.append('q', params.query);
    }
    
    if (params.sort) {
      searchParams.append('sort', params.sort);
    }
    
    if (params.order) {
      searchParams.append('order', params.order);
    }

    try {
      // Try the public recipes endpoint first
      let response: Response;
      let recipes: BrewfatherRecipe[];
      
      try {
        // First attempt: try public recipes endpoint
        response = await this.makeRequest(`/v2/recipes/public?${searchParams.toString()}`);
        recipes = await response.json();
      } catch (publicError) {
        console.log('Public recipes endpoint failed, trying recipe library endpoint:', publicError);
        
        try {
          // Second attempt: try recipe library endpoint  
          response = await this.makeRequest(`/v2/recipes/library?${searchParams.toString()}`);
          recipes = await response.json();
        } catch (libraryError) {
          console.log('Recipe library endpoint failed, trying general search:', libraryError);
          
          // Third attempt: try general recipes endpoint with public filter
          searchParams.append('public', 'true');
          response = await this.makeRequest(`/v2/recipes?${searchParams.toString()}`);
          recipes = await response.json();
        }
      }
      
      return {
        recipes,
        total: recipes.length, // API might provide total count in headers
        page: Math.floor(offset / limit) + 1,
        limit,
        hasMore: recipes.length === limit,
      };
    } catch (error) {
      console.error('Error searching Brewfather Recipe Library:', error);
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
   * Search your personal recipes (for future use)
   */
  async searchMyRecipes(params: RecipeSearchParams = {}): Promise<SearchResult> {
    const searchParams = new URLSearchParams();
    
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    
    searchParams.append('limit', limit.toString());
    searchParams.append('offset', offset.toString());
    
    if (params.query) {
      searchParams.append('q', params.query);
    }
    
    if (params.sort) {
      searchParams.append('sort', params.sort);
    }
    
    if (params.order) {
      searchParams.append('order', params.order);
    }

    try {
      const response = await this.makeRequest(`/v2/recipes?${searchParams.toString()}`);
      const recipes: BrewfatherRecipe[] = await response.json();
      
      return {
        recipes,
        total: recipes.length,
        page: Math.floor(offset / limit) + 1,
        limit,
        hasMore: recipes.length === limit,
      };
    } catch (error) {
      console.error('Error searching my recipes:', error);
      throw error;
    }
  }

  /**
   * Import a recipe to your collection (for future use)
   */
  async importRecipe(recipeId: string): Promise<void> {
    try {
      await this.makeRequest(`/v2/recipes/${recipeId}/clone`, {
        method: 'POST',
      });
    } catch (error) {
      console.error(`Error importing recipe ${recipeId}:`, error);
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