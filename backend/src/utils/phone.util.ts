export function formatWhatsAppNumber(phone: string): string {
  // Remove tudo que não for dígito
  let cleaned = phone.replace(/\D/g, '');

  // Se começar com 0, remove
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Se não tiver o DDI do Brasil (55) e tiver 10 ou 11 dígitos, adiciona o 55
  if ((cleaned.length === 10 || cleaned.length === 11) && !cleaned.startsWith('55')) {
    cleaned = `55${cleaned}`;
  }

  // Validação: no Brasil um número com DDI 55 tem entre 12 e 13 dígitos (55 + DDD de 2 dígitos + 8 ou 9 dígitos)
  if (cleaned.length < 12 || cleaned.length > 13) {
    throw new Error('Número de WhatsApp inválido. Informe o DDD e o número completo.');
  }

  return cleaned;
}

/** Formas equivalentes de um celular brasileiro, com e sem o 9 depois do DDD. */
export function whatsappDigitForms(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length < 10) return [];

  const forms = new Set<string>([local, `55${local}`]);
  if (local.length === 11 && local[2] === '9') {
    const withoutNine = `${local.slice(0, 2)}${local.slice(3)}`;
    forms.add(withoutNine);
    forms.add(`55${withoutNine}`);
  }
  if (local.length === 10) {
    const withNine = `${local.slice(0, 2)}9${local.slice(2)}`;
    forms.add(withNine);
    forms.add(`55${withNine}`);
  }
  return [...forms];
}

export function sameWhatsappNumber(left: string, right: string): boolean {
  const forms = new Set(whatsappDigitForms(left));
  return whatsappDigitForms(right).some((form) => forms.has(form));
}
