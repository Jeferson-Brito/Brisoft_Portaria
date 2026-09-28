import { getBaseUrl } from '../config/api';

/**
 * Normaliza qualquer referência de foto (ID do photo_storage, URL relativa, Base64 ou URL absoluta)
 * para uma URL/URI válida que o componente <Image source={{ uri }} /> do React Native consiga carregar.
 */
export const getPhotoUri = (photoUrl?: string | null): string | null => {
  if (!photoUrl) return null;
  const trimmed = photoUrl.trim();
  if (trimmed.length === 0) return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image') ||
    trimmed.startsWith('file://')
  ) {
    return trimmed;
  }

  // Se for ID do storage (ex: supa_photo_... ou filename relativo), monta a URL da API
  const baseUrl = getBaseUrl();
  return `${baseUrl}/visitors/photo/${encodeURIComponent(trimmed)}`;
};