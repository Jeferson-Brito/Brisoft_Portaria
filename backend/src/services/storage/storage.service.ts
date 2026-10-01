import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';

export interface IStorageService {
  upload(fileName: string, buffer: Buffer, mimeType: string, organizationId?: string): Promise<string>;
  getFile(filePath: string): Promise<{ buffer: Buffer; mimeType: string } | null>;
  getSignedUrl(filePath: string, expiresInSeconds?: number): Promise<string>;
  delete(filePath: string): Promise<boolean>;
}

const SAFE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function createPhotoKey(organizationId: string) {
  const org = organizationId.replace(/[^a-zA-Z0-9-]/g, '');
  return `photo_${org}_${randomBytes(16).toString('hex')}`;
}

export function isSafePhotoKey(value: string) {
  return /^[A-Za-z0-9._-]{1,180}$/.test(value) && !value.includes('..');
}

export function safeImageMime(mimeType?: string | null) {
  if (mimeType && SAFE_IMAGE_TYPES.has(mimeType)) return mimeType;
  return 'image/jpeg';
}

export async function photoBelongsToOrganization(fileName: string, organizationId: string) {
  if (!isSafePhotoKey(fileName)) return false;
  const org = organizationId.replace(/[^a-zA-Z0-9-]/g, '');
  if (org && fileName.startsWith(`photo_${org}_`)) return true;

  const [visitor, pkg] = await Promise.all([
    prisma.visitor.findFirst({ where: { organizationId, photoUrl: fileName }, select: { id: true } }),
    prisma.package.findFirst({ where: { organizationId, photoUrl: fileName }, select: { id: true } }),
  ]);
  return Boolean(visitor || pkg);
}

// -------------------------------------------------------------
// Armazenamento Supabase PostgreSQL (Tabela oficial photo_storage)
// -------------------------------------------------------------
export class SupabaseDatabaseStorageService implements IStorageService {
  async upload(fileName: string, buffer: Buffer, mimeType: string, organizationId?: string): Promise<string> {
    const id = organizationId ? createPhotoKey(organizationId) : `photo_${randomBytes(16).toString('hex')}`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.photo_storage (id, file_name, mime_type, data, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $4, file_name = $2, mime_type = $3`,
      id,
      'photo.jpg',
      safeImageMime(mimeType),
      buffer
    );

    return id;
  }

  async getFile(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    if (!isSafePhotoKey(id)) return null;
    try {
      const rows: any = await prisma.$queryRawUnsafe(
        `SELECT data, mime_type FROM public.photo_storage WHERE id = $1 LIMIT 1`,
        id
      );

      if (!rows || rows.length === 0) {
        return null;
      }

      return {
        buffer: Buffer.from(rows[0].data),
        mimeType: safeImageMime(rows[0].mime_type),
      };
    } catch (err) {
      console.warn('Erro ao buscar foto do Supabase PostgreSQL:', err);
      return null;
    }
  }

  async getSignedUrl(id: string): Promise<string> {
    return `${env.API_URL}/api/v1/visitors/photo/${id}`;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM public.photo_storage WHERE id = $1`,
        id
      );
      return true;
    } catch (err) {
      console.warn('Erro ao remover foto do Supabase:', err);
      return false;
    }
  }
}

// -------------------------------------------------------------
// Armazenamento Supabase Storage Bucket (Produção / Cloud REST)
// -------------------------------------------------------------
export class SupabaseStorageService implements IStorageService {
  private client: SupabaseClient;
  private bucket: string;

  constructor() {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase URL e Service Role Key são necessários para SupabaseStorageService');
    }
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    this.bucket = env.SUPABASE_BUCKET_VISITORS;
  }

  async upload(fileName: string, buffer: Buffer, mimeType: string, organizationId?: string): Promise<string> {
    const safeFileName = organizationId
      ? createPhotoKey(organizationId)
      : `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .upload(safeFileName, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Erro ao enviar foto para Supabase Storage: ${error.message}`);
    }

    return data.path;
  }

  async getFile(filePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    if (!isSafePhotoKey(filePath)) return null;
    const { data, error } = await this.client.storage.from(this.bucket).download(filePath);
    if (error || !data) {
      return null;
    }
    const arrayBuffer = await data.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: safeImageMime(data.type),
    };
  }

  async getSignedUrl(filePath: string, expiresInSeconds = 900): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data) {
      throw new Error(`Erro ao gerar URL assinada: ${error?.message}`);
    }

    return data.signedUrl;
  }

  async delete(filePath: string): Promise<boolean> {
    const { error } = await this.client.storage.from(this.bucket).remove([filePath]);
    return !error;
  }
}

// -------------------------------------------------------------
// Armazenamento Local (Fallback caso necessário)
// -------------------------------------------------------------
export class LocalStorageService implements IStorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'uploads', 'visitors');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(fileName: string, buffer: Buffer, _mimeType: string, organizationId?: string): Promise<string> {
    const safeFileName = organizationId
      ? createPhotoKey(organizationId)
      : `${Date.now()}_${path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const targetPath = path.join(this.baseDir, safeFileName);
    await fs.promises.writeFile(targetPath, buffer);
    return safeFileName;
  }

  async getFile(fileName: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    if (!isSafePhotoKey(fileName)) return null;
    const targetPath = path.resolve(this.baseDir, path.basename(fileName));
    const base = path.resolve(this.baseDir);
    if (targetPath !== base && !targetPath.startsWith(base + path.sep)) return null;
    if (!fs.existsSync(targetPath)) {
      return null;
    }
    const buffer = await fs.promises.readFile(targetPath);
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { buffer, mimeType };
  }

  async getSignedUrl(fileName: string): Promise<string> {
    return `${env.API_URL}/api/v1/visitors/photo/${fileName}`;
  }

  async delete(fileName: string): Promise<boolean> {
    if (!isSafePhotoKey(fileName)) return false;
    const targetPath = path.resolve(this.baseDir, path.basename(fileName));
    const base = path.resolve(this.baseDir);
    if (targetPath !== base && !targetPath.startsWith(base + path.sep)) return false;
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath).catch(() => {});
    }
    return true;
  }
}

// Factory para alternar automaticamente entre Supabase REST e Supabase PostgreSQL
export async function compressPhoto(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();
}

export function getStorageService(): IStorageService {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      return new SupabaseStorageService();
    } catch (e) {
      console.warn('Fallback para Supabase PostgreSQL Storage:', e);
    }
  }
  return new SupabaseDatabaseStorageService();
}
