import type { Route } from "./+types/page.$pageNumber";
import { redirect, Link } from "react-router";
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

  const { pageNumber } = params;
  if (!pageNumber) {
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
    },
  });

  if (!comic) {
    throw new Response("Comic not found", { status: 404 });
  }

  // Get the standalone page (no chapter)
  const page = await prisma.page.findFirst({
    where: {
      comicId: comic.id,
      chapterId: null,
      number: pageNum,
    },
    select: {
      id: true,
      number: true,
      imageUrl: true,
    },
  });

  if (!page) {
    throw new Response("Page not found", { status: 404 });
  }

  // Get prev/next standalone pages
  const prevPage = await prisma.page.findFirst({
    where: {
      comicId: comic.id,
      chapterId: null,
      number: { lt: pageNum },
    },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const nextPage = await prisma.page.findFirst({
    where: {
      comicId: comic.id,
      chapterId: null,
      number: { gt: pageNum },
    },
    orderBy: { number: "asc" },
    select: { number: true },
  });

  return { comic, page, prevPage, nextPage };
}

export default function StandalonePage({ loaderData }: Route.ComponentProps) {
  const data = loaderData as {
    comic: { id: string; title: string };
    page: { id: string; number: number; imageUrl: string };
    prevPage: { number: number } | null;
    nextPage: { number: number } | null;
  } | undefined;
  
  if (!data) {
    throw new Response("Not Found", { status: 404 });
  }
  
  const { comic, page, prevPage, nextPage } = data;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-950 border-b border-gray-800 px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link to="/" className="text-white hover:text-gray-300 transition">
            <h1 className="text-lg font-semibold">{comic.title}</h1>
          </Link>
          <div className="text-sm text-gray-400">
            Page {page.number}
          </div>
        </div>
      </header>

      {/* Comic image with side navigation */}
      <main className="flex-1 flex items-center justify-center p-4">
        {(() => {
          usePageArrowNavigation(
            prevPage ? `/page/${prevPage.number}` : undefined,
            nextPage ? `/page/${nextPage.number}` : undefined
          );
          return null;
        })()}
        <div className="relative flex items-center gap-4">
          {/* Left arrow or placeholder */}
          {prevPage ? (
            <Link
              to={`/page/${prevPage.number}`}
              className="p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition shadow-lg"
              aria-label="Previous page"
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
              to={`/page/${nextPage.number}`}
              className="p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition shadow-lg"
              aria-label="Next page"
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

      {/* Navigation */}
      <nav className="bg-gray-950 border-t border-gray-800 px-4 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            {prevPage ? (
              <Link
                to={`/page/${prevPage.number}`}
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
            to="/"
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Back to Home
          </Link>
          <div>
            {nextPage ? (
              <Link
                to={`/page/${nextPage.number}`}
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
    </div>
  );
}
