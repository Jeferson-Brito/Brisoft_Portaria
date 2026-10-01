export type PlaceTerms = {
  client: string;
  clients: string;
  unit: string;
  units: string;
};

function firstTerm(label: string | undefined, fallback: string) {
  const raw = (label || '').split('/')[0]?.trim();
  return raw || fallback;
}

function pluralizePt(word: string) {
  const value = word.trim();
  if (!value || /(s|x|z)$/i.test(value)) return value;
  if (/ão$/i.test(value)) return value.replace(/ão$/i, 'ões');
  if (/r$/i.test(value)) return `${value}es`;
  if (/m$/i.test(value)) return `${value.slice(0, -1)}ns`;
  if (/l$/i.test(value)) return `${value.slice(0, -1)}is`;
  return `${value}s`;
}

export function placeTermsFromSettings(settingsJson?: string | null): PlaceTerms {
  let settings: { clientLabel?: string; unitLabel?: string } = {};
  try {
    settings = settingsJson ? JSON.parse(settingsJson) : {};
  } catch {}
  const client = firstTerm(settings.clientLabel, 'Morador');
  const unit = firstTerm(settings.unitLabel, 'Unidade');
  return {
    client,
    clients: pluralizePt(client),
    unit,
    units: pluralizePt(unit),
  };
}
