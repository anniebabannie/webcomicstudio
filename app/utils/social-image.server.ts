import sharp from "sharp";

/**
 * Generate a social sharing image (1200x630) with gradient background and comic title
 * Uses the same indigo-pink gradient as the WebComic Studio branding
 */
export async function generateSocialImage(title: string, tagline?: string | null): Promise<Buffer> {
  const width = 1200;
  const height = 630;
  
  // Escape XML special characters in title
  const escapedTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
  
  const escapedTagline = tagline
    ? tagline
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
    : null;
  
  // Create SVG with gradient background (indigo -> purple -> pink) and centered white text
  // Using Tailwind colors: indigo-500 (#6366f1), purple-500 (#a855f7), pink-500 (#ec4899)
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#a855f7;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)"/>
      <text 
        x="50%" 
        y="${escapedTagline ? '45%' : '50%'}" 
        text-anchor="middle" 
        dominant-baseline="middle"
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="80" 
        font-weight="700"
        fill="white"
      >${escapedTitle}</text>
      ${escapedTagline ? `
      <text 
        x="50%" 
        y="58%" 
        text-anchor="middle" 
        dominant-baseline="middle"
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="40" 
        font-weight="400"
        fill="white"
        opacity="0.7"
      >${escapedTagline}</text>
      ` : ''}
    </svg>
  `;
  
  // Convert SVG to PNG buffer
  const buffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  
  return buffer;
}
