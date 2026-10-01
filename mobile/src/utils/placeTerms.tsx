import React, { createContext, useContext, useMemo } from 'react';

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

export function buildPlaceTerms(clientLabel?: string, unitLabel?: string): PlaceTerms {
  const client = firstTerm(clientLabel, 'Morador');
  const unit = firstTerm(unitLabel, 'Unidade');
  return {
    client,
    clients: pluralizePt(client),
    unit,
    units: pluralizePt(unit),
  };
}

const PlaceTermsContext = createContext<PlaceTerms>(buildPlaceTerms());

export function PlaceTermsProvider({
  clientLabel,
  unitLabel,
  children,
}: {
  clientLabel?: string;
  unitLabel?: string;
  children: React.ReactNode;
}) {
  const value = useMemo(() => buildPlaceTerms(clientLabel, unitLabel), [clientLabel, unitLabel]);
  return <PlaceTermsContext.Provider value={value}>{children}</PlaceTermsContext.Provider>;
}

export function usePlaceTerms() {
  return useContext(PlaceTermsContext);
}
