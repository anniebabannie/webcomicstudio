import type { Route } from "./+types/home";
import { SignedOut, SignInButton, SignUpButton } from '@clerk/react-router';
import { Link, redirect } from 'react-router';
import { extractSubdomain } from '../utils/subdomain.server';
import { prisma } from '../utils/db.server';
import { NavBar } from '../components/NavBar';

export function meta({ data }: Route.MetaArgs) {
  if (data?.comic) {
    return [
      { title: `${data.comic.title} • Webcomic` },
      { name: "description", content: data.comic.description || `Read ${data.comic.title}` },
    ];
  }
  return [
    { title: "WebComic Studio" },
    { name: "description", content: "Publish your webcomic in minutes" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const host = request.headers.get("host");
  console.log("Host header:", host);
  const subdomain = extractSubdomain(host);

  if (subdomain) {
    // Look up comic by slug
    const comic = await prisma.comic.findUnique({
      where: { slug: subdomain },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnail: true,
        chapters: {
          select: {
            id: true,
            number: true,
            title: true,
            pages: {
              select: {
                id: true,
                number: true,
              },
              orderBy: { number: 'asc' },
              take: 1,
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

    if (!comic) {
      throw new Response("Comic not found", { status: 404 });
    }

    console.log("Loaded comic for subdomain:", comic);
    return { type: 'comic' as const, comic };
  }

  // Root domain - show marketing page
  return { type: 'admin' as const };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  // If this is a comic subdomain, show public comic homepage
  if (loaderData.type === 'comic') {
    const { comic } = loaderData;
    
    // Determine the first page URL
    let firstPageUrl: string | null = null;
    if (comic.chapters.length > 0 && comic.chapters[0].pages.length > 0) {
      // First page of first chapter
      const firstChapter = comic.chapters[0];
      const firstPage = firstChapter.pages[0];
      firstPageUrl = `/${firstChapter.id}/${firstPage.number}`;
    } else if (comic.pages.length > 0) {
      // First standalone page (no chapter)
      const firstPage = comic.pages[0];
      firstPageUrl = `/page/${firstPage.number}`;
    }
    
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header */}
        <header className="bg-gray-950 border-b border-gray-800 px-4 py-3">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-lg font-semibold text-white">{comic.title}</h1>
          </div>
        </header>

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
                  <span className="opacity-0 group-hover:opacity-100 bg-white/90 dark:bg-gray-900/90 px-6 py-3 rounded-lg text-base font-semibold transition shadow-xl">
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
              <div className="relative h-[90vh] aspect-[2/3] max-w-full rounded-lg border border-gray-700 bg-gray-900 flex items-center justify-center">
                <h2 className="px-6 text-center text-2xl sm:text-3xl md:text-4xl font-bold text-gray-100">
                  {comic.title}
                </h2>
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition">
                  <span className="opacity-0 group-hover:opacity-100 bg-white/90 dark:bg-gray-900/90 px-6 py-3 rounded-lg text-base font-semibold transition shadow-xl">
                    Start Reading →
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="relative h-[90vh] aspect-[2/3] max-w-full rounded-lg border border-gray-700 bg-gray-900 flex items-center justify-center">
              <h2 className="px-6 text-center text-2xl sm:text-3xl md:text-4xl font-bold text-gray-100">
                {comic.title}
              </h2>
            </div>
          )}
        </main>

        {/* Footer navigation */}
        <footer className="bg-gray-950 border-t border-gray-800 px-4 py-3">
          <div className="mx-auto max-w-7xl flex items-center justify-center">
            {firstPageUrl && (
              <Link
                to={firstPageUrl}
                className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition"
              >
                Start Reading →
              </Link>
            )}
          </div>
        </footer>
      </div>
    );
  }

  // Marketing homepage for root domain
  return(
    <>
      <NavBar />
      <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
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
            <div className="aspect-[4/3] rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-indigo-50 to-pink-50 dark:from-indigo-950 dark:to-pink-950 p-4">
              <div className="h-full w-full rounded-lg bg-white/70 dark:bg-gray-950/70 border border-gray-200/60 dark:border-gray-800/60 grid place-items-center text-center">
                <div>
                  <p className="text-sm uppercase tracking-widest text-gray-500">Preview</p>
                  <p className="mt-1 font-medium text-gray-700 dark:text-gray-200">Your webcomic homepage & chapter list</p>
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
