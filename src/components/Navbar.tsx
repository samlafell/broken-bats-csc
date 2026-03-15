import { Link, useLocation } from 'react-router-dom';
import { User, Settings } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Navbar() {
  const location = useLocation();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Schedule', path: '/#schedule' },
    { name: 'Roster', path: '/#roster' },
    { name: 'Media', path: '/#media' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-stone-950/80 backdrop-blur-md border-b border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-white font-bold text-xl group-hover:bg-amber-500 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <path d="M19 4l-1 1-5 5-8 8a2.12 2.12 0 0 0 3 3l8-8 5-5 1-1a2.12 2.12 0 0 0-3-3z"/>
                  <path d="M16 7l1 1"/>
                </svg>
              </div>
              <span className="font-bold text-xl tracking-tight uppercase">Broken Bats</span>
            </Link>
            
            <div className="hidden md:flex space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors uppercase tracking-wider",
                    location.pathname === link.path
                      ? "bg-stone-800 text-white"
                      : "text-stone-400 hover:bg-stone-800/50 hover:text-stone-200"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/clubhouse"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors uppercase tracking-wider"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Clubhouse</span>
            </Link>
            <Link
              to="/admin"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-stone-400 hover:bg-stone-800 hover:text-stone-200 transition-colors"
              title="Manager's Office"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
