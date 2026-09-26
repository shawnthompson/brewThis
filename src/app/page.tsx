'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import RecipeCard from '@/components/RecipeCard';
import RecipeDetailModal from '@/components/RecipeDetailModal';
import { isPlanningStatus, plannedRecipeIds } from '@/lib/brewfather/recipeStatus';
import EmptyDraftCleanup from '@/components/EmptyDraftCleanup';
import FilterSidebar from '@/components/FilterSidebar';
import { BrewingSpinner } from '@/components/LoadingSpinner';
import { BrewfatherRecipe, BrewfatherBatch } from '@/types';

interface RecipeFilters {
  text: string;
  styles: string[];
  types: string[];
  hops: string[];
  abvRange: [number, number];
  ibuRange: [number, number];
  brewingStatus: 'all' | 'brewed' | 'planned' | 'not-brewed';
  sortBy: 'name' | 'abv' | 'ibu' | 'og' | '_created';
  sortOrder: 'asc' | 'desc';
}

interface BrewingHistory {
  recipeId: string;
  dateBrewed: string;
  notes?: string;
  rating?: number;
  batchId?: string;
  batchNo?: number;
  status?: string;
  measuredOg?: number;
  measuredFg?: number;
  measuredAbv?: number;
}

export default function Home() {
  const [allRecipes, setAllRecipes] = useState<BrewfatherRecipe[]>([]);
  const [, setAllBatches] = useState<BrewfatherBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<BrewfatherRecipe | null>(null);
  const [selectedRecipeIndex, setSelectedRecipeIndex] = useState<number>(0);
  const [brewingHistory, setBrewingHistory] = useState<BrewingHistory[]>([]);
  const [plannedIds, setPlannedIds] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Dynamic filter ranges based on actual recipe data
  const maxAbv = useMemo(() => {
    if (allRecipes.length === 0) return 15;
    return Math.ceil(Math.max(...allRecipes.map(r => r.abv || 0)));
  }, [allRecipes]);
  
  const maxIbu = useMemo(() => {
    if (allRecipes.length === 0) return 120;
    return Math.ceil(Math.max(...allRecipes.map(r => r.ibu || 0)));
  }, [allRecipes]);
  
  const [filters, setFilters] = useState<RecipeFilters>({
    text: '',
    styles: [],
    types: [],
    hops: [],
    abvRange: [0, 15], // Will be updated when recipes load
    ibuRange: [0, 120], // Will be updated when recipes load
    brewingStatus: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  });
  
  // Update filter ranges when recipes change
  useEffect(() => {
    if (allRecipes.length > 0) {
      setFilters(prev => ({
        ...prev,
        abvRange: [0, maxAbv],
        ibuRange: [0, maxIbu]
      }));
    }
  }, [maxAbv, maxIbu, allRecipes.length]);

  // Sync batches with brewing history
  const syncBatchesWithBrewingHistory = (batches: BrewfatherBatch[]) => {
    if (!batches || batches.length === 0) return;
    
    // A Planning batch can already carry its planned brew date, so it does
    // not count as brewed; it is tracked separately as planned.
    setPlannedIds(plannedRecipeIds(batches));

    const brewingHistoryFromBatches: BrewingHistory[] = batches
      .filter(batch => batch.recipe?._id && batch.brewDate && !isPlanningStatus(batch.status))
      .map(batch => {
        // Convert brewDate from timestamp to ISO date string
        const brewDate = typeof batch.brewDate === 'number' 
          ? new Date(batch.brewDate).toISOString().split('T')[0]
          : batch.brewDate!;
          
        return {
          recipeId: batch.recipe!._id,
          dateBrewed: brewDate,
          batchId: batch._id,
          batchNo: batch.batchNo,
          status: batch.status,
          notes: batch.batchNotes, // Use batchNotes field from batch
          measuredOg: batch.measuredOg,
          measuredFg: batch.measuredFg,
          measuredAbv: batch.measuredAbv
        };
      });
    
    console.log(`Found ${brewingHistoryFromBatches.length} brewed recipes from ${batches.length} batches`);
    
    // Update brewing history with batch data
    setBrewingHistory(brewingHistoryFromBatches);
    
    // Also save to localStorage as backup
    try {
      localStorage.setItem('brewingHistory', JSON.stringify(brewingHistoryFromBatches));
    } catch (error) {
      console.error('Error saving brewing history to localStorage:', error);
    }
  };

  // Load all recipes on component mount
  useEffect(() => {
    const loadAllRecipes = async () => {
      setIsLoading(true);
      
      try {
        // Load with high limit to get all personal recipes
        const searchParams = new URLSearchParams({
          limit: '50', // Max allowed by Brewfather API
          order_by: '_created',
          order_by_direction: 'desc',
        });
        
        const response = await fetch(`/api/recipes/search?${searchParams.toString()}`);
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message || result.error || 'Failed to load recipes');
        }
        
        const recipes = result.data.recipes || [];
        setAllRecipes(recipes);
        
        // Log successful load for debugging
        console.log(`Loaded ${recipes.length} recipes from Brewfather`);
        return recipes;
        
      } catch (error) {
        console.error('Recipe loading error:', error);
        
        // Show user-friendly error message
        let errorMessage = 'Failed to load recipes. Please try again.';
        
        if (error instanceof Error) {
          if (error.message.includes('Server configuration error')) {
            errorMessage = 'Recipe service is temporarily unavailable.';
          } else if (error.message.includes('External API error')) {
            errorMessage = 'Unable to connect to Brewfather. Please try again later.';
          }
        }
        
        // For now, we'll just log the error. In the future, we could show a toast/alert
        console.error('User-facing error:', errorMessage);
        
        // Set empty results on error
        setAllRecipes([]);
        return [];
      } finally {
        setIsLoading(false);
      }
    };
    
    const loadAllBatches = async () => {
      try {
        console.log('Loading batches from Brewfather...');
        const batches: BrewfatherBatch[] = [];
        let startAfter: string | undefined;

        while (true) {
          const searchParams = new URLSearchParams({
            limit: '50',
            complete: 'true',
            order_by: '_created',
            order_by_direction: 'desc',
          });
          if (startAfter) searchParams.set('start_after', startAfter);

          const response = await fetch(`/api/batches?${searchParams.toString()}`);
          const result = await response.json();

          if (!result.success || !result.data?.recipes) {
            console.warn('No batches found or API error:', result.message);
            return [];
          }

          const page = result.data.recipes as BrewfatherBatch[];
          batches.push(...page);

          if (!result.data.hasMore || page.length === 0) break;

          const lastBatchId = page[page.length - 1]?._id;
          if (!lastBatchId || lastBatchId === startAfter) {
            console.warn('Stopping batch pagination because Brewfather returned no next cursor');
            break;
          }
          startAfter = lastBatchId;
        }

        setAllBatches(batches);
        console.log(`Loaded ${batches.length} batches from Brewfather`);
        return batches;
      } catch (error) {
        console.error('Error loading batches:', error);
        return [];
      }
    };
    
    const loadAndSyncData = async () => {
      // Load recipes and batches in parallel
      const [, batches] = await Promise.all([
        loadAllRecipes(),
        loadAllBatches()
      ]);
      
      // Sync batches with brewing history
      syncBatchesWithBrewingHistory(batches);
    };
    
    loadAndSyncData();
    
    // Load any existing localStorage brewing history as fallback
    const loadStoredBrewingHistory = () => {
      try {
        const stored = localStorage.getItem('brewingHistory');
        if (stored) {
          const storedHistory = JSON.parse(stored);
          // Merge with any batch-synced history
          setBrewingHistory(prev => {
            const existingIds = new Set(prev.map(h => h.recipeId));
            const newFromStorage = storedHistory.filter((h: BrewingHistory) =>
              !isPlanningStatus(h.status) && !existingIds.has(h.recipeId)
            );
            return [...prev, ...newFromStorage];
          });
        }
      } catch (error) {
        console.error('Error loading stored brewing history:', error);
      }
    };
    
    loadStoredBrewingHistory();
  }, []);


  // Check if recipe has been brewed
  const hasBeenBrewed = useCallback((recipeId: string) => {
    return brewingHistory.some(history => history.recipeId === recipeId);
  }, [brewingHistory]);

  // Client-side filtering and sorting
  const filteredRecipes = useMemo(() => {
    let filtered = [...allRecipes];
    
    // Text filter
    if (filters.text.trim()) {
      const searchTerm = filters.text.toLowerCase();
      filtered = filtered.filter(recipe => 
        recipe.name?.toLowerCase().includes(searchTerm) ||
        recipe.style?.name?.toLowerCase().includes(searchTerm) ||
        recipe.notes?.toLowerCase().includes(searchTerm) ||
        recipe.author?.toLowerCase().includes(searchTerm) ||
        recipe.fermentables?.some(fermentable => 
          fermentable.name?.toLowerCase().includes(searchTerm)
        ) ||
        recipe.hops?.some(hop => 
          hop.name?.toLowerCase().includes(searchTerm)
        )
      );
    }
    
    // Style filter
    if (filters.styles.length > 0) {
      filtered = filtered.filter(recipe => 
        recipe.style?.name && filters.styles.includes(recipe.style.name)
      );
    }
    
    // Type filter
    if (filters.types.length > 0) {
      filtered = filtered.filter(recipe => 
        recipe.type && filters.types.includes(recipe.type)
      );
    }
    
    // Hop filter
    if (filters.hops.length > 0) {
      filtered = filtered.filter(recipe => 
        recipe.hops && recipe.hops.some(hop => 
          hop.name && filters.hops.includes(hop.name)
        )
      );
    }
    
    // Brewing status filter
    if (filters.brewingStatus !== 'all') {
      filtered = filtered.filter(recipe => {
        if (filters.brewingStatus === 'planned') return plannedIds.has(recipe._id);
        const brewed = hasBeenBrewed(recipe._id);
        return filters.brewingStatus === 'brewed' ? brewed : !brewed;
      });
    }
    
    // ABV range filter
    filtered = filtered.filter(recipe => {
      const abv = recipe.abv || 0;
      return abv >= filters.abvRange[0] && abv <= filters.abvRange[1];
    });
    
    // IBU range filter
    filtered = filtered.filter(recipe => {
      const ibu = recipe.ibu || 0;
      return ibu >= filters.ibuRange[0] && ibu <= filters.ibuRange[1];
    });
    
    // Sort recipes
    filtered.sort((a, b) => {
      let aValue: string | number, bValue: string | number;
      
      switch (filters.sortBy) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'abv':
          aValue = a.abv || 0;
          bValue = b.abv || 0;
          break;
        case 'ibu':
          aValue = a.ibu || 0;
          bValue = b.ibu || 0;
          break;
        case 'og':
          aValue = a.og || 0;
          bValue = b.og || 0;
          break;
        case '_created':
          aValue = a._created?._seconds || 0;
          bValue = b._created?._seconds || 0;
          break;
        default:
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
      }
      
      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
    
    return filtered;
  }, [allRecipes, filters, hasBeenBrewed, plannedIds]);
  
  // Extract unique styles and types for filter options
  const availableStyles = useMemo(() => {
    const styles = new Set<string>();
    allRecipes.forEach(recipe => {
      if (recipe.style?.name) {
        styles.add(recipe.style.name);
      }
    });
    return Array.from(styles).sort();
  }, [allRecipes]);
  
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    allRecipes.forEach(recipe => {
      if (recipe.type) {
        types.add(recipe.type);
      }
    });
    return Array.from(types).sort();
  }, [allRecipes]);
  
  const availableHops = useMemo(() => {
    const hops = new Set<string>();
    allRecipes.forEach(recipe => {
      if (recipe.hops) {
        recipe.hops.forEach(hop => {
          if (hop.name) {
            hops.add(hop.name);
          }
        });
      }
    });
    return Array.from(hops).sort();
  }, [allRecipes]);

  const handleRecipeSelect = (recipe: BrewfatherRecipe) => {
    const index = filteredRecipes.findIndex(r => r._id === recipe._id);
    setSelectedRecipe(recipe);
    setSelectedRecipeIndex(index >= 0 ? index : 0);
  };
  
  const handleModalNavigation = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < filteredRecipes.length) {
      setSelectedRecipe(filteredRecipes[newIndex]);
      setSelectedRecipeIndex(newIndex);
    }
  };

  const handleRecipeImport = (recipe: BrewfatherRecipe) => {
    console.log('Import recipe:', recipe);
    // TODO: Implement recipe import
  };

  const updateFilter = (key: keyof RecipeFilters, value: string | string[] | number[] | 'all' | 'brewed' | 'not-brewed' | 'name' | 'abv' | 'ibu' | 'og' | '_created' | 'asc' | 'desc') => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      text: '',
      styles: [],
      types: [],
      hops: [],
      abvRange: [0, maxAbv], // Use dynamic max based on actual recipes
      ibuRange: [0, maxIbu], // Use dynamic max based on actual recipes
      brewingStatus: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    });
  };
  

  return (
    <div className="min-vh-100">
      <Navigation />
      
      {/* Filter Sidebar */}
      <FilterSidebar
        filters={filters}
        availableStyles={availableStyles}
        availableTypes={availableTypes}
        availableHops={availableHops}
        maxAbv={maxAbv}
        maxIbu={maxIbu}
        onFilterChange={updateFilter}
        onClearFilters={clearFilters}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        totalRecipes={allRecipes.length}
        filteredCount={filteredRecipes.length}
      />
      
      {/* Main Content */}
      <div className="main-content" style={{ marginLeft: sidebarOpen ? '320px' : '0', transition: 'margin-left 0.3s' }}>
        <div className="container-fluid py-4">
          {/* Header Section */}
          <div className="row mb-4">
            <div className="col">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center">
                  {!sidebarOpen && (
                    <button
                      className="btn btn-outline-secondary me-3"
                      onClick={() => setSidebarOpen(true)}
                    >
                      <i className="fas fa-filter"></i>
                    </button>
                  )}
                  <h2 className="mb-0">
                    <i className="fas fa-flask me-2 text-primary"></i>
                    My Recipe Collection
                  </h2>
                </div>
                <div className="d-flex align-items-center gap-3">
                  {!isLoading && allRecipes.length > 0 && (
                    <div className="text-muted">
                      <i className="fas fa-check-circle me-2 text-success"></i>
                      <strong>{allRecipes.length}</strong> recipes loaded
                    </div>
                  )}
                  <a href="/recipes/new" className="btn btn-primary">
                    <i className="fas fa-plus me-2"></i>
                    New recipe
                  </a>
                </div>
              </div>
              <p className="text-muted mb-0">
                Browse and filter your personal brewing recipes from Brewfather
              </p>
            </div>
          </div>

        {!isLoading && (
          <EmptyDraftCleanup
            recipes={allRecipes}
            onDeleted={(ids) => setAllRecipes((recipes) => recipes.filter((r) => !ids.includes(r._id)))}
          />
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="row justify-content-center">
            <div className="col-lg-6">
              <BrewingSpinner size="lg" className="py-5" />
              <div className="text-center">
                <h5 className="text-muted">Loading your recipes from Brewfather...</h5>
              </div>
            </div>
          </div>
        )}

          {/* Recipe Results */}
          {!isLoading && allRecipes.length > 0 && (
            <div className="row">
              <div className="col">
                {filteredRecipes.length > 0 ? (
                  <div className="row g-4">
                    {filteredRecipes.map((recipe) => {
                      const recipeBrewingHistory = brewingHistory.filter(h => h.recipeId === recipe._id);
                      return (
                        <div key={recipe._id} className="col-md-6 col-xl-4">
                          <RecipeCard 
                            recipe={recipe}
                            onSelect={handleRecipeSelect}
                            onImport={handleRecipeImport}
                            hasBeenBrewed={hasBeenBrewed(recipe._id)}
                            hasPlannedBatch={plannedIds.has(recipe._id)}
                            brewingHistory={recipeBrewingHistory}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <i className="fas fa-filter text-muted" style={{ fontSize: '4rem' }}></i>
                    <h4 className="text-muted mt-3">No recipes match your filters</h4>
                    <p className="text-muted">
                      Try adjusting your filters or clearing them to see all recipes
                    </p>
                    <button className="btn btn-outline-primary" onClick={clearFilters}>
                      <i className="fas fa-eraser me-2"></i>
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && allRecipes.length === 0 && (
            <div className="row justify-content-center">
              <div className="col-lg-8">
                <div className="text-center py-5">
                  <i className="fas fa-beer-mug-empty text-muted" style={{ fontSize: '5rem', opacity: 0.3 }}></i>
                  <h3 className="text-muted mt-4">No recipes found in your Brewfather account</h3>
                  <p className="text-muted">
                    Use the Brewfather mobile app to browse and save recipes from the Recipe Library,
                    <br />
                    then refresh this page to see them here.
                  </p>
                  <button className="btn btn-outline-primary" onClick={() => window.location.reload()}>
                    <i className="fas fa-refresh me-2"></i>
                    Refresh Page
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          isOpen={!!selectedRecipe}
          onClose={() => {
            setSelectedRecipe(null);
            setSelectedRecipeIndex(0);
          }}
          brewingHistory={brewingHistory.filter(h => h.recipeId === selectedRecipe._id)}
          recipes={filteredRecipes}
          currentIndex={selectedRecipeIndex}
          onNavigate={handleModalNavigation}
          onDeleted={(id) => {
            setAllRecipes((recipes) => recipes.filter((r) => r._id !== id));
            setSelectedRecipe(null);
            setSelectedRecipeIndex(0);
          }}
        />
      )}
    </div>
  );
}
