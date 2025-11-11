import type { Route } from "./+types/dashboard.$comicId.$chapterId";
import { redirect, Link } from "react-router";
import { useState, useCallback } from "react";
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

// Sortable grid item wrapper
function SortablePageItem({ id, imageUrl, pageNumber }: { id: string; imageUrl: string; pageNumber: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  } as React.CSSProperties;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative select-none rounded-md overflow-hidden border shadow aspect-[2/3] w-24
        ${isDragging ? "border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700 scale-105" : "border-gray-300 dark:border-gray-600"}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Page ${pageNumber}`}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] bg-gray-200 dark:bg-gray-700">No image</div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[10px] text-white px-1 py-0.5 leading-none font-medium">
        Page {pageNumber}
      </div>
    </div>
  );
}

// Drag overlay visual
function DragOverlayItem({ imageUrl, pageNumber }: { imageUrl: string; pageNumber: number }) {
  return (
    <div className="relative aspect-[2/3] w-24 rounded-md overflow-hidden border border-indigo-400 bg-white dark:bg-gray-800 shadow-lg">
      {imageUrl ? (
        <img src={imageUrl} alt={`Page ${pageNumber}`} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] bg-gray-200 dark:bg-gray-700">No image</div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 text-[10px] text-white px-1 py-0.5 leading-none font-semibold">
        Page {pageNumber}
      </div>
    </div>
  );
}

export default function ChapterDetail({ loaderData }: Route.ComponentProps) {
  const data = loaderData as { comic: { id: string; title: string }; chapter: { id: string; number: number; title: string; pages: { id: string; number: number; imageUrl: string }[] } } | undefined;
  
  if (!data) {
    throw new Response("Not Found", { status: 404 });
  }

  const { comic, chapter } = data;

  const [reorderMode, setReorderMode] = useState(false);
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
        <section className="mb-8 rounded border border-dashed border-gray-300 dark:border-gray-700 p-6 text-sm text-gray-600 dark:text-gray-300">
          <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">Reorder Pages</h2>
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
                {items.map(id => {
                  const page = chapter.pages.find(p => p.id === id);
                  if (!page) return null;
                  return <SortablePageItem key={id} id={id} imageUrl={page.imageUrl} pageNumber={page.number} />;
                })}
              </div>
            </SortableContext>
            <DragOverlay adjustScale style={{ transformOrigin: "0 0" }}>
              {activeId ? (() => { const page = chapter.pages.find(p => p.id === activeId); return page ? <DragOverlayItem imageUrl={page.imageUrl} pageNumber={page.number} /> : null; })() : null}
            </DragOverlay>
          </DndContext>
        </section>
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
