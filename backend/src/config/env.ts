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
