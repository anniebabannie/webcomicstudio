import type { Route } from "./+types/dashboard.$comicId.update";
import { useEffect, useRef, useState } from "react";
import { getAuth } from "@clerk/react-router/server";
import { useAuth, PricingTable } from "@clerk/react-router";
import { redirect, Form, Link, useActionData } from "react-router";
import { prisma } from "../utils/db.server";
// import { uuidv4 } from "../utils/uuid"; // not used in debug mode

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
  const pageCount = await prisma.page.count({ where: { comicId } });
  return { comicId, chapters, pageCount };
}

export default function UpdateComic({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const { comicId, chapters, pageCount } = loaderData as {
    comicId: string;
    chapters: { id: string; number: number; title: string }[];
    pageCount: number;
  };
  const { has, isLoaded } = useAuth();
  const PAGE_LIMIT = 42;
  const PREMIUM_PLAN = "premium"; // TODO: set to your exact Clerk plan slug
  const hasChapters = chapters.length > 0;
  const [showNewChapter, setShowNewChapter] = useState(false);
  const newChapterRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (showNewChapter) {
      // small delay to ensure element is in DOM before focusing
      const t = setTimeout(() => newChapterRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [showNewChapter]);
  // Gate: if over limit and user lacks premium, show upgrade notice instead of form
  if (isLoaded && !has({ plan: PREMIUM_PLAN }) && pageCount >= PAGE_LIMIT) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-2">
          <Link to={`/dashboard/${comicId}`} className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white">
            <span className="mr-1">←</span> Back to comic
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-4">Add Pages</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
          <h2 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">Premium required</h2>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            You’ve reached the free limit of {PAGE_LIMIT} pages. Upgrade to the Premium plan to add more pages.
          </p>
          <div className="mt-3 flex gap-3">
            <Link to="/pricing" className="inline-flex items-center rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2">View plans</Link>
            <Link to={`/dashboard/${comicId}`} className="inline-flex items-center rounded-md bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 text-sm px-4 py-2">Back</Link>
          </div>
          <div className="mt-6">
            <PricingTable />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2">
        <Link to={`/dashboard/${comicId}`} className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white">
          <span className="mr-1">←</span> Back to comic
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Add Pages</h1>

      {actionData?.blocked && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 p-4">
          <h2 className="font-semibold text-red-900 dark:text-red-200 mb-1">Upload blocked</h2>
          <p className="text-sm text-red-800 dark:text-red-300">
            It looks like some of your pages include adult content. Unfortunately, this is prohibited material on WebComic Studio.
          </p>
        </div>
      )}

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
            if (file.size > 3 * 1024 * 1024) {
              e.preventDefault();
              alert("Each file must be 3MB or smaller.");
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
          <p className="text-xs text-gray-500">Select JPEG, PNG, or WebP images (max 3MB each).</p>
        </fieldset>

        {hasChapters && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-gray-500 uppercase">Chapter</legend>
            <select
              name="chapterId"
              disabled={showNewChapter}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              defaultValue={chapters[0]?.id ?? ""}
            >
              {chapters.map(c => (
                <option key={c.id} value={c.id}>Chapter {c.number}: {c.title}</option>
              ))}
            </select>

            {/* Toggle: New Chapter */}
            {!showNewChapter ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChapter(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <span className="text-base leading-none">＋</span>
                  New chapter
                </button>
              </div>
            ) : (
              <div className="pt-2 flex items-center gap-2">
                <input
                  ref={newChapterRef}
                  id="newChapterTitle"
                  type="text"
                  name="newChapterTitle"
                  placeholder="Enter new chapter title"
                  className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newChapterRef.current) newChapterRef.current.value = "";
                    setShowNewChapter(false);
                  }}
                  className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500">Leave blank to use the selected chapter.</p>
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

      {/* Vision API Debug Output */}
      {actionData?.visionResults && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-bold">Vision API Results (Debug)</h2>
          {actionData.visionResults.map((result: any, idx: number) => (
            <div key={idx} className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <h3 className="font-semibold mb-2">{result.filename}</h3>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
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

    // Sort files by filename using natural (numeric-aware) order so 2 < 10
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const sortedFiles = files.slice().sort((a, b) => collator.compare(a.name, b.name));

    // 1) Scan ALL images with Vision first
    const vision = await import("@google-cloud/vision");
    const client = new vision.ImageAnnotatorClient();
    type VisionItem = { filename: string; data: any; allowed: boolean };
    const visionResults: VisionItem[] = [];

    const isAllowed = (safe?: any | null) => {
      const level = String(safe?.adult ?? "UNLIKELY").toUpperCase();
      // Block only when adult is VERY_LIKELY
      return level !== "VERY_LIKELY";
    };

    for (const file of sortedFiles) {
      const original = Buffer.from(await file.arrayBuffer());
      try {
        const [result] = await client.annotateImage({
          image: { content: original },
          features: [{ type: 'SAFE_SEARCH_DETECTION' }]
        });
        const safe = result.safeSearchAnnotation;
        const allowed = isAllowed(safe);
        visionResults.push({ filename: file.name, data: { safeSearch: safe }, allowed });
      } catch (err) {
        console.error("Vision API error for", file.name, err);
        visionResults.push({ filename: file.name, data: { error: String(err) }, allowed: false });
      }
    }

    const anyBlocked = visionResults.some(v => !v.allowed);
    if (anyBlocked) {
      // Abort and show results; nothing uploaded
      return { visionResults, blocked: true };
    }

    // 2) If all pass, proceed to resize and upload to S3, then create pages
    // Gather chapter selection
    const newChapterTitle = String(formData.get("newChapterTitle") || "").trim();
    const selectedChapterId = String(formData.get("chapterId") || "").trim();
    let chapterId: string | null = null;
    if (newChapterTitle) {
      const count = await prisma.chapter.count({ where: { comicId } });
      const number = count + 1;
      const newChapter = await prisma.chapter.create({ data: { comicId, title: newChapterTitle, number } });
      chapterId = newChapter.id;
    } else if (selectedChapterId) {
      const exists = await prisma.chapter.findFirst({ where: { id: selectedChapterId, comicId }, select: { id: true } });
      chapterId = exists ? exists.id : null;
    }

    const maxPage = await prisma.page.findFirst({
      where: { comicId, chapterId: chapterId ?? null },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    let nextPageNumber = (maxPage?.number ?? 0) + 1;

    const { uploadBufferToS3 } = await import("../utils/s3.server");
    const { convertToWebP, generateThumbnail } = await import("../utils/image.server");
    const { uuidv4 } = await import("../utils/uuid");

    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      const pageNumber = nextPageNumber + i;
      const original = Buffer.from(await file.arrayBuffer());
      const webp = await convertToWebP(original, 75, 1500);
      const thumbnail = await generateThumbnail(original, 400, 75);
      const ext = 'webp';
      const uuid = uuidv4();
      const s3Key = `${userId}/${comicId}/${pageNumber}-${uuid}.${ext}`;
      const thumbnailKey = `${userId}/${comicId}/${pageNumber}-${uuid}-thumbnail.${ext}`;
      const imageUrl = await uploadBufferToS3(webp, s3Key, 'image/webp');
      await uploadBufferToS3(thumbnail, thumbnailKey, 'image/webp');
      await prisma.page.create({ data: { comicId, chapterId, imageUrl, number: pageNumber } });
    }

    return redirect(`/dashboard/${comicId}`);
  }

  return new Response("Unknown intent", { status: 400 });
}
