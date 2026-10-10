import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Category, DatabaseState, Product, ProductStatus } from '../types/database';

export type CategoryInput = { name: string; description: string; image_url: string };
export type ProductInput = {
  name: string;
  category_id: string;
  price: number;
  description: string;
  image_url: string;
  status: ProductStatus;
};
export type ProductPatch = Partial<ProductInput>;

export interface MenuRepository {
  list(): Promise<DatabaseState>;
  getCategory(id: string): Promise<Category | null>;
  getProduct(id: string): Promise<Product | null>;
  isImageUrlReferenced(url: string): Promise<boolean>;
  createCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: string, input: CategoryInput): Promise<Category | null>;
  deleteCategory(id: string): Promise<boolean>;
  createProduct(input: ProductInput): Promise<Product>;
  updateProduct(id: string, input: ProductPatch): Promise<Product | null>;
  setProductAvailability(id: string, status: ProductStatus): Promise<Product | null>;
  deleteProduct(id: string): Promise<boolean>;
  clearAll(): Promise<void>;
}

export class InMemoryMenuRepository implements MenuRepository {
  constructor(private readonly state: DatabaseState) {}

  async list(): Promise<DatabaseState> {
    return { categories: [...this.state.categories], products: [...this.state.products] };
  }

  async getProduct(id: string): Promise<Product | null> {
    return this.state.products.find((product) => product.id === id) || null;
  }

  async isImageUrlReferenced(url: string): Promise<boolean> {
    return this.state.products.some((product) => product.image_url === url)
      || this.state.categories.some((category) => category.image_url === url);
  }

  async createCategory(input: CategoryInput): Promise<Category> {
    if (this.state.categories.some((category) => category.name.toLowerCase() === input.name.toLowerCase())) {
      throw Object.assign(new Error('A category with this name already exists.'), { code: '23505' });
    }
    const now = new Date().toISOString();
    const category: Category = { id: randomUUID(), ...input, created_at: now, updated_at: now };
    this.state.categories.push(category);
    return category;
  }

  async getCategory(id: string): Promise<Category | null> {
    return this.state.categories.find((category) => category.id === id) || null;
  }

  async updateCategory(id: string, input: CategoryInput): Promise<Category | null> {
    const index = this.state.categories.findIndex((category) => category.id === id);
    if (index < 0) return null;
    if (this.state.categories.some((category) => category.id !== id && category.name.toLowerCase() === input.name.toLowerCase())) {
      throw Object.assign(new Error('A category with this name already exists.'), { code: '23505' });
    }
    this.state.categories[index] = { ...this.state.categories[index], ...input, updated_at: new Date().toISOString() };
    return this.state.categories[index];
  }

  async deleteCategory(id: string): Promise<boolean> {
    if (!this.state.categories.some((category) => category.id === id)) return false;
    if (this.state.products.some((product) => product.category_id === id)) {
      throw Object.assign(new Error('Category still contains products.'), { code: '23503' });
    }
    this.state.categories = this.state.categories.filter((category) => category.id !== id);
    return true;
  }

  async createProduct(input: ProductInput): Promise<Product> {
    if (!this.state.categories.some((category) => category.id === input.category_id)) {
      throw Object.assign(new Error('The selected category does not exist.'), { code: 'MENU_CATEGORY_MISSING' });
    }
    const now = new Date().toISOString();
    const product: Product = { id: randomUUID(), ...input, created_at: now, updated_at: now };
    this.state.products.push(product);
    return product;
  }

  async updateProduct(id: string, input: ProductPatch): Promise<Product | null> {
    const index = this.state.products.findIndex((product) => product.id === id);
    if (index < 0) return null;
    if (input.category_id && !this.state.categories.some((category) => category.id === input.category_id)) {
      throw Object.assign(new Error('The selected category does not exist.'), { code: 'MENU_CATEGORY_MISSING' });
    }
    this.state.products[index] = { ...this.state.products[index], ...input, updated_at: new Date().toISOString() };
    return this.state.products[index];
  }

  async setProductAvailability(id: string, status: ProductStatus): Promise<Product | null> {
    return this.updateProduct(id, { status });
  }

  async deleteProduct(id: string): Promise<boolean> {
    if (!this.state.products.some((product) => product.id === id)) return false;
    this.state.products = this.state.products.filter((product) => product.id !== id);
    return true;
  }

  async clearAll(): Promise<void> {
    this.state.products = [];
    this.state.categories = [];
  }
}

