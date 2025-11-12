import sharp from "sharp";

export async function convertToWebP(input: Buffer, quality = 75, maxWidth = 1500): Promise<Buffer> {
  // Auto-rotate, strip metadata, resize if too large, optimize compression
  const image = sharp(input, { failOn: "none" })
    .rotate();
  
  // Get metadata to check dimensions
  const metadata = await image.metadata();
  
  // Resize if width exceeds maxWidth (maintains aspect ratio)
  if (metadata.width && metadata.width > maxWidth) {
    image.resize(maxWidth, null, { 
      fit: "inside",
      withoutEnlargement: false 
    });
  }
  
  return image
    .webp({ 
      quality,
      effort: 6 // 0-6, higher = better compression (slower), default 4
    })
    .toBuffer();
}

export async function generateThumbnail(input: Buffer, maxWidth = 400, quality = 75): Promise<Buffer> {
  // Generate thumbnail: resize to max width, maintain aspect ratio
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(maxWidth, null, { 
      fit: "inside",
      withoutEnlargement: true 
    })
    .webp({ 
      quality,
      effort: 6 
    })
    .toBuffer();
}
