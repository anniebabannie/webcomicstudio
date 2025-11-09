import type { Route } from "./+types/dashboard.new";
import { Form, Link, redirect } from "react-router";
import { prisma } from "../utils/db.server";
import { getAuth, clerkClient } from "@clerk/react-router/server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Create New Comic • WebComic Studio" },
    { name: "description", content: "Create a new webcomic" },
  ];
}

export default function NewComic() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold tracking-tight mb-8">Create New Comic</h1>

      <Form method="post" className="space-y-6">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium mb-2"
          >
            Comic Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            placeholder="Enter your comic's title"
            className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
          />
        </div>

        <div>
          <label
            htmlFor="slug"
            className="block text-sm font-medium mb-2"
          >
            Subdomain
          </label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              id="slug"
              name="slug"
              required
              pattern="[a-z0-9-]+"
              placeholder="my-awesome-comic"
              className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            />
            <span className="text-sm text-gray-500 whitespace-nowrap">.webcomic.studio</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Lowercase letters, numbers, and hyphens only
          </p>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium mb-2"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            placeholder="Tell readers what your comic is about..."
            className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition resize-none"
          />
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition"
          >
            Create Comic
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-medium bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 transition"
          >
            Cancel
          </Link>
        </div>
      </Form>
    </section>
  );
}

export async function action(args: Route.ActionArgs) {
  // Require authentication
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  const uid = userId as string;

  const formData = await args.request.formData();
  const title = String(formData.get("title") || "").trim();
  const slugRaw = String(formData.get("slug") || "").trim();
  const slug = slugRaw.toLowerCase();
  const description = String(formData.get("description") || "").trim() || null;

  // Basic validation
  const slugOk = /^[a-z0-9-]+$/.test(slug);
  if (!title || !slug || !slugOk) {
    return new Response("Invalid form data", { status: 400 });
  }

  try {
    // Ensure a corresponding User row exists for FK
    // Fetch email from Clerk and upsert into our DB
    const client = clerkClient(args);
    const clerkUser = await client.users.getUser(uid);
    const email =
      clerkUser?.primaryEmailAddress?.emailAddress ||
      clerkUser?.emailAddresses?.[0]?.emailAddress ||
      `${uid}@users.clerk.local`;

    await prisma.user.upsert({
      where: { id: uid },
      update: { email },
      create: { id: uid, email },
    });

    await prisma.comic.create({
      data: {
        title,
        slug,
        description,
        userId: uid,
      },
    });
  } catch (e: any) {
    // Unique constraint on slug
    if (e?.code === "P2002") {
      return new Response("Subdomain already in use", { status: 400 });
    }
    throw e;
  }

  return redirect("/dashboard");
}
