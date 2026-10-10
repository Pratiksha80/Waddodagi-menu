import { Category, Product, DatabaseState, ProductStatus } from '../types/database';

const API_URL = '/api/menu';

async function readApiResponse(response: Response): Promise<any> {
  const body = await response.text();
  let result: any;
  try {
    result = body ? JSON.parse(body) : {};
  } catch {
    throw new Error(response.ok
      ? 'The server returned an unexpected response. Restart the app server and try again.'
      : `The server could not process this request (HTTP ${response.status}). Check the server logs.`);
  }
  if (!response.ok) throw new Error(result.error || `Request failed (HTTP ${response.status}).`);
  return result;
}

// Initial state must be 100% EMPTY as required by the business specification:
// "The shop owner will add all categories and products themselves through the Admin Panel.
// Therefore, the initial database/menu must be EMPTY.
// Categories: 0, Products: 0"
async function loadState(): Promise<DatabaseState> {
  const response = await fetch(API_URL, { cache: 'no-store', credentials: 'same-origin' });
  const data = await readApiResponse(response);
  return { categories: data.categories, products: data.products };
}

async function mutate<T>(path: string, method: string, data?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    ...(data === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  });
  return readApiResponse(response) as Promise<T>;
}

async function uploadImage(file: File, purpose: 'products' | 'categories'): Promise<string> {
  const response = await fetch('/api/images', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type, 'x-image-purpose': purpose }, body: file,
  });
  const result = await readApiResponse(response);
  if (typeof result.image_url !== 'string') throw new Error('The server did not return an image URL.');
  return result.image_url;
}

export const uploadProductImage = (file: File) => uploadImage(file, 'products');
export const uploadCategoryImage = (file: File) => uploadImage(file, 'categories');

export async function deleteUnattachedProductImage(imageUrl: string): Promise<void> {
  try { await mutate<void>('/api/images', 'DELETE', { image_url: imageUrl }); }
  catch { /* Keep product save errors primary; an unreferenced object can be cleaned up later. */ }
}

/**
 * Database API Service Layer
 * Structured as an async repository so it mirrors Supabase client query patterns.
 */
export const dbService = {
  async getMenuState(): Promise<DatabaseState> {
    return loadState();
  },

  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    const state = await loadState();
    return [...state.categories].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getCategoryById(id: string): Promise<Category | null> {
    const state = await loadState();
    return state.categories.find(c => c.id === id) || null;
  },

  async createCategory(data: { name: string; description?: string; image_url?: string }): Promise<Category> {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error('Category name is required');
    }

    const result = await mutate<{ category: Category }>('/api/categories', 'POST', {
      name: trimmedName,
      description: data.description ? data.description.trim() : '',
      image_url: data.image_url || '',
    });
    return result.category;
  },

  async updateCategory(id: string, data: { name: string; description?: string; image_url?: string }): Promise<Category> {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error('Category name is required');
    }

    const result = await mutate<{ category: Category }>(`/api/categories/${encodeURIComponent(id)}`, 'PUT', {
      name: trimmedName,
      description: data.description ? data.description.trim() : '',
      image_url: data.image_url || '',
    });
    return result.category;
  },

  async deleteCategory(id: string): Promise<{ success: boolean; deletedCount: number }> {
    await mutate<{ success: boolean }>(`/api/categories/${encodeURIComponent(id)}`, 'DELETE');
    return { success: true, deletedCount: 1 };
  },

  // --- PRODUCTS ---
  async getProducts(filter?: { category_id?: string; status?: ProductStatus; search?: string }): Promise<Product[]> {
    const state = await loadState();
    let result = [...state.products];

    if (filter?.category_id) {
      result = result.filter(p => p.category_id === filter.category_id);
    }

    if (filter?.status) {
      result = result.filter(p => p.status === filter.status);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getProductById(id: string): Promise<Product | null> {
    const state = await loadState();
    return state.products.find(p => p.id === id) || null;
  },

  async createProduct(data: {
    name: string;
    category_id: string;
    price: number;
    description?: string;
    image_url?: string;
    status?: ProductStatus;
  }): Promise<Product> {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error('Product name is required');
    }
    if (!data.category_id) {
      throw new Error('Please select a valid category');
    }
    if (typeof data.price !== 'number' || isNaN(data.price) || data.price < 0) {
      throw new Error('Product price must be a positive number');
    }

    const result = await mutate<{ product: Product }>('/api/products', 'POST', {
      name: trimmedName,
      category_id: data.category_id,
      price: data.price,
      description: data.description || '',
      image_url: data.image_url || '',
      status: data.status || 'available',
    });
    return result.product;
  },

  async updateProduct(id: string, data: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Promise<Product> {
    if (data.name !== undefined && !data.name.trim()) {
      throw new Error('Product name cannot be empty');
    }

    if (data.price !== undefined && (isNaN(data.price) || data.price < 0)) {
      throw new Error('Product price must be a positive number');
    }

    const result = await mutate<{ product: Product }>(`/api/products/${encodeURIComponent(id)}`, 'PUT', data);
    return result.product;
  },

  async setProductAvailability(id: string, status: ProductStatus): Promise<Product> {
    const result = await mutate<{ product: Product }>(`/api/products/${encodeURIComponent(id)}/availability`, 'PATCH', { status });
    return result.product;
  },

  async deleteProduct(id: string): Promise<{ success: boolean }> {
    await mutate<{ success: boolean }>(`/api/products/${encodeURIComponent(id)}`, 'DELETE');
    return { success: true };
  },

  async getDashboardCounts(): Promise<{
    totalProducts: number;
    totalCategories: number;
    availableProducts: number;
    outOfStockProducts: number;
  }> {
    const state = await loadState();
    const totalProducts = state.products.length;
    const totalCategories = state.categories.length;
    const availableProducts = state.products.filter(p => p.status === 'available').length;
    const outOfStockProducts = state.products.filter(p => p.status === 'out_of_stock').length;

    return {
      totalProducts,
      totalCategories,
      availableProducts,
      outOfStockProducts,
    };
  },

  /**
   * Utility to reset/clear database back to 0 categories and 0 products
   */
  async clearAllData(): Promise<void> {
    await mutate<{ success: boolean }>('/api/menu/reset', 'POST', {});
  },
};
