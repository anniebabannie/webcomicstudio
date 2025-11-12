import type { Route } from "./+types/$chapterId.$pageNumber";
import { redirect, Link } from "react-router";
import { useEffect } from "react"; // still used for other local effects if needed
import { usePageArrowNavigation } from "../hooks/usePageArrowNavigation";
import { extractSubdomain } from "../utils/subdomain.server";
import { prisma } from "../utils/db.server";

export function meta({ data }: Route.MetaArgs) {
  if (data?.page) {
    return [
      { title: `Page ${data.page.number} • ${data.comic.title}` },
    ];
  }
  return [{ title: "Page" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const host = request.headers.get("host");
  const subdomain = extractSubdomain(host);

  if (!subdomain) {
    return redirect("/");
  }

  const { chapterId, pageNumber } = params;
  if (!chapterId || !pageNumber) {
    throw new Response("Not Found", { status: 404 });
  }

  const pageNum = parseInt(pageNumber, 10);
  if (isNaN(pageNum)) {
    throw new Response("Invalid page number", { status: 400 });
  }

  // Look up comic by slug
  const comic = await prisma.comic.findUnique({
    where: { slug: subdomain },
    select: {
      id: true,
      title: true,
      chapters: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          title: true,
          publishedDate: true,
        },
      },
    },
  });

  if (!comic) {
    throw new Response("Comic not found", { status: 404 });
  }

  // Get the chapter and page
  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      comicId: comic.id,
    },
    select: {
      id: true,
      number: true,
      title: true,
      publishedDate: true,
      pages: {
        where: { number: pageNum },
        select: {
          id: true,
          number: true,
          imageUrl: true,
        },
      },
    },
  });

  if (!chapter || chapter.pages.length === 0) {
    throw new Response("Page not found", { status: 404 });
  }
  // Block access if chapter is scheduled for future
  if (chapter.publishedDate && new Date(chapter.publishedDate) > new Date()) {
    throw new Response("Not Found", { status: 404 });
  }

  const page = chapter.pages[0];

  // Get prev/next pages in this chapter
  const prevPage = await prisma.page.findFirst({
    where: {
      chapterId,
      number: { lt: pageNum },
    },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const nextPage = await prisma.page.findFirst({
    where: {
      chapterId,
      number: { gt: pageNum },
    },
    orderBy: { number: "asc" },
    select: { number: true },
  });

  // If first page (no prevPage), fetch last page of previous published chapter
  let prevChapterLastPage: { chapterId: string; pageNumber: number } | null = null;
  if (!prevPage && pageNum === 1) {
    const previousChapter = await prisma.chapter.findFirst({
      where: {
        comicId: comic.id,
        number: { lt: chapter.number },
        OR: [
          { publishedDate: null },
          { publishedDate: { lte: new Date() } },
        ],
      },
      orderBy: { number: "desc" },
      select: { id: true },
    });
    if (previousChapter) {
      const lastPage = await prisma.page.findFirst({
        where: { chapterId: previousChapter.id },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      if (lastPage) {
        prevChapterLastPage = { chapterId: previousChapter.id, pageNumber: lastPage.number };
      }
    }
  }

  // If no next page inside this chapter, find first page of next published chapter
  let nextChapterFirstPage: { chapterId: string; pageNumber: number } | null = null;
  if (!nextPage) {
    const nextChapter = await prisma.chapter.findFirst({
      where: {
        comicId: comic.id,
        number: { gt: chapter.number },
        OR: [
          { publishedDate: null },
          { publishedDate: { lte: new Date() } },
        ],
      },
      orderBy: { number: "asc" },
      select: { id: true },
    });
    if (nextChapter) {
      const firstPage = await prisma.page.findFirst({
        where: { chapterId: nextChapter.id },
        orderBy: { number: "asc" },
        select: { number: true },
      });
      if (firstPage) {
        nextChapterFirstPage = { chapterId: nextChapter.id, pageNumber: firstPage.number };
      }
    }
  }

  return { comic, chapter, page, prevPage, nextPage, nextChapterFirstPage, prevChapterLastPage };
}

export default function ComicPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData as {
    comic: { id: string; title: string; chapters: { id: string; number: number; title: string; publishedDate: Date | null }[] };
    chapter: { id: string; number: number; title: string };
    page: { id: string; number: number; imageUrl: string };
    prevPage: { number: number } | null;
    nextPage: { number: number } | null;
    nextChapterFirstPage: { chapterId: string; pageNumber: number } | null;
    prevChapterLastPage: { chapterId: string; pageNumber: number } | null;
  } | undefined;
  
  if (!data) {
    throw new Response("Not Found", { status: 404 });
  }
  
  const { comic, chapter, page, prevPage, nextPage, nextChapterFirstPage, prevChapterLastPage } = data;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-950 border-b border-gray-800 px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link to="/" className="text-white hover:text-gray-300 transition">
            <h1 className="text-lg font-semibold">{comic.title}</h1>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <select
              value={chapter.id}
              onChange={(e) => {
                console.log(e.target.value);
                const selectedChapter = comic.chapters.find(ch => ch.id === e.target.value);
                if (selectedChapter) {
                  window.location.href = `/${selectedChapter.id}/1`;
                }
              }}
              className="bg-gray-800 text-white border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {comic.chapters
                .filter(ch => !ch.publishedDate || new Date(ch.publishedDate) <= new Date())
                .map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title}
                  </option>
                ))}
            </select>
            <span className="text-gray-400">•</span>
            <span className="text-gray-400">Page {page.number}</span>
          </div>
        </div>
      </header>

      {/* Comic image with side navigation */}
      <main className="flex-1 flex items-center justify-center p-4">
        {/* Arrow key navigation hook call */}
        {(() => {
          const prevUrl = prevPage
            ? `/${chapter.id}/${prevPage.number}`
            : (prevChapterLastPage ? `/${prevChapterLastPage.chapterId}/${prevChapterLastPage.pageNumber}` : undefined);
          const nextUrl = nextPage
            ? `/${chapter.id}/${nextPage.number}`
            : (nextChapterFirstPage ? `/${nextChapterFirstPage.chapterId}/${nextChapterFirstPage.pageNumber}` : undefined);
          usePageArrowNavigation(prevUrl, nextUrl);
          return null;
        })()}
        <div className="relative flex items-center gap-4">
          {/* Left arrow or placeholder */}
          {prevPage ? (
            <Link
              to={`/${chapter.id}/${prevPage.number}`}
              className="p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition shadow-lg"
              aria-label="Previous page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
          ) : prevChapterLastPage ? (
            <Link
              to={`/${prevChapterLastPage.chapterId}/${prevChapterLastPage.pageNumber}`}
              className="p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition shadow-lg"
              aria-label="Previous chapter"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
          ) : (
            <div className="p-3 w-12 h-12 before:content-['']" aria-hidden="true" />
          )}

          <img
            src={page.imageUrl}
            alt={`Page ${page.number}`}
            className="max-h-[90vh] w-auto object-contain"
          />

          {/* Right arrow or placeholder */}
          {nextPage ? (
            <Link
              to={`/${chapter.id}/${nextPage.number}`}
              className="p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition shadow-lg"
              aria-label="Next page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ) : nextChapterFirstPage ? (
            <Link
              to={`/${nextChapterFirstPage.chapterId}/${nextChapterFirstPage.pageNumber}`}
              className="p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition shadow-lg"
              aria-label="Next chapter"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ) : (
            <div className="p-3 w-12 h-12 before:content-['']" aria-hidden="true" />
          )}
        </div>
      </main>
    </div>
  );
}
