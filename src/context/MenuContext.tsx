import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Category, Product, ProductStatus } from '../types/database';
import { dbService } from '../services/database';
import { useNavigation } from './NavigationContext';

const CUSTOMER_IDLE_TIMEOUT_MS = 20 * 60 * 1000;

interface DashboardCounts {
  totalProducts: number;
  totalCategories: number;
  availableProducts: number;
  outOfStockProducts: number;
}

interface MenuContextType {
  categories: Category[];
  products: Product[];
  counts: DashboardCounts;
  loading: boolean;
  loadError: string | null;
  customerMenuIdle: boolean;
  refreshData: () => Promise<void>;
  resumeCustomerMenu: () => void;
  addCategory: (data: { name: string; description?: string; image_url?: string }) => Promise<Category>;
  updateCategory: (id: string, data: { name: string; description?: string; image_url?: string }) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  addProduct: (data: {
    name: string;
    category_id: string;
    price: number;
    description?: string;
    image_url?: string;
    status?: ProductStatus;
  }) => Promise<Product>;
  updateProduct: (id: string, data: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductStatus: (id: string) => Promise<void>;
  resetDatabase: () => Promise<void>;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export const MenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { path } = useNavigation();
  const isCustomerRoute = !path.startsWith('/admin');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<DashboardCounts>({
    totalProducts: 0,
    totalCategories: 0,
    availableProducts: 0,
    outOfStockProducts: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customerMenuIdle, setCustomerMenuIdle] = useState(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const customerIdleRef = useRef(false);
  const lastCustomerActivity = useRef(Date.now());

  const refreshData = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const refresh = (async () => {
      try {
        const state = await dbService.getMenuState();
        setCategories(state.categories);
        setProducts(state.products);
        setCounts({
          totalProducts: state.products.length,
          totalCategories: state.categories.length,
          availableProducts: state.products.filter((product) => product.status === 'available').length,
          outOfStockProducts: state.products.filter((product) => product.status === 'out_of_stock').length,
        });
        setLoadError(null);
      } catch (err) {
        console.error('Failed to load menu data:', err);
        setLoadError(err instanceof Error ? err.message : 'Could not load the shared menu.');
      } finally {
        setLoading(false);
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = refresh;
    return refresh;
  }, []);

  const requireOwnerSession = async () => {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Your owner session has expired. Please sign in again to publish changes.');
  };

  const resumeCustomerMenu = useCallback(() => {
    lastCustomerActivity.current = Date.now();
    customerIdleRef.current = false;
    setCustomerMenuIdle(false);
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    let idleTimer: number | undefined;
    const scheduleIdleLock = () => {
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      const remaining = Math.max(0, CUSTOMER_IDLE_TIMEOUT_MS - (Date.now() - lastCustomerActivity.current));
      idleTimer = window.setTimeout(() => {
        customerIdleRef.current = true;
        setCustomerMenuIdle(true);
      }, remaining);
    };

    if (!isCustomerRoute) {
      customerIdleRef.current = false;
      setCustomerMenuIdle(false);
    } else {
      lastCustomerActivity.current = Date.now();
      scheduleIdleLock();
    }

    const handleActivity = () => {
      if (!isCustomerRoute || customerIdleRef.current) return;
      lastCustomerActivity.current = Date.now();
      scheduleIdleLock();
    };
    const handleVisible = () => {
      if (!isCustomerRoute || document.visibilityState !== 'visible') return;
      if (Date.now() - lastCustomerActivity.current >= CUSTOMER_IDLE_TIMEOUT_MS) {
        customerIdleRef.current = true;
        setCustomerMenuIdle(true);
        return;
      }
      handleActivity();
      void refreshData();
    };

    const activityEvents: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleVisible);

    const refreshTimer = window.setInterval(() => {
      if (isCustomerRoute && Date.now() - lastCustomerActivity.current >= CUSTOMER_IDLE_TIMEOUT_MS) {
        customerIdleRef.current = true;
        setCustomerMenuIdle(true);
        return;
      }
      if (!customerIdleRef.current && document.visibilityState === 'visible') void refreshData();
    }, 15000);

    return () => {
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      window.clearInterval(refreshTimer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleVisible);
    };
  }, [isCustomerRoute, refreshData]);

  const addCategory = async (data: { name: string; description?: string; image_url?: string }) => {
    await requireOwnerSession();
    const created = await dbService.createCategory(data);
    await refreshData();
    return created;
  };

  const updateCategory = async (id: string, data: { name: string; description?: string; image_url?: string }) => {
    await requireOwnerSession();
    const updated = await dbService.updateCategory(id, data);
    await refreshData();
    return updated;
  };

  const deleteCategory = async (id: string) => {
    await requireOwnerSession();
    await dbService.deleteCategory(id);
    await refreshData();
  };

  const addProduct = async (data: {
    name: string;
    category_id: string;
    price: number;
    description?: string;
    image_url?: string;
    status?: ProductStatus;
  }) => {
    await requireOwnerSession();
    const created = await dbService.createProduct(data);
    await refreshData();
    return created;
  };

  const updateProduct = async (id: string, data: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>) => {
    await requireOwnerSession();
    const updated = await dbService.updateProduct(id, data);
    await refreshData();
    return updated;
  };

  const deleteProduct = async (id: string) => {
    await requireOwnerSession();
    await dbService.deleteProduct(id);
    await refreshData();
  };

  const toggleProductStatus = async (id: string) => {
    const item = products.find(p => p.id === id);
    if (!item) return;
    const newStatus: ProductStatus = item.status === 'available' ? 'out_of_stock' : 'available';
    await requireOwnerSession();
    await dbService.setProductAvailability(id, newStatus);
    await refreshData();
  };

  const resetDatabase = async () => {
    await requireOwnerSession();
    await dbService.clearAllData();
    await refreshData();
  };

  return (
    <MenuContext.Provider
      value={{
        categories,
        products,
        counts,
        loading,
        loadError,
        customerMenuIdle,
        refreshData,
        resumeCustomerMenu,
        addCategory,
        updateCategory,
        deleteCategory,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductStatus,
        resetDatabase,
      }}
    >
      {children}
    </MenuContext.Provider>
  );
};

export function useMenu() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
}
