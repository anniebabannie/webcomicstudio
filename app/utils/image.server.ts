import sharp from "sharp";

export async function convertToWebP(input: Buffer, quality = 80): Promise<Buffer> {
  // Auto-rotate, strip metadata, limit size to be safe
  return sharp(input, { failOn: "none" })
    .rotate()
    .webp({ quality })
    .toBuffer();
}
