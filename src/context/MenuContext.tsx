import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Category, Product, ProductStatus } from '../types/database';
import { dbService } from '../services/database';

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
  refreshData: () => Promise<void>;
  addCategory: (data: { name: string; description?: string }) => Promise<Category>;
  updateCategory: (id: string, data: { name: string; description?: string }) => Promise<Category>;
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

  const refreshData = useCallback(async () => {
    try {
      const [cats, prods, cnts] = await Promise.all([
        dbService.getCategories(),
        dbService.getProducts(),
        dbService.getDashboardCounts(),
      ]);
      setCategories(cats);
      setProducts(prods);
      setCounts(cnts);
      setLoadError(null);
    } catch (err) {
      console.error('Failed to load menu data:', err);
      setLoadError(err instanceof Error ? err.message : 'Could not load the shared menu.');
    } finally {
      setLoading(false);
    }
  }, []);

  const requireOwnerSession = async () => {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Your owner session has expired. Please sign in again to publish changes.');
  };

  useEffect(() => {
    refreshData();

    const refreshTimer = window.setInterval(refreshData, 15000);
    const handleFocus = () => { void refreshData(); };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshData]);

  const addCategory = async (data: { name: string; description?: string }) => {
    await requireOwnerSession();
    const created = await dbService.createCategory(data);
    await refreshData();
    return created;
  };

  const updateCategory = async (id: string, data: { name: string; description?: string }) => {
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
    await dbService.updateProduct(id, { status: newStatus });
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
        refreshData,
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
