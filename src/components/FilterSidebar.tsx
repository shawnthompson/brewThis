import React, { useState } from 'react';

interface RecipeFilters {
  text: string;
  styles: string[];
  types: string[];
  hops: string[];
  abvRange: [number, number];
  ibuRange: [number, number];
  brewingStatus: 'all' | 'brewed' | 'not-brewed';
  sortBy: 'name' | 'abv' | 'ibu' | 'og' | '_created';
  sortOrder: 'asc' | 'desc';
}

interface FilterSidebarProps {
  filters: {
    text: string;
    styles: string[];
    types: string[];
    hops: string[];
    abvRange: [number, number];
    ibuRange: [number, number];
    brewingStatus: 'all' | 'brewed' | 'not-brewed';
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  availableStyles: string[];
  availableTypes: string[];
  availableHops: string[];
  onFilterChange: (key: keyof RecipeFilters, value: string | string[] | number[] | 'all' | 'brewed' | 'not-brewed' | 'name' | 'abv' | 'ibu' | 'og' | '_created' | 'asc' | 'desc') => void;
  onClearFilters: () => void;
  isOpen: boolean;
  onToggle: () => void;
  totalRecipes: number;
  filteredCount: number;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters,
  availableStyles,
  availableTypes,
  availableHops,
  onFilterChange,
  onClearFilters,
  isOpen,
  onToggle,
  totalRecipes,
  filteredCount
}) => {
  const [expandedSections, setExpandedSections] = useState({
    search: true,
    styles: false,
    types: false,
    hops: false,
    stats: false,
    status: true,
    sort: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleArrayFilter = (filterKey: keyof RecipeFilters, value: string, currentArray: string[]) => {
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    onFilterChange(filterKey, newArray);
  };

  const renderCheckboxList = (
    items: string[],
    selectedItems: string[],
    filterKey: keyof RecipeFilters,
    maxHeight = '200px'
  ) => (
    <div style={{ maxHeight, overflowY: 'auto' }} className="border rounded p-2">
      {items.map(item => (
        <div key={item} className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            id={`${filterKey}-${item}`}
            checked={selectedItems.includes(item)}
            onChange={() => toggleArrayFilter(filterKey, item, selectedItems)}
          />
          <label className="form-check-label" htmlFor={`${filterKey}-${item}`}>
            <small>{item}</small>
          </label>
        </div>
      ))}
      {items.length === 0 && (
        <small className="text-muted">No options available</small>
      )}
    </div>
  );

  return (
    <>
      {/* Sidebar */}
      <div className={`bg-light border-end position-fixed h-100 ${isOpen ? '' : 'd-none'}`} 
           style={{ 
             width: '320px', 
             top: '76px', // Account for navbar height
             left: 0, 
             zIndex: 1020,
             overflowY: 'auto'
           }}>
        <div className="p-3">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              <i className="fas fa-filter me-2"></i>
              Filters
            </h5>
            <button className="btn btn-sm btn-outline-secondary" onClick={onToggle}>
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* Results Count */}
          <div className="alert alert-info py-2 mb-3">
            <small>
              <strong>{filteredCount}</strong> of <strong>{totalRecipes}</strong> recipes
            </small>
          </div>

          {/* Search Text */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0 fw-semibold">
                <i className="fas fa-search me-1"></i>
                Search
              </label>
              <button
                className="btn btn-sm btn-link p-0"
                onClick={() => toggleSection('search')}
              >
                <i className={`fas fa-chevron-${expandedSections.search ? 'up' : 'down'}`}></i>
              </button>
            </div>
            {expandedSections.search && (
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search by name, style, ingredients..."
                value={filters.text}
                onChange={(e) => onFilterChange('text', e.target.value)}
              />
            )}
          </div>

          {/* Brewing Status */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0 fw-semibold">
                <i className="fas fa-check-circle me-1"></i>
                Status
              </label>
              <button
                className="btn btn-sm btn-link p-0"
                onClick={() => toggleSection('status')}
              >
                <i className={`fas fa-chevron-${expandedSections.status ? 'up' : 'down'}`}></i>
              </button>
            </div>
            {expandedSections.status && (
              <select
                className="form-select form-select-sm"
                value={filters.brewingStatus}
                onChange={(e) => onFilterChange('brewingStatus', e.target.value)}
              >
                <option value="all">All Recipes</option>
                <option value="brewed">Brewed Before</option>
                <option value="not-brewed">Not Brewed Yet</option>
              </select>
            )}
          </div>

          {/* Beer Styles */}
          {availableStyles.length > 0 && (
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label mb-0 fw-semibold">
                  <i className="fas fa-tags me-1"></i>
                  Styles ({filters.styles.length})
                </label>
                <button
                  className="btn btn-sm btn-link p-0"
                  onClick={() => toggleSection('styles')}
                >
                  <i className={`fas fa-chevron-${expandedSections.styles ? 'up' : 'down'}`}></i>
                </button>
              </div>
              {expandedSections.styles && renderCheckboxList(availableStyles, filters.styles, 'styles')}
            </div>
          )}

          {/* Recipe Types */}
          {availableTypes.length > 0 && (
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label mb-0 fw-semibold">
                  <i className="fas fa-cog me-1"></i>
                  Types ({filters.types.length})
                </label>
                <button
                  className="btn btn-sm btn-link p-0"
                  onClick={() => toggleSection('types')}
                >
                  <i className={`fas fa-chevron-${expandedSections.types ? 'up' : 'down'}`}></i>
                </button>
              </div>
              {expandedSections.types && renderCheckboxList(availableTypes, filters.types, 'types')}
            </div>
          )}

          {/* Hops */}
          {availableHops.length > 0 && (
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label mb-0 fw-semibold">
                  <i className="fas fa-leaf me-1"></i>
                  Hops ({filters.hops.length})
                </label>
                <button
                  className="btn btn-sm btn-link p-0"
                  onClick={() => toggleSection('hops')}
                >
                  <i className={`fas fa-chevron-${expandedSections.hops ? 'up' : 'down'}`}></i>
                </button>
              </div>
              {expandedSections.hops && renderCheckboxList(availableHops, filters.hops, 'hops', '250px')}
            </div>
          )}

          {/* Stats Ranges */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0 fw-semibold">
                <i className="fas fa-chart-bar me-1"></i>
                Stats
              </label>
              <button
                className="btn btn-sm btn-link p-0"
                onClick={() => toggleSection('stats')}
              >
                <i className={`fas fa-chevron-${expandedSections.stats ? 'up' : 'down'}`}></i>
              </button>
            </div>
            {expandedSections.stats && (
              <div>
                <div className="mb-2">
                  <label className="form-label mb-1">
                    <small>ABV Range: {filters.abvRange[0]}% - {filters.abvRange[1]}%</small>
                  </label>
                  <div className="d-flex gap-2">
                    <input
                      type="range"
                      className="form-range"
                      min="0"
                      max="15"
                      step="0.1"
                      value={filters.abvRange[0]}
                      onChange={(e) => onFilterChange('abvRange', [parseFloat(e.target.value), filters.abvRange[1]])}
                    />
                    <input
                      type="range"
                      className="form-range"
                      min="0"
                      max="15"
                      step="0.1"
                      value={filters.abvRange[1]}
                      onChange={(e) => onFilterChange('abvRange', [filters.abvRange[0], parseFloat(e.target.value)])}
                    />
                  </div>
                </div>
                <div className="mb-2">
                  <label className="form-label mb-1">
                    <small>IBU Range: {filters.ibuRange[0]} - {filters.ibuRange[1]}</small>
                  </label>
                  <div className="d-flex gap-2">
                    <input
                      type="range"
                      className="form-range"
                      min="0"
                      max="120"
                      value={filters.ibuRange[0]}
                      onChange={(e) => onFilterChange('ibuRange', [parseInt(e.target.value), filters.ibuRange[1]])}
                    />
                    <input
                      type="range"
                      className="form-range"
                      min="0"
                      max="120"
                      value={filters.ibuRange[1]}
                      onChange={(e) => onFilterChange('ibuRange', [filters.ibuRange[0], parseInt(e.target.value)])}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sort */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0 fw-semibold">
                <i className="fas fa-sort me-1"></i>
                Sort
              </label>
              <button
                className="btn btn-sm btn-link p-0"
                onClick={() => toggleSection('sort')}
              >
                <i className={`fas fa-chevron-${expandedSections.sort ? 'up' : 'down'}`}></i>
              </button>
            </div>
            {expandedSections.sort && (
              <div>
                <select
                  className="form-select form-select-sm mb-2"
                  value={filters.sortBy}
                  onChange={(e) => onFilterChange('sortBy', e.target.value)}
                >
                  <option value="name">Name</option>
                  <option value="abv">ABV</option>
                  <option value="ibu">IBU</option>
                  <option value="og">Original Gravity</option>
                  <option value="_created">Date Created</option>
                </select>
                <select
                  className="form-select form-select-sm"
                  value={filters.sortOrder}
                  onChange={(e) => onFilterChange('sortOrder', e.target.value)}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            )}
          </div>

          {/* Clear Filters */}
          <button
            className="btn btn-outline-danger btn-sm w-100"
            onClick={onClearFilters}
            disabled={
              filters.text === '' &&
              filters.styles.length === 0 &&
              filters.types.length === 0 &&
              filters.hops.length === 0 &&
              filters.brewingStatus === 'all'
            }
          >
            <i className="fas fa-eraser me-2"></i>
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="position-fixed w-100 h-100 d-md-none"
          style={{ top: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1019 }}
          onClick={onToggle}
        />
      )}
    </>
  );
};

export default FilterSidebar;