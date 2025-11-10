'use client';

import { HamburgerMenu } from './HamburgerMenu';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  return (
    <nav className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <HamburgerMenu />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Airtable Dashboard
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

