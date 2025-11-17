import type { Route } from "./+types/dashboard.$comicId.$chapterId";
import { redirect, Link, useFetcher, useLocation, useNavigate } from "react-router";
import { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  DragOverlay,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { prisma } from "../utils/db.server";
import { getAuth } from "@clerk/react-router/server";
import { getThumbnailUrl } from "../utils/thumbnail";

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

  // Verify comic ownership and gather all chapters (for move UI later)
  const comic = await prisma.comic.findFirst({
    where: { id: comicId, userId },
    select: {
      id: true,
      title: true,
      chapters: {
        select: { id: true, number: true, title: true },
        orderBy: { number: "asc" },
      },
    },
  });
  if (!comic) return redirect("/dashboard");

  // Get chapter with pages
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, comicId },
    select: {
      id: true,
      number: true,
      title: true,
      publishedDate: true,
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

export async function action(args: Route.ActionArgs) {
  const { request, params } = args;
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  const { comicId, chapterId } = params;
  if (!comicId || !chapterId) throw new Response("Not Found", { status: 404 });

  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "saveOrder") {
    const orderedJson = formData.get("ordered");
    if (typeof orderedJson !== "string") return new Response("Bad Request", { status: 400 });
    let ordered: string[];
    try {
      ordered = JSON.parse(orderedJson);
    } catch {
      return new Response("Invalid payload", { status: 400 });
    }
    if (!Array.isArray(ordered) || ordered.some((v) => typeof v !== "string")) {
      return new Response("Invalid payload", { status: 400 });
    }
  
    // Verify comic ownership and chapter existence
    const comic = await prisma.comic.findFirst({ where: { id: comicId, userId }, select: { id: true } });
    if (!comic) return redirect("/dashboard");
  
    const pages = await prisma.page.findMany({ where: { chapterId }, select: { id: true } });
    const pageIds = new Set(pages.map((p) => p.id));
    if (ordered.length !== pages.length) {
      return new Response("Mismatched list length", { status: 400 });
    }
    // Ensure all ids belong to this chapter
    for (const id of ordered) {
      if (!pageIds.has(id)) return new Response("Invalid page id", { status: 400 });
    }
  
  // Two-phase renumber to avoid unique conflicts: temp bump, then final set
  const bump = 10000; // increased to handle very large chapters
    const tempUpdates = ordered.map((id, index) =>
      prisma.page.update({ where: { id }, data: { number: index + 1 + bump } })
    );
    const finalUpdates = ordered.map((id, index) =>
      prisma.page.update({ where: { id }, data: { number: index + 1 } })
    );
  
    await prisma.$transaction(tempUpdates);
    await prisma.$transaction(finalUpdates);
  
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (intent === "deleteSelected") {
    const selectedJson = formData.get("selected");
    if (typeof selectedJson !== "string") return new Response("Bad Request", { status: 400 });
    let selected: string[];
    try {
      selected = JSON.parse(selectedJson);
    } catch {
      return new Response("Invalid payload", { status: 400 });
    }
    if (!Array.isArray(selected) || selected.length === 0) {
      return redirect(`/dashboard/${comicId}/${chapterId}`);
    }

    // Verify comic ownership
    const comic = await prisma.comic.findFirst({ where: { id: comicId, userId }, select: { id: true } });
    if (!comic) return redirect("/dashboard");

    // Collect URLs to remove from S3 first
    const pagesToDelete = await prisma.page.findMany({
      where: { id: { in: selected }, chapterId },
      select: { imageUrl: true },
    });

    // Remove from DB
    const result = await prisma.page.deleteMany({ where: { id: { in: selected }, chapterId } });

    // Best-effort S3 cleanup of originals + thumbnails
    try {
      const { deleteS3Keys } = await import("../utils/s3.server");
      const urlsToKeys = (url: string): string[] => {
        try {
          const u = new URL(url);
          const key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
          const dot = key.lastIndexOf('.');
          const thumbKey = dot === -1 ? `${key}-thumbnail` : `${key.slice(0, dot)}-thumbnail${key.slice(dot)}`;
          return [key, thumbKey];
        } catch { return []; }
      };
      const keys = pagesToDelete.flatMap(p => urlsToKeys(p.imageUrl));
      await deleteS3Keys(keys);
    } catch (err) {
      console.error("Failed S3 cleanup for selected pages", err);
    }

    // Resequence remaining pages to keep numbers contiguous
    const remaining = await prisma.page.findMany({
      where: { chapterId },
      select: { id: true },
      orderBy: { number: "asc" },
    });

    if (remaining.length > 0) {
      const bump = 10000; // increased to handle very large chapters
      const tempUpdates = remaining.map((p, index) =>
        prisma.page.update({ where: { id: p.id }, data: { number: index + 1 + bump } })
      );
      const finalUpdates = remaining.map((p, index) =>
        prisma.page.update({ where: { id: p.id }, data: { number: index + 1 } })
      );

      await prisma.$transaction(tempUpdates);
      await prisma.$transaction(finalUpdates);
    }

    // Redirect back to refresh list and show count
    return redirect(`/dashboard/${comicId}/${chapterId}?deleted=${result.count || 0}`);
  }

  if (intent === "deleteChapter") {
    // Verify ownership again
    const comic = await prisma.comic.findFirst({ where: { id: comicId, userId }, select: { id: true } });
    if (!comic) return redirect("/dashboard");

    // Ensure chapter exists and belongs to comic
    const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, comicId }, select: { id: true } });
    if (!chapter) return redirect(`/dashboard/${comicId}`);

    // Gather page image URLs before deleting DB rows
    const pages = await prisma.page.findMany({
      where: { chapterId },
      select: { imageUrl: true },
    });

    // Compute S3 keys for full-size and thumbnails
    const urlsToKeys = (url: string): string[] => {
      try {
        const u = new URL(url);
        const key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
        // insert -thumbnail before extension for thumb key
        const dot = key.lastIndexOf('.');
        const thumbKey = dot === -1 ? `${key}-thumbnail` : `${key.slice(0, dot)}-thumbnail${key.slice(dot)}`;
        return [key, thumbKey];
      } catch {
        return [];
      }
    };
    const keys: string[] = pages.flatMap(p => urlsToKeys(p.imageUrl));

    // Best-effort S3 cleanup (do not block DB deletion on failures)
    try {
      const { deleteS3Keys } = await import("../utils/s3.server");
      await deleteS3Keys(keys);
    } catch (err) {
      console.error("Failed to delete S3 objects for chapter", chapterId, err);
    }

    // Delete pages first (in case cascade not set) then chapter
    await prisma.$transaction([
      prisma.page.deleteMany({ where: { chapterId } }),
      prisma.chapter.delete({ where: { id: chapterId } }),
    ]);

    return redirect(`/dashboard/${comicId}`);
  }

  if (intent === "updatePublishedDate") {
    const dateStr = formData.get("publishedDate");
    if (typeof dateStr !== "string" || !dateStr) {
      return redirect(`/dashboard/${comicId}/${chapterId}`);
    }
    // Expect YYYY-MM-DD from date input
    const parsed = new Date(dateStr + "T00:00:00Z");
    if (isNaN(parsed.getTime())) {
      return redirect(`/dashboard/${comicId}/${chapterId}`);
    }
    await prisma.chapter.update({ where: { id: chapterId }, data: { publishedDate: parsed } });
    return redirect(`/dashboard/${comicId}/${chapterId}`);
  }

  return new Response("Bad Request", { status: 400 });
}

