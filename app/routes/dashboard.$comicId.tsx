import type { Route } from "./+types/dashboard.$comicId";
import { redirect, Link, Form, useNavigation } from "react-router";
import { useEffect, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { prisma } from "../utils/db.server";
import { getAuth } from "@clerk/react-router/server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Comic • WebComic Studio" },
  ];
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  const { comicId } = args.params;
  if (!comicId) throw new Response("Not Found", { status: 404 });

  const comic = await prisma.comic.findFirst({
    where: { id: comicId, userId },
    select: {
      id: true,
      title: true,
      description: true,
      slug: true,
      thumbnail: true,
      createdAt: true,
      updatedAt: true,
      chapters: {
        select: {
          id: true,
          number: true,
          title: true,
          publishedDate: true,
          _count: { select: { pages: true } },
        },
        orderBy: { number: "asc" },
      },
      _count: { select: { pages: true } },
    },
  });

  // Cover fallback logic: if no thumbnail, use first page of first chapter; else first standalone page
  let recentPageImage: string | null = null;
  if (comic && !comic.thumbnail) {
    // Find first chapter (by number asc) and its first page
    const firstChapter = await prisma.chapter.findFirst({
      where: { comicId },
      orderBy: { number: "asc" },
      select: { id: true },
    });
    if (firstChapter) {
      const firstChapterPage = await prisma.page.findFirst({
        where: { comicId, chapterId: firstChapter.id },
        orderBy: { number: "asc" },
        select: { imageUrl: true },
      });
      recentPageImage = firstChapterPage?.imageUrl || null;
    }
    // If no chapter page found, fallback to first standalone page (chapterId null)
    if (!recentPageImage) {
      const firstStandalonePage = await prisma.page.findFirst({
        where: { comicId, chapterId: null },
        orderBy: { number: "asc" },
        select: { imageUrl: true },
      });
      recentPageImage = firstStandalonePage?.imageUrl || null;
    }
  }

  if (!comic) throw new Response("Not Found", { status: 404 });
  return { comic, recentPageImage };
}

export async function action(args: Route.ActionArgs) {
  const { request, params } = args;
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  
  const comicId = params.comicId as string;
  
  // Verify ownership
  const comic = await prisma.comic.findFirst({ where: { id: comicId, userId }, select: { id: true } });
  if (!comic) return redirect("/dashboard");
  
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  
  if (intent === "deleteAllChapters") {
    // Prisma cascade will delete associated pages automatically
    await prisma.chapter.deleteMany({ where: { comicId } });
    return redirect(`/dashboard/${comicId}`);
  }
  
  if (intent === "deleteAllPages") {
    await prisma.page.deleteMany({ where: { comicId } });
    return redirect(`/dashboard/${comicId}`);
  }

  if (intent === "uploadThumbnail") {
    const file = formData.get("thumbnail") as File | null;
    if (!file) return new Response("File required", { status: 400 });
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) return new Response("Invalid type", { status: 400 });
    if (file.size > 2 * 1024 * 1024) return new Response("File too large", { status: 400 });
    // Dynamic import server-only modules
    const [{ convertToWebP }, { uploadBufferToS3 }] = await Promise.all([
      import("../utils/image.server"),
      import("../utils/s3.server"),
    ]);
    const buffer = Buffer.from(await file.arrayBuffer());
    const webp = await convertToWebP(buffer, 80);
    const uuid = crypto.randomUUID();
    const key = `${userId}/${comicId}/cover-${uuid}.webp`;
    const url = await uploadBufferToS3(webp, key, "image/webp");
    await prisma.comic.update({ where: { id: comicId }, data: { thumbnail: url } });
    return redirect(`/dashboard/${comicId}`);
  }

  if (intent === "removeCover") {
    await prisma.comic.update({ where: { id: comicId }, data: { thumbnail: null } });
    return redirect(`/dashboard/${comicId}`);
  }

  if (intent === "reorderChapters") {
    // Gather submitted chapter IDs in order
    const chapterIds: string[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("chapter_")) {
        chapterIds.push(String(value));
      }
    }
    // Validate ownership of chapters
    const existing = await prisma.chapter.findMany({
      where: { comicId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map(c => c.id));
    const filtered = chapterIds.filter(id => existingIds.has(id));
    if (filtered.length !== existing.length) {
      // If mismatch, abort silently or return error
      return redirect(`/dashboard/${comicId}`);
    }
    // Two-phase renumber using unique temporary numbers per row to satisfy (comicId, number) uniqueness
    // Phase 1: assign distinct high temp numbers (10000 + index)
    await Promise.all(
      filtered.map((id, idx) =>
        prisma.chapter.update({ where: { id }, data: { number: 10000 + idx } })
      )
    );
    // Phase 2: assign final target sequence 1..N
    await Promise.all(
      filtered.map((id, idx) =>
        prisma.chapter.update({ where: { id }, data: { number: idx + 1 } })
      )
    );
    return redirect(`/dashboard/${comicId}`);
  }
  
  return new Response("Unknown intent", { status: 400 });
}

