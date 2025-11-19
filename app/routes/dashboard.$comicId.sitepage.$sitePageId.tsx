import type { Route } from "./+types/dashboard.$comicId.sitepage.$sitePageId";
import { redirect, Link, Form, useNavigation } from "react-router";
import { useState } from "react";
import { prisma } from "../utils/db.server";
import { getAuth } from "@clerk/react-router/server";
import { RichTextEditor } from "../components/RichTextEditor";

export function meta({ data }: Route.MetaArgs) {
  const title = data?.sitePage?.linkText || "Edit Site Page";
  return [
    { title: `${title} • WebComic Studio` },
  ];
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  const { comicId, sitePageId } = args.params;
  if (!comicId || !sitePageId) throw new Response("Not Found", { status: 404 });

  // Verify comic ownership
  const comic = await prisma.comic.findFirst({
    where: { id: comicId, userId },
    select: { id: true, title: true, slug: true, domain: true },
  });
  if (!comic) return redirect("/dashboard");

  // Load site page
  const sitePage = await prisma.sitePage.findFirst({
    where: { id: sitePageId, comicId },
  });
  if (!sitePage) throw new Response("Not Found", { status: 404 });

  // Determine environment for URL construction
  const isDev = process.env.NODE_ENV === 'development';
  const isStaging = process.env.NODE_ENV === 'staging';
  const baseDomain = isDev ? 'localhost:5173' : isStaging ? 'wcsstaging.com' : 'webcomic.studio';

  return { comic, sitePage, baseDomain, isDev, userId };
}

export async function action(args: Route.ActionArgs) {
  const { request, params } = args;
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  
  const { comicId, sitePageId } = params;
  if (!comicId || !sitePageId) throw new Response("Not Found", { status: 404 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  
  console.log("Intent received:", intent); // Debug log

  if (intent === "deleteSitePage") {
    // Verify ownership
    const comic = await prisma.comic.findFirst({ where: { id: comicId, userId }, select: { id: true } });
    if (!comic) return redirect("/dashboard");

    // Verify site page exists and belongs to comic
    const sitePage = await prisma.sitePage.findFirst({ where: { id: sitePageId, comicId } });
    if (!sitePage) return redirect(`/dashboard/${comicId}`);

    await prisma.sitePage.delete({
      where: { id: sitePageId },
    });

    return redirect(`/dashboard/${comicId}`);
  }

  if (intent === "updateSitePage") {
    // Verify ownership
    const comic = await prisma.comic.findFirst({ where: { id: comicId, userId }, select: { id: true } });
    if (!comic) return redirect("/dashboard");

    // Verify site page exists and belongs to comic
    const sitePage = await prisma.sitePage.findFirst({ where: { id: sitePageId, comicId } });
    if (!sitePage) return redirect(`/dashboard/${comicId}`);

    const linkText = formData.get("linkText") as string | null;
    const slug = formData.get("slug") as string | null;
    const html = formData.get("html") as string | null;
    const publishedDateStr = formData.get("publishedDate") as string | null;

    // Validate and sanitize slug
    const trimmedSlug = slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || sitePage.slug;
    if (!trimmedSlug) {
      return new Response("Invalid slug", { status: 400 });
    }

    // Check slug uniqueness per comic (exclude current page)
    const existing = await prisma.sitePage.findFirst({ 
      where: { comicId, slug: trimmedSlug, NOT: { id: sitePageId } } 
    });
    if (existing) {
      return new Response("Slug already exists for this comic", { status: 400 });
    }

    // Parse published date
    let publishedDate: Date | null = null;
    if (publishedDateStr && publishedDateStr.trim()) {
      const parsed = new Date(publishedDateStr + "T00:00:00Z");
      publishedDate = isNaN(parsed.getTime()) ? null : parsed;
    }

    // Minimum 333ms delay to prevent loading state from blinking
    const startTime = Date.now();
    
    await prisma.sitePage.update({
      where: { id: sitePageId },
      data: {
        linkText: linkText?.trim() || undefined,
        slug: trimmedSlug,
        html: html || undefined,
        publishedDate,
      },
    });

    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, 333 - elapsed);
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }

    return redirect(`/dashboard/${comicId}/sitepage/${sitePageId}`);
  }

  if (intent === "deleteSitePage") {
    // Verify ownership
    const comic = await prisma.comic.findFirst({ where: { id: comicId, userId }, select: { id: true } });
    if (!comic) return redirect("/dashboard");

    // Verify site page exists and belongs to comic
    const sitePage = await prisma.sitePage.findFirst({ where: { id: sitePageId, comicId } });
    if (!sitePage) return redirect(`/dashboard/${comicId}`);

    await prisma.sitePage.delete({
      where: { id: sitePageId },
    });

    return redirect(`/dashboard/${comicId}`);
  }

  return new Response("Bad Request", { status: 400 });
}

export default function SitePageEditor({ loaderData }: Route.ComponentProps) {
  const { comic, sitePage, baseDomain, isDev, userId } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting" && navigation.formData?.get("intent") === "updateSitePage";
  
  const [htmlContent, setHtmlContent] = useState(sitePage.html || "");
  
  const protocol = isDev ? 'http' : 'https';
  
  // Use custom domain if set, otherwise subdomain
  const baseUrl = comic.domain 
    ? `${protocol}://${comic.domain}`
    : `${protocol}://${comic.slug}.${baseDomain}`;
  
  const publishedDateValue = sitePage.publishedDate ? new Date(sitePage.publishedDate) : null;
  const publishedDateISO = publishedDateValue ? publishedDateValue.toISOString().slice(0, 10) : "";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4">
        <Link to={`/dashboard/${comic.id}`} className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">← Back to {comic.title}</Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Edit Site Page</h1>
      
      <Form method="post" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left: Main content (2/3) */}
        <div className="md:col-span-2 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Content</label>
            <input type="hidden" name="html" value={htmlContent} />
            <RichTextEditor 
              content={sitePage.html || ""} 
              onChange={setHtmlContent}
              userId={userId}
              comicId={comic.id}
              sitePageId={sitePage.id}
            />
          </div>
        </div>
        
        {/* Right: Sidebar (1/3) */}
        <div className="md:col-span-1">
          <div className="p-6 rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Link Text</label>
              <input 
                type="text" 
                name="linkText"
                defaultValue={sitePage.linkText || ""} 
                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Slug</label>
              <div className="mb-1">
                <span className="text-xs text-gray-600 dark:text-gray-400 break-all">{baseUrl}/</span>
              </div>
              <input 
                type="text" 
                name="slug"
                pattern="[a-z0-9-]+" 
                defaultValue={sitePage.slug}
                onInput={(e) => {
                  // Remove any characters that aren't lowercase letters, numbers, or hyphens
                  e.currentTarget.value = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                }}
                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" 
                required
              />
              <p className="mt-1 text-xs text-gray-500">Only lowercase letters, numbers, and hyphens allowed</p>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Published Date</label>
              <input 
                type="date" 
                name="publishedDate"
                defaultValue={publishedDateISO} 
                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" 
              />
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button 
                type="submit"
                name="intent"
                value="updateSitePage"
                disabled={isSubmitting}
                className="rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
              <Link 
                to={`/dashboard/${comic.id}`} 
                className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-center hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                name="intent"
                value="deleteSitePage"
                onClick={(e) => {
                  if (!confirm('Are you sure you want to delete this page? This action cannot be undone.')) {
                    e.preventDefault();
                    return false;
                  }
                }}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-center"
              >
                Delete Page
              </button>
            </div>
          </div>
        </div>
      </Form>
    </main>
  );
}