import type { Route } from "./+types/dashboard.$comicId";
import { redirect, Link } from "react-router";
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
    },
  });

  if (!comic) throw new Response("Not Found", { status: 404 });
  return { comic };
}

export default function ComicDetail({ loaderData }: Route.ComponentProps) {
  const { comic } = loaderData as {
    comic: {
      id: string;
      title: string;
      description: string | null;
      slug: string;
      thumbnail: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
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
          <div className="text-sm text-gray-500">
            <p>Created: {comic.createdAt.toLocaleString()}</p>
            <p>Updated: {comic.updatedAt.toLocaleString()}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
