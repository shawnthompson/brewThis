'use client';

import React from 'react';
import { RecipeCardProps } from '@/types';

interface BrewingHistoryData {
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

interface ExtendedRecipeCardProps extends RecipeCardProps {
  hasBeenBrewed?: boolean;
  brewingHistory?: BrewingHistoryData[];
}

export default function RecipeCard({ 
  recipe, 
  onSelect, 
  onImport,
  hasBeenBrewed = false,
  brewingHistory = [],
  className = '' 
}: ExtendedRecipeCardProps) {
  
  const formatAbv = (abv?: number) => abv ? `${abv.toFixed(1)}%` : 'N/A';
  const formatIbu = (ibu?: number) => ibu ? Math.round(ibu) : 'N/A';
  const formatGravity = (gravity?: number) => gravity ? gravity.toFixed(3) : 'N/A';
  const formatBatchSize = (size?: number) => size ? `${size.toFixed(1)}L` : 'N/A';
  
  const getStyleColor = (style?: { name: string }) => {
    if (!style?.name) return 'secondary';
    const styleName = style.name.toLowerCase();
    if (styleName.includes('ipa') || styleName.includes('pale ale')) return 'warning';
    if (styleName.includes('stout') || styleName.includes('porter')) return 'dark';
    if (styleName.includes('wheat') || styleName.includes('wit')) return 'light';
    if (styleName.includes('lager')) return 'info';
    if (styleName.includes('amber') || styleName.includes('red')) return 'danger';
    return 'primary';
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(recipe);
    }
  };

  const handleImportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onImport) {
      onImport(recipe);
    }
  };

  return (
    <div 
      className={`card recipe-card brew-card h-100 ${className}`}
      style={{ cursor: onSelect ? 'pointer' : 'default' }}
      onClick={handleCardClick}
    >
      {/* Recipe Image/Icon */}
      <div className="recipe-image">
        <i className="fas fa-beer"></i>
      </div>
      
      {/* Card Body */}
      <div className="card-body d-flex flex-column">
        {/* Recipe Name */}
        <h5 className="card-title text-truncate" title={recipe.name}>
          {recipe.name}
        </h5>
        
        {/* Style Badge */}
        {recipe.style?.name && (
          <span className={`badge bg-${getStyleColor(recipe.style)} mb-2 align-self-start`}>
            {recipe.style.name}
          </span>
        )}
        
        {/* Description */}
        {recipe.description && (
          <p className="card-text text-muted small mb-3" style={{ 
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            {recipe.description}
          </p>
        )}
        
        {/* Recipe Stats */}
        <div className="recipe-stats mb-3">
          <div className="stat">
            <div className="stat-value">{formatAbv(recipe.abv)}</div>
            <div className="stat-label">ABV</div>
          </div>
          <div className="stat">
            <div className="stat-value">{formatIbu(recipe.ibu)}</div>
            <div className="stat-label">IBU</div>
          </div>
          <div className="stat">
            <div className="stat-value">{formatGravity(recipe.og)}</div>
            <div className="stat-label">OG</div>
          </div>
          <div className="stat">
            <div className="stat-value">{formatBatchSize(recipe.batchSize)}</div>
            <div className="stat-label">Batch</div>
          </div>
        </div>
        
        {/* Additional Info */}
        <div className="d-flex justify-content-between align-items-center text-muted small mb-3">
          {recipe.author && (
            <span>
              <i className="fas fa-user me-1"></i>
              {recipe.author}
            </span>
          )}
          {recipe.efficiency && (
            <span>
              <i className="fas fa-percentage me-1"></i>
              {recipe.efficiency}% eff
            </span>
          )}
        </div>
        
        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="mb-3">
            {recipe.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="badge bg-light text-dark me-1 mb-1" style={{ fontSize: '0.7rem' }}>
                {tag}
              </span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="text-muted small">+{recipe.tags.length - 3} more</span>
            )}
          </div>
        )}
        
        {/* Actions */}
        <div className="mt-auto">
          {/* Brewing Status */}
          {hasBeenBrewed && brewingHistory.length > 0 && (
            <div className="mb-2">
              {brewingHistory.map((history, index) => {
                const brewDate = new Date(history.dateBrewed).toLocaleDateString();
                return (
                  <div key={history.batchId || index} className="mb-1">
                    <span className="badge bg-success me-1">
                      <i className="fas fa-check me-1"></i>
                      {history.batchNo ? `Batch #${history.batchNo}` : 'Brewed'}
                    </span>
                    <small className="text-muted">{brewDate}</small>
                    {history.measuredAbv && (
                      <small className="text-muted ms-1">({history.measuredAbv.toFixed(1)}% ABV)</small>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {hasBeenBrewed && brewingHistory.length === 0 && (
            <div className="mb-2">
              <span className="badge bg-success">
                <i className="fas fa-check me-1"></i>
                Brewed
              </span>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="d-flex gap-2 mb-2">
            {onSelect && (
              <button 
                className="btn btn-outline-primary btn-sm flex-fill"
                onClick={handleCardClick}
              >
                <i className="fas fa-eye me-1"></i>
                View Details
              </button>
            )}
            {onImport && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={handleImportClick}
                title="Import to My Recipes"
              >
                <i className="fas fa-download"></i>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}