export default function ComicDetail({ loaderData }: Route.ComponentProps) {
  const { comic, recentPageImage } = loaderData as {
    comic: {
      id: string;
      title: string;
      description: string | null;
      slug: string;
      thumbnail: string | null;
      createdAt: Date;
      updatedAt: Date;
  chapters: { id: string; number: number; title: string; publishedDate: Date | null; _count: { pages: number } }[];
      _count: { pages: number };
    };
    recentPageImage: string | null;
  };

  // Reorder chapters state
  const [reorderMode, setReorderMode] = useState(false);
  const [chaptersOrder, setChaptersOrder] = useState(comic.chapters.map(c => c.id));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Auto-exit reorder mode after successful save
  const navigation = useNavigation();
  const lastIntentRef = useRef<string | null>(null);
  useEffect(() => {
    const fd = navigation.formData as FormData | undefined;
    if (fd) {
      const intent = String(fd.get("intent") || "");
      lastIntentRef.current = intent;
    } else if (navigation.state === "idle" && lastIntentRef.current === "reorderChapters") {
      setReorderMode(false);
      lastIntentRef.current = null;
    }
  }, [navigation.state, navigation.formData]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = chaptersOrder.indexOf(String(active.id));
      const newIndex = chaptersOrder.indexOf(String(over.id));
      setChaptersOrder(arrayMove(chaptersOrder, oldIndex, newIndex));
    }
  }

  function SortableChapter({ id }: { id: string }) {
    const chapter = comic.chapters.find(c => c.id === id)!;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : undefined,
      cursor: "grab",
    };
    return (
      <li ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm flex items-center justify-between">
        <span className="font-medium">{chapter.title}</span>
        <span className="text-xs text-gray-500">{chapter._count.pages} page{chapter._count.pages !== 1 ? 's' : ''}</span>
      </li>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{comic.title}</h1>
        <Link
          to={`/dashboard/${comic.id}/update`}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition"
        >
          Add Pages
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="md:col-span-1">
          <div className="relative w-full aspect-[2/3] rounded border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 overflow-hidden">
            {comic.thumbnail ? (
              <img src={comic.thumbnail} alt={comic.title} className="h-full w-full object-cover" />
            ) : recentPageImage ? (
              <img src={recentPageImage} alt={comic.title + " (latest page)"} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-gray-400">No Cover</div>
            )}
          </div>
        </div>
        <aside className="space-y-4 md:col-span-1">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Subdomain</h2>
            {(() => {
              const isDev = import.meta.env.DEV;
              const domain = isDev
                ? `${comic.slug}.localhost:5173`
                : `${comic.slug}.webcomic.studio`;
              const href = `${isDev ? "http" : "https"}://${domain}`;
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 break-all inline-block text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {domain}
                </a>
              );
            })()}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Description</h2>
            <p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {comic.description || "—"}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-500 uppercase">Chapters</h2>
              {comic.chapters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReorderMode(r => !r)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {reorderMode ? "Done" : "Reorder"}
                </button>
              )}
            </div>
            {comic.chapters.length > 0 ? (
              <>
                {!reorderMode ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {comic.chapters.map(ch => {
                      const future = ch.publishedDate && new Date(ch.publishedDate) > new Date();
                      const dateStr = future ? new Date(ch.publishedDate!).toISOString().slice(0,10) : null;
                      return (
                        <li key={ch.id} className="flex items-center gap-2">
                          <Link 
                            to={`/dashboard/${comic.id}/${ch.id}`}
                            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            {ch.title} ({ch._count.pages} page{ch._count.pages !== 1 ? 's' : ''})
                          </Link>
                          {future && (
                            <span className="text-xs text-gray-400">Scheduled for {dateStr}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={chaptersOrder} strategy={verticalListSortingStrategy}>
                      <ul className="mt-2 space-y-2">
                        {chaptersOrder.map(id => <SortableChapter key={id} id={id} />)}
                      </ul>
                    </SortableContext>
                  </DndContext>
                )}
                <div className="mt-2 flex items-center gap-3">
                  <Form method="post">
                    <input type="hidden" name="intent" value="deleteAllChapters" />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete All Chapters
                    </button>
                  </Form>
                  {reorderMode && (
                    <Form method="post" className="inline-flex items-center gap-2">
                      <input type="hidden" name="intent" value="reorderChapters" />
                      {chaptersOrder.map((id, idx) => (
                        <input key={id} type="hidden" name={`chapter_${idx}`} value={id} />
                      ))}
                      <button
                        type="submit"
                        className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        Save Order
                      </button>
                    </Form>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-1 text-gray-500 text-sm">No chapters</p>
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Pages</h2>
            {comic._count.pages > 0 ? (
              <>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {comic._count.pages} page{comic._count.pages !== 1 ? 's' : ''}
                </p>
                <Form method="post" className="mt-2">
                  <input type="hidden" name="intent" value="deleteAllPages" />
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete All Pages
                  </button>
                </Form>
              </>
            ) : (
              <p className="mt-1 text-gray-500 text-sm">No pages</p>
            )}
          </div>
          <div className="text-sm text-gray-500">
            <p>Created: {comic.createdAt.toLocaleString()}</p>
            <p>Updated: {comic.updatedAt.toLocaleString()}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Cover Image</h2>
            <Form method="post" encType="multipart/form-data" className="mt-2 space-y-2" onSubmit={e => {
              const input = e.currentTarget.elements.namedItem("thumbnail") as HTMLInputElement | null;
              if (input?.files?.[0]) {
                const file = input.files[0];
                const valid = ["image/jpeg", "image/png", "image/webp"];
                if (!valid.includes(file.type)) { e.preventDefault(); alert("Only JPEG, PNG, or WebP."); return; }
                if (file.size > 2*1024*1024) { e.preventDefault(); alert("Max 2MB file."); return; }
              }
            }}>
              <input type="hidden" name="intent" value="uploadThumbnail" />
              <input
                type="file"
                name="thumbnail"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 text-xs"
                required={!comic.thumbnail}
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition"
              >
                {comic.thumbnail ? "Update Cover" : "Add Cover"}
              </button>
              {comic.thumbnail && (
                <Form method="post" className="inline-block ml-2">
                  <input type="hidden" name="intent" value="removeCover" />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition"
                  >
                    Remove Cover
                  </button>
                </Form>
              )}
            </Form>
          </div>
        </aside>
      </div>
    </main>
  );
}
