import type { Route } from "./+types/dashboard.$comicId";
import { redirect, Link, Form } from "react-router";
import { prisma } from "../utils/db.server";
import { getAuth } from "@clerk/react-router/server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Comic • WebComic Studio" },
  ];
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  const { comicId } = args.params;
  if (!comicId) throw new Response("Not Found", { status: 404 });

  const comic = await prisma.comic.findFirst({
    where: { id: comicId, userId },
    select: {
      id: true,
      title: true,
      description: true,
      slug: true,
      thumbnail: true,
      createdAt: true,
      updatedAt: true,
      chapters: {
        select: {
          id: true,
          number: true,
          title: true,
          _count: { select: { pages: true } },
        },
        orderBy: { number: "asc" },
      },
      _count: { select: { pages: true } },
    },
  });

  // Get most recent page image if no thumbnail
  let recentPageImage: string | null = null;
  if (comic && !comic.thumbnail) {
    const recentPage = await prisma.page.findFirst({
      where: { comicId },
      orderBy: { createdAt: "desc" },
      select: { imageUrl: true },
    });
    recentPageImage = recentPage?.imageUrl || null;
  }

  if (!comic) throw new Response("Not Found", { status: 404 });
  return { comic, recentPageImage };
}

export async function action(args: Route.ActionArgs) {
  const { request, params } = args;
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  
  const comicId = params.comicId as string;
  
  // Verify ownership
  const comic = await prisma.comic.findFirst({ where: { id: comicId, userId }, select: { id: true } });
  if (!comic) return redirect("/dashboard");
  
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  
  if (intent === "deleteAllChapters") {
    // Prisma cascade will delete associated pages automatically
    await prisma.chapter.deleteMany({ where: { comicId } });
    return redirect(`/dashboard/${comicId}`);
  }
  
  if (intent === "deleteAllPages") {
    await prisma.page.deleteMany({ where: { comicId } });
    return redirect(`/dashboard/${comicId}`);
  }

  if (intent === "uploadThumbnail") {
    const file = formData.get("thumbnail") as File | null;
    if (!file) return new Response("File required", { status: 400 });
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) return new Response("Invalid type", { status: 400 });
    if (file.size > 2 * 1024 * 1024) return new Response("File too large", { status: 400 });
    // Dynamic import server-only modules
    const [{ convertToWebP }, { uploadBufferToS3 }] = await Promise.all([
      import("../utils/image.server"),
      import("../utils/s3.server"),
    ]);
    const buffer = Buffer.from(await file.arrayBuffer());
    const webp = await convertToWebP(buffer, 80);
    const uuid = crypto.randomUUID();
    const key = `${userId}/${comicId}/cover-${uuid}.webp`;
    const url = await uploadBufferToS3(webp, key, "image/webp");
    await prisma.comic.update({ where: { id: comicId }, data: { thumbnail: url } });
    return redirect(`/dashboard/${comicId}`);
  }
  
  return new Response("Unknown intent", { status: 400 });
}

export default function ComicDetail({ loaderData }: Route.ComponentProps) {
  const { comic, recentPageImage } = loaderData as {
    comic: {
      id: string;
      title: string;
      description: string | null;
      slug: string;
      thumbnail: string | null;
      createdAt: Date;
      updatedAt: Date;
      chapters: { id: string; number: number; title: string; _count: { pages: number } }[];
      _count: { pages: number };
    };
    recentPageImage: string | null;
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{comic.title}</h1>
        <Link
          to={`/dashboard/${comic.id}/update`}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition"
        >
          Add Pages
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="md:col-span-1">
          <div className="relative w-full aspect-[2/3] rounded border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 overflow-hidden">
            {comic.thumbnail ? (
              <img src={comic.thumbnail} alt={comic.title} className="h-full w-full object-cover" />
            ) : recentPageImage ? (
              <img src={recentPageImage} alt={comic.title + " (latest page)"} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-gray-400">No Cover</div>
            )}
          </div>
        </div>
        <aside className="space-y-4 md:col-span-1">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Subdomain</h2>
            <p className="mt-1 break-all">{comic.slug}.webcomic.studio</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Description</h2>
            <p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {comic.description || "—"}
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Chapters</h2>
            {comic.chapters.length > 0 ? (
              <>
                <ul className="mt-2 space-y-1 text-sm">
                  {comic.chapters.map(ch => (
                    <li key={ch.id}>
                      <Link 
                        to={`/dashboard/${comic.id}/${ch.id}`}
                        className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        Chapter {ch.number}: {ch.title} ({ch._count.pages} page{ch._count.pages !== 1 ? 's' : ''})
                      </Link>
                    </li>
                  ))}
                </ul>
                <Form method="post" className="mt-2">
                  <input type="hidden" name="intent" value="deleteAllChapters" />
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete All Chapters
                  </button>
                </Form>
              </>
            ) : (
              <p className="mt-1 text-gray-500 text-sm">No chapters</p>
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Pages</h2>
            {comic._count.pages > 0 ? (
              <>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {comic._count.pages} page{comic._count.pages !== 1 ? 's' : ''}
                </p>
                <Form method="post" className="mt-2">
                  <input type="hidden" name="intent" value="deleteAllPages" />
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete All Pages
                  </button>
                </Form>
              </>
            ) : (
              <p className="mt-1 text-gray-500 text-sm">No pages</p>
            )}
          </div>
          <div className="text-sm text-gray-500">
            <p>Created: {comic.createdAt.toLocaleString()}</p>
            <p>Updated: {comic.updatedAt.toLocaleString()}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Cover Image</h2>
            <Form method="post" encType="multipart/form-data" className="mt-2 space-y-2" onSubmit={e => {
              const input = e.currentTarget.elements.namedItem("thumbnail") as HTMLInputElement | null;
              if (input?.files?.[0]) {
                const file = input.files[0];
                const valid = ["image/jpeg", "image/png", "image/webp"];
                if (!valid.includes(file.type)) { e.preventDefault(); alert("Only JPEG, PNG, or WebP."); return; }
                if (file.size > 2*1024*1024) { e.preventDefault(); alert("Max 2MB file."); return; }
              }
            }}>
              <input type="hidden" name="intent" value="uploadThumbnail" />
              <input
                type="file"
                name="thumbnail"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 text-xs"
                required={!comic.thumbnail}
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition"
              >
                {comic.thumbnail ? "Update Cover" : "Add Cover"}
              </button>
            </Form>
          </div>
        </aside>
      </div>
    </main>
  );
}
