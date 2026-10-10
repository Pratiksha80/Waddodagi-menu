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
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

async function loadState(): Promise<DatabaseState> {
  const response = await fetch(API_URL, { cache: 'no-store', credentials: 'same-origin' });
  const data = await readApiResponse(response);
  return { categories: data.categories, products: data.products };
}

async function saveState(state: DatabaseState): Promise<void> {
  const response = await fetch(API_URL, {
    method: 'PUT', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state),
  });
  await readApiResponse(response);
}

/**
 * Database API Service Layer
 * Structured as an async repository so it mirrors Supabase client query patterns.
 */
export const dbService = {
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

  async createCategory(data: { name: string; description?: string }): Promise<Category> {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error('Category name is required');
    }

    const state = await loadState();
    const existing = state.categories.find(
      c => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) {
      throw new Error(`Category "${trimmedName}" already exists`);
    }

    const now = new Date().toISOString();
    const newCategory: Category = {
      id: generateId(),
      name: trimmedName,
      description: data.description ? data.description.trim() : '',
      created_at: now,
      updated_at: now,
    };

    state.categories.push(newCategory);
    await saveState(state);
    return newCategory;
  },

  async updateCategory(id: string, data: { name: string; description?: string }): Promise<Category> {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error('Category name is required');
    }

    const state = await loadState();
    const index = state.categories.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error('Category not found');
    }

    const duplicate = state.categories.find(
      c => c.id !== id && c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Another category named "${trimmedName}" already exists`);
    }

    const updated: Category = {
      ...state.categories[index],
      name: trimmedName,
      description: data.description !== undefined ? data.description.trim() : state.categories[index].description,
      updated_at: new Date().toISOString(),
    };

    state.categories[index] = updated;
    await saveState(state);
    return updated;
  },

  async deleteCategory(id: string): Promise<{ success: boolean; deletedCount: number }> {
    const state = await loadState();
    const category = state.categories.find(c => c.id === id);
    if (!category) {
      throw new Error('Category not found');
    }

    // Check if products exist in this category (PostgreSQL foreign key RESTRICT simulation)
    const attachedProducts = state.products.filter(p => p.category_id === id);
    if (attachedProducts.length > 0) {
      throw new Error(
        `Cannot delete "${category.name}" because it still contains ${attachedProducts.length} product(s). Please move or delete the products first.`
      );
    }

    state.categories = state.categories.filter(c => c.id !== id);
    await saveState(state);
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

    const state = await loadState();
    const category = state.categories.find(c => c.id === data.category_id);
    if (!category) {
      throw new Error('Selected category does not exist');
    }

    const now = new Date().toISOString();
    const newProduct: Product = {
      id: generateId(),
      name: trimmedName,
      category_id: data.category_id,
      price: data.price,
      description: data.description ? data.description.trim() : '',
      image_url: data.image_url ? data.image_url.trim() : '',
      status: data.status || 'available',
      created_at: now,
      updated_at: now,
    };

    state.products.push(newProduct);
    await saveState(state);
    return newProduct;
  },

  async updateProduct(id: string, data: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Promise<Product> {
    const state = await loadState();
    const index = state.products.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Product not found');
    }

    if (data.name !== undefined && !data.name.trim()) {
      throw new Error('Product name cannot be empty');
    }

    if (data.price !== undefined && (isNaN(data.price) || data.price < 0)) {
      throw new Error('Product price must be a positive number');
    }

    if (data.category_id !== undefined) {
      const category = state.categories.find(c => c.id === data.category_id);
      if (!category) {
        throw new Error('Selected category does not exist');
      }
    }

    const updated: Product = {
      ...state.products[index],
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.category_id !== undefined && { category_id: data.category_id }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.description !== undefined && { description: data.description.trim() }),
      ...(data.image_url !== undefined && { image_url: data.image_url.trim() }),
      ...(data.status !== undefined && { status: data.status }),
      updated_at: new Date().toISOString(),
    };

    state.products[index] = updated;
    await saveState(state);
    return updated;
  },

  async deleteProduct(id: string): Promise<{ success: boolean }> {
    const state = await loadState();
    const exists = state.products.some(p => p.id === id);
    if (!exists) {
      throw new Error('Product not found');
    }

    state.products = state.products.filter(p => p.id !== id);
    await saveState(state);
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
    await saveState({ categories: [], products: [] });
  },
};
