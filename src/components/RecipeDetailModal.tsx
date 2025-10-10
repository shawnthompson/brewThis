import React from 'react';
import { BrewfatherRecipe } from '@/types';

interface RecipeDetailModalProps {
  recipe: BrewfatherRecipe;
  isOpen: boolean;
  onClose: () => void;
}

const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({ recipe, isOpen, onClose }) => {
  if (!isOpen) return null;

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
      {/* Modal Backdrop */}
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1040 }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="modal fade show d-block" 
        style={{ zIndex: 1050 }}
        tabIndex={-1}
      >
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            {/* Modal Header */}
            <div className="modal-header bg-primary text-white">
              <h4 className="modal-title">
                <i className="fas fa-flask me-2"></i>
                {recipe.name}
              </h4>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={onClose}
                aria-label="Close"
              />
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