import type { Route } from "./+types/dashboard.$comicId.update";
import { getAuth } from "@clerk/react-router/server";
import { redirect, Form } from "react-router";
import { prisma } from "../utils/db.server";

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
      <h1 className="text-2xl font-bold tracking-tight mb-6">Add Pages</h1>

      {!hasChapters && (
        <div className="mb-8 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">This comic currently has no chapters. You can create one below or upload pages without a chapter.</p>
          <details className="rounded border border-gray-300 dark:border-gray-700 p-4">
            <summary className="cursor-pointer font-medium">Add Chapter</summary>
            <Form method="post" className="mt-4 space-y-4">
              <input type="hidden" name="intent" value="createChapter" />
              <div>
                <label htmlFor="chapterTitle" className="block text-sm font-medium mb-1">Chapter Title</label>
                <input
                  id="chapterTitle"
                  name="chapterTitle"
                  type="text"
                  required
                  placeholder="e.g. The Journey Begins"
                  className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition"
              >
                Create Chapter
              </button>
            </Form>
          </details>
        </div>
      )}

      <Form method="post" encType="multipart/form-data" className="space-y-8">
        <input type="hidden" name="intent" value="uploadPages" />
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-500 uppercase">Page Images</legend>
          <input
            type="file"
            name="pages"
            multiple
            accept="image/*"
            className="block w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3 text-sm"
            required
          />
          <p className="text-xs text-gray-500">Select image files (PNG/JPG/WebP).</p>
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

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const comicId = params.comicId as string;

  if (intent === "createChapter") {
    const title = String(formData.get("chapterTitle") || "").trim();
    if (!title) return new Response("Title required", { status: 400 });
    const count = await prisma.chapter.count({ where: { comicId } });
    const number = count + 1; // next sequential number
    await prisma.chapter.create({ data: { comicId, title, number } });
    return redirect(`/dashboard/${comicId}/update`);
  }

  if (intent === "uploadPages") {
    const files = formData.getAll("pages");
    if (files.length === 0) return new Response("No files uploaded", { status: 400 });
    // Placeholder: store files & create Page rows later
    return redirect(`/dashboard/${comicId}`);
  }

  return new Response("Unknown intent", { status: 400 });
}
