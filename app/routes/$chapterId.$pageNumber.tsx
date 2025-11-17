import type { Route } from "./+types/$chapterId.$pageNumber";
import { redirect, Link } from "react-router";
import { useEffect } from "react"; // still used for other local effects if needed
import { usePageArrowNavigation } from "../hooks/usePageArrowNavigation";
import { extractSubdomain } from "../utils/subdomain.server";
import { prisma } from "../utils/db.server";

export function meta({ data }: Route.MetaArgs) {
  if (data?.page) {
    const fullDesc = data.comic.description?.replace(/\s+/g, ' ').trim() || `Read ${data.comic.title}`;
    const truncated = fullDesc.slice(0, 160) + (fullDesc.length > 160 ? '…' : '');
    
    // Build social image URL using the actual host and protocol from the request
    const host = data.host || 'webcomic.studio';
    const protocol = data.protocol || 'https';
    const ogImageUrl = `${protocol}://${host}/api/og-image/${data.comic.id}`;
    
    const meta: any[] = [
      { title: data.comic.tagline ? `${data.comic.title} • ${data.comic.tagline}` : data.comic.title },
      { name: "description", content: truncated },
      // Open Graph tags
      { property: "og:title", content: data.comic.title },
      { property: "og:description", content: truncated },
      { property: "og:image", content: ogImageUrl },
      { property: "og:type", content: "website" },
      // Twitter Card tags
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: data.comic.title },
      { name: "twitter:description", content: truncated },
      { name: "twitter:image", content: ogImageUrl },
    ];
    if (data.comic.favicon) {
      meta.push({ tagName: "link", rel: "icon", href: data.comic.favicon });
    }
    return meta;
  }
  return [{ title: "Page" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const host = request.headers.get("host");
  const url = new URL(request.url);
  const isPreview = url.searchParams.get("preview") === "true";
  
  // Support custom domains in dev/prod
  const isCustomDomain = host &&
    !host.includes('localhost') &&
    !host.includes('lvh.me') &&
    !host.includes('webcomic.studio');

  const { chapterId, pageNumber } = params;
  if (!chapterId || !pageNumber) {
    throw new Response("Not Found", { status: 404 });
  }

  const pageNum = parseInt(pageNumber, 10);
  if (isNaN(pageNum)) {
    throw new Response("Invalid page number", { status: 400 });
  }

  // Look up comic by slug (subdomain) or domain (custom domain)
  let comic = null as null | {
    id: string;
    title: string;
    description: string | null;
      tagline: string | null;
    logo: string | null;
    favicon: string | null;
    doubleSpread: boolean;
    chapters: { id: string; number: number; title: string; publishedDate: Date | null }[];
  };
  if (isCustomDomain) {
    const hostname = host!.split(':')[0];
    comic = await prisma.comic.findUnique({
      where: { domain: hostname },
      select: {
        id: true,
        title: true,
        description: true,
          tagline: true,
        logo: true,
        favicon: true,
        doubleSpread: true,
        chapters: {
          orderBy: { number: "asc" },
          select: { id: true, number: true, title: true, publishedDate: true },
        },
      },
    });
  } else {
    const subdomain = extractSubdomain(host);
    if (!subdomain) return redirect("/");
    comic = await prisma.comic.findUnique({
      where: { slug: subdomain },
      select: {
        id: true,
        title: true,
        description: true,
          tagline: true,
        logo: true,
        favicon: true,
        doubleSpread: true,
        chapters: {
          orderBy: { number: "asc" },
          select: { id: true, number: true, title: true, publishedDate: true },
        },
      },
    });
  }

  if (!comic) {
    throw new Response("Comic not found", { status: 404 });
  }

  // Apply preview overrides if present
  if (isPreview) {
    const description = url.searchParams.get("description");
    const doubleSpread = url.searchParams.get("doubleSpread");
    const chapterOrder = url.searchParams.get("chapterOrder");
    
    if (description !== null) {
      comic.description = description;
    }
    
    if (doubleSpread !== null) {
      comic.doubleSpread = doubleSpread === "true";
    }
    
    if (chapterOrder) {
      const orderIds = chapterOrder.split(',');
      const orderedChapters = orderIds
        .map(id => comic.chapters.find(ch => ch.id === id))
        .filter(Boolean);
      if (orderedChapters.length === comic.chapters.length) {
        comic.chapters = orderedChapters as typeof comic.chapters;
      }
    }
  }

  // Get the chapter and pages for this request
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
      // we'll fetch specific pages separately
    },
  });

  if (!chapter) {
    throw new Response("Page not found", { status: 404 });
  }
  // Block access if chapter has no publishedDate or is scheduled for future
  if (!chapter.publishedDate || new Date(chapter.publishedDate) > new Date()) {
    throw new Response("Not Found", { status: 404 });
  }

  // Determine spread start when enabled
  const normalizeToSpread = (n: number) => n - ((n - 1) % 2);
  const spreadStart = comic.doubleSpread ? normalizeToSpread(pageNum) : pageNum;

  // Fetch one or two pages depending on mode
  const pages = await prisma.page.findMany({
    where: {
      chapterId,
      number: comic.doubleSpread ? { in: [spreadStart, spreadStart + 1] } : { in: [pageNum] },
    },
    orderBy: { number: "asc" },
    select: { id: true, number: true, imageUrl: true },
  });
  if (!pages || pages.length === 0) {
    throw new Response("Page not found", { status: 404 });
  }
  const page = pages[0];

  // Get all page numbers for this chapter (for page selector and nav)
  const allPages = await prisma.page.findMany({
    where: { chapterId },
    orderBy: { number: "asc" },
    select: { number: true },
  });
  const pageNumbers = allPages.map(p => p.number);
  const lastNumber = pageNumbers[pageNumbers.length - 1] ?? 0;

  // Get prev/next based on single or spread navigation
  let prevPage: { number: number } | null = null;
  let nextPage: { number: number } | null = null;
  if (!comic.doubleSpread) {
    prevPage = await prisma.page.findFirst({
      where: { chapterId, number: { lt: pageNum } },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    nextPage = await prisma.page.findFirst({
      where: { chapterId, number: { gt: pageNum } },
      orderBy: { number: "asc" },
      select: { number: true },
    });
  } else {
    const prevStart = spreadStart - 2;
    const nextStart = spreadStart + 2;
    if (prevStart >= 1) prevPage = { number: prevStart };
    if (nextStart <= lastNumber) nextPage = { number: nextStart };
  }

  // If first page (no prevPage), fetch last page of previous published chapter
  let prevChapterLastPage: { chapterId: string; pageNumber: number } | null = null;
  if (!prevPage && spreadStart === 1) {
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
        const prevStartForPrevChapter = comic.doubleSpread ? normalizeToSpread(lastPage.number) : lastPage.number;
        prevChapterLastPage = { chapterId: previousChapter.id, pageNumber: prevStartForPrevChapter };
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
        const nextStartForNextChapter = comic.doubleSpread ? normalizeToSpread(firstPage.number) : firstPage.number;
        nextChapterFirstPage = { chapterId: nextChapter.id, pageNumber: nextStartForNextChapter };
      }
    }
  }

  return { comic, chapter, page, pages, spreadStart, pageNumbers, prevPage, nextPage, nextChapterFirstPage, prevChapterLastPage, host: host || '', protocol: url.protocol.replace(':', '') };
}

