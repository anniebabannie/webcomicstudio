import type { Route } from "./+types/$slug";
import { Link, redirect } from "react-router";
import { useEffect } from "react";
import { extractSubdomain } from "../utils/subdomain.server";
import { prisma } from "../utils/db.server";
import { ComicHeader } from "../components/ComicHeader";
import { ComicFooter } from "../components/ComicFooter";
import "../styles/RichTextEditor.css";
import { resolveThemeName } from "../themes";

export function meta({ data }: Route.MetaArgs) {
  if (data?.sitePage && data?.comic) {
    const title = `${data.sitePage.linkText} • ${data.comic.title}`;
    const meta: any[] = [
      { title },
    ];
    if (data.comic.favicon) {
      meta.push({ tagName: "link", rel: "icon", href: data.comic.favicon });
    }
    return meta;
  }
  return [{ title: "Site Page" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { slug } = params;
  if (!slug) throw new Response("Not Found", { status: 404 });

  const host = request.headers.get("host") || "";
  const url = new URL(request.url);
  const isPreview = url.searchParams.get("preview") === "true";

  // Support custom domains in dev/prod
  const isCustomDomain = host &&
    !host.includes('localhost') &&
    !host.includes('webcomic.studio') &&
    !host.includes('wcsstaging.com');

  // Look up comic by slug (subdomain) or domain (custom domain)
  let comic: null | { 
    id: string; 
    title: string; 
    tagline: string | null;
    logo: string | null; 
    favicon: string | null;
    doubleSpread: boolean;
    theme?: string;
    chapters: { id: string; number: number; title: string; publishedDate: Date | null; pages: { id: string; number: number }[] }[];
  } = null;
  if (isCustomDomain) {
    const hostname = host.split(':')[0];
    comic = await prisma.comic.findUnique({
      where: { domain: hostname },
      select: { 
        id: true, 
        title: true, 
        tagline: true,
        logo: true, 
        favicon: true,
        doubleSpread: true,
        theme: true,
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
      },
    });
  } else {
    const sub = extractSubdomain(host);
    if (!sub) return redirect("/");
    comic = await prisma.comic.findUnique({
      where: { slug: sub },
      select: { 
        id: true, 
        title: true, 
        tagline: true,
        logo: true, 
        favicon: true,
        doubleSpread: true,
        theme: true,
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
      },
    });
  }

  if (!comic) throw new Response("Not Found", { status: 404 });

  // Find the site page by slug for this comic
  const sitePage = await prisma.sitePage.findFirst({
    where: {
      comicId: comic.id,
      slug,
      // Only show when published unless preview requested
      ...(isPreview ? {} : { publishedDate: { lte: new Date() } }),
    },
    select: { id: true, linkText: true, html: true, slug: true },
  });

  if (!sitePage) throw new Response("Not Found", { status: 404 });

  // Load all published site pages for navigation
  const sitePages = await prisma.sitePage.findMany({
    where: {
      comicId: comic.id,
      // Only show published unless preview requested
      ...(isPreview ? {} : { publishedDate: { lte: new Date() } }),
    },
    select: { linkText: true, slug: true },
    orderBy: { linkText: 'asc' },
  });

  const isDev = process.env.NODE_ENV === 'development';
  const isStaging = process.env.NODE_ENV === 'staging';
  const baseDomain = isDev ? 'localhost:5173' : isStaging ? 'wcsstaging.com' : 'webcomic.studio';

  return { comic, sitePage, sitePages, baseDomain };
}

export default function SitePagePublic({ loaderData }: Route.ComponentProps) {
  if (!loaderData) {
    throw new Response("Not Found", { status: 404 });
  }
  const { comic, sitePage, sitePages = [], baseDomain } = loaderData as { 
    comic: { 
      id: string; 
      title: string; 
      tagline?: string | null;
      logo?: string | null;
      doubleSpread?: boolean;
      theme?: string | null;
      chapters: { id: string; number: number; title: string; publishedDate: Date | null; pages: { id: string; number: number }[] }[];
    }; 
    sitePage: { linkText: string; html: string | null };
    sitePages?: { linkText: string; slug: string }[];
    baseDomain: string;
  };

  // Apply theme to document and add comic-theme class
  useEffect(() => {
    const themeName = resolveThemeName((comic as any).theme);
    document.documentElement.setAttribute('data-theme', themeName);
    document.body.classList.add('comic-theme');
    return () => {
      document.body.classList.remove('comic-theme');
    };
  }, [comic]);

  // Get preview params from URL
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const previewParams = searchParams.toString();

  return (
    <div className="min-h-screen text-[var(--text)] flex flex-col">
      <ComicHeader
        comic={comic}
        chapters={comic.chapters}
        sitePages={sitePages}
        previewParams={previewParams}
      />

      <main className="flex-1 mx-auto max-w-3xl px-4 py-8 w-full flex flex-col">
        <article className="site-page-content prose-invert prose max-w-none">
          {/* NOTE: Consider sanitizing HTML before rendering if user-generated */}
          <div dangerouslySetInnerHTML={{ __html: sitePage.html || "" }} />
        </article>
      </main>

      <ComicFooter baseDomain={baseDomain} comicId={comic.id} />
    </div>
  );
}