export class PostgresMenuRepository implements MenuRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<DatabaseState> {
    // Query sequentially so a menu read occupies at most one pool client at a time.
    const categories = await this.pool.query('SELECT * FROM categories ORDER BY created_at DESC');
    const products = await this.pool.query('SELECT * FROM products ORDER BY created_at DESC');
    return {
      categories: categories.rows.map((category) => ({ ...category, description: category.description || '', image_url: category.image_url || '' })),
      products: products.rows.map(normalizeProduct),
    };
  }

  async getCategory(id: string): Promise<Category | null> {
    const result = await this.pool.query<Category>('SELECT * FROM categories WHERE id = $1', [id]);
    const category = result.rows[0];
    return category ? { ...category, description: category.description || '', image_url: category.image_url || '' } : null;
  }

  async getProduct(id: string): Promise<Product | null> {
    const result = await this.pool.query<Product>('SELECT * FROM products WHERE id = $1', [id]);
    return result.rows[0] ? normalizeProduct(result.rows[0]) : null;
  }

  async isImageUrlReferenced(url: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM products WHERE image_url = $1 UNION ALL SELECT 1 FROM categories WHERE image_url = $1 LIMIT 1',
      [url],
    );
    return Boolean(result.rowCount);
  }

  async createCategory(input: CategoryInput): Promise<Category> {
    return this.withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('menu_categories_name'))");
      const duplicate = await client.query('SELECT 1 FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1', [input.name]);
      if (duplicate.rowCount) throw Object.assign(new Error('A category with this name already exists.'), { code: '23505' });
      const now = new Date().toISOString();
      const result = await client.query<Category>(
        'INSERT INTO categories (id, name, description, image_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5) RETURNING *',
        [randomUUID(), input.name, input.description, input.image_url, now],
      );
      return result.rows[0];
    });
  }

  async updateCategory(id: string, input: CategoryInput): Promise<Category | null> {
    return this.withTransaction(async (client) => {
      const existing = await client.query('SELECT 1 FROM categories WHERE id = $1', [id]);
      if (!existing.rowCount) return null;
      await client.query("SELECT pg_advisory_xact_lock(hashtext('menu_categories_name'))");
      const duplicate = await client.query('SELECT 1 FROM categories WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1', [input.name, id]);
      if (duplicate.rowCount) throw Object.assign(new Error('A category with this name already exists.'), { code: '23505' });
      const result = await client.query<Category>(
        'UPDATE categories SET name = $2, description = $3, image_url = $4, updated_at = $5 WHERE id = $1 RETURNING *',
        [id, input.name, input.description, input.image_url, new Date().toISOString()],
      );
      return result.rows[0] || null;
    });
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.withTransaction(async (client) => {
      const existing = await client.query('SELECT 1 FROM categories WHERE id = $1', [id]);
      if (!existing.rowCount) return false;
      const inUse = await client.query('SELECT 1 FROM products WHERE category_id = $1 LIMIT 1', [id]);
      if (inUse.rowCount) throw Object.assign(new Error('Category still contains products.'), { code: '23503' });
      const result = await client.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
      return Boolean(result.rowCount);
    });
  }

  async createProduct(input: ProductInput): Promise<Product> {
    return this.withTransaction(async (client) => {
      const category = await client.query('SELECT 1 FROM categories WHERE id = $1', [input.category_id]);
      if (!category.rowCount) throw Object.assign(new Error('The selected category does not exist.'), { code: 'MENU_CATEGORY_MISSING' });
      const now = new Date().toISOString();
      const result = await client.query<Product>(
        'INSERT INTO products (id, name, category_id, price, description, image_url, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *',
        [randomUUID(), input.name, input.category_id, input.price, input.description, input.image_url, input.status, now],
      );
      return normalizeProduct(result.rows[0]);
    });
  }

  async updateProduct(id: string, input: ProductPatch): Promise<Product | null> {
    const allowedColumns: Record<keyof ProductPatch, string> = {
      name: 'name', category_id: 'category_id', price: 'price', description: 'description', image_url: 'image_url', status: 'status',
    };
    return this.withTransaction(async (client) => {
      const existing = await client.query('SELECT 1 FROM products WHERE id = $1', [id]);
      if (!existing.rowCount) return null;
      if (input.category_id) {
        const category = await client.query('SELECT 1 FROM categories WHERE id = $1', [input.category_id]);
        if (!category.rowCount) throw Object.assign(new Error('The selected category does not exist.'), { code: 'MENU_CATEGORY_MISSING' });
      }
      const fields = Object.entries(input) as Array<[keyof ProductPatch, ProductPatch[keyof ProductPatch]]>;
      const assignments = fields.map(([key], index) => `${allowedColumns[key]} = $${index + 2}`);
      assignments.push(`updated_at = $${fields.length + 2}`);
      const values = [id, ...fields.map(([, value]) => value), new Date().toISOString()];
      const result = await client.query<Product>(
        `UPDATE products SET ${assignments.join(', ')} WHERE id = $1 RETURNING *`, values,
      );
      return result.rows[0] ? normalizeProduct(result.rows[0]) : null;
    });
  }

  async setProductAvailability(id: string, status: ProductStatus): Promise<Product | null> {
    return this.withTransaction(async (client) => {
      const result = await client.query<Product>(
        'UPDATE products SET status = $2, updated_at = $3 WHERE id = $1 RETURNING *',
        [id, status, new Date().toISOString()],
      );
      return result.rows[0] ? normalizeProduct(result.rows[0]) : null;
    });
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.withTransaction(async (client) => {
      const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
      return Boolean(result.rowCount);
    });
  }

  async clearAll(): Promise<void> {
    await this.withTransaction(async (client) => {
      await client.query('DELETE FROM products');
      await client.query('DELETE FROM categories');
    });
  }

  private async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    let client: PoolClient | undefined;
    let started = false;
    try {
      const connection = await this.pool.connect();
      client = connection;
      await connection.query('BEGIN');
      started = true;
      const value = await operation(connection);
      await connection.query('COMMIT');
      started = false;
      return value;
    } catch (error) {
      if (started) {
        try { await client?.query('ROLLBACK'); } catch { /* Preserve the operation error. */ }
      }
      throw error;
    } finally {
      client?.release();
    }
  }
}

function normalizeProduct(product: Product | (Product & { price: string })): Product {
  const price = Number(product.price);
  if (!Number.isFinite(price)) throw new Error('Database returned a product with an invalid price.');
  return { ...product, price, description: product.description || '', image_url: product.image_url || '' };
}
