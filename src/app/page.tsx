'use client';

import React, { useState } from 'react';
import Navigation from '@/components/Navigation';
import RecipeCard from '@/components/RecipeCard';
import LoadingSpinner, { BrewingSpinner } from '@/components/LoadingSpinner';
import { BrewfatherRecipe, SearchFilters } from '@/types';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recipes, setRecipes] = useState<BrewfatherRecipe[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters] = useState<Partial<SearchFilters>>({
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setHasSearched(true);
    
    try {
      // TODO: Replace with actual API call
      console.log('Searching for:', query, filters);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock data for now
      const mockRecipes: BrewfatherRecipe[] = [
        {
          _id: '1',
          name: 'Talus Pale Ale',
          style: { name: 'American Pale Ale' },
          abv: 5.2,
          ibu: 35,
          og: 1.052,
          fg: 1.012,
          color: 6,
          batchSize: 23,
          boilTime: 60,
          efficiency: 75,
          author: 'You',
          description: 'A hoppy pale ale showcasing Talus hops with citrus and floral notes.',
          tags: ['hoppy', 'citrus', 'american'],
          public: false
        },
        {
          _id: '2', 
          name: 'Session IPA',
          style: { name: 'Session IPA' },
          abv: 4.1,
          ibu: 45,
          og: 1.045,
          fg: 1.008,
          color: 4,
          batchSize: 23,
          boilTime: 60,
          efficiency: 72,
          author: 'Brewmaster Joe',
          description: 'A lower alcohol IPA with big hop flavor and aroma.',
          tags: ['session', 'hoppy', 'ipa'],
          public: true
        }
      ];
      
      setRecipes(mockRecipes);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecipeSelect = (recipe: BrewfatherRecipe) => {
    console.log('Selected recipe:', recipe);
    // TODO: Navigate to recipe detail page
  };

  const handleRecipeImport = (recipe: BrewfatherRecipe) => {
    console.log('Import recipe:', recipe);
    // TODO: Implement recipe import
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(searchQuery);
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column">
      <Navigation />
      
      <div className="container-fluid flex-grow-1 py-4">
        {/* Hero Section */}
        <div className="row justify-content-center mb-5">
          <div className="col-lg-8">
            <div className="text-center mb-4">
              <h1 className="display-4 mb-3">
                <i className="fas fa-search me-3 text-primary"></i>
                Find Your Perfect Recipe
              </h1>
              <p className="lead text-muted">
                Search thousands of brewing recipes from Brewfather community
              </p>
            </div>
            
            {/* Search Interface */}
            <div className="search-container">
              <div className="search-input-group mb-3">
                <i className="fas fa-search search-icon"></i>
                <input
                  type="text"
                  className="form-control form-control-lg search-input"
                  placeholder="Search recipes by name, style, or ingredients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                />
              </div>
              
              <div className="d-flex gap-2 justify-content-center">
                <button 
                  className="btn btn-primary btn-lg px-4"
                  onClick={() => handleSearch(searchQuery)}
                  disabled={isLoading || !searchQuery.trim()}
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner size="sm" className="me-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-search me-2"></i>
                      Search Recipes
                    </>
                  )}
                </button>
                
                <button className="btn btn-outline-secondary" disabled>
                  <i className="fas fa-filter me-2"></i>
                  Filters
                  <span className="badge bg-secondary ms-2" style={{ fontSize: '0.6rem' }}>
                    Soon
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {isLoading && (
          <div className="row justify-content-center">
            <div className="col-lg-6">
              <BrewingSpinner size="lg" className="py-5" />
            </div>
          </div>
        )}

        {!isLoading && hasSearched && (
          <div className="row justify-content-center">
            <div className="col-lg-10">
              {recipes.length > 0 ? (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h3>
                      <i className="fas fa-list me-2 text-primary"></i>
                      Search Results ({recipes.length})
                    </h3>
                  </div>
                  
                  <div className="row g-4">
                    {recipes.map((recipe) => (
                      <div key={recipe._id} className="col-md-6 col-lg-4">
                        <RecipeCard 
                          recipe={recipe}
                          onSelect={handleRecipeSelect}
                          onImport={handleRecipeImport}
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-5">
                  <i className="fas fa-search text-muted" style={{ fontSize: '4rem' }}></i>
                  <h4 className="text-muted mt-3">No recipes found</h4>
                  <p className="text-muted">
                    Try adjusting your search terms or check your spelling
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Welcome Message */}
        {!hasSearched && (
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="text-center py-5">
                <i className="fas fa-beer-mug-empty text-primary" style={{ fontSize: '5rem', opacity: 0.3 }}></i>
                <h3 className="text-muted mt-4">Ready to brew something amazing?</h3>
                <p className="text-muted">
                  Enter a search term above to find recipes from the Brewfather community.
                  <br />
                  You can search by recipe name, beer style, or even specific ingredients.
                </p>
                
                {/* Quick Search Buttons */}
                <div className="mt-4">
                  <h5 className="text-muted mb-3">Popular searches:</h5>
                  <div className="d-flex gap-2 justify-content-center flex-wrap">
                    {['IPA', 'Pale Ale', 'Stout', 'Wheat Beer', 'Lager'].map((style) => (
                      <button
                        key={style}
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => {
                          setSearchQuery(style);
                          handleSearch(style);
                        }}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="bg-light py-4 mt-5">
        <div className="container text-center text-muted">
          <p className="mb-0">
            <i className="fas fa-beer me-2"></i>
            BrewThis - Your brewing companion
            <span className="mx-2">•</span>
            Powered by Brewfather API
          </p>
        </div>
      </footer>
    </div>
  );
}
