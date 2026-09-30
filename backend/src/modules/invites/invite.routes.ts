import { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';
import { prisma } from '../../lib/prisma.js';

export function inviteUrl(token: string) {
  const base = (process.env.PUBLIC_WEB_URL || 'https://portaria.brisoft.com.br').replace(/\/$/, '');
  return `${base}/convite/${encodeURIComponent(token)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value: Date) {
  return value.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export async function invitePageRoutes(app: FastifyInstance) {
  app.get('/convite/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const item = await prisma.preAuthorization.findFirst({
      where: { qrToken: token.trim().toUpperCase() },
      include: {
        organization: { select: { name: true } },
        destination: { select: { name: true, block: true } },
      },
    });

    if (!item) {
      return reply.type('text/html').send(page('Convite não encontrado', 'Este código não corresponde a uma visita.', ''));
    }

    const now = new Date();
    let status = 'Apresente este QR Code na portaria.';
    if (item.cancelledAt) status = 'Este convite foi cancelado.';
    else if (item.isUsed) status = 'Este convite já foi utilizado.';
    else if (now < item.startDate || now > item.endDate) status = 'Este convite está fora do período autorizado.';

    const qr = await QRCode.toDataURL(item.qrToken || token, { width: 320, margin: 1 });
    const unit = `${item.destination.name}${item.destination.block ? ` · ${item.destination.block}` : ''}`;
    const body = `
      <p class="place">${escapeHtml(item.organization.name)}</p>
      <p class="unit">${escapeHtml(unit)}</p>
      <p class="who">${escapeHtml(item.visitorName)}</p>
      <p>Data: ${formatDate(item.startDate)}</p>
      <p>Horário: ${escapeHtml(item.expectedTimeStart || '00:00')} às ${escapeHtml(item.expectedTimeEnd || '23:59')}</p>
      <img alt="QR Code do convite" src="${qr}" />
      <p class="code">${escapeHtml(item.qrToken || '')}</p>
      <p class="status">${escapeHtml(status)}</p>
    `;
    return reply.type('text/html').send(page('Convite de visita', '', body));
  });
}

function page(title: string, message: string, body: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: sans-serif; background: #F4F7F5; color: #0F172A; }
    main { max-width: 420px; margin: 0 auto; padding: 28px 20px 40px; text-align: center; }
    h1 { color: #165337; font-size: 22px; }
    .place { font-size: 18px; font-weight: 700; margin-bottom: 0; }
    .unit, .who { color: #475569; }
    img { width: 240px; height: 240px; background: white; padding: 12px; border-radius: 16px; }
    .code { letter-spacing: 1px; font-weight: 700; color: #165337; }
    .status { line-height: 1.4; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    ${message ? `<p>${escapeHtml(message)}</p>` : ''}
    ${body}
  </main>
</body>
</html>`;
}
