import React, { useEffect } from 'react';
import { BrewfatherRecipe } from '@/types';
import DeleteRecipeButton from './DeleteRecipeButton';
import { isSampleRecipeId } from '@/lib/brewfather/recipeInput';

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

interface RecipeDetailModalProps {
  recipe: BrewfatherRecipe;
  isOpen: boolean;
  onClose: () => void;
  brewingHistory?: BrewingHistoryData[];
  // Navigation props
  recipes?: BrewfatherRecipe[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  onDeleted?: (id: string) => void;
}

const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({ 
  recipe, 
  isOpen, 
  onClose, 
  brewingHistory = [],
  recipes = [],
  currentIndex = 0,
  onNavigate,
  onDeleted
}) => {
  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow keys move the cursor inside a text field, not between recipes
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && e.key !== 'Escape') return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0 && onNavigate) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < recipes.length - 1 && onNavigate) {
        onNavigate(currentIndex + 1);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, recipes.length, onClose, onNavigate]);
  
  // Block body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const canNavigatePrevious = currentIndex > 0 && onNavigate && recipes.length > 1;
  const canNavigateNext = currentIndex < recipes.length - 1 && onNavigate && recipes.length > 1;
  const hasBrewingHistory = brewingHistory.length > 0;

  const formatDate = (timestamp: { _seconds: number } | null | undefined) => {
    if (!timestamp) return 'Not specified';
    const date = new Date(timestamp._seconds * 1000);
    return date.toLocaleDateString();
  };

  const formatGravity = (gravity?: number) => {
    if (!gravity) return 'N/A';
    return gravity.toFixed(3);
  };

  const formatPercentage = (value?: number) => {
    if (!value) return 'N/A';
    return `${value.toFixed(1)}%`;
  };

  return (
    <>
      {/* Modal Backdrop - blocks all background interaction */}
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1040, backgroundColor: 'rgba(0,0,0,0.8)' }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="modal fade show d-block" 
        style={{ zIndex: 1050 }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-modal-title"
      >
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            {/* Modal Header */}
            <div className="modal-header bg-primary text-white">
              <div className="d-flex align-items-center w-100">
                {/* Previous Button */}
                <button 
                  type="button" 
                  className="btn btn-outline-light me-3"
                  onClick={() => onNavigate && onNavigate(currentIndex - 1)}
                  disabled={!canNavigatePrevious}
                  title="Previous recipe (←)"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                
                {/* Title */}
                <h4 id="recipe-modal-title" className="modal-title flex-grow-1 mb-0">
                  <i className="fas fa-flask me-2"></i>
                  {recipe.name}
                  {recipes.length > 1 && (
                    <small className="ms-2 opacity-75">
                      ({currentIndex + 1} of {recipes.length})
                    </small>
                  )}
                </h4>
                
                {/* Next Button */}
                <button 
                  type="button" 
                  className="btn btn-outline-light me-3"
                  onClick={() => onNavigate && onNavigate(currentIndex + 1)}
                  disabled={!canNavigateNext}
                  title="Next recipe (→)"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
                
                {/* Close Button */}
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={onClose}
                  aria-label="Close"
                />
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="modal-body">
              <div className="row g-4">
                {/* Recipe Overview */}
                <div className="col-md-6">
                  <div className="card h-100">
                    <div className="card-header bg-light">
                      <h5 className="card-title mb-0">
                        <i className="fas fa-info-circle me-2"></i>
                        Recipe Overview
                      </h5>
                    </div>
                    <div className="card-body">
                      <div className="row g-2">
                        <div className="col-6">
                          <strong>Style:</strong>
                        </div>
                        <div className="col-6">
                          {recipe.style?.name || 'Not specified'}
                        </div>
                        
                        <div className="col-6">
                          <strong>Type:</strong>
                        </div>
                        <div className="col-6">
                          {recipe.type || 'Not specified'}
                        </div>
                        
                        <div className="col-6">
                          <strong>Author:</strong>
                        </div>
                        <div className="col-6">
                          {recipe.author || 'Not specified'}
                        </div>
                        
                        <div className="col-6">
                          <strong>Created:</strong>
                        </div>
                        <div className="col-6">
                          {formatDate(recipe._created)}
                        </div>
                        
                        <div className="col-6">
                          <strong>Batch Size:</strong>
                        </div>
                        <div className="col-6">
                          {recipe.batchSize ? `${recipe.batchSize}L` : 'Not specified'}
                        </div>
                        
                        <div className="col-6">
                          <strong>Boil Time:</strong>
                        </div>
                        <div className="col-6">
                          {recipe.boilTime ? `${recipe.boilTime} min` : 'Not specified'}
                        </div>
                        
                        <div className="col-6">
                          <strong>Efficiency:</strong>
                        </div>
                        <div className="col-6">
                          {recipe.efficiency ? `${recipe.efficiency}%` : 'Not specified'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Recipe Stats */}
                <div className="col-md-6">
                  <div className="card h-100">
                    <div className="card-header bg-light">
                      <h5 className="card-title mb-0">
                        <i className="fas fa-chart-bar me-2"></i>
                        Recipe Statistics
                      </h5>
                    </div>
                    <div className="card-body">
                      <div className="row g-2">
                        <div className="col-6">
                          <strong>Original Gravity:</strong>
                        </div>
                        <div className="col-6">
                          {formatGravity(recipe.og)}
                        </div>
                        
                        <div className="col-6">
                          <strong>Final Gravity:</strong>
                        </div>
                        <div className="col-6">
                          {formatGravity(recipe.fg)}
                        </div>
                        
                        <div className="col-6">
                          <strong>ABV:</strong>
                        </div>
                        <div className="col-6">
                          <span className="badge bg-success fs-6">
                            {recipe.abv ? `${recipe.abv.toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                        
                        <div className="col-6">
                          <strong>IBU:</strong>
                        </div>
                        <div className="col-6">
                          <span className="badge bg-warning text-dark fs-6">
                            {recipe.ibu ? recipe.ibu.toFixed(0) : 'N/A'}
                          </span>
                        </div>
                        
                        <div className="col-6">
                          <strong>Color (EBC):</strong>
                        </div>
                        <div className="col-6">
                          {recipe.color ? recipe.color.toFixed(1) : 'N/A'}
                        </div>
                        
                        <div className="col-6">
                          <strong>Attenuation:</strong>
                        </div>
                        <div className="col-6">
                          {recipe.attenuation ? `${(recipe.attenuation * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Notes */}
                {recipe.notes && (
                  <div className="col-12">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h5 className="card-title mb-0">
                          <i className="fas fa-sticky-note me-2"></i>
                          Notes
                        </h5>
                      </div>
                      <div className="card-body">
                        <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                          {recipe.notes}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Brewing History */}
                {hasBrewingHistory && (
                  <div className="col-12">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h5 className="card-title mb-0">
                          <i className="fas fa-history me-2"></i>
                          Brewing History ({brewingHistory.length})
                        </h5>
                      </div>
                      <div className="card-body">
                        <div className="row g-3">
                          {brewingHistory.map((history, index) => {
                            const brewDate = new Date(history.dateBrewed).toLocaleDateString();
                            return (
                              <div key={history.batchId || index} className="col-md-6">
                                <div className="border rounded p-3 bg-light">
                                  <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                      <h6 className="mb-1">
                                        <span className="badge bg-primary me-2">
                                          {history.batchNo ? `Batch #${history.batchNo}` : `Batch ${index + 1}`}
                                        </span>
                                        {history.status && (
                                          <span className={`badge ${
                                            history.status === 'Completed' ? 'bg-success' :
                                            history.status === 'Conditioning' ? 'bg-warning text-dark' :
                                            history.status === 'Fermenting' ? 'bg-info' : 'bg-secondary'
                                          }`}>
                                            {history.status}
                                          </span>
                                        )}
                                      </h6>
                                      <p className="text-muted small mb-2">
                                        <i className="fas fa-calendar me-1"></i>
                                        Brewed on {brewDate}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Measured Stats */}
                                  {(history.measuredOg || history.measuredFg || history.measuredAbv) && (
                                    <div className="row g-2 mb-2">
                                      <div className="col-12">
                                        <small className="text-muted fw-bold">Measured Stats:</small>
                                      </div>
                                      {history.measuredOg && (
                                        <div className="col-4">
                                          <small className="d-block text-muted">OG</small>
                                          <strong>{history.measuredOg.toFixed(3)}</strong>
                                        </div>
                                      )}
                                      {history.measuredFg && (
                                        <div className="col-4">
                                          <small className="d-block text-muted">FG</small>
                                          <strong>{history.measuredFg.toFixed(3)}</strong>
                                        </div>
                                      )}
                                      {history.measuredAbv && (
                                        <div className="col-4">
                                          <small className="d-block text-muted">ABV</small>
                                          <strong className="text-success">{history.measuredAbv.toFixed(1)}%</strong>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Batch Notes */}
                                  {history.notes && (
                                    <div className="mt-2">
                                      <small className="text-muted fw-bold">Batch Notes:</small>
                                      <p className="small mb-0 mt-1" style={{ whiteSpace: 'pre-wrap' }}>
                                        {history.notes}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Fermentables */}
                {recipe.fermentables && recipe.fermentables.length > 0 && (
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h5 className="card-title mb-0">
                          <i className="fas fa-wheat-awn me-2"></i>
                          Fermentables ({recipe.fermentables.length})
                        </h5>
                      </div>
                      <div className="card-body">
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Amount</th>
                                <th>%</th>
                                <th>Color</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recipe.fermentables.map((fermentable, index) => (
                                <tr key={index}>
                                  <td>
                                    <strong>{fermentable.name}</strong>
                                    <br />
                                    <small className="text-muted">{fermentable.type}</small>
                                  </td>
                                  <td>
                                    {fermentable.amount ? `${fermentable.amount}kg` : 'N/A'}
                                  </td>
                                  <td>
                                    {formatPercentage(fermentable.percentage)}
                                  </td>
                                  <td>
                                    {fermentable.color ? `${fermentable.color} EBC` : 'N/A'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Hops */}
                {recipe.hops && recipe.hops.length > 0 && (
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h5 className="card-title mb-0">
                          <i className="fas fa-leaf me-2"></i>
                          Hops ({recipe.hops.length})
                        </h5>
                      </div>
                      <div className="card-body">
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Amount</th>
                                <th>Time</th>
                                <th>Usage</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recipe.hops.map((hop, index) => (
                                <tr key={index}>
                                  <td>
                                    <strong>{hop.name}</strong>
                                    <br />
                                    <small className="text-muted">
                                      α: {hop.alpha ? `${hop.alpha}%` : 'N/A'}
                                    </small>
                                  </td>
                                  <td>
                                    {hop.amount ? `${hop.amount}g` : 'N/A'}
                                  </td>
                                  <td>
                                    {hop.time !== undefined ? `${hop.time} min` : 'N/A'}
                                  </td>
                                  <td>
                                    <span className="badge bg-secondary">
                                      {hop.use}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Yeasts */}
                {recipe.yeasts && recipe.yeasts.length > 0 && (
                  <div className="col-12">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h5 className="card-title mb-0">
                          <i className="fas fa-microscope me-2"></i>
                          Yeasts ({recipe.yeasts.length})
                        </h5>
                      </div>
                      <div className="card-body">
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Laboratory</th>
                                <th>Type</th>
                                <th>Form</th>
                                <th>Amount</th>
                                <th>Attenuation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recipe.yeasts.map((yeast, index) => (
                                <tr key={index}>
                                  <td>
                                    <strong>{yeast.name}</strong>
                                    {yeast.productId && (
                                      <>
                                        <br />
                                        <small className="text-muted">ID: {yeast.productId}</small>
                                      </>
                                    )}
                                  </td>
                                  <td>{yeast.laboratory || 'N/A'}</td>
                                  <td>
                                    <span className="badge bg-info">
                                      {yeast.type}
                                    </span>
                                  </td>
                                  <td>{yeast.form || 'N/A'}</td>
                                  <td>
                                    {yeast.amount ? `${yeast.amount} ${yeast.unit || ''}` : 'N/A'}
                                  </td>
                                  <td>
                                    {yeast.attenuation ? `${yeast.attenuation}%` : 'N/A'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="modal-footer">
              {!isSampleRecipeId(recipe._id) && (
                <>
                  {onDeleted && (
                    <span className="me-auto">
                      <DeleteRecipeButton key={recipe._id} recipe={recipe} onDeleted={onDeleted} />
                    </span>
                  )}
                  <a
                    href={`/recipes/${encodeURIComponent(recipe._id)}/edit`}
                    className="btn btn-outline-primary"
                  >
                    <i className="fas fa-pen me-2"></i>
                    Edit
                  </a>
                </>
              )}
              <a
                href={`/recipes/${recipe._id}/brewsheet`}
                className="btn btn-primary"
              >
                <i className="fas fa-clipboard-list me-2"></i>
                Brew Sheet
              </a>
              <button
                type="button" 
                className="btn btn-outline-primary"
                onClick={() => window.print()}
              >
                <i className="fas fa-print me-2"></i>
                Print Recipe
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RecipeDetailModal;