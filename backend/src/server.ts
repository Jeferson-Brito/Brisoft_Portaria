// Define o fuso horário padrão da aplicação para Horário de Brasília (BRT / UTC-3)
process.env.TZ = 'America/Sao_Paulo';

import { createServer } from 'http';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { realtimeService } from './services/realtime/realtime.service.js';
import { whatsappService } from './services/whatsapp/whatsapp.service.js';
import { storageRetentionService } from './services/storage/storage-cleanup.service.js';

// Suprime ruído de logs internos do libsignal sobre mensagens antigas não descriptografadas (Bad MAC)
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : (args[0]?.message || String(args[0] || ''));
  if (
    msg.includes('Failed to decrypt message with any known session') ||
    msg.includes('Bad MAC')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Previne crash fatal do processo Node.js por exceções assíncronas do Baileys/libsignal (ex: Bad MAC, 428 Connection Closed)
process.on('unhandledRejection', (reason: any) => {
  const msg = reason?.message || String(reason);
  if (
    msg.includes('Bad MAC') ||
    msg.includes('Connection Closed') ||
    msg.includes('Session error') ||
    reason?.output?.statusCode === 428
  ) {
    console.warn('⚠️ [Baileys/Signal] Erro assíncrono recuperável interceptado (processo mantido ativo):', msg);
    return;
  }
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err: any) => {
  const msg = err?.message || String(err);
  if (
    msg.includes('Bad MAC') ||
    msg.includes('Connection Closed') ||
    msg.includes('Session error') ||
    err?.output?.statusCode === 428
  ) {
    console.warn('⚠️ [Baileys/Signal] Exceção assíncrona recuperável interceptada (processo mantido ativo):', msg);
    return;
  }
  console.error('Uncaught Exception:', err);
});

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

    // Restaura automaticamente sessões salvas do WhatsApp Baileys (apenas em produção para evitar conflito com Render)
    if (env.NODE_ENV === 'production' || process.env.ENABLE_LOCAL_WHATSAPP === 'true') {
      await whatsappService.autoRestoreSessions();
    } else {
      console.log('ℹ️ [WhatsApp] Auto-conexão do WhatsApp desativada no ambiente local para não conflitar com o Render (evita erro 440 Conflict). Para testar localmente, defina ENABLE_LOCAL_WHATSAPP=true.');
    }

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
