import { FastifyInstance } from 'fastify';
import { VisitRequestController } from './visit-request.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { subscriptionGuard } from '../../middlewares/subscription.middleware.js';

const visitRequestController = new VisitRequestController();

export async function visitRequestRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', async (request, reply) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return subscriptionGuard(request, reply);
    }
  });

  // Criar nova solicitação de acesso (+ Nova Solicitação)
  app.post('/', {
    handler: visitRequestController.create.bind(visitRequestController),
  });

  // Listar solicitações em aberto (PENDING) com timer do servidor
  app.get('/pending', {
    handler: visitRequestController.listPending.bind(visitRequestController),
  });

  // Resumo de contadores para o Dashboard
  app.get('/summary', {
    handler: visitRequestController.getSummary.bind(visitRequestController),
  });

  // Histórico geral com filtros e busca
  app.get('/history', {
    handler: visitRequestController.listHistory.bind(visitRequestController),
  });

  // Detalhes completos e timeline de eventos da visita
  app.get('/:id', {
    handler: visitRequestController.getById.bind(visitRequestController),
  });

  // Reenviar cobrança no WhatsApp (limite de 3)
  app.post('/:id/remind', {
    handler: visitRequestController.remind.bind(visitRequestController),
  });

  // Cancelar solicitação aberta
  app.post('/:id/cancel', {
    handler: visitRequestController.cancel.bind(visitRequestController),
  });

  // Autorização manual de contingência (ex: morador autorizou por interfone/ligação)
  app.post('/:id/authorize-manual', {
    handler: visitRequestController.manualAuthorize.bind(visitRequestController),
  });

  // Listar visitantes presentes no local (Seção 30)
  app.get('/present', {
    handler: visitRequestController.listPresent.bind(visitRequestController),
  });

  // Registrar entrada física no local (AUTHORIZED -> ENTERED)
  app.post('/:id/entry', {
    handler: visitRequestController.registerEntry.bind(visitRequestController),
  });

  // Registrar saída física do local (ENTERED -> EXITED)
  app.post('/:id/exit', {
    handler: visitRequestController.registerExit.bind(visitRequestController),
  });
}
