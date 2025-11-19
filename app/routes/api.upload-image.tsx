import type { Route } from "./+types/api.upload-image";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { uuidv4 } from "../utils/uuid";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const file = formData.get("image") as File;
  const userId = formData.get("userId") as string;
  const comicId = formData.get("comicId") as string;
  const sitePageId = formData.get("sitePageId") as string;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (!userId || !comicId || !sitePageId) {
    return Response.json({ error: "User ID, Comic ID, and Site Page ID are required" }, { status: 400 });
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "File must be an image" }, { status: 400 });
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return Response.json({ error: "File size must be less than 5MB" }, { status: 400 });
  }

  try {
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || "auto",
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const fileExtension = file.name.split(".").pop();
    const key = `${userId}/${comicId}/site-page-images/${sitePageId}/${uuidv4()}.${fileExtension}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const imageUrl = `${process.env.AWS_ENDPOINT_URL_S3}/${process.env.BUCKET_NAME}/${key}`;

    return Response.json({ url: imageUrl });
  } catch (error) {
    console.error("Error uploading image:", error);
    return Response.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
