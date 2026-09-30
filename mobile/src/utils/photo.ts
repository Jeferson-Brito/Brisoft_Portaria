import { getBaseUrl } from '../config/api';

let accessToken: string | null = null;

export function setPhotoAccessToken(token: string | null) {
  accessToken = token;
}

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

  const baseUrl = getBaseUrl();
  return `${baseUrl}/visitors/photo/${encodeURIComponent(trimmed)}`;
};

export function getPhotoSource(photoUrl?: string | null): { uri: string; headers?: Record<string, string> } | null {
  const uri = getPhotoUri(photoUrl);
  if (!uri) return null;
  if (!uri.includes('/visitors/photo/') || !accessToken) {
    return { uri };
  }
  return {
    uri,
    headers: { Authorization: `Bearer ${accessToken}` },
  };
};
