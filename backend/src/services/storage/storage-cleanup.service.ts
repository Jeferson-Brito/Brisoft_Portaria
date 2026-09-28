import fs from 'fs';
import path from 'path';
import { prisma } from '../../lib/prisma.js';

export class StorageRetentionService {
  private timer: NodeJS.Timeout | null = null;

  /**
   * Executa a rotina de exclusão automática de fotos com mais de 30 dias corridos
   * Conforme diretriz de privacidade, LGPD e regras de negócio da portaria.
   */
  async runRetentionCleanup(): Promise<{
    deletedDatabasePhotos: number;
    cleanedVisitors: number;
    cleanedPackages: number;
    deletedStorageObjects: number;
  }> {
    console.log('🧹 [StorageRetention] Iniciando limpeza automática de fotos (> 30 dias)...');

    let deletedDatabasePhotos = 0;
    let cleanedVisitors = 0;
    let cleanedPackages = 0;
    let deletedStorageObjects = 0;

    try {
      // 1. Remove fotos da tabela Supabase PostgreSQL photo_storage
      try {
        const resDb = await prisma.$executeRawUnsafe(`
          DELETE FROM public.photo_storage
          WHERE created_at < NOW() - INTERVAL '30 days';
        `);
        deletedDatabasePhotos = Number(resDb) || 0;
      } catch (err: any) {
        console.warn('⚠️ [StorageRetention] Erro ao limpar public.photo_storage:', err.message);
      }

      // 2. Remove objetos do Supabase Storage bucket se houverem
      try {
        const resObj = await prisma.$executeRawUnsafe(`
          DELETE FROM storage.objects
          WHERE bucket_id IN ('visitor-photos', 'package-photos')
            AND created_at < NOW() - INTERVAL '30 days';
        `);
        deletedStorageObjects = Number(resObj) || 0;
      } catch (err: any) {
        // Tabela storage.objects pode ter RLS ou não estar presente
      }

      // 3. Remove referências de photoUrl em Visitantes antigos (> 30 dias)
      try {
        const resVis = await prisma.$executeRawUnsafe(`
          UPDATE public.visitors
          SET "photoUrl" = NULL
          WHERE "createdAt" < NOW() - INTERVAL '30 days'
            AND "photoUrl" IS NOT NULL;
        `);
        cleanedVisitors = Number(resVis) || 0;
      } catch (err: any) {
        console.warn('⚠️ [StorageRetention] Erro ao desvincular photoUrl de visitantes:', err.message);
      }

      // 4. Remove referências de photoUrl em Encomendas antigas (> 30 dias)
      try {
        const resPkg = await prisma.$executeRawUnsafe(`
          UPDATE public.packages
          SET "photoUrl" = NULL
          WHERE "createdAt" < NOW() - INTERVAL '30 days'
            AND "photoUrl" IS NOT NULL;
        `);
        cleanedPackages = Number(resPkg) || 0;
      } catch (err: any) {
        console.warn('⚠️ [StorageRetention] Erro ao desvincular photoUrl de encomendas:', err.message);
      }

      // 5. Limpa uploads locais em disco se houverem (> 30 dias)
      try {
        const localDir = path.resolve(process.cwd(), 'uploads', 'visitors');
        if (fs.existsSync(localDir)) {
          const files = await fs.promises.readdir(localDir);
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          for (const file of files) {
            const filePath = path.join(localDir, file);
            const stats = await fs.promises.stat(filePath);
            if (stats.mtimeMs < thirtyDaysAgo) {
              await fs.promises.unlink(filePath).catch(() => {});
            }
          }
        }
      } catch (err: any) {}

      console.log(
        `✅ [StorageRetention] Limpeza concluída: ${deletedDatabasePhotos} foto(s) apagadas do Supabase, ` +
        `${cleanedVisitors} visitante(s) e ${cleanedPackages} encomenda(s) higienizados.`
      );

      return {
        deletedDatabasePhotos,
        cleanedVisitors,
        cleanedPackages,
        deletedStorageObjects,
      };
    } catch (err: any) {
      console.error('❌ [StorageRetention] Falha crítica na rotina de retenção:', err);
      return {
        deletedDatabasePhotos: 0,
        cleanedVisitors: 0,
        cleanedPackages: 0,
        deletedStorageObjects: 0,
      };
    }
  }

  /**
   * Inicia o agendamento contínuo: executa na inicialização e a cada 24 horas.
   */
  startAutoCleanup(): void {
    // Executa imediatamente na inicialização
    this.runRetentionCleanup().catch((err) => {
      console.error('Erro na primeira execução da limpeza de fotos:', err);
    });

    // Repete a cada 24 horas (86.400.000 ms)
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    this.timer = setInterval(() => {
      this.runRetentionCleanup().catch((err) => {
        console.error('Erro na execução diária da limpeza de fotos:', err);
      });
    }, TWENTY_FOUR_HOURS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const storageRetentionService = new StorageRetentionService();
