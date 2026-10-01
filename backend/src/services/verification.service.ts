import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../core/errors/app-error.js';
import { formatWhatsAppNumber } from '../utils/phone.util.js';
import { normalizeEmail } from '../utils/email.js';
import { whatsappService } from './whatsapp/whatsapp.service.js';

export type VerificationPurpose = 'REGISTER' | 'PASSWORD_RESET' | 'WHATSAPP_CONFIRM';

function createCode() {
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += String(randomInt(0, 10));
  }
  return code;
}

function verificationMessage(purpose: VerificationPurpose, code: string) {
  const intro =
    purpose === 'PASSWORD_RESET'
      ? 'Use o código abaixo para redefinir sua senha. Ele vale por 10 minutos. Não compartilhe este código.'
      : 'Use o código abaixo para confirmar seu WhatsApp. Ele vale por 10 minutos. Não compartilhe este código.';
  return `*Brisoft Portaria*\n${intro}\n\n*${code}*`;
}

export class VerificationService {
  async send(params: {
    email?: string;
    phone: string;
    purpose: VerificationPurpose;
    userId?: string;
    organizationId?: string;
  }) {
    const phone = formatWhatsAppNumber(params.phone);
    const email = params.email?.trim() ? normalizeEmail(params.email) : `wa-${phone}@pending.local`;
    const code = createCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationCode.deleteMany({
      where: { purpose: params.purpose, OR: [{ phone }, { email }] },
    });
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
      await whatsappService.sendVerificationMessage(
        params.organizationId,
        phone,
        verificationMessage(params.purpose, code)
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

  async matches(params: { email?: string; code: string; purpose: VerificationPurpose; phone?: string }) {
    const phone = params.phone ? formatWhatsAppNumber(params.phone) : undefined;
    const record = await prisma.verificationCode.findFirst({
      where:
        params.purpose === 'REGISTER' && phone
          ? { phone, purpose: params.purpose, expiresAt: { gt: new Date() } }
          : { email: normalizeEmail(params.email || ''), purpose: params.purpose, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new AppError('Código expirado ou inexistente. Peça um novo código.', 400, 'CODE_EXPIRED');
    }
    if (params.phone && params.purpose !== 'REGISTER' && formatWhatsAppNumber(params.phone) !== record.phone) {
      throw new AppError('O WhatsApp informado não é o mesmo que recebeu o código.', 400, 'PHONE_MISMATCH');
    }
    const ok = await bcrypt.compare(params.code.trim(), record.codeHash);
    if (!ok) {
      throw new AppError('Código incorreto.', 400, 'CODE_INVALID');
    }
    return record;
  }

  async consume(params: { email?: string; code: string; purpose: VerificationPurpose; phone?: string }) {
    const record = await this.matches(params);
    await prisma.verificationCode.delete({ where: { id: record.id } });
    return record;
  }
}

export const verificationService = new VerificationService();
