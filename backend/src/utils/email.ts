const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'guerrillamail.de',
  'sharklasers.com',
  'grr.la',
  'mailinator.com',
  'mailinator.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'trashmail.com',
  'trashmail.de',
  'trash-mail.com',
  'dispostable.com',
  'discard.email',
  'fakeinbox.com',
  'getnada.com',
  'nada.email',
  'maildrop.cc',
  'mintemail.com',
  'mohmal.com',
  'throwawaymail.com',
  'mailnesia.com',
  'spamgourmet.com',
  'tempail.com',
  'emailondeck.com',
  'moakt.com',
  'moakt.cc',
  'inboxkitten.com',
  'getairmail.com',
  'dropmail.me',
  'mail.tm',
  'tmpmail.org',
  'tmpmail.net',
  'guerrillamailblock.com',
  'pokemail.net',
  'spam4.me',
  'mytemp.email',
  'tempinbox.com',
  'mailcatch.com',
  'mailexpire.com',
  'tempr.email',
  'discardmail.com',
  'discardmail.de',
  'jetable.org',
  'trbvm.com',
  'vortexmail.org',
]);

export function normalizeEmail(email: string) {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at < 1) return lower;

  let local = lower.slice(0, at);
  let domain = lower.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') {
    local = local.split('+')[0].replace(/\./g, '');
  }
  return `${local}@${domain}`;
}

export function isDisposableEmail(email: string) {
  const normalized = normalizeEmail(email);
  const domain = normalized.slice(normalized.lastIndexOf('@') + 1);
  return DISPOSABLE_DOMAINS.has(domain);
}

export function isGmailAddress(email: string) {
  const lower = email.trim().toLowerCase();
  return lower.endsWith('@gmail.com') || lower.endsWith('@googlemail.com');
}
