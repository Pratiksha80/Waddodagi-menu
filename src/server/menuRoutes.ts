import express, { type RequestHandler } from 'express';
import type { CategoryInput, MenuRepository, ProductInput, ProductPatch } from './menuRepository';
import type { ProductStatus } from '../types/database';
import { hasValidImageSignature, isAllowedImageType, MAX_PRODUCT_IMAGE_BYTES, SupabaseImageStorage } from './imageStorage';

const maxNameLength = 255;
const maxDescriptionLength = 20000;
const maxImageReferenceLength = 90 * 1024 * 1024;

function invalid(res: express.Response, message: string) {
  return res.status(400).json({ error: message, code: 'INVALID_INPUT' });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function categoryInput(value: unknown): CategoryInput | null {
  if (!isRecord(value) || !onlyKeys(value, ['name', 'description'])) return null;
  if (typeof value.name !== 'string') return null;
  const name = value.name.trim();
  const description = value.description === undefined ? '' : value.description;
  if (!name || name.length > maxNameLength || typeof description !== 'string' || description.length > maxDescriptionLength) return null;
  return { name, description: description.trim() };
}

function productField(key: string, value: unknown): boolean {
  if (key === 'name') return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxNameLength;
  if (key === 'category_id') return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 255;
  if (key === 'price') {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 99999999.99
      && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
  }
  if (key === 'description') return typeof value === 'string' && value.length <= maxDescriptionLength;
  if (key === 'image_url') {
    if (typeof value !== 'string') return false;
    if (value === '') return true;
    if (value.startsWith('data:')) return value.length <= maxImageReferenceLength && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/]*={0,2}$/i.test(value);
    if (value.length > 2048) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch { return false; }
  }
  if (key === 'status') return value === 'available' || value === 'out_of_stock';
  return false;
}

function productInput(value: unknown): ProductInput | null {
  if (!isRecord(value) || !onlyKeys(value, ['name', 'category_id', 'price', 'description', 'image_url', 'status'])) return null;
  if (!['name', 'category_id', 'price'].every((key) => key in value)) return null;
  for (const [key, field] of Object.entries(value)) if (!productField(key, field)) return null;
  if (typeof value.image_url === 'string' && value.image_url.startsWith('data:')) return null;
  return {
    name: (value.name as string).trim(),
    category_id: (value.category_id as string).trim(),
    price: value.price as number,
    description: typeof value.description === 'string' ? value.description.trim() : '',
    image_url: typeof value.image_url === 'string' ? value.image_url : '',
    status: (value.status as ProductStatus | undefined) || 'available',
  };
}

function productPatch(value: unknown): ProductPatch | null {
  if (!isRecord(value) || !Object.keys(value).length || !onlyKeys(value, ['name', 'category_id', 'price', 'description', 'image_url', 'status'])) return null;
  for (const [key, field] of Object.entries(value)) if (!productField(key, field)) return null;
  const patch: ProductPatch = { ...value } as ProductPatch;
  if (patch.name !== undefined) patch.name = patch.name.trim();
  if (patch.category_id !== undefined) patch.category_id = patch.category_id.trim();
  if (patch.description !== undefined) patch.description = patch.description.trim();
  return patch;
}

function errorResponse(res: express.Response, error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'MENU_CATEGORY_MISSING') return res.status(400).json({ error: 'The selected category does not exist.', code: 'INVALID_CATEGORY' });
  if (code === '23505') return res.status(409).json({ error: 'A category with this name already exists.', code: 'DUPLICATE_NAME' });
  if (code === '23503') return res.status(409).json({ error: 'This category is still assigned to one or more products.', code: 'RESOURCE_IN_USE' });
  if (typeof code === 'string' && (code.startsWith('08') || ['ECONNREFUSED', 'ENETUNREACH', 'ETIMEDOUT', '57P01', '57P02', '57P03'].includes(code))) {
    return res.status(503).json({ error: 'The menu database is temporarily unavailable.', code: 'DATABASE_UNAVAILABLE' });
  }
  console.error('Menu operation failed (details redacted).', {
    code: typeof code === 'string' ? code : 'UNCLASSIFIED',
    name: error instanceof Error ? error.name : 'UnknownError',
  });
  return res.status(500).json({ error: 'The menu operation could not be completed.', code: 'INTERNAL_ERROR' });
}

