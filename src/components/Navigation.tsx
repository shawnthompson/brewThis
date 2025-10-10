'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavigationProps } from '@/types';

export default function Navigation({ className = '' }: NavigationProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Search Recipes', icon: 'fa-search' },
    { href: '/recipes', label: 'My Recipes', icon: 'fa-beer', disabled: true },
    { href: '/inventory', label: 'Inventory', icon: 'fa-warehouse', disabled: true },
    { href: '/brewing', label: 'Brewing Sessions', icon: 'fa-flask', disabled: true },
    { href: '/guides', label: 'Brew Guides', icon: 'fa-list-check', disabled: true },
  ];

  return (
    <nav className={`navbar navbar-expand-lg brew-nav ${className}`}>
      <div className="container-fluid">
        {/* Brand */}
        <Link href="/" className="navbar-brand">
          <i className="fas fa-beer-mug-empty brand-icon"></i>
          BrewThis
        </Link>

        {/* Mobile toggle button */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Navigation items */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {navItems.map((item) => (
              <li key={item.href} className="nav-item">
                {item.disabled ? (
                  <span 
                    className="nav-link text-muted position-relative"
                    title="Coming soon"
                  >
                    <i className={`fas ${item.icon} me-2`}></i>
                    {item.label}
                    <span className="badge bg-secondary ms-2" style={{ fontSize: '0.6rem' }}>
                      Soon
                    </span>
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className={`nav-link ${pathname === item.href ? 'active' : ''}`}
                  >
                    <i className={`fas ${item.icon} me-2`}></i>
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          
          {/* User menu placeholder */}
          <div className="navbar-nav ms-3">
            <div className="nav-item dropdown">
              <a
                className="nav-link dropdown-toggle d-flex align-items-center"
                href="#"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                title="User menu (coming soon)"
              >
                <i className="fas fa-user-circle me-2"></i>
                <span className="d-none d-lg-inline">Menu</span>
              </a>
              <ul className="dropdown-menu dropdown-menu-end">
                <li>
                  <span className="dropdown-item text-muted">
                    <i className="fas fa-cog me-2"></i>
                    Settings
                    <span className="badge bg-secondary ms-2" style={{ fontSize: '0.6rem' }}>
                      Soon
                    </span>
                  </span>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <span className="dropdown-item text-muted">
                    <i className="fas fa-question-circle me-2"></i>
                    Help
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}