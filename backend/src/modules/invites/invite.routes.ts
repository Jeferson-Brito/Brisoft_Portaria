import { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';
import { prisma } from '../../lib/prisma.js';
import { matchesWeekday, weekdayLabels } from '../../utils/weekdays.js';
import { navigationLinks, readOrganizationAddress } from '../../utils/address.js';

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
        client: { select: { name: true } },
        organization: { select: { name: true, settings: true } },
        destination: { select: { name: true, block: true } },
      },
    });

    if (!item) {
      return reply.type('text/html').send(renderPage({
        title: 'Convite não encontrado',
        missing: true,
      }));
    }

    const now = new Date();
    let tone: 'ok' | 'warn' | 'bad' = 'ok';
    let status = 'Apresente este QR Code na portaria.';
    if (item.cancelledAt) {
      tone = 'bad';
      status = 'Este convite foi cancelado.';
    } else if (item.isUsed && !item.weekdays) {
      tone = 'warn';
      status = 'Este convite já foi utilizado.';
    } else if (now < item.startDate || now > item.endDate) {
      tone = 'bad';
      status = 'Este convite está fora do período autorizado.';
    } else if (item.weekdays && !matchesWeekday(item.weekdays, now)) {
      tone = 'warn';
      status = 'Este convite não vale neste dia da semana.';
    }

    const address = readOrganizationAddress(item.organization.settings);
    const links = address ? navigationLinks(address) : null;
    const qr = await QRCode.toDataURL(item.qrToken || token, { width: 480, margin: 1 });
    const unit = `${item.destination.name}${item.destination.block ? ` · ${item.destination.block}` : ''}`;
    const when = item.weekdays
      ? `Repete ${weekdayLabels(item.weekdays)}, até ${formatDate(item.endDate)}`
      : formatDate(item.startDate);

    return reply.type('text/html').send(renderPage({
      title: 'Convite de visita',
      place: item.organization.name,
      unit,
      host: item.client.name,
      visitor: item.visitorName,
      when,
      time: `${item.expectedTimeStart || '00:00'} às ${item.expectedTimeEnd || '23:59'}`,
      address,
      google: links?.google,
      waze: links?.waze,
      qr,
      code: item.qrToken || '',
      status,
      tone,
    }));
  });
}

function renderPage(data: {
  title: string;
  missing?: boolean;
  place?: string;
  unit?: string;
  host?: string;
  visitor?: string;
  when?: string;
  time?: string;
  address?: string;
  google?: string;
  waze?: string;
  qr?: string;
  code?: string;
  status?: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const maps = data.address
    ? `<section class="route">
        <p class="label">Como chegar</p>
        <p class="address">${escapeHtml(data.address || '')}</p>
        <div class="apps">
          <a class="app maps" href="${escapeHtml(data.google || '#')}">
            <span class="pin" aria-hidden="true"></span>
            Google Maps
          </a>
          <a class="app waze" href="${escapeHtml(data.waze || '#')}">
            <span class="bubble" aria-hidden="true"></span>
            Waze
          </a>
        </div>
      </section>`
    : '';

  const body = data.missing
    ? `<p class="status bad">Este código não corresponde a uma visita.</p>`
    : `
      ${maps}
      <section class="details">
        <div><span>Convidado por</span><strong>${escapeHtml(data.host || '')}</strong></div>
        <div><span>Visitante</span><strong>${escapeHtml(data.visitor || '')}</strong></div>
        <div><span>Quando</span><strong>${escapeHtml(data.when || '')}</strong></div>
        <div><span>Horário</span><strong>${escapeHtml(data.time || '')}</strong></div>
      </section>
      <div class="qr">
        <img alt="QR Code do convite" src="${data.qr || ''}" />
        <p class="code">${escapeHtml(data.code || '')}</p>
      </div>
      <p class="status ${data.tone || 'ok'}">${escapeHtml(data.status || '')}</p>
    `;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", sans-serif; background: #E7F0EA; color: #0F172A; }
    main { max-width: 440px; margin: 0 auto; padding: 24px 16px 40px; }
    .card { background: #fff; border-radius: 28px; overflow: hidden; box-shadow: 0 16px 40px rgba(22, 83, 55, 0.12); }
    .hero { background: #165337; color: #fff; padding: 28px 24px 22px; text-align: center; }
    h1 { margin: 0; font-size: 13px; letter-spacing: 1.4px; text-transform: uppercase; font-weight: 700; color: #A7F3D0; }
    .place { margin: 8px 0 0; font-size: 26px; font-weight: 800; color: #fff; }
    .unit { margin: 4px 0 0; color: #D1FAE5; }
    .body { padding: 22px 22px 28px; }
    .route { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 18px; padding: 14px; margin-top: 18px; }
    .label { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; color: #64748B; }
    .address { margin: 6px 0 12px; font-size: 15px; line-height: 1.4; }
    .apps { display: flex; gap: 10px; }
    .app { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 14px; }
    .maps { background: #fff; color: #1A73E8; border: 1px solid #D0E2FF; }
    .waze { background: #33CCFF; color: #083344; }
    .pin { width: 14px; height: 14px; border-radius: 50% 50% 50% 0; background: #EA4335; transform: rotate(-45deg); }
    .bubble { width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: inset 0 0 0 2px #083344; }
    .details { margin-top: 18px; display: grid; gap: 12px; }
    .details div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #F1F5F9; padding-bottom: 10px; }
    .details span { color: #64748B; font-size: 13px; }
    .details strong { text-align: right; }
    .qr { margin-top: 18px; text-align: center; }
    img { width: 230px; height: 230px; background: #fff; padding: 10px; border-radius: 20px; border: 1px solid #E2E8F0; }
    .code { letter-spacing: 1px; font-weight: 800; color: #165337; margin: 8px 0 0; }
    .status { margin: 16px 0 0; padding: 12px 14px; border-radius: 14px; line-height: 1.4; text-align: center; font-weight: 700; }
    .ok { background: #DCFCE7; color: #166534; }
    .warn { background: #FEF3C7; color: #92400E; }
    .bad { background: #FEE2E2; color: #991B1B; }
  </style>
</head>
<body>
  <main>
    <article class="card">
      <header class="hero">
        <h1>${escapeHtml(data.title)}</h1>
        ${data.place ? `<p class="place">${escapeHtml(data.place)}</p><p class="unit">${escapeHtml(data.unit || '')}</p>` : ''}
      </header>
      <div class="body">
        ${body}
      </div>
    </article>
  </main>
</body>
</html>`;
}