export function createMenuRouter(repository: MenuRepository, requireOwner: RequestHandler, imageStorage?: SupabaseImageStorage): express.Router {
  const api = express.Router();
  api.post('/images', requireOwner, (req, res, next) => {
    const contentType = req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() || '';
    if (!isAllowedImageType(contentType)) return res.status(415).json({ error: 'Use a JPEG, PNG, WebP, or GIF image.', code: 'UNSUPPORTED_IMAGE_TYPE' });
    return express.raw({ type: contentType, limit: MAX_PRODUCT_IMAGE_BYTES })(req, res, next);
  }, async (req, res) => {
    const type = req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() || '';
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return invalid(res, 'Image file is empty or missing.');
    if (!hasValidImageSignature(req.body, type as Parameters<typeof hasValidImageSignature>[1])) {
      return res.status(415).json({ error: 'The file contents do not match a supported image type.', code: 'INVALID_IMAGE_CONTENT' });
    }
    try {
      if (!imageStorage) return res.status(503).json({ error: 'Product image storage is not configured on the server.', code: 'IMAGE_STORAGE_UNAVAILABLE' });
      return res.status(201).json({ image_url: await imageStorage.upload(req.body, type as Parameters<typeof hasValidImageSignature>[1]) });
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode || 502;
      return res.status(status).json({ error: error instanceof Error ? error.message : 'Image upload failed.', code: status === 503 ? 'IMAGE_STORAGE_UNAVAILABLE' : 'IMAGE_UPLOAD_FAILED' });
    }
  });

  api.delete('/images', requireOwner, async (req, res) => {
    const url = isRecord(req.body) && typeof req.body.image_url === 'string' ? req.body.image_url : null;
    if (!url) return invalid(res, 'Provide an image URL to clean up.');
    if (!imageStorage) return res.status(503).json({ error: 'Product image storage is not configured on the server.', code: 'IMAGE_STORAGE_UNAVAILABLE' });
    try {
      if (await repository.isImageUrlReferenced(url)) {
        return res.status(409).json({ error: 'Image is still referenced by a menu product.', code: 'IMAGE_IN_USE' });
      }
      await imageStorage.deleteOwnedPublicUrl(url);
      return res.status(204).end();
    } catch {
      return res.status(502).json({ error: 'Unused image cleanup failed.', code: 'IMAGE_CLEANUP_FAILED' });
    }
  });
  api.get('/menu', async (_req, res) => {
    try {
      const state = await repository.list();
      res.set('Cache-Control', 'no-store');
      return res.json(state);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  // Preserve the existing owner dashboard reset control as an explicit atomic action.
  api.post('/menu/reset', requireOwner, async (_req, res) => {
    try {
      await repository.clearAll();
      return res.json({ success: true });
    } catch (error) { return errorResponse(res, error); }
  });

  api.post('/categories', requireOwner, async (req, res) => {
    const input = categoryInput(req.body);
    if (!input) return invalid(res, 'Category must include a name of 1–255 characters and a description up to 20,000 characters.');
    try { return res.status(201).json({ category: await repository.createCategory(input) }); }
    catch (error) { return errorResponse(res, error); }
  });

  api.put('/categories/:id', requireOwner, async (req, res) => {
    const input = categoryInput(req.body);
    if (!input) return invalid(res, 'Category must include a name of 1–255 characters and a description up to 20,000 characters.');
    try {
      const category = await repository.updateCategory(req.params.id, input);
      return category ? res.json({ category }) : res.status(404).json({ error: 'Category not found.', code: 'NOT_FOUND' });
    } catch (error) { return errorResponse(res, error); }
  });

  api.delete('/categories/:id', requireOwner, async (req, res) => {
    try {
      const deleted = await repository.deleteCategory(req.params.id);
      return deleted ? res.json({ success: true }) : res.status(404).json({ error: 'Category not found.', code: 'NOT_FOUND' });
    } catch (error) { return errorResponse(res, error); }
  });

  api.post('/products', requireOwner, async (req, res) => {
    const input = productInput(req.body);
    if (!input) return invalid(res, 'Product fields are invalid. Provide a name, category ID, price with at most two decimal places, and valid optional fields.');
    try { return res.status(201).json({ product: await repository.createProduct(input) }); }
    catch (error) { return errorResponse(res, error); }
  });

  api.put('/products/:id', requireOwner, async (req, res) => {
    const input = productPatch(req.body);
    if (!input) return invalid(res, 'Provide one or more valid product fields to update.');
    try {
      const before = input.image_url === undefined ? null : await repository.getProduct(req.params.id);
      if (input.image_url !== undefined && !before) return res.status(404).json({ error: 'Product not found.', code: 'NOT_FOUND' });
      if (input.image_url?.startsWith('data:') && before?.image_url !== input.image_url) {
        return invalid(res, 'New image files must be uploaded through POST /api/images; legacy image data may only be retained unchanged.');
      }
      const product = await repository.updateProduct(req.params.id, input);
      if (!product) return res.status(404).json({ error: 'Product not found.', code: 'NOT_FOUND' });
      if (before && input.image_url !== undefined && before.image_url !== input.image_url && imageStorage) {
        try { await imageStorage.deleteOwnedPublicUrl(before.image_url); }
        catch { console.error('Replaced product image cleanup failed; old object retained.'); }
      }
      return res.json({ product });
    } catch (error) { return errorResponse(res, error); }
  });

  api.patch('/products/:id/availability', requireOwner, async (req, res) => {
    if (!isRecord(req.body) || !onlyKeys(req.body, ['status']) || !productField('status', req.body.status)) {
      return invalid(res, 'Availability must be either available or out_of_stock.');
    }
    try {
      const product = await repository.setProductAvailability(req.params.id, req.body.status as ProductStatus);
      return product ? res.json({ product }) : res.status(404).json({ error: 'Product not found.', code: 'NOT_FOUND' });
    } catch (error) { return errorResponse(res, error); }
  });

  api.delete('/products/:id', requireOwner, async (req, res) => {
    try {
      const before = await repository.getProduct(req.params.id);
      const deleted = await repository.deleteProduct(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Product not found.', code: 'NOT_FOUND' });
      if (before && imageStorage) {
        try { await imageStorage.deleteOwnedPublicUrl(before.image_url); }
        catch { console.error('Deleted product image cleanup failed; old object retained.'); }
      }
      return res.json({ success: true });
    } catch (error) { return errorResponse(res, error); }
  });
  return api;
}