export default function ComicPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData as {
  comic: { id: string; title: string; tagline?: string | null; description?: string | null; logo?: string | null; doubleSpread?: boolean; chapters: { id: string; number: number; title: string; publishedDate: Date | null }[] };
    chapter: { id: string; number: number; title: string };
    page: { id: string; number: number; imageUrl: string };
    pages?: { id: string; number: number; imageUrl: string }[];
    spreadStart?: number;
    pageNumbers: number[];
    prevPage: { number: number } | null;
    nextPage: { number: number } | null;
    nextChapterFirstPage: { chapterId: string; pageNumber: number } | null;
    prevChapterLastPage: { chapterId: string; pageNumber: number } | null;
  } | undefined;
  
  if (!data) {
    throw new Response("Not Found", { status: 404 });
  }
  
  const { comic, chapter, page, pages, spreadStart, pageNumbers, prevPage, nextPage, nextChapterFirstPage, prevChapterLastPage } = data;
  const isDouble = !!comic.doubleSpread;
  const currentSpreadStart = isDouble && spreadStart ? spreadStart : page.number;

  // Get preview params from URL
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const previewParams = searchParams.toString();

  // Inject canonical link when double spread (Option B: no redirect)
  useEffect(() => {
    if (!isDouble) return;
    const canonicalPath = `/${chapter.id}/${currentSpreadStart}`;
    const href = `${window.location.origin}${canonicalPath}`;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
    return () => {
      // don't remove on unmount to keep latest canonical; no-op
    };
  }, [isDouble, chapter.id, currentSpreadStart]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-950 border-b border-gray-800 px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <Link to={`/${previewParams ? `?${previewParams}` : ''}`} className="text-white hover:text-gray-300 transition flex items-center gap-3">
            {comic.logo ? (
              <img src={comic.logo} alt={comic.title} className="max-h-[28px]" />
            ) : (
              <h1 className="text-lg font-semibold">{comic.title}</h1>
            )}
            {comic.tagline && (
              <p className="text-sm text-gray-400 hidden sm:block">
                {comic.tagline.slice(0, 80)}{comic.tagline.length > 80 ? '...' : ''}
              </p>
            )}
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <select
              value={chapter.id}
              onChange={(e) => {
                console.log(e.target.value);
                const selectedChapter = comic.chapters.find(ch => ch.id === e.target.value);
                if (selectedChapter) {
                  window.location.href = `/${selectedChapter.id}/1${previewParams ? `?${previewParams}` : ''}`;
                }
              }}
              className="bg-gray-800 text-white border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {comic.chapters
                .filter(ch => ch.publishedDate && new Date(ch.publishedDate) <= new Date())
                .map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title}
                  </option>
                ))}
            </select>
            <span className="text-gray-400">•</span>
            <select
              value={isDouble ? currentSpreadStart : page.number}
              onChange={(e) => {
                const num = parseInt(e.target.value, 10);
                if (!isNaN(num)) {
                  window.location.href = `/${chapter.id}/${num}${previewParams ? `?${previewParams}` : ''}`;
                }
              }}
              className="bg-gray-800 text-white border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {isDouble
                ? pageNumbers.filter(n => (n - 1) % 2 === 0).map((n) => (
                    <option key={n} value={n}>
                      {n}–{n + 1 <= (pageNumbers[pageNumbers.length - 1] ?? n) ? n + 1 : ""}
                    </option>
                  ))
                : pageNumbers.map((n) => (
                    <option key={n} value={n}>
                      Page {n}
                    </option>
                  ))}
            </select>
          </div>
        </div>
      </header>

      {/* Comic image with side navigation */}
      <main className="flex-1 flex items-center justify-center p-4">
        {/* Compute navigation URLs */}
        {(() => {
          const prevUrl = prevPage
            ? `/${chapter.id}/${prevPage.number}${previewParams ? `?${previewParams}` : ''}`
            : (prevChapterLastPage ? `/${prevChapterLastPage.chapterId}/${prevChapterLastPage.pageNumber}${previewParams ? `?${previewParams}` : ''}` : undefined);
          const nextUrl = nextPage
            ? `/${chapter.id}/${nextPage.number}${previewParams ? `?${previewParams}` : ''}`
            : (nextChapterFirstPage ? `/${nextChapterFirstPage.chapterId}/${nextChapterFirstPage.pageNumber}${previewParams ? `?${previewParams}` : ''}` : undefined);
          usePageArrowNavigation(prevUrl, nextUrl);

          return (
            <div className="flex items-center justify-center gap-4 max-w-full mx-auto">
              {/* Left arrow or placeholder */}
              {prevUrl ? (
                <Link
                  to={prevUrl}
                  className="p-2 md:p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition shadow-lg flex-shrink-0"
                  aria-label="Previous"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 md:w-6 md:h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </Link>
              ) : (
                <div className="p-2 md:p-3 w-8 h-8 md:w-12 md:h-12 before:content-[''] flex-shrink-0" aria-hidden="true" />
              )}

              {/* Image(s) */}
              {isDouble ? (
                nextUrl ? (
                  <Link to={nextUrl} className="flex flex-col md:flex-row items-center gap-px cursor-pointer min-w-0 flex-1">
                    <img
                      src={(pages && pages[0]) ? pages[0].imageUrl : page.imageUrl}
                      alt={`Page ${pages && pages[0] ? pages[0].number : page.number}`}
                      className="max-h-[90vh] w-auto object-contain max-w-full md:max-w-[calc(50vw-4rem)]"
                    />
                    {pages && pages[1] ? (
                      <img
                        src={pages[1].imageUrl}
                        alt={`Page ${pages[1].number}`}
                        className="max-h-[90vh] w-auto object-contain max-w-full md:max-w-[calc(50vw-4rem)]"
                      />
                    ) : null}
                  </Link>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-px min-w-0 flex-1">
                    <img
                      src={(pages && pages[0]) ? pages[0].imageUrl : page.imageUrl}
                      alt={`Page ${pages && pages[0] ? pages[0].number : page.number}`}
                      className="max-h-[90vh] w-auto object-contain max-w-full md:max-w-[calc(50vw-4rem)]"
                    />
                    {pages && pages[1] ? (
                      <img
                        src={pages[1].imageUrl}
                        alt={`Page ${pages[1].number}`}
                        className="max-h-[90vh] w-auto object-contain max-w-full md:max-w-[calc(50vw-4rem)]"
                      />
                    ) : null}
                  </div>
                )
              ) : (
                nextUrl ? (
                  <Link to={nextUrl}>
                    <img
                      src={page.imageUrl}
                      alt={`Page ${page.number}`}
                      className="max-h-[90vh] w-auto object-contain cursor-pointer"
                    />
                  </Link>
                ) : (
                  <img
                    src={page.imageUrl}
                    alt={`Page ${page.number}`}
                    className="max-h-[90vh] w-auto object-contain"
                  />
                )
              )}

              {/* Right arrow or placeholder */}
              {nextUrl ? (
                <Link
                  to={nextUrl}
                  className="p-2 md:p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition shadow-lg flex-shrink-0"
                  aria-label="Next"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 md:w-6 md:h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ) : (
                <div className="p-2 md:p-3 w-8 h-8 md:w-12 md:h-12 before:content-[''] flex-shrink-0" aria-hidden="true" />
              )}
            </div>
          );
        })()}
      </main>

      {/* Powered by footer */}
      <div className="fixed bottom-4 left-4 text-xs text-gray-500 dark:text-gray-400">
        Powered by{" "}
        <a
          href={import.meta.env.DEV ? "http://localhost:5173" : (import.meta.env.MODE === 'staging' || process.env.NODE_ENV === 'staging') ? "https://wcsstaging.com" : "https://webcomic.studio"}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-700 dark:hover:text-gray-300 underline transition"
        >
          WebComic Studio
        </a>
      </div>
    </div>
  );
}
