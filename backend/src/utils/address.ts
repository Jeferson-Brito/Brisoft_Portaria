export function readOrganizationAddress(settings?: string | null) {
  if (!settings) return '';
  try {
    const parsed = JSON.parse(settings);
    return typeof parsed.address === 'string' ? parsed.address.trim() : '';
  } catch {
    return '';
  }
}

export function navigationLinks(address: string) {
  const query = encodeURIComponent(address);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    waze: `https://waze.com/ul?q=${query}&navigate=yes`,
  };
}
