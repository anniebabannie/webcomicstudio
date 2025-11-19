import type { Route } from "./+types/home";
import { SignedOut, SignInButton, SignUpButton } from '@clerk/react-router';
import { Link, redirect } from 'react-router';
import { useEffect } from 'react';
import { extractSubdomain } from '../utils/subdomain.server';
import { prisma } from '../utils/db.server';
import { NavBar } from '../components/NavBar';
import { ComicHeader } from '../components/ComicHeader';
import { ComicFooter } from '../components/ComicFooter';

export function meta({ data }: Route.MetaArgs) {
  if (data?.comic) {
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
  return [
    { title: "WebComic Studio" },
    { name: "description", content: "Publish your webcomic in minutes" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const host = request.headers.get("host");
  console.log("Host header:", host);
  
  const url = new URL(request.url);
  const isPreview = url.searchParams.get("preview") === "true";
  
  // Check if this is a custom domain (not localhost or webcomic.studio)
  const isCustomDomain = host && 
    !host.includes('localhost') && 
    !host.includes('webcomic.studio') &&
    !host.includes('wcsstaging.com');

  let comic = null;

  if (isCustomDomain) {
    // Custom domain lookup - remove port if present
    const hostname = host.split(':')[0];
    comic = await prisma.comic.findUnique({
      where: { domain: hostname },
      select: {
        id: true,
        title: true,
        description: true,
          tagline: true,
        thumbnail: true,
        logo: true,
        favicon: true,
        theme: true,
        doubleSpread: true,
        chapters: {
          select: {
            id: true,
            number: true,
            title: true,
            publishedDate: true,
            pages: {
              select: {
                id: true,
                number: true,
              },
              orderBy: { number: 'asc' },
            },
          },
          orderBy: { number: 'asc' },
        },
        pages: {
          select: {
            id: true,
            number: true,
            chapterId: true,
          },
          where: { chapterId: null },
          orderBy: { number: 'asc' },
          take: 1,
        },
      },
    });
  } else {
    // Subdomain lookup (existing logic)
    const subdomain = extractSubdomain(host);
    if (subdomain) {
      comic = await prisma.comic.findUnique({
        where: { slug: subdomain },
        select: {
          id: true,
          title: true,
          description: true,
            tagline: true,
          thumbnail: true,
          logo: true,
          favicon: true,
          theme: true,
          doubleSpread: true,
          chapters: {
            select: {
              id: true,
              number: true,
              title: true,
              publishedDate: true,
              pages: {
                select: {
                  id: true,
                  number: true,
                },
                orderBy: { number: 'asc' },
              },
            },
            orderBy: { number: 'asc' },
          },
          pages: {
            select: {
              id: true,
              number: true,
              chapterId: true,
            },
            where: { chapterId: null },
            orderBy: { number: 'asc' },
            take: 1,
          },
        },
      });
    }
  }

  if (comic) {
    // Load published site pages for top nav
    const sitePages = await prisma.sitePage.findMany({
      where: {
        comicId: comic.id,
        publishedDate: { lte: new Date() },
      },
      select: { linkText: true, slug: true },
      orderBy: { linkText: 'asc' },
    });
    // Apply preview overrides if present
    if (isPreview) {
      const description = url.searchParams.get("description");
      const chapterOrder = url.searchParams.get("chapterOrder");
      
      if (description !== null) {
        comic.description = description;
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
    
    const isDev = process.env.NODE_ENV === 'development';
    const isStaging = process.env.NODE_ENV === 'staging';
    const baseDomain = isDev ? 'localhost:5173' : isStaging ? 'wcsstaging.com' : 'webcomic.studio';
    
    return { type: 'comic' as const, comic, sitePages, host: host || '', protocol: url.protocol.replace(':', ''), baseDomain };
  }

  // Root domain - show marketing page
  const isDev = process.env.NODE_ENV === 'development';
  const isStaging = process.env.NODE_ENV === 'staging';
  const baseDomain = isDev ? 'localhost:5173' : isStaging ? 'wcsstaging.com' : 'webcomic.studio';
  
  return { type: 'admin' as const, host: host || '', protocol: url.protocol.replace(':', ''), baseDomain };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  // If this is a comic subdomain, show public comic homepage
  if (loaderData.type === 'comic') {
  const { comic, sitePages = [] } = loaderData as typeof loaderData & { sitePages?: { linkText: string; slug: string }[] };

    // Apply theme via data-theme attribute and comic-theme class
    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const mod = await import('../themes');
          const name = mod.resolveThemeName((comic as any).theme as string | undefined);
          if (!cancelled) {
            document.documentElement.setAttribute('data-theme', name);
            document.body.classList.add('comic-theme');
          }
        } catch {
          if (!cancelled) {
            document.documentElement.setAttribute('data-theme', 'navy');
            document.body.classList.add('comic-theme');
          }
        }
      })();
      return () => { 
        cancelled = true;
        document.body.classList.remove('comic-theme');
      };
    }, [/* comic id/theme */ (comic as any).theme]);
    
    // Get preview params from URL
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const previewParams = searchParams.toString();
    
    // Filter published chapters: must have a publishedDate and it must not be in the future
    const publishedChapters = comic.chapters.filter(
      (ch) => ch.publishedDate && new Date(ch.publishedDate) <= new Date()
    );
    
    // Determine the first page URL
    let firstPageUrl: string | null = null;
    if (publishedChapters.length > 0 && publishedChapters[0].pages.length > 0) {
      // First page of first chapter
      const firstChapter = publishedChapters[0];
      const firstPage = firstChapter.pages[0];
      firstPageUrl = `/${firstChapter.id}/${firstPage.number}${previewParams ? `?${previewParams}` : ''}`;
    } else if (comic.pages.length > 0) {
      // First standalone page (no chapter)
      const firstPage = comic.pages[0];
      firstPageUrl = `/page/${firstPage.number}${previewParams ? `?${previewParams}` : ''}`;
    }
    
    return (
  <div className="min-h-screen text-[var(--text)] flex flex-col">
        <ComicHeader
          comic={comic}
          chapters={comic.chapters}
          sitePages={sitePages}
          previewParams={previewParams}
        />

        {/* Main content - centered cover */}
  <main className="flex-1 flex items-center justify-center p-4">
          {comic.thumbnail ? (
            firstPageUrl ? (
              <Link to={firstPageUrl} className="block relative group">
                <img
                  src={comic.thumbnail}
                  alt={`${comic.title} cover`}
                  className="max-h-[90vh] w-auto"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition">
                  <span className="opacity-0 group-hover:opacity-100 bg-white/90 dark:bg-gray-900/90 px-6 py-3 rounded-lg text-base font-semibold transition shadow-xl text-gray-900">
                    Start Reading →
                  </span>
                </div>
              </Link>
            ) : (
              <img
                src={comic.thumbnail}
                alt={`${comic.title} cover`}
                className="max-h-[90vh] w-auto"
              />
            )
          ) : firstPageUrl ? (
            <Link to={firstPageUrl} className="block relative group">
              <div className="relative h-[90vh] aspect-[2/3] max-w-full rounded-lg border border-[var(--border)] bg-[var(--page-bg)] flex items-center justify-center">
                <h2 className="px-6 text-center text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--text)]">
                  {comic.title}
                </h2>
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition">
                  <span className="opacity-0 group-hover:opacity-100 bg-white/90 dark:bg-gray-900/90 px-6 py-3 rounded-lg text-base font-semibold transition shadow-xl text-gray-900">
                    Start Reading →
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="relative h-[90vh] aspect-[2/3] max-w-full rounded-lg border border-[var(--border)] bg-[var(--page-bg)] flex items-center justify-center">
              <h2 className="px-6 text-center text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--text)]">
                {comic.title}
              </h2>
            </div>
          )}
        </main>

        <ComicFooter baseDomain={loaderData.baseDomain} comicId={comic.id} />
      </div>
    );
  }

  // Marketing homepage for root domain
  return(
    <>
      <NavBar />
      <section className="relative overflow-hidden min-h-screen flex items-center">
        {/* Background image with color overlay blend */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage: "linear-gradient(to bottom right, rgba(168, 85, 247, 1), rgba(236, 72, 153, 1)), url('/ai-bg-1.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundBlendMode: "screen"
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:py-24 w-full">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-shadow-lg text-shadow-white">
              Publish your webcomic in minutes
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Create chapters, upload pages, and point your custom domain. We handle the site so you can focus on the story.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <SignedOut>
                <SignUpButton mode="modal">
                  <button className="inline-flex items-center justify-center rounded-md px-5 py-3 text-base font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition">
                    Get started — it’s free
                  </button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <button className="inline-flex items-center justify-center rounded-md px-5 py-3 text-base font-medium bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 dark:bg-gray-900 dark:text-white dark:border-gray-700 dark:hover:bg-gray-800 transition">
                    Sign in
                  </button>
                </SignInButton>
              </SignedOut>
              <Link to="#features" className="text-indigo-600 hover:underline text-base">
                Learn more →
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 shadow-sm flex flex-col">
              {/* Mac style traffic light title bar */}
              <div className="flex items-center gap-2 px-3 h-8 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-[#ff5f56]"></span>
                  <span className="h-3 w-3 rounded-full bg-[#ffbd2e]"></span>
                  <span className="h-3 w-3 rounded-full bg-[#27c93f]"></span>
                </div>
                <div className="mx-auto text-xs text-gray-500 dark:text-gray-400 select-none tracking-tight">
                  your-comic.webcomic.studio
                </div>
              </div>
              {/* Window content */}
              <div className="flex-1 flex flex-col">
                {/* Fake site navigation */}
                <div className="h-9 px-4 flex items-center text-sm bg-gray-50 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800">
                  <span className="font-semibold text-gray-700 dark:text-gray-200 tracking-tight">Your Comic</span>
                </div>
                {/* Centered comic page placeholder */}
                <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-gray-100 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
                  <div className="aspect-[2/3] w-40 sm:w-48 md:w-56 lg:w-64 max-h-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 shadow-inner p-1 flex flex-col gap-1">
                    {/* New top row: two panels */}
                    <div className="flex gap-1">
                      <div className="w-1/3 h-20 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800" />
                      <div className="w-2/3 h-20 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800" />
                    </div>
                    {/* Middle row: 2 panels */}
                    <div className="flex gap-1">
                      <div className="w-2/3 h-16 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800" />
                      <div className="w-1/3 h-16 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800" />
                    </div>
                    {/* Existing wide panel */}
                    <div className="flex-1 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800" />
                    {/* Bottom row: 3 panels */}
                    <div className="flex gap-1">
                      <div className="flex-1 h-28 flex flex-col gap-1">
                        <div className="flex-1 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800" />
                        <div className="flex-1 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800" />
                      </div>
                      <div className="flex-1 h-28 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
