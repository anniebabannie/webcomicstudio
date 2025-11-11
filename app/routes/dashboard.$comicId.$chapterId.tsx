import type { Route } from "./+types/dashboard.$comicId.$chapterId";
import { redirect, Link } from "react-router";
import { useState } from "react";
import { prisma } from "../utils/db.server";
import { getAuth } from "@clerk/react-router/server";

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: data?.chapter ? `${data.chapter.title} • WebComic Studio` : "Chapter • WebComic Studio" },
  ];
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  const { comicId, chapterId } = args.params;
  if (!comicId || !chapterId) throw new Response("Not Found", { status: 404 });

  // Verify comic ownership
  const comic = await prisma.comic.findFirst({
    where: { id: comicId, userId },
    select: { id: true, title: true },
  });
  if (!comic) return redirect("/dashboard");

  // Get chapter with pages
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, comicId },
    select: {
      id: true,
      number: true,
      title: true,
      pages: {
        select: {
          id: true,
          number: true,
          imageUrl: true,
        },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!chapter) throw new Response("Chapter Not Found", { status: 404 });

  return { comic, chapter };
}

export default function ChapterDetail({ loaderData }: Route.ComponentProps) {
  const data = loaderData as { comic: { id: string; title: string }; chapter: { id: string; number: number; title: string; pages: { id: string; number: number; imageUrl: string }[] } } | undefined;
  
  if (!data) {
    throw new Response("Not Found", { status: 404 });
  }

  const { comic, chapter } = data;

  const [reorderMode, setReorderMode] = useState(false);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to={`/dashboard/${comic.id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
        >
          <span className="mr-1">←</span> Back to {comic.title}
        </Link>
        <button
          type="button"
          onClick={() => setReorderMode(r => !r)}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white transition"
        >
          {reorderMode ? "Done" : "Reorder pages"}
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Chapter {chapter.number}: {chapter.title}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {chapter.pages.length} page{chapter.pages.length !== 1 ? "s" : ""}
        </p>
      </div>

      {reorderMode && (
        <div className="mb-8 rounded border border-dashed border-gray-300 dark:border-gray-700 p-6 text-sm text-gray-600 dark:text-gray-300">
          Reorder mode placeholder — drag-and-drop UI coming soon.
        </div>
      )}

      {!reorderMode && (
        chapter.pages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {chapter.pages.map((page) => (
              <div
                key={page.id}
                className="relative aspect-[2/3] rounded border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 overflow-hidden group"
              >
                <img
                  src={page.imageUrl}
                  alt={`Page ${page.number}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white font-medium">Page {page.number}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No pages in this chapter yet.</p>
          </div>
        )
      )}
    </main>
  );
}
