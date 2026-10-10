import express, { type RequestHandler } from 'express';
import type { CategoryInput, MenuRepository, ProductInput, ProductPatch } from './menuRepository';
import type { ProductStatus } from '../types/database';
import { hasValidImageSignature, isAllowedImageType, MAX_PRODUCT_IMAGE_BYTES, SupabaseImageStorage } from './imageStorage';
import type { ErrorAlert } from './errorAlerts';

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
  if (!isRecord(value) || !onlyKeys(value, ['name', 'description', 'image_url'])) return null;
  if (typeof value.name !== 'string') return null;
  const name = value.name.trim();
  const description = value.description == null ? '' : value.description;
  const imageUrl = value.image_url === undefined ? '' : value.image_url;
  if (!name || name.length > maxNameLength || typeof description !== 'string'
    || !productField('image_url', imageUrl) || (typeof imageUrl === 'string' && imageUrl.startsWith('data:'))) return null;
  return { name, description: description.trim(), image_url: imageUrl as string };
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

function errorResponse(res: express.Response, error: unknown, reportError?: (alert: ErrorAlert) => void, route = '') {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'MENU_CATEGORY_MISSING') return res.status(400).json({ error: 'The selected category does not exist.', code: 'INVALID_CATEGORY' });
  if (code === '23505') return res.status(409).json({ error: 'A category with this name already exists.', code: 'DUPLICATE_NAME' });
  if (code === '23503') return res.status(409).json({ error: 'This category is still assigned to one or more products.', code: 'RESOURCE_IN_USE' });
  if (typeof code === 'string' && (code.startsWith('08') || ['ECONNREFUSED', 'ENETUNREACH', 'ETIMEDOUT', '57P01', '57P02', '57P03'].includes(code))) {
    reportError?.({ source: 'database', summary: 'Database request failed.', route, code });
    return res.status(503).json({ error: 'The menu database is temporarily unavailable.', code: 'DATABASE_UNAVAILABLE' });
  }
  console.error('Menu operation failed (details redacted).', {
    code: typeof code === 'string' ? code : 'UNCLASSIFIED',
    name: error instanceof Error ? error.name : 'UnknownError',
  });
  reportError?.({ source: 'api', summary: error instanceof Error ? error.name : 'Unknown server error.', route, code: typeof code === 'string' ? code : undefined });
  return res.status(500).json({ error: 'The menu operation could not be completed.', code: 'INTERNAL_ERROR' });
}

