/**
 * Derives the thumbnail URL from a full image URL by inserting "-thumbnail" before the extension
 * Example: "image.webp" -> "image-thumbnail.webp"
 */
export function getThumbnailUrl(imageUrl: string): string {
  const lastDotIndex = imageUrl.lastIndexOf('.');
  if (lastDotIndex === -1) return imageUrl; // No extension found, return original
  
  return imageUrl.slice(0, lastDotIndex) + '-thumbnail' + imageUrl.slice(lastDotIndex);
}
