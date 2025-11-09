import type { Route } from "./+types/dashboard";
import { Link, redirect } from "react-router";
import { prisma } from "../utils/db.server";
import { getAuth } from "@clerk/react-router/server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dashboard • WebComic Studio" },
    { name: "description", content: "Manage your webcomics" },
  ];
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  const comics = await prisma.comic.findMany({
    where: { userId },
    select: { id: true, title: true, thumbnail: true },
    orderBy: { createdAt: "desc" },
  });
  return { comics };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { comics } = loaderData as { comics: { id: string; title: string; thumbnail: string | null }[] };
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Your Comics</h1>
        <Link
          to="/dashboard/new"
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition"
        >
          + New Comic
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {comics.map((comic) => (
            <Link
              key={comic.id}
              to={`/dashboard/${comic.id}`}
            className="group block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 hover:shadow-lg transition bg-white dark:bg-gray-950"
          >
            <div className="relative w-full aspect-[2/3] bg-gray-100 dark:bg-gray-900">
              {comic.thumbnail ? (
                <img
                  src={comic.thumbnail}
                  alt={comic.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-gray-400 text-sm">No Cover</div>
              )}
            </div>
            <div className="p-4">
              <h2 className="font-semibold text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                {comic.title}
              </h2>
            </div>
          </Link>
        ))}
        {comics.length === 0 && (
          <div className="col-span-full text-center text-gray-500">
            No comics yet. Create your first one.
          </div>
        )}
      </div>
    </section>
  );
}
