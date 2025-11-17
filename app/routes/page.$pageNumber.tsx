import type { Route } from "./+types/page.$pageNumber";
import { redirect, Link } from "react-router";
import { useEffect } from "react";
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
    
    return [
      { title: `Page ${data.page.number} • ${data.comic.title}` },
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

  const { pageNumber } = params;
  if (!pageNumber) {
    throw new Response("Not Found", { status: 404 });
  }

  const pageNum = parseInt(pageNumber, 10);
  if (isNaN(pageNum)) {
    throw new Response("Invalid page number", { status: 400 });
  }

  // Look up comic by slug (subdomain) or domain (custom domain)
  let comic = null as null | { id: string; title: string; description: string | null; logo: string | null; doubleSpread: boolean };
  if (isCustomDomain) {
    const hostname = host!.split(':')[0];
    comic = await prisma.comic.findUnique({
      where: { domain: hostname },
      select: { id: true, title: true, description: true, logo: true, doubleSpread: true },
    });
  } else {
    const subdomain = extractSubdomain(host);
    if (!subdomain) return redirect("/");
    comic = await prisma.comic.findUnique({
      where: { slug: subdomain },
      select: { id: true, title: true, description: true, logo: true, doubleSpread: true },
    });
  }

  if (!comic) {
    throw new Response("Comic not found", { status: 404 });
  }

  // Apply preview overrides if present
  if (isPreview) {
    const description = url.searchParams.get("description");
    const doubleSpread = url.searchParams.get("doubleSpread");
    
    if (description !== null) {
      comic.description = description;
    }
    
    if (doubleSpread !== null) {
      comic.doubleSpread = doubleSpread === "true";
    }
  }

  // Determine spread start when enabled
  const normalizeToSpread = (n: number) => n - ((n - 1) % 2);
  const spreadStart = comic.doubleSpread ? normalizeToSpread(pageNum) : pageNum;

  // Get the standalone page(s) (no chapter)
  const pages = await prisma.page.findMany({
    where: {
      comicId: comic.id,
      chapterId: null,
      number: comic.doubleSpread ? { in: [spreadStart, spreadStart + 1] } : { in: [pageNum] },
    },
    orderBy: { number: "asc" },
    select: { id: true, number: true, imageUrl: true },
  });
  const page = pages[0];
  if (!page) {
    throw new Response("Page not found", { status: 404 });
  }

  // Get prev/next standalone pages
  // Get prev/next standalone pages
  let prevPage: { number: number } | null = null;
  let nextPage: { number: number } | null = null;
  if (!comic.doubleSpread) {
    prevPage = await prisma.page.findFirst({
      where: { comicId: comic.id, chapterId: null, number: { lt: pageNum } },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    nextPage = await prisma.page.findFirst({
      where: { comicId: comic.id, chapterId: null, number: { gt: pageNum } },
      orderBy: { number: "asc" },
      select: { number: true },
    });
  } else {
    const allStandalone = await prisma.page.findMany({
      where: { comicId: comic.id, chapterId: null },
      orderBy: { number: "asc" },
      select: { number: true },
    });
    const nums = allStandalone.map(p => p.number);
    const last = nums[nums.length - 1] ?? 0;
    const prevStart = spreadStart - 2;
    const nextStart = spreadStart + 2;
    if (prevStart >= 1) prevPage = { number: prevStart };
    if (nextStart <= last) nextPage = { number: nextStart };
  }

  const isDev = process.env.NODE_ENV === 'development';
  const isStaging = process.env.NODE_ENV === 'staging';
  const baseDomain = isDev ? 'localhost:5173' : isStaging ? 'wcsstaging.com' : 'webcomic.studio';

  return { comic, page, pages, spreadStart, prevPage, nextPage, host: host || '', protocol: url.protocol.replace(':', ''), baseDomain };
}

export default function StandalonePage({ loaderData }: Route.ComponentProps) {
  const data = loaderData as {
    comic: { id: string; title: string; description?: string | null; logo?: string | null; doubleSpread?: boolean };
    page: { id: string; number: number; imageUrl: string };
    pages?: { id: string; number: number; imageUrl: string }[];
    spreadStart?: number;
    prevPage: { number: number } | null;
    nextPage: { number: number } | null;
    baseDomain: string;
  } | undefined;
  
  if (!data) {
    throw new Response("Not Found", { status: 404 });
  }
  
  const { comic, page, pages, spreadStart, prevPage, nextPage, baseDomain } = data;
  const isDouble = !!comic.doubleSpread;
  const currentSpreadStart = isDouble && spreadStart ? spreadStart : page.number;

  // Get preview params from URL
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const previewParams = searchParams.toString();

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
            {comic.description && (
              <p className="text-sm text-gray-400 hidden sm:block">
                {comic.description.slice(0, 100)}{comic.description.length > 100 ? '...' : ''}
              </p>
            )}
          </Link>
          <div className="text-sm text-gray-400">
            Page {page.number}
          </div>
        </div>
      </header>

      {/* Canonical for spreads (Option B) */}
      {isDouble ? (
        <script dangerouslySetInnerHTML={{ __html: `(${function(href:string){var link=document.querySelector('link[rel="canonical"]');if(!link){link=document.createElement('link');link.setAttribute('rel','canonical');document.head.appendChild(link);}link.setAttribute('href',href);} })("${typeof window!=="undefined" ? `${window.location.origin}/page/${currentSpreadStart}` : ''}")` }} />
      ) : null}

      {/* Comic image with side navigation */}
      <main className="flex-1 flex items-center justify-center p-4">
        {(() => {
          usePageArrowNavigation(
            prevPage ? `/page/${prevPage.number}${previewParams ? `?${previewParams}` : ''}` : undefined,
            nextPage ? `/page/${nextPage.number}${previewParams ? `?${previewParams}` : ''}` : undefined
          );
          return null;
        })()}
        <div className="flex items-center justify-center gap-4 max-w-full mx-auto">
          {/* Left arrow or placeholder */}
          {prevPage ? (
            <Link
              to={`/page/${prevPage.number}${previewParams ? `?${previewParams}` : ''}`}
              className="p-2 md:p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition shadow-lg flex-shrink-0"
              aria-label="Previous page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 md:w-6 md:h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
          ) : (
            <div className="p-2 md:p-3 w-8 h-8 md:w-12 md:h-12 before:content-[''] flex-shrink-0" aria-hidden="true" />
          )}

          {isDouble ? (
            nextPage ? (
              <Link to={`/page/${nextPage.number}${previewParams ? `?${previewParams}` : ''}`} className="flex flex-col md:flex-row items-center gap-px cursor-pointer min-w-0 flex-1">
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
            <img
              src={page.imageUrl}
              alt={`Page ${page.number}`}
              className="max-h-[90vh] w-auto object-contain"
            />
          )}

          {/* Right arrow or placeholder */}
          {nextPage ? (
            <Link
              to={`/page/${nextPage.number}${previewParams ? `?${previewParams}` : ''}`}
              className="p-2 md:p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition shadow-lg flex-shrink-0"
              aria-label="Next page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 md:w-6 md:h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ) : (
            <div className="p-2 md:p-3 w-8 h-8 md:w-12 md:h-12 before:content-[''] flex-shrink-0" aria-hidden="true" />
          )}
        </div>
      </main>

      {/* Navigation */}
      <nav className="bg-gray-950 border-t border-gray-800 px-4 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            {prevPage ? (
              <Link
                to={`/page/${prevPage.number}${previewParams ? `?${previewParams}` : ''}`}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 rounded-md transition"
              >
                ← Previous
              </Link>
            ) : (
              <div className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-900 rounded-md cursor-not-allowed">
                ← Previous
              </div>
            )}
          </div>
          <Link
            to={`/${previewParams ? `?${previewParams}` : ''}`}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Back to Home
          </Link>
          <div>
            {nextPage ? (
              <Link
                to={`/page/${nextPage.number}${previewParams ? `?${previewParams}` : ''}`}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 rounded-md transition"
              >
                Next →
              </Link>
            ) : (
              <div className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-900 rounded-md cursor-not-allowed">
                Next →
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Powered by footer */}
      <div className="fixed bottom-4 left-4 text-xs text-gray-500 dark:text-gray-400">
        Powered by{" "}
        <a
          href={baseDomain.includes('localhost') ? `http://${baseDomain}` : `https://${baseDomain}`}
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
