/**
 * Supabase PostgreSQL Schema Definition
 * 
 * Run this SQL script in the Supabase SQL Editor when connecting to your project.
 * Notice: Initially, tables are created with 0 rows (no sample data).
 */

export const SUPABASE_SQL_SCHEMA = `-- 1. Enable UUID generation extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create CATEGORIES table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Create PRODUCTS table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'out_of_stock')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Create Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);

-- 5. Row Level Security (RLS) Configuration
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Allow public (customers) to READ categories & products
CREATE POLICY "Public read categories" 
ON public.categories FOR SELECT 
USING (true);

CREATE POLICY "Public read products" 
ON public.products FOR SELECT 
USING (true);

-- Allow authenticated admin users to manage categories & products
CREATE POLICY "Admins manage categories" 
ON public.categories FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Admins manage products" 
ON public.products FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
`;
