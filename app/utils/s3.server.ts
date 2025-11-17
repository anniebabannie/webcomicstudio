import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.BUCKET_NAME!;

export async function uploadToS3(
  file: File,
  key: string
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  );

  // Return public URL (Tigris public bucket format)
  return `https://${BUCKET_NAME}.t3.storage.dev/${key}`;
}

export async function uploadBufferToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return `https://${BUCKET_NAME}.t3.storage.dev/${key}`;
}

/** Delete a single object by key */
export async function deleteS3Key(key: string): Promise<void> {
  if (!key) return;
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    );
  } catch (err) {
    // Best-effort; log and continue
    console.error("S3 delete failed for key", key, err);
  }
}

/** Delete many objects by keys efficiently */
export async function deleteS3Keys(keys: string[]): Promise<void> {
  const filtered = Array.from(new Set(keys.filter(Boolean)));
  if (filtered.length === 0) return;
  // Batch in chunks of 1000 (S3 limit per DeleteObjects)
  const chunkSize = 900;
  for (let i = 0; i < filtered.length; i += chunkSize) {
    const chunk = filtered.slice(i, i + chunkSize);
    try {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: chunk.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      );
    } catch (err) {
      console.error("S3 bulk delete failed", err);
      // Fallback: try individually to maximize cleanup
      await Promise.all(chunk.map((k) => deleteS3Key(k)));
    }
  }
}