// Sortable grid item wrapper
function SortablePageItem({ id, imageUrl, displayNumber }: { id: string; imageUrl: string; displayNumber: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  } as React.CSSProperties;
  
  const thumbnailUrl = getThumbnailUrl(imageUrl);
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative select-none rounded-md overflow-hidden border shadow aspect-[2/3] w-24
        ${isDragging ? "border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700 scale-105" : "border-gray-300 dark:border-gray-600"}`}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={`Page ${displayNumber}`}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] bg-gray-200 dark:bg-gray-700">No image</div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[10px] text-white px-1 py-0.5 leading-none font-medium">
        Page {displayNumber}
      </div>
    </div>
  );
}

// Drag overlay visual
function DragOverlayItem({ imageUrl, displayNumber }: { imageUrl: string; displayNumber: number }) {
  const thumbnailUrl = getThumbnailUrl(imageUrl);
  
  return (
    <div className="relative aspect-[2/3] w-24 rounded-md overflow-hidden border border-indigo-400 bg-white dark:bg-gray-800 shadow-lg">
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt={`Page ${displayNumber}`} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] bg-gray-200 dark:bg-gray-700">No image</div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 text-[10px] text-white px-1 py-0.5 leading-none font-semibold">
        Page {displayNumber}
      </div>
    </div>
  );
}

export default function ChapterDetail({ loaderData }: Route.ComponentProps) {
  const data = loaderData as { comic: { id: string; title: string; chapters: { id: string; number: number; title: string }[] }; chapter: { id: string; number: number; title: string; publishedDate: Date | null; pages: { id: string; number: number; imageUrl: string }[] } } | undefined;
  
  if (!data) {
    throw new Response("Not Found", { status: 404 });
  }

  const { comic, chapter } = data;
  const publishedDateValue = chapter.publishedDate ? new Date(chapter.publishedDate) : null;
  const publishedDateISO = publishedDateValue ? publishedDateValue.toISOString().slice(0,10) : "";
  const location = useLocation();
  const navigate = useNavigate();
  const deletedParam = new URLSearchParams(location.search).get("deleted");
  const deletedCount = deletedParam ? parseInt(deletedParam, 10) : 0;

  const [reorderMode, setReorderMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [modalPage, setModalPage] = useState<{ imageUrl: string; number: number } | null>(null);
  const fetcher = useFetcher();
  const lastIntentRef = useRef<string | null>(null);
  // Local sortable order of page ids (no persistence yet)
  const [items, setItems] = useState<string[]>(() => chapter.pages.map(p => p.id));
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id && over?.id && active.id !== over.id) {
      setItems(items => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  }, []);
  const handleDragCancel = useCallback(() => setActiveId(null), []);

  // After successful save, exit reorder mode
  useEffect(() => {
    if (fetcher.state === "idle" && (fetcher.data as any)?.ok) {
      setReorderMode(false);
    }
  }, [fetcher.state, fetcher.data]);

  // Track last submitted intent
  useEffect(() => {
    if (fetcher.formData) {
      const intent = fetcher.formData.get("intent");
      if (typeof intent === "string") lastIntentRef.current = intent;
    }
  }, [fetcher.formData]);

  // After deleteSelected redirect completes, exit select mode and clear selection
  useEffect(() => {
    if (fetcher.state === "idle" && lastIntentRef.current === "deleteSelected") {
      setSelectMode(false);
      setSelectedPages(new Set());
      lastIntentRef.current = null;
    }
  }, [fetcher.state]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!modalPage) return;
      
      if (e.key === "Escape") {
        setModalPage(null);
      } else if (e.key === "ArrowLeft") {
        // Previous page
        const currentIndex = chapter.pages.findIndex(p => p.number === modalPage.number);
        if (currentIndex > 0) {
          const prevPage = chapter.pages[currentIndex - 1];
          setModalPage({ imageUrl: prevPage.imageUrl, number: prevPage.number });
        }
      } else if (e.key === "ArrowRight") {
        // Next page
        const currentIndex = chapter.pages.findIndex(p => p.number === modalPage.number);
        if (currentIndex < chapter.pages.length - 1) {
          const nextPage = chapter.pages[currentIndex + 1];
          setModalPage({ imageUrl: nextPage.imageUrl, number: nextPage.number });
        }
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [modalPage, chapter.pages]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      {deletedCount > 0 && (
        <div className="mb-4 rounded-md border border-green-700/30 bg-green-600/15 text-green-800 px-3 py-2 text-sm flex items-center justify-between">
          <span>
            {deletedCount} page{deletedCount === 1 ? "" : "s"} deleted
          </span>
          <button
            className="ml-3 text-green-800 hover:text-white underline decoration-dotted"
            onClick={() => {
              const url = new URL(location.pathname, window.location.origin);
              navigate(url.pathname);
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <Link
          to={`/dashboard/${comic.id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
        >
          <span className="mr-1">←</span> Back to {comic.title}
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/dashboard/${comic.id}/update?chapterId=${chapter.id}`}
            className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition"
          >
            Add Pages
          </Link>
          {chapter.pages.length > 0 && (
            <button
              type="button"
              onClick={() => setReorderMode(r => !r)}
              className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white transition"
            >
              {reorderMode ? "Done" : "Reorder pages"}
            </button>
          )}
          <fetcher.Form
            method="post"
            className="inline-flex"
            onSubmit={(e) => {
              const ok = confirm("Delete this chapter and all its pages? This cannot be undone.");
              if (!ok) e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="deleteChapter" />
            <button
              type="submit"
              className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-red-700 text-white hover:bg-red-600"
            >
              Delete chapter
            </button>
          </fetcher.Form>
          {chapter.pages.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectMode(s => !s)}
              disabled={reorderMode}
              className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition ${
                reorderMode
                  ? "bg-gray-100 dark:bg-gray-900 text-gray-400 cursor-not-allowed"
                  : selectMode
                  ? "bg-indigo-600 text-white hover:bg-indigo-500"
                  : "bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
              }`}
            >
              Select
            </button>
          )}
          {selectMode && (
            <div className="flex items-center gap-2">
              {/* Delete Selected (UI only for now) */}
              <fetcher.Form
                method="post"
                className="inline-flex"
                onSubmit={(e) => {
                  if (selectedPages.size === 0) {
                    e.preventDefault();
                    return;
                  }
                  const plural = selectedPages.size === 1 ? "page" : "pages";
                  const ok = confirm(`Delete ${selectedPages.size} ${plural}? This cannot be undone.`);
                  if (!ok) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="intent" value="deleteSelected" />
                <input type="hidden" name="selected" value={JSON.stringify([...selectedPages])} />
                <button
                  type="submit"
                  disabled={selectedPages.size === 0 || fetcher.state !== 'idle'}
                  className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {fetcher.state !== 'idle' ? 'Deleting…' : 'Delete selected'}
                </button>
              </fetcher.Form>
              {/* Move To Chapter (UI only) */}
              {chapter.pages.length > 0 && (
                <form
                  onSubmit={e => {
                    if (selectedPages.size === 0) { e.preventDefault(); return; }
                    const formData = new FormData(e.currentTarget);
                    const target = String(formData.get("targetChapterId") || "");
                    alert(`Would move ${selectedPages.size} page(s) to chapter ${target || '(none)'} (not implemented).`);
                    e.preventDefault();
                  }}
                  className="flex items-center gap-1"
                >
                  <input type="hidden" name="selected" value={JSON.stringify([...selectedPages])} />
                  <label className="sr-only" htmlFor="targetChapterId">Move to chapter</label>
                  <select
                    id="targetChapterId"
                    name="targetChapterId"
                    className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
                    defaultValue=""
                  >
                    <option value="" disabled>Move to…</option>
                    {comic.chapters.map(ch => (
                      <option key={ch.id} value={ch.id}>Chapter {ch.number}: {ch.title}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={selectedPages.size === 0}
                    className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Move
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{chapter.title}</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {chapter.pages.length} page{chapter.pages.length !== 1 ? "s" : ""}
            </p>
          </div>
          <form method="post" className="flex items-center gap-2 text-sm">
            <input type="hidden" name="intent" value="updatePublishedDate" />
            <label htmlFor="publishedDate" className="text-gray-600 dark:text-gray-300">Publish on</label>
            <input
              id="publishedDate"
              name="publishedDate"
              type="date"
              defaultValue={publishedDateISO}
              className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
            />
            <button
              type="submit"
              className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow transition"
            >
              Save
            </button>
          </form>
        </div>
      </div>

      {reorderMode && (
        <section className="mb-8 rounded border border-dashed border-gray-300 dark:border-gray-700 p-6 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Reorder Pages</h2>
            <fetcher.Form method="post" className="contents">
              <input type="hidden" name="intent" value="saveOrder" />
              <input type="hidden" name="ordered" value={JSON.stringify(items)} />
              <button
                type="submit"
                disabled={fetcher.state !== "idle"}
                className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {fetcher.state !== "idle" ? "Saving…" : "Save order"}
              </button>
            </fetcher.Form>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Drag items to change their local order. (Not yet saved.)
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={items} strategy={rectSortingStrategy}>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(6rem, 1fr))", maxWidth: "64rem" }}>
                {items.map((id, idx) => {
                  const page = chapter.pages.find(p => p.id === id);
                  if (!page) return null;
                  const displayNumber = idx + 1;
                  return <SortablePageItem key={id} id={id} imageUrl={page.imageUrl} displayNumber={displayNumber} />;
                })}
              </div>
            </SortableContext>
            <DragOverlay adjustScale style={{ transformOrigin: "0 0" }}>
              {activeId ? (() => {
                const page = chapter.pages.find(p => p.id === activeId);
                if (!page) return null;
                const displayNumber = items.indexOf(activeId) + 1;
                return <DragOverlayItem imageUrl={page.imageUrl} displayNumber={displayNumber} />;
              })() : null}
            </DragOverlay>
          </DndContext>
        </section>
      )}

      {!reorderMode && (
        chapter.pages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {chapter.pages.map((page) => {
              const isSelected = selectedPages.has(page.id);
              return (
                <div
                  key={page.id}
                  onClick={() => {
                    if (selectMode) {
                      setSelectedPages(prev => {
                        const next = new Set(prev);
                        if (next.has(page.id)) next.delete(page.id); else next.add(page.id);
                        return next;
                      });
                    } else {
                      setModalPage({ imageUrl: page.imageUrl, number: page.number });
                    }
                  }}
                  className="relative aspect-[2/3] rounded border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 overflow-hidden group cursor-pointer"
                >
                  <img
                    src={getThumbnailUrl(page.imageUrl)}
                    alt={`Page ${page.number}`}
                    className="h-full w-full object-cover"
                  />
                  {selectMode && (
                    <div className={`absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-full border-2 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/70 dark:bg-gray-900/70 border-indigo-500 text-transparent'}`}>
                      <svg aria-hidden={isSelected ? 'false' : 'true'} className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 0 1.414l-7.01 7.01a1 1 0 0 1-1.414 0L3.296 8.73a1 1 0 1 1 1.414-1.414l3.17 3.17 6.303-6.303a1 1 0 0 1 1.414 0Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-medium">Page {page.number}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No pages in this chapter yet.</p>
          </div>
        )
      )}

      {/* Image modal */}
      {modalPage && (
        <div
          onClick={() => setModalPage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          {/* Page number indicator */}
          <div className="absolute top-4 right-16 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-sm font-medium text-white">
            Page {modalPage.number}
          </div>

          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setModalPage(null);
            }}
            className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 p-2 text-white backdrop-blur transition"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous arrow */}
          {(() => {
            const currentIndex = chapter.pages.findIndex(p => p.number === modalPage.number);
            const hasPrev = currentIndex > 0;
            return hasPrev ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const prevPage = chapter.pages[currentIndex - 1];
                  setModalPage({ imageUrl: prevPage.imageUrl, number: prevPage.number });
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 p-3 text-white backdrop-blur transition z-10"
                aria-label="Previous page"
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : null;
          })()}

          <div className="relative max-h-[95vh] max-w-[95vw] flex items-center justify-center">
            <img
              src={modalPage.imageUrl}
              alt={`Page ${modalPage.number}`}
              className="max-h-[95vh] w-auto object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Next arrow */}
          {(() => {
            const currentIndex = chapter.pages.findIndex(p => p.number === modalPage.number);
            const hasNext = currentIndex < chapter.pages.length - 1;
            return hasNext ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const nextPage = chapter.pages[currentIndex + 1];
                  setModalPage({ imageUrl: nextPage.imageUrl, number: nextPage.number });
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 p-3 text-white backdrop-blur transition z-10"
                aria-label="Next page"
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : null;
          })()}
        </div>
      )}
    </main>
  );
}
