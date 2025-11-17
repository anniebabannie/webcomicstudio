import type { Route } from "./+types/api.og-image.$comicId";
import { prisma } from "../utils/db.server";
import { generateSocialImage } from "../utils/social-image.server";

export async function loader(args: Route.LoaderArgs) {
  const { comicId } = args.params;
  
  if (!comicId) {
    throw new Response("Not Found", { status: 404 });
  }
  
  // Fetch comic title and tagline (public data, no auth required)
  const comic = await prisma.comic.findUnique({
    where: { id: comicId },
    select: { title: true, tagline: true },
  });
  
  if (!comic) {
    throw new Response("Not Found", { status: 404 });
  }
  
  // Generate the social image
  const imageBuffer = await generateSocialImage(comic.title, comic.tagline);
  
  // Convert Buffer to Uint8Array for Response
  const uint8Array = new Uint8Array(imageBuffer);
  
  // Return as PNG with cache headers
  return new Response(uint8Array, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=86400", // Cache for 24 hours
    },
  });
}
