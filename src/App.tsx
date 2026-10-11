import React, { useEffect } from 'react';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MenuProvider } from './context/MenuContext';
import { ToastProvider } from './components/common/Toast';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { reportClientError } from './services/errorReporting';

import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminProductAddPage } from './pages/admin/AdminProductAddPage';
import { AdminProductEditPage } from './pages/admin/AdminProductEditPage';

import { CustomerMenuPage } from './pages/customer/CustomerMenuPage';
import { CustomerHomePage } from './pages/customer/CustomerHomePage';
import { CustomerCategoryPage } from './pages/customer/CustomerCategoryPage';
import { CustomerProductDetailsPage } from './pages/customer/CustomerProductDetailsPage';

const AppRouter: React.FC = () => {
  const { path } = useNavigation();
  const { isAuthenticated, isLoading } = useAuth();

  if (path.startsWith('/admin') && path !== '/admin/login') {
    if (isLoading) return <div className="min-h-screen bg-cream" />;
    if (!isAuthenticated) return <AdminLoginPage />;
  }

  const renderRoute = () => {
    if (path === '/admin/login') {
      return <AdminLoginPage />;
    }
    if (path === '/admin' || path === '/admin/dashboard') {
      return <AdminDashboardPage />;
    }
    if (path === '/admin/categories') {
      return <AdminCategoriesPage />;
    }
    if (path === '/admin/products') {
      return <AdminProductsPage />;
    }
    if (path === '/admin/products/add') {
      return <AdminProductAddPage />;
    }
    if (path.startsWith('/admin/products/edit/')) {
      return <AdminProductEditPage />;
    }

    if (path.startsWith('/menu/category/')) {
      return <CustomerCategoryPage />;
    }
    if (path === '/home') {
      return <CustomerHomePage />;
    }
    if (path.startsWith('/menu/product/')) {
      return <CustomerProductDetailsPage />;
    }
    if (path === '/menu' || path === '/' || path === '') {
      return <CustomerMenuPage />;
    }

    return <CustomerMenuPage />;
  };

  return (
    <div className="relative min-h-screen">
      {import.meta.env.DEV && path.startsWith('/admin') && <DevModeSwitchBar />}
      {renderRoute()}
    </div>
  );
};

const DevModeSwitchBar: React.FC = () => {
  const { path, navigate } = useNavigation();
  const { isAuthenticated } = useAuth();

  const isCustomerView = !path.startsWith('/admin');

  return (
    <div className="bg-ink text-gold-light/80 text-[11px] px-3 py-1.5 flex items-center justify-between border-b border-gold/20 z-40 relative select-none">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
        <span className="font-mono text-[10px] text-ivory/50">
          {path}
        </span>
      </div>

      <div className="flex items-center gap-1.5 font-medium">
        <button
          onClick={() => navigate('/menu')}
          className={`px-2.5 py-0.5 rounded-full transition ${
            isCustomerView
              ? 'bg-gold text-ink font-semibold'
              : 'text-gold-light/70 hover:text-ivory hover:bg-white/10'
          }`}
        >
          Menu
        </button>
        <button
          onClick={() => navigate(isAuthenticated ? '/admin/dashboard' : '/admin/login')}
          className={`px-2.5 py-0.5 rounded-full transition ${
            !isCustomerView
              ? 'bg-gold text-ink font-semibold'
              : 'text-gold-light/70 hover:text-ivory hover:bg-white/10'
          }`}
        >
          Owner
        </button>
      </div>
    </div>
  );
};

export default function App() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error) reportClientError('window_error', event.error);
    };
    const handleRejection = (event: PromiseRejectionEvent) => reportClientError('unhandled_rejection', event.reason);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <NavigationProvider>
      <AuthProvider>
        <MenuProvider>
          <ToastProvider>
            <AppErrorBoundary>
              <AppRouter />
            </AppErrorBoundary>
          </ToastProvider>
        </MenuProvider>
      </AuthProvider>
    </NavigationProvider>
  );
}
