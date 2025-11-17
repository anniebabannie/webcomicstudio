import type { Route } from "./+types/dashboard.$comicId";
import { redirect, Link, Form, useNavigation, useActionData } from "react-router";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect, useRef } from "react";
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
      domain: true,
      thumbnail: true,
      logo: true,
      doubleSpread: true,
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
  
  if (intent === "updateComic") {
    const slug = formData.get("slug") as string | null;
    const domain = formData.get("domain") as string | null;
    const description = formData.get("description") as string | null;
    const doubleSpread = formData.get("doubleSpread") === "on";
    
    // Handle file uploads
    const thumbnailFile = formData.get("thumbnail") as File | null;
    const logoFile = formData.get("logo") as File | null;
    
    const updates: any = {
      domain: domain || null,
      description: description || null,
      doubleSpread,
    };
    
    // Update chapter order if provided
    const chapterIds: string[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("chapter_")) {
        chapterIds.push(String(value));
      }
    }
    
    if (chapterIds.length > 0) {
      // Validate ownership
      const existing = await prisma.chapter.findMany({
        where: { comicId },
        select: { id: true },
      });
      const existingIds = new Set(existing.map(c => c.id));
      const filtered = chapterIds.filter(id => existingIds.has(id));
      
      if (filtered.length === existing.length) {
        // Two-phase renumber
        await Promise.all(
          filtered.map((id, idx) =>
            prisma.chapter.update({ where: { id }, data: { number: 10000 + idx } })
          )
        );
        await Promise.all(
          filtered.map((id, idx) =>
            prisma.chapter.update({ where: { id }, data: { number: idx + 1 } })
          )
        );
      }
    }
    
    // Update slug if provided
    if (slug && slug.trim()) {
      const trimmedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (trimmedSlug) {
        // Check if slug is already taken
        const existing = await prisma.comic.findUnique({ where: { slug: trimmedSlug } });
        if (existing && existing.id !== comicId) {
          return Response.json(
            { error: "subdomain", message: "Subdomain already taken" },
            { status: 400 }
          );
        }
        updates.slug = trimmedSlug;
      }
    }
    
    // Upload thumbnail if provided
    if (thumbnailFile && thumbnailFile.size > 0) {
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(thumbnailFile.type)) return new Response("Invalid thumbnail type", { status: 400 });
      if (thumbnailFile.size > 2 * 1024 * 1024) return new Response("Thumbnail too large", { status: 400 });
      
      const [{ convertToWebP }, { uploadBufferToS3 }] = await Promise.all([
        import("../utils/image.server"),
        import("../utils/s3.server"),
      ]);
      const buffer = Buffer.from(await thumbnailFile.arrayBuffer());
      const webp = await convertToWebP(buffer, 80);
      const uuid = crypto.randomUUID();
      const key = `${userId}/${comicId}/cover-${uuid}.webp`;
      const url = await uploadBufferToS3(webp, key, "image/webp");
      updates.thumbnail = url;
    }
    
    // Upload logo if provided
    if (logoFile && logoFile.size > 0) {
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(logoFile.type)) return new Response("Invalid logo type", { status: 400 });
      if (logoFile.size > 2 * 1024 * 1024) return new Response("Logo too large", { status: 400 });
      
      const [{ convertToWebP }, { uploadBufferToS3 }] = await Promise.all([
        import("../utils/image.server"),
        import("../utils/s3.server"),
      ]);
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      const webp = await convertToWebP(buffer, 80);
      const uuid = crypto.randomUUID();
      const key = `${userId}/${comicId}/logo-${uuid}.webp`;
      const url = await uploadBufferToS3(webp, key, "image/webp");
      updates.logo = url;
    }
    
    await prisma.comic.update({ where: { id: comicId }, data: updates });
    return redirect(`/dashboard/${comicId}`);
  }

  if (intent === "reorderChapters") {
    const orderStr = String(formData.get("order") || "").trim();
    const ids = orderStr ? orderStr.split(",").filter(Boolean) : [];
    // Validate: ensure all ids belong to this comic
    const existing = await prisma.chapter.findMany({ where: { comicId }, select: { id: true } });
    const existingIds = new Set(existing.map(c => c.id));
    const filtered = ids.filter(id => existingIds.has(id));
    if (filtered.length === existing.length && filtered.length > 0) {
      // Two-phase renumber to avoid unique collisions
      await Promise.all(
        filtered.map((id, idx) =>
          prisma.chapter.update({ where: { id }, data: { number: 10000 + idx } })
        )
      );
      await Promise.all(
        filtered.map((id, idx) =>
          prisma.chapter.update({ where: { id }, data: { number: idx + 1 } })
        )
      );
    }
    return redirect(`/dashboard/${comicId}`);
  }
  
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

  if (intent === "uploadLogo") {
    const file = formData.get("logo") as File | null;
    if (!file) return new Response("File required", { status: 400 });
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) return new Response("Invalid type", { status: 400 });
    if (file.size > 2 * 1024 * 1024) return new Response("File too large", { status: 400 });
    const [{ convertToWebP }, { uploadBufferToS3 }] = await Promise.all([
      import("../utils/image.server"),
      import("../utils/s3.server"),
    ]);
    const buffer = Buffer.from(await file.arrayBuffer());
    const webp = await convertToWebP(buffer, 80);
    const uuid = crypto.randomUUID();
    const key = `${userId}/${comicId}/logo-${uuid}.webp`;
    const url = await uploadBufferToS3(webp, key, "image/webp");
    await prisma.comic.update({ where: { id: comicId }, data: { logo: url } });
    return redirect(`/dashboard/${comicId}`);
  }

  if (intent === "removeLogo") {
    await prisma.comic.update({ where: { id: comicId }, data: { logo: null } });
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
  
  if (intent === "addDomain") {
    const domain = formData.get("domain") as string | null;
    if (!domain) return new Response("Domain required", { status: 400 });
    
    // Basic domain validation (simple check for now)
    const trimmedDomain = domain.trim().toLowerCase();
    if (!trimmedDomain || trimmedDomain.includes('://')) {
      return new Response("Invalid domain format", { status: 400 });
    }
    
    // Check if domain already in use
    const existing = await prisma.comic.findUnique({ where: { domain: trimmedDomain } });
    if (existing && existing.id !== comicId) {
      return new Response("Domain already in use", { status: 400 });
    }
    
    await prisma.comic.update({ 
      where: { id: comicId }, 
      data: { domain: trimmedDomain } 
    });
    return redirect(`/dashboard/${comicId}`);
  }
  
  if (intent === "updateDomain") {
    const domain = formData.get("domain") as string | null;
    if (!domain) return new Response("Domain required", { status: 400 });
    const trimmedDomain = domain.trim().toLowerCase();
    if (!trimmedDomain || trimmedDomain.includes('://')) {
      return new Response("Invalid domain format", { status: 400 });
    }
    const existing = await prisma.comic.findUnique({ where: { domain: trimmedDomain } });
    if (existing && existing.id !== comicId) {
      return new Response("Domain already in use", { status: 400 });
    }
    await prisma.comic.update({ where: { id: comicId }, data: { domain: trimmedDomain } });
    return redirect(`/dashboard/${comicId}`);
  }
  
  if (intent === "updateDoubleSpread") {
    const doubleSpread = formData.get("doubleSpread") === "on";
    await prisma.comic.update({ 
      where: { id: comicId }, 
      data: { doubleSpread } 
    });
    return redirect(`/dashboard/${comicId}`);
  }
  
  if (intent === "createChapter") {
    const name = formData.get("name");
    if (!name || typeof name !== "string") {
      return new Response("Chapter name required", { status: 400 });
    }
    
    // Get the highest chapter number to auto-increment
    const lastChapter = await prisma.chapter.findFirst({
      where: { comicId },
      orderBy: { number: 'desc' }
    });
    
    const nextNumber = lastChapter ? lastChapter.number + 1 : 1;
    
    await prisma.chapter.create({
      data: {
        comicId,
        title: name.trim(),
        number: nextNumber
      }
    });
    
    return { success: true, action: 'createChapter' };
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
      domain?: string | null;
      doubleSpread?: boolean;
      thumbnail: string | null;
      logo?: string | null;
      createdAt: Date;
      updatedAt: Date;
  chapters: { id: string; number: number; title: string; publishedDate: Date | null; _count: { pages: number } }[];
      _count: { pages: number };
    };
    recentPageImage: string | null;
  };

  const [isEditing, setIsEditing] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [description, setDescription] = useState(comic.description || '');
  const [doubleSpread, setDoubleSpread] = useState(comic.doubleSpread || false);
  const [showNewChapter, setShowNewChapter] = useState(false);
  const [reorderChapters, setReorderChapters] = useState(false);
  const [chapterIds, setChapterIds] = useState<string[]>(() => comic.chapters.map(c => c.id));
  useEffect(() => {
    setChapterIds(comic.chapters.map(c => c.id));
  }, [comic.chapters]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setChapterIds((ids) => {
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      return arrayMove(ids, oldIndex, newIndex);
    });
  }
  const navigation = useNavigation();
  const actionData = useActionData<{ error?: string; message?: string; success?: boolean; action?: string }>();
  const isSubmitting = navigation.state === "submitting" && navigation.formData?.get("intent") === "updateComic";
  const prevStateRef = useRef(navigation.state);
  const lastIntentRef = useRef<string | null>(null);

  // Exit edit mode after successful save
  useEffect(() => {
    const wasSubmitting = prevStateRef.current === "submitting" || prevStateRef.current === "loading";
    const isNowIdle = navigation.state === "idle";
    
    if (wasSubmitting && isNowIdle && isEditing && !actionData?.error) {
      setIsEditing(false);
      setLogoPreview(null);
      setThumbnailPreview(null);
    }
    
    prevStateRef.current = navigation.state;
  }, [navigation.state, isEditing, actionData]);
  
  // Hide new chapter form after successful creation
  useEffect(() => {
    if (actionData?.success && actionData?.action === 'createChapter') {
      setShowNewChapter(false);
    }
  }, [actionData]);

  // Exit reorder mode after successful save (intent=reorderChapters)
  useEffect(() => {
    if (navigation.state === 'submitting') {
      lastIntentRef.current = String(navigation.formData?.get('intent') || '');
    }
    if (navigation.state === 'idle' && lastIntentRef.current === 'reorderChapters') {
      setReorderChapters(false);
      lastIntentRef.current = null;
    }
  }, [navigation.state]);

  // Clear previews when exiting edit mode
  useEffect(() => {
    if (!isEditing) {
      setLogoPreview(null);
      setThumbnailPreview(null);
      setDescription(comic.description || '');
      setDoubleSpread(comic.doubleSpread || false);
    }
  }, [isEditing, comic.chapters, comic.description, comic.doubleSpread]);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setThumbnailPreview(null);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  };

  const getPreviewUrl = () => {
    const isDev = import.meta.env.DEV;
    
    const baseUrl = isDev 
      ? `http://${comic.slug}.localhost:5173`
      : `https://${comic.slug}.webcomic.studio`;
    
    const params = new URLSearchParams({
      preview: 'true',
      description: description,
      doubleSpread: String(doubleSpread),
    });
    
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{comic.title}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="md:col-span-1">
          {isEditing && (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Cover Image
              </label>
              <input
                type="file"
                name="thumbnail"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleThumbnailChange}
                form="comic-settings-form"
                className="block w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 text-xs"
              />
            </div>
          )}
          <div className="relative w-full aspect-[2/3] rounded border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 overflow-hidden">
            {thumbnailPreview ? (
              <img src={thumbnailPreview} alt={comic.title} className="h-full w-full object-cover" />
            ) : comic.thumbnail ? (
              <img src={comic.thumbnail} alt={comic.title} className="h-full w-full object-cover" />
            ) : recentPageImage ? (
              <img src={recentPageImage} alt={comic.title + " (latest page)"} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-gray-400">No Cover</div>
            )}
          </div>
        </div>
        <aside className="md:col-span-1">
          {/* Chapters box (separate from settings form) */}
          <div className="mb-6 p-6 rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Chapters</h2>
              {!reorderChapters ? (
                <button
                  type="button"
                  onClick={() => setReorderChapters(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Reorder chapters
                </button>
              ) : (
                <div className="inline-flex items-center gap-3">
                  <button
                    type="button"
                    className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
                    onClick={() => {
                      setChapterIds(comic.chapters.map(c => c.id));
                      setReorderChapters(false);
                    }}
                  >
                    Cancel
                  </button>
                  <Form method="post" className="inline-flex items-center gap-2">
                    <input type="hidden" name="intent" value="reorderChapters" />
                    <input type="hidden" name="order" value={chapterIds.join(",")} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-md bg-indigo-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-indigo-500 transition"
                    >
                      Save
                    </button>
                  </Form>
                </div>
              )}
            </div>
            {comic.chapters.length === 0 ? (
              <p className="mt-1 text-gray-500 text-sm">No chapters</p>
            ) : !reorderChapters ? (
              <ul className="mt-2 space-y-1 text-sm">
                {comic.chapters.map((ch) => {
                  const isFuture = ch.publishedDate && new Date(ch.publishedDate) > new Date();
                  const dateStr = isFuture && ch.publishedDate ? new Date(ch.publishedDate).toLocaleDateString() : null;
                  return (
                    <li key={ch.id} className="flex items-center gap-2">
                      <Link 
                        to={`/dashboard/${comic.id}/${ch.id}`}
                        className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        {ch.title} ({ch._count.pages} page{ch._count.pages !== 1 ? 's' : ''})
                      </Link>
                      {!ch.publishedDate ? (
                        <span className="text-xs text-gray-400">Unpublished</span>
                      ) : isFuture ? (
                        <span className="text-xs text-gray-400">Scheduled for {dateStr}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-3">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={chapterIds} strategy={rectSortingStrategy}>
                    <ul className="space-y-2">
                      {chapterIds.map((id) => {
                        const ch = comic.chapters.find(c => c.id === id)!;
                        return <SortableChapter key={id} id={id} title={ch.title} count={ch._count.pages} />;
                      })}
                    </ul>
                  </SortableContext>
                </DndContext>
              </div>
            )}
            
            {/* New Chapter toggle */}
            {!showNewChapter ? (
              <button
                type="button"
                onClick={() => setShowNewChapter(true)}
                className="mt-4 inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <span className="text-base leading-none">＋</span>
                New Chapter
              </button>
            ) : (
              <Form method="post" className="mt-4 space-y-2">
                <input type="hidden" name="intent" value="createChapter" />
                <input
                  type="text"
                  name="name"
                  placeholder="Chapter title"
                  className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                  autoFocus
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md bg-indigo-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-indigo-500 transition"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewChapter(false)}
                    className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    Cancel
                  </button>
                </div>
              </Form>
            )}
          </div>

          <Form method="post" encType="multipart/form-data" id="comic-settings-form" className="space-y-4 p-6 rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <input type="hidden" name="intent" value="updateComic" />
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Comic Settings</h2>
              <div className="flex gap-2">
                {isEditing && (
                  <>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="text-sm font-medium px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                    <a
                      href={getPreviewUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium px-3 py-1.5 rounded-md border border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition"
                    >
                      Preview
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={isSubmitting}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditing ? "Cancel" : "Edit Comic"}
                </button>
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase">Subdomain</h2>
              {isEditing ? (
                <div className="mt-1">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      name="slug"
                      defaultValue={comic.slug}
                      placeholder="mycomic"
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      pattern="[a-z0-9-]+"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      .{import.meta.env.DEV ? 'localhost:5173' : 'webcomic.studio'}
                    </span>
                  </div>
                  {actionData?.error === "subdomain" && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {actionData.message}
                    </p>
                  )}
                </div>
              ) : (
                (() => {
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
                })()
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase">Custom Domain</h2>
              {isEditing ? (
                <input
                  type="text"
                  name="domain"
                  defaultValue={comic.domain || ''}
                  placeholder="example.com"
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              ) : comic.domain ? (
                (() => {
                  const isDev = import.meta.env.DEV;
                  const href = isDev
                    ? `http://${comic.domain}:5173`
                    : `https://${comic.domain}`;
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 break-all inline-block text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      {comic.domain}
                    </a>
                  );
                })()
              ) : (
                <p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">No custom domain</p>
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase">Description</h2>
              {isEditing ? (
                <textarea
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {comic.description || "—"}
                </p>
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase">Double Page Spread</h2>
              {isEditing ? (
                <label className="mt-1 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="doubleSpread"
                    checked={doubleSpread}
                    onChange={(e) => setDoubleSpread(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Use double page spread</span>
                </label>
              ) : (
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {comic.doubleSpread ? "Enabled" : "Disabled"}
                </p>
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase">Logo</h2>
              {(logoPreview || comic.logo) ? (
                <div className="mt-2 p-4 rounded bg-gray-200 dark:bg-gray-700 inline-block">
                  <img src={logoPreview || comic.logo!} alt="Logo" className="max-w-[200px] max-h-[100px]" />
                </div>
              ) : (
                <p className="mt-1 text-gray-500 text-sm">No logo</p>
              )}
              {isEditing && (
                <input
                  type="file"
                  name="logo"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleLogoChange}
                  className="mt-2 block w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 text-xs"
                />
              )}
            </div>
            {/* Chapters list moved to separate box above; removed from settings form */}
            {comic.chapters.length === 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase">Pages</h2>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {comic._count.pages} page{comic._count.pages !== 1 ? 's' : ''}
                </p>
              </div>
            )}
            <div className="text-sm text-gray-500">
              <p>Created: {comic.createdAt.toLocaleString()}</p>
              <p>Updated: {comic.updatedAt.toLocaleString()}</p>
            </div>
          </Form>
        </aside>
      </div>
    </main>
  );
}

function SortableChapter({ id, title, count }: { id: string; title: string; count: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
  };
  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-3 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span {...attributes} {...listeners} className="text-gray-400 select-none">⋮⋮</span>
        <span className="text-gray-900 dark:text-gray-100">{title}</span>
      </div>
      <span className="text-xs text-gray-500">{count} page{count !== 1 ? 's' : ''}</span>
    </li>
  );
}
