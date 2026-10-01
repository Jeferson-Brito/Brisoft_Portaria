import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_URL: z.string().default('http://localhost:3333'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  DIRECT_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16).default('combate_portaria_jwt_secret_dev_local_super_safe_key_123456'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  JWT_REFRESH_SECRET: z.string().min(16).default('combate_portaria_refresh_secret_dev_local_123456'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().optional(),
  PUBLIC_WEB_URL: z.string().optional(),
  WHATSAPP_SESSION_PATH: z.string().default('./whatsapp_sessions'),
  WHATSAPP_AUTO_RECONNECT: z.coerce.boolean().default(true),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET_VISITORS: z.string().default('visitor-photos'),
  STRIPE_WEBHOOK_SECRET: z.string().min(8).optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Erro de validação das variáveis de ambiente:', _env.error.format());
  throw new Error('Variáveis de ambiente inválidas');
}

export const env = _env.data;

const DEFAULT_SECRETS = new Set([
  'combate_portaria_jwt_secret_dev_local_super_safe_key_123456',
  'combate_portaria_refresh_secret_dev_local_123456',
]);

if (env.NODE_ENV === 'production') {
  if (DEFAULT_SECRETS.has(env.JWT_SECRET) || env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET padrão ou curto demais. Defina um segredo próprio com pelo menos 32 caracteres em produção.');
  }
  if (
    DEFAULT_SECRETS.has(env.JWT_REFRESH_SECRET) ||
    env.JWT_REFRESH_SECRET.length < 32 ||
    env.JWT_REFRESH_SECRET === env.JWT_SECRET
  ) {
    throw new Error('JWT_REFRESH_SECRET deve ser próprio, ter pelo menos 32 caracteres e ser diferente do JWT_SECRET.');
  }
}
