import React from 'react';
import { LoadingSpinnerProps } from '@/types';

export default function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'loading-spinner-sm',
    md: 'loading-spinner-md', 
    lg: 'loading-spinner-lg'
  };

  const sizeStyles = {
    sm: { width: '1rem', height: '1rem', borderWidth: '0.125rem' },
    md: { width: '2rem', height: '2rem', borderWidth: '0.25rem' },
    lg: { width: '3rem', height: '3rem', borderWidth: '0.375rem' }
  };

  return (
    <div className={`d-flex justify-content-center align-items-center ${className}`}>
      <div 
        className={`loading-spinner ${sizeClasses[size]}`}
        style={sizeStyles[size]}
        role="status"
        aria-label="Loading..."
      >
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}

// Alternative brewing-themed loading component
export function BrewingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`d-flex flex-column justify-content-center align-items-center ${className}`}>
      <i 
        className={`fas fa-beer-mug-empty text-primary ${size === 'lg' ? 'fs-1' : size === 'sm' ? 'fs-5' : 'fs-3'}`}
        style={{ 
          animation: 'brewBubble 1.5s ease-in-out infinite',
        }}
      ></i>
      <div className="mt-2 text-muted small">
        Brewing something good...
      </div>
      <style jsx>{`
        @keyframes brewBubble {
          0%, 100% { transform: translateY(0px); opacity: 0.7; }
          50% { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}