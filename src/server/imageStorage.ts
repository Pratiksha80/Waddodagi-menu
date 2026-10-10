import { randomUUID } from 'node:crypto';

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type ProductImageType = typeof PRODUCT_IMAGE_TYPES[number];

export interface ImageStorageConfig {
  url?: string;
  serviceRoleKey?: string;
  bucket?: string;
}

export class ImageStorageError extends Error {
  constructor(message: string, readonly statusCode = 502) { super(message); }
}

export class SupabaseImageStorage {
  constructor(private readonly config: ImageStorageConfig, private readonly request: typeof fetch = fetch) {}

  isConfigured(): boolean {
    return Boolean(this.config.url && this.config.serviceRoleKey && this.config.bucket);
  }

  async upload(bytes: Buffer, contentType: ProductImageType): Promise<string> {
    this.requireConfigured();
    if (bytes.length < 1 || bytes.length > MAX_PRODUCT_IMAGE_BYTES) {
      throw new ImageStorageError('Image must be between 1 byte and 5 MiB.', 413);
    }
    const extension: Record<ProductImageType, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    };
    const path = `products/${randomUUID()}.${extension[contentType]}`;
    const response = await this.request(`${this.baseUrl()}/storage/v1/object/${encodeURIComponent(this.config.bucket!)}/${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': contentType, 'x-upsert': 'false' }),
      body: new Uint8Array(bytes).buffer,
    });
    if (!response.ok) throw new ImageStorageError('Image storage could not save this file. Check the bucket configuration and try again.');
    return this.publicUrl(path);
  }

  async deleteOwnedPublicUrl(value: string): Promise<void> {
    if (!this.isConfigured()) return;
    const path = this.ownedObjectPath(value);
    if (!path) return;
    const response = await this.request(`${this.baseUrl()}/storage/v1/object/${encodeURIComponent(this.config.bucket!)}`, {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: [path] }),
    });
    if (!response.ok && response.status !== 404) throw new ImageStorageError('Image cleanup failed; the menu change was saved, but an unused image may remain in Storage.');
  }

  private publicUrl(path: string): string {
    return `${this.baseUrl()}/storage/v1/object/public/${encodeURIComponent(this.config.bucket!)}/${path}`;
  }

  private ownedObjectPath(value: string): string | null {
    try {
      const candidate = new URL(value);
      const base = new URL(this.config.url!);
      if (candidate.origin !== base.origin) return null;
      const prefix = `/storage/v1/object/public/${encodeURIComponent(this.config.bucket!)}/products/`;
      if (!candidate.pathname.startsWith(prefix)) return null;
      const path = decodeURIComponent(candidate.pathname.slice(prefix.length));
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/i.test(path) ? `products/${path}` : null;
    } catch { return null; }
  }

  private requireConfigured(): void {
    if (!this.isConfigured()) throw new ImageStorageError('Product image storage is not configured on the server.', 503);
  }

  private baseUrl(): string { return this.config.url!.replace(/\/$/, ''); }
  private headers(extra: Record<string, string>): Record<string, string> {
    return { apikey: this.config.serviceRoleKey!, Authorization: `Bearer ${this.config.serviceRoleKey!}`, ...extra };
  }
}

export function isAllowedImageType(value: string): value is ProductImageType {
  return (PRODUCT_IMAGE_TYPES as readonly string[]).includes(value.toLowerCase());
}

export function hasValidImageSignature(bytes: Buffer, contentType: ProductImageType): boolean {
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === 'image/gif') return bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'));
  if (contentType === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
}
