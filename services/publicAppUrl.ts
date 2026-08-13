/**
 * Origin of the public Nuxt app — where printed QR codes resolve to.
 *
 * This is not the dashboard and not any of the API services, so it cannot be
 * derived from the base URLs in apiClient.ts. Everything that builds a
 * user-facing link (team contact cards, promo redemption) shares this one value,
 * so a wrong origin is a single fix rather than a hunt through call sites.
 */
export const PUBLIC_APP_URL = (
  import.meta.env.VITE_PUBLIC_APP_URL || 'https://medicalstudent.ai'
).replace(/\/+$/, '');

export const publicAppUrl = (path: string): string =>
  `${PUBLIC_APP_URL}${path.startsWith('/') ? path : `/${path}`}`;
