import { createServer } from 'http';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { realtimeService } from './services/realtime/realtime.service.js';
import { whatsappService } from './services/whatsapp/whatsapp.service.js';
import { storageRetentionService } from './services/storage/storage-cleanup.service.js';

async function bootstrap() {
  const app = buildApp();

  // Inicializa o serviço de WebSocket em tempo real acoplado ao servidor HTTP do Fastify
  const io = realtimeService.init(app.server);
  whatsappService.setSocketServer(io);

  // Disponibiliza o socket.io no fastify ANTES de finalizar a inicialização
  app.decorate('io', io);

  await app.ready();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });

    // Inicia a rotina de exclusão automática de fotos antigas (> 30 dias corridos)
    storageRetentionService.startAutoCleanup();

    // Restaura automaticamente sessões salvas do WhatsApp Baileys
    await whatsappService.autoRestoreSessions();

    // Keep-alive inteligente: realiza auto-ping a cada 8 minutos para manter o Baileys conectado e evitar cold-start no Render
    if (env.NODE_ENV === 'production') {
      const pingUrl = process.env.RENDER_EXTERNAL_URL
        ? `${process.env.RENDER_EXTERNAL_URL}/health`
        : 'https://combate-portaria-backend.onrender.com/health';
      setInterval(async () => {
        try {
          await fetch(pingUrl);
          console.log(`💓 [KeepAlive] Auto-ping enviado para ${pingUrl}`);
        } catch (e) {}
      }, 8 * 60 * 1000);
    }

    console.log(`
🚀 ========================================================
   SISTEMA DE CONTROLE DE ACESSO E GESTÃO DE VISITANTES
   Servidor rodando em: http://localhost:${env.PORT}
   Ambiente: ${env.NODE_ENV}
   Healthcheck: http://localhost:${env.PORT}/health
   Documentação & Rotas em: http://localhost:${env.PORT}/api/v1
   Persistência: SQLite local (Pronto para Supabase)
   Deploy: Preparado para o Render
========================================================
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