export function createMenuRouter(repository: MenuRepository, requireOwner: RequestHandler, imageStorage?: SupabaseImageStorage, reportError?: (alert: ErrorAlert) => void): express.Router {
  const api = express.Router();
  let clientReportCount = 0;
  let clientReportWindowStartedAt = Date.now();
  api.post('/client-errors', (req, res) => {
    const origin = req.get('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Cross-origin error reports are not accepted.' });
      } catch { return res.status(403).json({ error: 'Invalid report origin.' }); }
    }
    if (!isRecord(req.body) || !onlyKeys(req.body, ['source', 'message', 'route'])) return invalid(res, 'Invalid error report.');
    const allowedSources = ['window_error', 'unhandled_rejection', 'react_error_boundary'];
    if (typeof req.body.source !== 'string' || !allowedSources.includes(req.body.source)
      || typeof req.body.message !== 'string' || !req.body.message.trim() || req.body.message.length > 500
      || typeof req.body.route !== 'string' || !req.body.route.startsWith('/') || req.body.route.length > 200 || req.body.route.includes('?')) {
      return invalid(res, 'Error report fields are invalid.');
    }
    const now = Date.now();
    if (now - clientReportWindowStartedAt >= 10 * 60 * 1000) {
      clientReportWindowStartedAt = now;
      clientReportCount = 0;
    }
    if (clientReportCount >= 60) return res.status(429).json({ error: 'Error report limit reached.' });
    clientReportCount += 1;
    reportError?.({ source: req.body.source, summary: req.body.message, route: req.body.route });
    return res.status(202).json({ accepted: true });
  });
  api.post('/images', requireOwner, (req, res, next) => {
    const contentType = req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() || '';
    if (!isAllowedImageType(contentType)) return res.status(415).json({ error: 'Use a JPEG, PNG, WebP, or GIF image.', code: 'UNSUPPORTED_IMAGE_TYPE' });
    return express.raw({ type: contentType, limit: MAX_PRODUCT_IMAGE_BYTES })(req, res, next);
  }, async (req, res) => {
    const type = req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() || '';
    const purpose = req.header('x-image-purpose') || 'products';
    if (purpose !== 'products' && purpose !== 'categories') return invalid(res, 'Image purpose must be products or categories.');
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return invalid(res, 'Image file is empty or missing.');
    if (!hasValidImageSignature(req.body, type as Parameters<typeof hasValidImageSignature>[1])) {
      return res.status(415).json({ error: 'The file contents do not match a supported image type.', code: 'INVALID_IMAGE_CONTENT' });
    }
    try {
      if (!imageStorage) return res.status(503).json({ error: 'Product image storage is not configured on the server.', code: 'IMAGE_STORAGE_UNAVAILABLE' });
      return res.status(201).json({ image_url: await imageStorage.upload(req.body, type as Parameters<typeof hasValidImageSignature>[1], purpose) });
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode || 502;
      if (status >= 500) reportError?.({ source: 'image_storage', summary: error instanceof Error ? error.name : 'Image upload failed.', route: req.path, code: String(status) });
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
    } catch (error) {
      reportError?.({ source: 'image_storage', summary: error instanceof Error ? error.name : 'Image cleanup failed.', route: req.path, code: 'CLEANUP_FAILED' });
      return res.status(502).json({ error: 'Unused image cleanup failed.', code: 'IMAGE_CLEANUP_FAILED' });
    }
  });
  api.get('/menu', async (req, res) => {
    try {
      const state = await repository.list();
      res.set('Cache-Control', 'no-store');
      return res.json(state);
    } catch (error) {
      return errorResponse(res, error, reportError, req.path);
    }
  });

  // Preserve the existing owner dashboard reset control as an explicit atomic action.
  api.post('/menu/reset', requireOwner, async (req, res) => {
    try {
      await repository.clearAll();
      return res.json({ success: true });
    } catch (error) { return errorResponse(res, error, reportError, req.path); }
  });

  api.post('/categories', requireOwner, async (req, res) => {
    const input = categoryInput(req.body);
    if (!input) return invalid(res, 'Enter a category name and provide a valid image URL if using one.');
    try { return res.status(201).json({ category: await repository.createCategory(input) }); }
    catch (error) { return errorResponse(res, error, reportError, req.path); }
  });

  api.put('/categories/:id', requireOwner, async (req, res) => {
    const input = categoryInput(req.body);
    if (!input) return invalid(res, 'Enter a category name and provide a valid image URL if using one.');
    try {
      const before = await repository.getCategory(req.params.id);
      if (!before) return res.status(404).json({ error: 'Category not found.', code: 'NOT_FOUND' });
      const category = await repository.updateCategory(req.params.id, input);
      if (!category) return res.status(404).json({ error: 'Category not found.', code: 'NOT_FOUND' });
      if (before.image_url && before.image_url !== category.image_url && imageStorage) {
        try {
          if (!await repository.isImageUrlReferenced(before.image_url)) await imageStorage.deleteOwnedPublicUrl(before.image_url);
        } catch { console.error('Replaced category image cleanup failed; old object retained.'); }
      }
      return res.json({ category });
    } catch (error) { return errorResponse(res, error, reportError, req.path); }
  });

  api.delete('/categories/:id', requireOwner, async (req, res) => {
    try {
      const before = await repository.getCategory(req.params.id);
      const deleted = await repository.deleteCategory(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Category not found.', code: 'NOT_FOUND' });
      if (before?.image_url && imageStorage) {
        try {
          if (!await repository.isImageUrlReferenced(before.image_url)) await imageStorage.deleteOwnedPublicUrl(before.image_url);
        } catch { console.error('Deleted category image cleanup failed; old object retained.'); }
      }
      return res.json({ success: true });
    } catch (error) { return errorResponse(res, error, reportError, req.path); }
  });

  api.post('/products', requireOwner, async (req, res) => {
    const input = productInput(req.body);
    if (!input) return invalid(res, 'Product fields are invalid. Provide a name, category ID, price with at most two decimal places, and valid optional fields.');
    try { return res.status(201).json({ product: await repository.createProduct(input) }); }
    catch (error) { return errorResponse(res, error, reportError, req.path); }
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
        try {
          if (before.image_url && !await repository.isImageUrlReferenced(before.image_url)) await imageStorage.deleteOwnedPublicUrl(before.image_url);
        }
        catch { console.error('Replaced product image cleanup failed; old object retained.'); }
      }
      return res.json({ product });
    } catch (error) { return errorResponse(res, error, reportError, req.path); }
  });

  api.patch('/products/:id/availability', requireOwner, async (req, res) => {
    if (!isRecord(req.body) || !onlyKeys(req.body, ['status']) || !productField('status', req.body.status)) {
      return invalid(res, 'Availability must be either available or out_of_stock.');
    }
    try {
      const product = await repository.setProductAvailability(req.params.id, req.body.status as ProductStatus);
      return product ? res.json({ product }) : res.status(404).json({ error: 'Product not found.', code: 'NOT_FOUND' });
    } catch (error) { return errorResponse(res, error, reportError, req.path); }
  });

  api.delete('/products/:id', requireOwner, async (req, res) => {
    try {
      const before = await repository.getProduct(req.params.id);
      const deleted = await repository.deleteProduct(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Product not found.', code: 'NOT_FOUND' });
      if (before && imageStorage) {
        try {
          if (before.image_url && !await repository.isImageUrlReferenced(before.image_url)) await imageStorage.deleteOwnedPublicUrl(before.image_url);
        }
        catch { console.error('Deleted product image cleanup failed; old object retained.'); }
      }
      return res.json({ success: true });
    } catch (error) { return errorResponse(res, error, reportError, req.path); }
  });
  return api;
}
