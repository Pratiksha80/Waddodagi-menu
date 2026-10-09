import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface NavigationContextType {
  path: string;
  navigate: (to: string) => void;
  goBack: () => void;
  getParam: (key: string) => string | undefined;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// Normalize path from window.location (supports both standard path and hash path)
function getInitialPath(): string {
  if (typeof window === 'undefined') return '/menu';

  // Support hash routing fallback for iframe/static hosts
  if (window.location.hash) {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('/')) {
      return hash;
    }
  }

  const p = window.location.pathname;
  if (!p || p === '/') {
    return '/menu';
  }
  return p;
}

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [path, setPath] = useState<string>(getInitialPath);

  useEffect(() => {
    const handlePopState = () => {
      setPath(getInitialPath());
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigate = useCallback((to: string) => {
    if (!to) return;
    try {
      window.history.pushState({}, '', to);
    } catch {
      // In strict sandboxes fallback to hash
      window.location.hash = to;
    }
    setPath(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/menu');
    }
  }, [navigate]);

  const getParam = useCallback((key: string): string | undefined => {
    // Check path params like /menu/category/:id or /admin/products/edit/:id
    const parts = path.split('/').filter(Boolean);

    if (parts[0] === 'menu' && parts[1] === 'category' && key === 'id') {
      return parts[2];
    }
    if (parts[0] === 'menu' && parts[1] === 'product' && key === 'id') {
      return parts[2];
    }
    if (parts[0] === 'admin' && parts[1] === 'products' && parts[2] === 'edit' && key === 'id') {
      return parts[3];
    }

    return undefined;
  }, [path]);

  return (
    <NavigationContext.Provider value={{ path, navigate, goBack, getParam }}>
      {children}
    </NavigationContext.Provider>
  );
};

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
