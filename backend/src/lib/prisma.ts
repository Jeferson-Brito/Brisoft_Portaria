import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// O pooler em modo transação (porta 6543, pgbouncer=true) gasta umas quatro idas
// e voltas por consulta; o modo sessão (DIRECT_URL, porta 5432) reaproveita as
// consultas preparadas. O limite precisa caber no pool de sessão do Supabase,
// que é compartilhado com o prisma db push e com a instância antiga durante o deploy.
function runtimeDatabaseUrl() {
  const raw = env.DIRECT_URL || env.DATABASE_URL;
  if (!raw.startsWith('postgres')) return raw;
  const url = new URL(raw);
  if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '5');
  return url.toString();
}

export const prisma = new PrismaClient({
  datasources: { db: { url: runtimeDatabaseUrl() } },
  log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});
