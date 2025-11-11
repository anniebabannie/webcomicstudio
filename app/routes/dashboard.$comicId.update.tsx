import type { Route } from "./+types/dashboard.$comicId.update";
import { getAuth } from "@clerk/react-router/server";
import { redirect, Form, Link } from "react-router";
import { prisma } from "../utils/db.server";
import { uuidv4 } from "../utils/uuid"; // pure client-safe

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  const { comicId } = args.params;
  if (!comicId) throw new Response("Not Found", { status: 404 });
  // Ensure comic belongs to user (basic check)
  const comic = await prisma.comic.findFirst({ where: { id: comicId, userId }, select: { id: true } });
  if (!comic) return redirect("/dashboard");
  const chapters = await prisma.chapter.findMany({
    where: { comicId },
    select: { id: true, number: true, title: true },
    orderBy: { number: "asc" },
  });
  return { comicId, chapters };
}

export default function UpdateComic({ loaderData }: Route.ComponentProps) {
  const { comicId, chapters } = loaderData as {
    comicId: string;
    chapters: { id: string; number: number; title: string }[];
  };
  const hasChapters = chapters.length > 0;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2">
        <Link to={`/dashboard/${comicId}`} className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white">
          <span className="mr-1">←</span> Back to comic
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Add Pages</h1>

      <Form method="post" encType="multipart/form-data" className="space-y-8" onSubmit={e => {
        const input = (e.currentTarget.elements.namedItem("pages") as HTMLInputElement);
        if (input && input.files) {
          for (const file of input.files) {
            const validTypes = ["image/jpeg", "image/png", "image/webp"];
            if (!validTypes.includes(file.type)) {
              e.preventDefault();
              alert("Only JPEG, PNG, or WebP images are allowed.");
              return;
            }
            if (file.size > 2 * 1024 * 1024) {
              e.preventDefault();
              alert("Each file must be 2MB or smaller.");
              return;
            }
          }
        }
      }}>
        <input type="hidden" name="intent" value="uploadPages" />
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-500 uppercase">Page Images</legend>
          <input
            type="file"
            name="pages"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="block w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3 text-sm"
            required
          />
          <p className="text-xs text-gray-500">Select JPEG, PNG, or WebP images (max 2MB each).</p>
        </fieldset>

        {hasChapters && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-gray-500 uppercase">Chapter</legend>
            <select
              name="chapterId"
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">No Chapter (standalone pages)</option>
              {chapters.map(c => (
                <option key={c.id} value={c.id}>Chapter {c.number}: {c.title}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Choose a chapter or leave blank.</p>
          </fieldset>
        )}

        {!hasChapters && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-gray-500 uppercase">New Chapter</legend>
            <input
              type="text"
              name="newChapterTitle"
              placeholder="Enter chapter title"
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500">Leave blank to create pages without a chapter.</p>
          </fieldset>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition"
          >
            Upload Pages
          </button>
          <a
            href={`/dashboard/${comicId}`}
            className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-medium bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 transition"
          >
            Cancel
          </a>
        </div>
      </Form>
    </main>
  );
}

export async function action(args: Route.ActionArgs) {
  const { request, params } = args;
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const comicId = params.comicId as string;

  // Verify comic ownership
  const comic = await prisma.comic.findFirst({ where: { id: comicId, userId }, select: { id: true } });
  if (!comic) return redirect("/dashboard");

  if (intent === "uploadPages") {
    const files = formData.getAll("pages") as File[];
    if (files.length === 0) return new Response("No files uploaded", { status: 400 });

    // Sort files alphabetically by filename
    const sortedFiles = files.slice().sort((a, b) => a.name.localeCompare(b.name));

    // Check for new chapter title or existing chapter selection
    const newChapterTitle = String(formData.get("newChapterTitle") || "").trim();
    const selectedChapterId = String(formData.get("chapterId") || "").trim();
    
    let chapterId: string | null = null;
    
    // Create new chapter if title provided
    if (newChapterTitle) {
      const count = await prisma.chapter.count({ where: { comicId } });
      const number = count + 1;
      const newChapter = await prisma.chapter.create({
        data: { comicId, title: newChapterTitle, number },
      });
      chapterId = newChapter.id;
    } else if (selectedChapterId) {
      // Validate selected chapter belongs to this comic
      const exists = await prisma.chapter.findFirst({
        where: { id: selectedChapterId, comicId },
        select: { id: true },
      });
      chapterId = exists ? exists.id : null;
    }

    // Get next page number for this context (chapter or comic)
    const maxPage = await prisma.page.findFirst({
      where: { comicId, chapterId: chapterId ?? null },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    let nextPageNumber = (maxPage?.number ?? 0) + 1;

    // Upload files to S3 and create page records
  // Dynamic import server-only modules to avoid client bundle inclusion
  const { uploadBufferToS3 } = await import("../utils/s3.server");
  const { convertToWebP } = await import("../utils/image.server");

  for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      const pageNumber = nextPageNumber + i;
      // Convert to WebP in-memory
      const original = Buffer.from(await file.arrayBuffer());
      const webp = await convertToWebP(original, 82);
      const ext = 'webp';
      const uuid = uuidv4();
      const s3Key = `${userId}/${comicId}/${pageNumber}-${uuid}.${ext}`;
      const imageUrl = await uploadBufferToS3(webp, s3Key, 'image/webp');
      await prisma.page.create({
        data: {
          comicId,
          chapterId,
          imageUrl,
          number: pageNumber,
        },
      });
    }

    return redirect(`/dashboard/${comicId}`);
  }

  return new Response("Unknown intent", { status: 400 });
}
