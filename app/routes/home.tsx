import type { Route } from "./+types/home";
import { SignedOut, SignInButton, SignUpButton } from '@clerk/react-router';
import { Link, redirect } from 'react-router';
import { useEffect } from 'react';
import { extractSubdomain } from '../utils/subdomain.server';
import { prisma } from '../utils/db.server';
import { NavBar } from '../components/NavBar';
import { ComicHeader } from '../components/ComicHeader';
import { ComicFooter } from '../components/ComicFooter';
import { Button } from "~/components/Button";

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
  <div className="min-h-screen text-(--text) flex flex-col">
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
              <div className="relative h-[90vh] aspect-2/3 max-w-full rounded-lg border border-(--border) bg-(--page-bg) flex items-center justify-center">
                <h2 className="px-6 text-center text-2xl sm:text-3xl md:text-4xl font-bold text-(--text)">
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
            <div className="relative h-[90vh] aspect-2/3 max-w-full rounded-lg border border-(--border) bg-(--page-bg) flex items-center justify-center">
              <h2 className="px-6 text-center text-2xl sm:text-3xl md:text-4xl font-bold text-(--text)">
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
      <section className="overflow-hidden pt-52 h-screen min-h-[100px] max-h-[1100px] bg-cover bg-center -mt-[60px]" style={{ backgroundImage: 'url(/comic-collage.png)' }}>
        <div className="mx-auto max-w-6xl px-4 w-full">
          <div className="flex flex-col items-center text-center max-w-5xl mx-auto gap-8">
            <h1>Publish your webcomic in seconds.</h1>
            <p>The easiest place to build a website for your comic. <br/>Publish your first 100 pages for free, then it’s just $3.99/mo.</p>
            <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
              <Button size="lg">Get Started for Free</Button>
            </SignUpButton>
          </div>
          <div className="mt-16 flex justify-center pointer-none pointer-events-none">
            <img
              src="/comic-browser-demo.png"
              alt="Comic browser demo"
            />
          </div>
      </div>
    </section>
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center">
            <h3>Step 1</h3>
            <p>Create a comic</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <h3>Step 2</h3>
            <p>Upload pages</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <h3>Step 3</h3>
            <p>Publish</p>
          </div>
        </div>
      </div>
    </section>
    <section className="py-16 sm:py-24" style={{ background: 'linear-gradient(135deg, rgba(221, 76, 209, 0.1), rgba(82, 55, 191, 0.1))' }}>
      <div className="mx-auto max-w-6xl px-4 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2>Bring your own domain</h2>
            <p>Securely host your comic under your own domain.</p>
            <p className="mt-4">Don't have a domain yet? Webcomic Studio gives you a subdomain for free at &lt;your-comic&gt;.webcomic.studio</p>
          </div>
          <div>
            <div className="bg-white rounded-lg px-4 py-3 ring-2 ring-purple-300 text-gray-600">
              https://myawesomecomic.com
            </div>
          </div>
        </div>
      </div>
    </section>
    <footer className="py-10 border-t border-(--border) bg-(--bg)">
      <div className="mx-auto max-w-6xl px-4 w-full text-center text-sm text-(--muted) flex flex-col gap-2">
        <div>© {new Date().getFullYear()} Webcomic Studio · Build, publish & grow your comic.</div>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/terms" className="hover:underline">Terms of Service</Link>
          <Link to="/adult-content-guidelines" className="hover:underline">Adult Content Guidelines</Link>
          <Link to="/report" className="hover:underline">Report an issue</Link>
        </div>
      </div>
    </footer>
    </>
  );
}
