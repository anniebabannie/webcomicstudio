/**
 * Extract subdomain from host header
 * Examples:
 *   mycomic.localhost:3000 → "mycomic"
 *   mycomic.lvh.me:3000 → "mycomic"
 *   localhost:3000 → null
 *   webcomicstudio.com → null
 */
export function extractSubdomain(host: string | null): string | null {
  if (!host) return null;

  // Remove port if present
  const hostname = host.split(':')[0];

  // Split by dots
  const parts = hostname.split('.');

  // If only one part (e.g., "localhost"), no subdomain
  if (parts.length <= 1) return null;

  // If two parts, check if it's localhost in development
  if (parts.length === 2) {
    const isDev = process.env.NODE_ENV === 'development';
    const isLocalhost = parts[1] === 'localhost';
    
    // In dev with "subdomain.localhost", the first part is the subdomain
    if (isDev && isLocalhost) {
      const subdomain = parts[0];
      // Exclude "www" as a valid subdomain
      if (subdomain === 'www') return null;
      return subdomain;
    }
    
    // Production two-part domains (e.g., "lvh.me", "example.com") have no subdomain
    return null;
  }

  // If three or more parts, first part is subdomain
  // e.g., "mycomic.lvh.me" → ["mycomic", "lvh", "me"]
  const subdomain = parts[0];

  // Exclude "www" as a valid subdomain
  if (subdomain === 'www') return null;

  return subdomain;
}
