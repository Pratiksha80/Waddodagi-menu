export type ProductStatus = 'available' | 'out_of_stock';

export interface Category {
  id: string;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  category_id: string;
  price: number;
  description: string;
  image_url: string;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface CategoryWithProductCount extends Category {
  product_count: number;
}

export interface ProductWithCategory extends Product {
  category_name?: string;
}

export interface DatabaseState {
  categories: Category[];
  products: Product[];
}

export interface AdminUser {
  email: string;
  name: string;
  role: 'owner' | 'manager';
}
