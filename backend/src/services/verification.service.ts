import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../core/errors/app-error.js';
import { formatWhatsAppNumber } from '../utils/phone.util.js';
import { normalizeEmail } from '../utils/email.js';
import { whatsappService } from './whatsapp/whatsapp.service.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PURPOSE = {
  REGISTER: 'REGISTER',
  PASSWORD_RESET: 'PASSWORD_RESET',
  WHATSAPP_CONFIRM: 'WHATSAPP_CONFIRM',
} as const;

export type VerificationPurpose = (typeof PURPOSE)[keyof typeof PURPOSE];

function createCode() {
  let code = '';
  for (let index = 0; index < 8; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export class VerificationService {
  async send(params: { email: string; phone: string; purpose: VerificationPurpose; userId?: string }) {
    const email = normalizeEmail(params.email);
    const phone = formatWhatsAppNumber(params.phone);
    const code = createCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationCode.deleteMany({ where: { email, purpose: params.purpose } });
    const record = await prisma.verificationCode.create({
      data: {
        email,
        phone,
        purpose: params.purpose,
        codeHash,
        userId: params.userId,
        expiresAt,
      },
    });

    try {
      await whatsappService.sendPlatformMessage(
        phone,
        `*Brisoft Portaria*\nSeu código é *${code}*.\nEle vale por 10 minutos. Não compartilhe este código.`
      );
    } catch (err: any) {
      await prisma.verificationCode.delete({ where: { id: record.id } }).catch(() => {});
      throw new AppError(
        err?.message || 'O WhatsApp da plataforma não está conectado.',
        503,
        'PLATFORM_WHATSAPP_OFFLINE'
      );
    }
  }

  async matches(params: { email: string; code: string; purpose: VerificationPurpose; phone?: string }) {
    const email = normalizeEmail(params.email);
    const record = await prisma.verificationCode.findFirst({
      where: { email, purpose: params.purpose, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new AppError('Código expirado ou inexistente. Peça um novo código.', 400, 'CODE_EXPIRED');
    }
    if (params.phone && formatWhatsAppNumber(params.phone) !== record.phone) {
      throw new AppError('O WhatsApp informado não é o mesmo que recebeu o código.', 400, 'PHONE_MISMATCH');
    }
    const ok = await bcrypt.compare(params.code.trim().toUpperCase(), record.codeHash);
    if (!ok) {
      throw new AppError('Código incorreto.', 400, 'CODE_INVALID');
    }
    return record;
  }

  async consume(params: { email: string; code: string; purpose: VerificationPurpose; phone?: string }) {
    const record = await this.matches(params);
    await prisma.verificationCode.delete({ where: { id: record.id } });
    return record;
  }
}

export const verificationService = new VerificationService();
